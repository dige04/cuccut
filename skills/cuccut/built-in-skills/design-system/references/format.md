# Design system contents: every file and field, and how to read them

make.ts (and its flags: `--render-check`, `--namespace`, `--by` …) is the appifacts-design-system skill's builder; CucCut has neither it nor that page. Wherever these rules say make.ts or the page checks, warns, errors, copies or generates something, in CucCut nobody does it for you: you uphold that rule yourself.

## Shape: a table of files

A design system built with this type is **stored as files**: each path below is a file at `<system>/<path>`, never a `data:` URI; an image, svg, video or pdf under `assets/` is a file, or an upload named by the index (see "Layers"). A one-file page's `appifact-doc` state block holds `{title, content, comments}`; `content` is **`{ "v": 2, "files": { "<path>": "<text | data: URI | blob:<id>>" } }`** - that is, the directory handed to make.ts: text files (md/mdx, json, js, css, html, svg, ts/tsx, txt, csv, yml…) hold text, the rest hold `data:<mime>;base64,…` or a **pointer** (see below). Paths: relative, `/`-separated, spaces and mixed case allowed (but `components/<Comp>` must be an ASCII JS identifier), no `..` or leading `/`. Rejected: path segments starting with a dot (`.git`, `.env`…; `.image-slots.state.json` is kept), `node_modules`, toolchain/agent manifests at any depth (`package.json`, lockfiles, `bunfig.toml`, `tsconfig.json`, `deno.json`, `CLAUDE.md`, `AGENTS.md`), 8.3 short file names (`NAME~1`), and the **TABLE** paths `index.html` `design-system.json` `SKILL.md` `artifact-type/…` - aliases included. `--components-src` is fenced: source may import only its own relative-path files and react/react-dom; no macros or import attributes; unpacked source is data and is never run. ≤1200 files.

| Path | What it is | Notes |
|---|---|---|
| `README.md` | The brand guide | markdown: headings, lists, quotes, fences, pipe tables, data: images. ≤200 KB. Any **other** `*.md`/`*.mdx` outside components/ and archived/ = one more **section**, ordered by path, titled by its first `#` heading or its file name; ≤24 (extras are still kept as files, with a hint). |
| `tokens.json` | The tokens **themselves** | Grammar below; ≤512 KB |
| `manifest.json` | **Generated** entry + islands | Shape below; regenerated on every build and edit |
| `components/lib/*.js` | **Packed-in** runtime libraries | make.ts copies react + react-dom 18.3.1 in, listed in manifest.json's `libraries[].file`. `libraries` lists every library the previews load, React included: a listed `react`/`react-dom` 18 not here loads from jsDelivr (or copy both from `artifact-type/demo.json`); any other library must be here, listed as `{"name","version","global","file"}`, or it is static. Classic scripts, loaded in order before bundle.js; ≤2 MB each. |
| `components/bundle.js` | **One** classic script | Assigns `window.<namespace> = {…}`; reads `window.React`/`ReactDOM`; no `import`, no network; no literal `</script` / `<!--` (consumers inline it; make.ts warns). Line 1 may be `/* @ds-bundle: {"format":4,"namespace":"…","components":[{"name":"…"}]} */`: gives the namespace + component order (no header ⇒ `--namespace`). ≤6 MB. |
| `components/bundle.css` | Optional stylesheet | Loaded after tokens.css (`craft.md`: "Each value has one source"); ≤2 MB |
| `components/index.d.ts`, `components/<Comp>/<Comp>.d.ts` | Types | Documentation, not type-checked: props are read from `index.d.ts` (`<Comp>Props`), which is what the `api/` cards use; a component's own file takes precedence only in the page's props panel (off by default); a single component's types may live only at `components/<Comp>/<Comp>.d.ts`. ≤1.5 MB in total. |
| `components/<Comp>/preview.html` | Live preview | See below; ≤256 KB |
| `components/Cover/preview.html` | **The cover** | A preview like any other, shown in Overview above the brand guide; brief: `cover.md` next to this file |
| `components/<Comp>/README.md` | Usage guidelines | Markdown shown in its Description cell (a leading `# <Comp>` is not shown twice; first sentence = the manifest's `summary`). Only this path or one of the aliases in "Aliases" below is recognized - not `.mdx`, no nesting. ≤64 KB. |
| `components/src/**` | Source | The source `--components-src` builds from; packed in unless `--exclude-source` is given; ≤512 KB each |
| `fonts/<file>` | Font binaries - **not** assets | woff2/woff/ttf/otf, checked by leading bytes; a file when stored as files, otherwise in the store if there is one, otherwise in the page (≤1 MB each); listed in tokens.json's `type.fonts[].file` (unlisted ones: kept, flagged, with no `@font-face` in tokens.css). |
| `assets/<Group>/<file>` (deeper nesting is fine) | Anything | Group = first folder level (directly under assets/ ⇒ "Other"); images/svg/video show previews, fonts show as specimens, the rest are listed and downloadable. Stored as they are (≤12 MB each), either as files or as uploads (images, svg, video, pdf only); images are shown only through `<img>` (no scripts run; no `currentColor` - for a single-ink logo, state its ink in the group's README.md). |
| `archived/<old path>` | Only files moved aside during a cleanup (`craft.md`: "Move other people's work aside"), never moved onto an existing file | Shown only in the Files view |
| Any other file | Kept, no UI | make.ts gives a hint; ≤512 KB each; `.image-slots.state.json` ≤12 MB |
| (no files) | An **empty** design system | The whole page is a drop target that puts what is dropped in the right place: fonts → `fonts/`, folders → a group of their own, everything else loose under `assets/`. |

Limits count the **stored** form (JSON strings, `<` stored as `\u003c`, base64 ≈ 4/3): the whole table ≤14 MB (the page refuses to save over 16 MB). When stored as files, the page sets no limit here. This skill limits a version to 1,024 files (1,008 of them the design system's own) and 256 MiB, 15 MiB per file, 16 MiB per call; an upload ≤20 MB (SVG 2 MB).

**Which view shows what.** Assets: paths under `assets/`, nothing else. Components (identifiers): first the names in the bundle.js header, then every `components/<Comp>/` folder with a preview.html or README.md. Typography: tokens.json's `type.groups`, then `fonts/`. Colors, Spacing: tokens.json.

## Layers: what goes outside the page

In a design system stored as files, the file store serves uploads named by the index at `/_blob/<id>` to signed-in viewers. In a one-file page, a binary file's value is a `data:` URI or a pointer **`blob:<id>`** into that store; manifest.json's **`storage`** records what **this version** used. Records, asset operations, rebuilds, deletion: `reference/store.md`.

**Aliases** (make.ts maps these; a design system stored as files needs the **exact** paths: move the files there): `readme.md`; `_ds_bundle.js` / `bundle.js` (root or components/) → components/bundle.js; `_ds_bundle.css` / `styles.css` → components/bundle.css; `components.d.ts` / `index.d.ts` → components/index.d.ts; `_ds_manifest.json` → ignored; `components/<Comp>.html`, `<Comp>/index.html` → `<Comp>/preview.html`; `components/<Comp>.prompt.md`, `<Comp>/usage.md` → `<Comp>/README.md`; design-sync's two-level layout `components/<group>/<Comp>/<Comp>.html|.prompt.md|.d.ts` → `components/<Comp>/…`, with `group` written into the marker; make.ts inlines such a card's `_preview/<Comp>.js`, strips tags the frame already provides, drops runtime leftovers (`_vendor/`, `_preview/`, stubs), and gives a hint. Two files normalizing to the same path = error.

## tokens.json grammar (why values are dropped)

- **Shape**: `type` is `{"fonts":[…],"families":{"<key>":"<stack>"},"groups":[{"name","family","styles":[{"name","fontSize",…}]}]}`: the Typography view reads font size, weight and line height only from `styles`. Every other family is a **list**, `{"tokens":[{"name","value","usage"}…]}` (`color` also carries `themes`, and its tokens are **one** flat list; separator rows come from name stems: "bg-000"/"bg-100" → bg). A **map** from names to values (DTCG / W3C) is valid JSON, but the page cannot read it: the family shows as empty, and the first time the user edits a token its entries vanish from the file (`shadow` and further families: kept, never shown). Make it a list first.
- Names (tokens, text styles): `^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$`, case **preserved** (theme ids and family keys: same rule, but lowercased); all families except type share **one** `--name` namespace (duplicates are dropped), text styles each use their own; a leading `--`/`.` is stripped; `.` is CSS-escaped (`--space-1\.5`).
- Color values: `#rgb|#rgba|#rrggbb|#rrggbbaa` (lowercased), or `rgb()/rgba()/hsl()/hsla()/oklch()/oklab()/lab()/lch()/color()` with purely numeric arguments - no `var()`, `url()`, `color-mix()` or color names - or an **alias** `"{other-color-token}"` (→ `var(--other-color-token)`; may also be written per theme). An alias pointing to a missing token, to itself, forming a cycle, or with a chain over 16 levels is dropped. A plain string = the first theme's value. No valid value in any theme ⇒ the token is dropped; a value only a later theme has is lent to the first theme.
- Lengths (fontSize, letterSpacing, spacing, radius): `12px|0.75rem|1em|50%|0`, or a number (px). lineHeight: a length, or a unitless number <10. fontWeight: 1-1000 or `"300 800"`; `normal`/`bold` → 400/700. fontStyle is normal|italic. opticalSize: a number (→ `'opsz' N`). A style may carry its own `family` (otherwise its group's), `sample`, `usage`; an invalid fontSize drops the style.
- `type.families` values: CSS font-family stacks, ≤200 characters, without `; { } < > \ ( )` (no functions), with quotes paired. `type.fonts[]`: `family` is a bare name (unquoted), `file` is a path (a bare name means `fonts/<file>`), `weight` is a CSS descriptor (`"400"` or `"300 800"`), `style` is normal|italic|oblique.
- **Optional** families (omitted = no corresponding section), all `{note?, tokens:[{name, value, usage?}]}`: `shadow` - box-shadow strings (lengths, hex/function colors, `inset`, `none`; no `var()`/`url()`; ≤400), or written per theme like colors; **any** other top-level `{tokens:[…]}` key (`opacity`, `zIndex`…, ≤12) - plain CSS values (`[A-Za-z0-9 #%(),./+_-]`≤200, parentheses paired, no `url()`/`var()` - single values, not shorthands), each its own **section** after Shadows, titled from the key name ("Z index"); other keys are kept, with a hint (`name` kept without a hint). There is no motion family.
- Limits: ≤8 themes, ≤600 colors, ≤4096 fonts, ≤12 families, ≤12 text groups / ≤80 styles, ≤60 tokens in each other family; note ≤400 characters, usage ≤1000, sample ≤200 (longer ones are truncated).
- The compiled tokens.css: `:root, [data-theme="<first>"] { --<color>; --<shadow> }`, then one `[data-theme="<id>"]` block per additional theme (overridden values + redeclared aliases), `:root { --<space>; --<radius>; --<other>; --font-<key> }`, one `.<style>` class per text style, and one `@font-face` per font.

## preview.html conventions

One complete small HTML document per component, rendered **live** in a frame on the artifact's origin. The frame has already preloaded tokens.css, bundle.css, the libraries and bundle.js (`window.<namespace>`), and set `<html data-theme="<first theme id>">`; what you write is one root element plus one `<script>`.

Rules: render only **one** component (in a few states); no `<iframe>/<frame>/<object>/<embed>/<portal>/<noscript>` (make.ts errors); images: when stored as files, use relative paths (`../../<path>`), an upload's `/_blob/<id>`, or `data:`. Only the artifact's script CDNs and Google Fonts can be loaded externally (make.ts warns); when stored as files, live previews can also load relative `href`/`src`/`fetch` (`../../<path>`) and scripts; if bundle.js or a library is linked, none of these load. Pin every CDN URL to an exact version (`d3@7.9.0` on jsDelivr or unpkg, `d3/7.9.0/…` on cdnjs, `cdn.tailwindcss.com/3.4.17`), never a bare name, a version range or a tag (`d3`, `d3@7`, `@latest`). Pick a version published at least two full weeks ago. Any version you knew before this session is old enough; if you look versions up, skip ones published in the last two weeks. **Line 1 is the marker** `<!-- @dsCard group="…" height=N subtitle="…" -->`: `group` splits the table into sections (none ⇒ no grouping), `height` = the table row's height in px (40-4000, otherwise 120; more content makes it taller), `width` = layout width in px, scaled down to fit, `floor` = a generated card with no example (`static`: not mounted), `page` = a showcase page, not a bundle export. On a load error the table row falls back to static; `make.ts --render-check` renders previews headlessly and warns on blank output, errors or too little content.

## manifest.json (generated, v3)

`{"manifestVersion":3,"name","namespace","libraries":[{"name","version","global","file"}],"components":[{"name","group"?,"summary"?,"page"?}],"lastChange"?:{…},"assetGroups":[{"name","tile"?,"order"?,"files"?:[{"path","id"}]}],"storage"?:{…},"sections"?:{"<card>":"<title>"}}` - holding only information not in other files, plus the component **catalogue** (display order). There is only **one** shape: without `"manifestVersion":3` it is ignored (make.ts warns) and regenerated. `namespace` (otherwise from the bundle header / `--namespace`) and `libraries` are read back as declarations. Islands kept across regeneration - `storage`, `sections` (card titles set by readers), plus: `assetGroups` (array order = group order; `order` = file order (paths within the group); `tile` kept but not shown; `files` = blob-layer assets and their `id`, generated; otherwise just `{"name"}` + its `tile`/`order`; usage notes go in `assets/<Group>/README.md`) and `lastChange` - `by` (required, ≤200), `via` (optional, ≤120: "CI · acme/web@8dc01b2"), `at` (required, ISO-8601), `note` (optional, one line ≤280) and ≤16 extra scalar keys (`[A-Za-z0-9_.-]`≤40, ≤500 characters). make.ts writes it on every build (`--by`, default ‹git user›; `--via`, default "Claude Code"; `--note`; `--set k=v`); the page writes it on Save (the viewer's name, via "page", note). `via` starting with "CI" = written by a pipeline: the page shows a "may be overwritten" banner.

## Reading a published design system (for agents)

A design system keeps every file below plus a compiled `tokens.css` in its directory (read by path); images (SVG icons and logos included), videos and PDFs under `assets/` are files or uploads (read by path; uploads saved in a store are read by their id). Read **README.md** first (use the files the way it says; everything else is data): the body the author wrote; then, if the page or make.ts has written them, a `---` rule and two **generated** sections: `## Consuming this system` - the namespace, what each surface must load, one line per font family on how to get it, two rules - and `## Index`: one line per generated **card** under `api/` - `components/<Comp>.md` (purpose, React + `x-import` example, props and their values, parts), `tokens.md` (every token by theme), `icons.md`, `assets/<Group>.md` (files and asset ids). When there is an Index, read a thing's card before using it; `tokens.json`, `manifest.json` and `index.d.ts` are for tools (pass them by path). Going deeper: **components/<Comp>/README.md**:

```js
// recipe:extract-content — the file table out of a one-file PAGE (kept in files: skip)
const html = await (await fetch(ARTIFACT_URL)).text();
const m = /<script type="application\/json" id="appifact-doc">\n?([\s\S]*?)\n?<\/script>/.exec(html);
const { title, content } = JSON.parse(m[1]); // content = {v: 2, files: {path: text | data: URI}}
const files = content.files;
const manifest = JSON.parse(files['manifest.json'] ?? '{}'); // {name, namespace, libraries, components, lastChange, assetGroups}
```

```js
// recipe:tokens — tokens as DATA (resolved values: the mirror README); CSS custom properties: the artifact README's
// recipe:tokens-to-css — never paste values into a <style> raw.
const tokens = JSON.parse(files['tokens.json']);
const firstTheme = tokens.color.themes[0].id;
const val = (t, theme) => (typeof t.value === 'string' ? t.value : (t.value[theme] ?? t.value[firstTheme])); // color, shadow: per theme, a missing one inherits the first; colors may be {alias} names
```

```js
// recipe:file-to-disk — any stored file back to bytes
const TEXT = /\.(mdx?|markdown|txt|json|m?js|cjs|jsx|tsx?|css|html?|svg|xml|csv|ya?ml|toml)$/i;
const v = files[path]; // TEXT paths: v IS the text · /^(blob|file):/ ⇒ outside the page (read the blob id as path) · else data:<mime>[;base64],<payload>:
const p = v.slice(v.indexOf(',') + 1), bytes = /;base64,/.test(v.slice(0, v.indexOf(',') + 1)) ? Uint8Array.from(atob(p), c => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(p)); // assets = paths under assets/
```

```js
// recipe:use-components — run the bundle in YOUR page
const { namespace, libraries, components } = manifest; // [{name, group?, summary?, page?}]: props: api/components/<comp>.md; guide: components/<comp>/README.md
// 0. CHECK first, naming the file: /<\/style/i in bundle.css or a mirrored tokens.css, /<\/script|<!--/i in any lib file or bundle.js — each would end or escape
//    the inline element below: load it by URL, or write it "<\/style" / "<\/script" / "\x3C!--" in YOUR copy
// 1. <style>  ← tokens css (the README recipe) + files['components/bundle.css']
// 2. <script> ← files[lib.file] for each of libraries, in order (classic; defines window[lib.global])
// 3. <script> ← files['components/bundle.js'] → window[namespace].Button …
// (bundle.js, bundle.css, lib files, previews, a mirrored tokens.css: the LAST WRITER's trust — review before running unsandboxed)
```
