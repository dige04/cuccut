# Caption style model: compose by dimension, presets only supply values

Status: proposal, prototype first (2026-10-09). This document defines the **target contract** `cuccut.caption-style/1` for v3 caption styles and maps each of its keys to the Studio style already on disk and to the render kernel. The prototype follows this document. Electron / Web and kernel changes wait until the user confirms the prototype ([development workflow §3](../../development-workflow.md#3-multi-surface-sync)). The normative entry point is [video format spec §5.6](../../spec/video-format-spec.md#56-layoutprofile-styles-and-export).

## Contents

1. [Goals and conclusion](#1-goals-and-conclusion)
2. [Current state: five notations in one style](#2-current-state-five-notations-in-one-style)
3. [Model: seven dimensions](#3-model-seven-dimensions)
4. [Active word (activeWord): the highlight each style carries](#4-active-word-activeword-the-highlight-each-style-carries)
5. [KTV mode](#5-ktv-mode)
6. [Reverse-duck: `layout.mode = 'sequence'`](#6-daoyazi-倒鸭子-layoutmode--sequence)
7. [Presets and categories](#7-presets-and-categories)
8. [Compiling to the kernel: new caption body to Studio style](#8-compiling-to-the-kernel-new-body--studio-style)
9. [Interface: gallery and properties page](#9-interface-gallery-and-property-page)
10. [Rollout order and verification](#10-landing-order-and-verification)
11. [Differences from existing spec and prototype](#11-differences-from-the-existing-spec-and-prototype)

## 1. Goals and conclusion

A caption style is no longer a single “card”. It is seven independent dimensions, each taking one value: **typography, surface, layout, active word, motion, emphasis, and layout mode**. Presets in the gallery are just default values across these seven dimensions; when a user replaces any one dimension, the others stay put. So 20 surfaces × 8 active-word modes × 10 entrance effects yields thousands of caption looks without adding more cards to the gallery.

Three hard rules:

- **Every preset must carry its own active-word style** (`activeWord`). A yellow pill with a yellow active word is no active word at all, so the active-word colour cannot fall back to a global default. Tracks without per-word timing (translations, imported subtitles) always use `none` for the active word.
- **KTV is one mode of the active word** (`activeWord.mode = 'sweep'`): as playback reaches a word, its colour sweeps from the base colour to another colour. It is not a “karaoke preset”; any surface can use it.
- **Reverse-duck (倒鸭子) is a layout mode** (`layout.mode = 'sequence'`), not a per-word animation. It takes over layout, camera and colour for the whole source-language track; its settings sit under `layout.sequence`, and most surface and placement keys do not apply to it.

The render kernel **does not change**. `cuccut.caption-style/1` is compiled by a layer of pure functions into the Studio style the kernel reads today (§8). The three surfaces (prototype, Electron, Web) and export all go through the same compilation, so gallery thumbnails, canvas preview and the final render look the same.

## 2. Current state: five notations in one style

v3 currently persists the v2 Studio style (`cuccut.legacy-studio-style/0.1`), a flat table. The same thing, “how the spoken word looks”, is written in five different ways in it, each unaware of the others:

| Notation | Key | Read by | Notes |
| --- | --- | --- | --- |
| Per-word animation catalog | `wordAnimation` / `anim` (19 cells, `catalogId`) | kernel `word_animation()`, gallery thumbnails | highlight style, entry action and colour folded into one cell; the `karaoke` cell actually means “unspoken words dim” |
| Text motion | `textMotion {in, out, loop, emphasis, karaoke}` | kernel `crates/motion` | `emphasis` is the current word changing colour and scaling up; `karaoke` is the real KTV colour sweep |
| Per-word box | `wordBackground {color, activeColor, …}` | kernel `LineStyle` | the current word's box changes colour; unrelated to the two rows above |
| Emphasis word | `captionEmphasis {<wordId>: {role, color, emoji}}` | kernel; applies only to the animated caption recipe | hero words the user picks by hand |
| Spec draft | `CaptionStyle.highlight {mode: 'word' \| 'none', color}` | none | not persisted |

Consequence: the real editor's presets write only “paint” keys, so applying a card drops the animation entirely (`packages/ui/src/model/caption-presets.ts`, `PAINT_KEYS`). When the `wordAnimation` key is absent the kernel draws `Color` + `#8CAAFF`; when the key is present but unnamed it draws `None`. Reverse-duck exists in the prototype but cannot be reached in the editor.

## 3. Model: seven dimensions

```ts
// Target contract. Notation follows the spec's DTO outline; it does not represent a generated schema.
interface CaptionStyleBody {
  schema: 'cuccut.caption-style/1';
  typography: Typography;
  surface: Surface;
  layout: Layout;
  activeWord: ActiveWord;          // §4, required; tracks without word timing write { mode: 'none' }
  motion?: Motion;                 // omitted = static
  emphasis?: EmphasisLook;         // look of emphasis words; which words are emphasis words is recorded on the instance
  preset?: { id: string; revision: number };   // source card; used only for selected state and “restore”, not part of rendering
}
```

All lengths are **ratios**, not pixels: font size is a ratio of the canvas short side, and everything else is a ratio of the font size (em). The same style has the same shape on a 13 px thumbnail and a 1080p final render.

### 3.1 Typography `typography`

```ts
interface Typography {
  fontFamily: string;              // family name; weight is given separately, not baked into the family name
  fontWeight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  italic: boolean;
  size: number;                    // ratio of canvas short side, e.g. 0.055
  lineHeight: number;              // line-height multiplier
  letterSpacing: number;           // em, may be negative
  casing: 'none' | 'upper' | 'lower' | 'title';
  align: 'left' | 'center' | 'right';
}
```

### 3.2 Surface `surface`

```ts
interface Surface {
  color: string;                                            // text colour, CSS colour
  stroke?: { color: string; width: number };                // width in em
  shadow?: { color: string; offset: [number, number]; blur: number };   // em
  glow?: { color: string; intensity: number; range: number };
  plate?: { mode: 'line' | 'block'; color: string; opacity: number;
            padding: [number, number]; radius: number };    // backdrop, em
  wordBox?: { color: string; padding: [number, number]; radius: number };   // per-word box, em
}
```

`plate` is the whole caption's backdrop (`line` sits behind each line, `block` is one block for the whole caption), and `wordBox` is a box per word. Both may coexist, but presets should not supply both. The active word's colour on its box is written in `activeWord.box`, not here.

### 3.3 Layout `layout`

```ts
interface Layout {
  mode: 'line' | 'sequence';       // 'sequence' see §6
  anchor: 'top' | 'center' | 'bottom';
  y: number;                       // anchor's distance from the canvas top edge, as a ratio (0–1)
  width: number;                   // line width as a ratio of canvas width
  maxLines: 1 | 2 | 3;
  sequence?: SequenceOptions;      // valid when mode = 'sequence'
}
```

The Shorts-style “large text pinned to the bottom of the safe frame at 72%” is placement, not surface. When copying the same surface onto a translation track, placement must account for how many tracks are on screen together.

### 3.4 Active word `activeWord`

See §4.

### 3.5 Motion `motion`

```ts
interface Motion {
  in?: Effect;
  out?: Effect;
  loop?: Effect;
}
interface Effect {
  preset: string;                  // in: typewriter fade-up rise cascade pop blur-in slide-mask wave-in
                                   //     drop-in float-in-top float-in-bottom scale-in impact flip stomp stack
                                   // out: fade-down sink pop-out blur-out typewriter-erase
                                   // loop: pulse wave shimmer swing
  unit: 'cue' | 'line' | 'word' | 'grapheme';
  trigger: 'enter' | 'spoken';     // enter: captions enter one after another by stagger as they appear; spoken: each word enters when it is spoken
  durationSeconds: number;
  staggerSeconds?: number;         // valid when trigger = 'enter'
  intensity: number;               // 0–2
  easing: 'linear' | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad' | 'overshoot';
  order?: 'forward' | 'backward' | 'center' | 'random';
  seed?: number;
}
```

`trigger: 'spoken'` is the real form of the `dropIn` / `floatInBottom` / `scaleIn` / `impactPop` / `flipClock` / `stomp` / `stack` cells in the per-word animation catalog. Each one performs an entry action when its word is spoken, which is orthogonal to how the active word is highlighted. The catalog folded “drop in when spoken” and “current word turns yellow” into one cell. Here they are split, so “drop-in + box highlight” and “flip + sweep” can be combined.

### 3.6 Emphasis `emphasis`

```ts
interface EmphasisLook {
  color?: string;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  scale: number;                   // 0.8–1.6
}
```

Which words are emphasis words is **instance data** (`captionEmphasis`, keyed by word ID, roles `emphasis` / `hero`, video format spec §3.8), not style. The style only says what emphasis words look like. Reverse-duck's “hero words” use the same data.

### 3.7 Layout mode `layout.mode`

`line` is a normal caption: one sentence per line, placed by the placement settings. `sequence` is reverse-duck (§6). If the future “animated caption” recipes (`caption-*`, 16 styles, pulled from the prototype in round 74) return, they also belong on this dimension (`mode: 'recipe'`) without introducing a separate key set.

## 4. Active word (activeWord): the highlight each style carries

```ts
interface ActiveWord {
  mode: 'none' | 'color' | 'box' | 'scale' | 'lift' | 'underline' | 'sweep';
  color?: string;                  // target colour for color / underline / sweep; text colour for box
  scale?: number;                  // scale: active-word magnification (1.04–1.3); other modes may stack it
  box?: { color: string; radius: number; padding: [number, number] };   // box: active-word box, em
  lift?: number;                   // lift: active-word raise, em
  sweep?: Sweep;                   // §5
  durationSeconds?: number;        // transition time into the active state, default 0.16
  spoken: 'keep' | 'tint' | 'dim';         // spoken words: keep / tint to spokenColor and underline / dim
  unspoken: 'keep' | 'dim' | 'hidden';     // unspoken words: keep / dim / not drawn (words appear one by one)
  spokenColor?: string;
  dimOpacity?: number;             // opacity for dim, default 0.5
}
```

Rules:

- The active word is the **last word with `start ≤ t`**. Gaps between words keep the previous word (`hold previous`), and the last word of a sentence is held until the end of the sentence.
- `mode` decides only the active word itself; `spoken` / `unspoken` are two independent minor axes. In the per-word catalog, `reveal` (unspoken words are not drawn) is `mode: 'none', unspoken: 'hidden'`; the `karaoke` cell is `mode: 'none', unspoken: 'dim'`; `highlight` (highlighter) is `spoken: 'dim', unspoken: 'dim'`; `paint` (wipe) is `spoken: 'tint'`.
- `scale` can be layered on `color` / `box` (`mode: 'color', scale: 1.1` is “change colour and enlarge slightly”), the most common combination in the reference implementation.
- Presets must supply `activeWord`. Translation tracks and imported subtitles without word timing are forced to `{ mode: 'none' }` by the compile layer, and no active word is drawn for them on thumbnails either.

**Mapping of the 19-cell per-word catalog** (the kernel catalog is unchanged; this is a lookup in the compile layer):

| Catalog cell | activeWord | motion.in (trigger: spoken, unit: word) |
| --- | --- | --- |
| `none` | `none` | — |
| `colourHighlight` | `color` | — |
| `boxHighlight` / `stack` | `box` | — / `stack` |
| `highlight` (highlighter) | `none`, spoken `dim`, unspoken `dim` | — |
| `karaoke` | `none`, unspoken `dim` | — |
| `reveal` | `none`, unspoken `hidden` | — |
| `bounce` | `lift` 0.22 | — |
| `paint` | `none`, spoken `tint` | — |
| `dropIn` / `floatInTop` / `floatInBottom` / `scaleIn` / `impact` / `impactPop` / `stomp` | `color` | `drop-in` / `float-in-top` / `float-in-bottom` / `scale-in` / `impact` / `impact` (intensity 1.3) / `stomp` |
| `flipClock` / `rotateFlipClock` / `rotateHighlight` | `color` / `color` / `color` + `tilt` | `flip` / `flip` + `tilt` / — |

`tilt` is a “random rotation slot”. The three `rotate*` cells in the catalog differ from the same-named cells without rotate only by this slot. Without it, the round-trip lookup cannot get back to the original.

## 5. KTV mode

`activeWord.mode = 'sweep'`:

```ts
interface Sweep {
  unit: 'grapheme' | 'word';       // advance color per grapheme or per word; default grapheme
  guide?: boolean;                 // draw a guide dot at the position the sweep has reached
  nextLine?: boolean;              // preview the next line below the current one (not stacked in the bilingual view)
}
```

Behavior:

- Each word has `[start, end]`. Within a word, the sweep progress advances linearly along the timeline (with `unit: 'grapheme'`, the word's time is split evenly by grapheme count; with `unit: 'word'`, the whole word switches color at `start`). The swept part uses `activeWord.color`, the unswept part uses `surface.color`. Gaps between words keep the state of the previous word, fully swept.
- Tracks without word-level timing do not sweep (they compile to `none`); progress is not faked from sentence duration.
- The kernel has landed: `textMotion.karaoke {color, guide, nextLine}`. `karaoke_sung(t)` returns the fractional position of how far the sweep has reached in terms of words (`crates/motion/src/text_motion.rs`). `unit: 'grapheme'` matches the current behavior; `unit: 'word'` is still to be implemented (§10).
- It is orthogonal to `motion.in`: "word-by-word drop-in plus color sweep" is a valid combination. It is mutually exclusive with `spoken: 'tint'`, since the sweep already tints.

## 6. Daoyazi (倒鸭子): `layout.mode = 'sequence'`

Daoyazi (v2 `caption-daoyazi`) is a cross-sentence dynamic layout: the words of the caption are laid out on an unbounded canvas, and the camera flies to, turns toward, and zooms into the block currently being spoken. It takes over the entire layout, color, and camera of the source-language track, so it sits on the `layout` dimension. `typography.fontFamily / fontWeight` still apply (weight at least 700). `surface.color` serves as the primary color, and `activeWord` is fixed as "the current word switches to one accent color" (determined by the palette). `motion` and `layout.anchor / y / width / maxLines` have no effect.

```ts
interface SequenceOptions {
  preset: 'standard' | 'light';    // light: no turning, lead 0.3, dwell 0.35, motion cap 40
  intensity: number;               // 0–100, default 60
  speed: number;                   // 0.35–2, default 1
  palette: { primary: string; accent: string; secondary: string; background: string };
  seed: number;                    // a new version = a new seed
  reveal: 'block' | 'word';        // whole block pops in / word by word, default block
  camera: { motion: 'smooth' | 'stopAndGo'; dwell: number; anticipation: number; maxTurnDeg: 0 | 90; fit?: number };
  layout: { density?: number; turnEvery: number };
  presentation: { viewportMode: 'center' | 'bottom' | 'full'; background: 'transparent' | 'solid';
                  history: { maxBlocks: number; opacity: number }; ending: 'hold' | 'overviewIfRoom' };
  sequence: { maxDurationMs: number; maxBlocks: number; maxWords: number; pauseThresholdMs: number; breakOnSpeakerChange: boolean };
}
```

Four built-in palettes (v2 original values, with names changed to English identifiers):

| id | primary | accent | secondary | background |
| --- | --- | --- | --- | --- |
| `classic` | `#FFFFFF` | `#FF9B42` | `#59BAF2` | `#111214` |
| `neon` | `#F4F4F4` | `#C6FF3D` | `#FF4FD8` | `#0B0B12` |
| `paper` | `#F6EFE4` | `#FF6A3D` | `#7FD1FF` | `#2A211C` |
| `ice` | `#E8F4FF` | `#4CC9FF` | `#FFD166` | `#0E1A26` |

Per-block edits (starting a new block from this sentence, giving a block a new seed, pinning a line at a spot on the canvas and rotating it) are instance data, `captionSequences`, not style ([Daoyazi design §5.4](ccut-daoyazi-caption-design.md)).

The settings on the property page match v2 ([Daoyazi design §3.3](ccut-daoyazi-caption-design.md)): preset, intensity, speed, palette, regenerate (whole track / current block), start new block from this sentence, word-by-word reveal, camera motion, camera dwell, lead, max turn, caption area, history lines, history opacity, background, block ending, density, fit, adjust layout (rotate 90°, fixed position, restore auto). There is no font size and no words-per-line setting: "fit" replaces font size, and "density" decides how many words are packed into each line.

The kernel has landed: `crates/subtitle-render/src/caption_sequence.rs` (compiler `typography-world`) and the recipe description `assets/captions/styles/caption-daoyazi-v1.json`. The corresponding keys are listed in §8.

## 7. Presets and categories

A preset = one value for each of the seven dimensions + one category label + one thumbnail that shows the current word. Categories are the sections of the gallery and are **sorted by mood only**, not by technique. What the current word is and what entrance a preset uses are marked with a small badge in the card corner.

| `category` | Gallery section | What it covers |
| --- | --- | --- |
| `basic` | Basic | Classic, Shorts, Simple: the defaults for new projects and vertical publishing |
| `social` | Social | Large type, all caps, high-saturation current-word color |
| `business` | Business | Backing plate, small type, low-contrast current word |
| `retro` | Retro | Italic, yellow type, hard shadow |
| `motion` | Motion | Designs led by the entrance: word-by-word drop-in, typewriter, line-by-line slide-in, soft-focus, rise-and-settle, character wave, KTV lyrics |
| `kinetic` | Kinetic layout | Daoyazi (one card; palette and camera are options on its property page, not split into several cards) |

Built-in presets keep the current state, with no new additions, for a total of 43: Basic 3 (Classic, Shorts, Simple), Social 20 (the 18 existing social presets plus Reading emphasis and Word-by-word block), Business 6, Retro 6, Motion 7, Kinetic layout 1. Each preset's `activeWord` must be written out explicitly. The table below gives the values for the Basic and Motion sections; the rest are converted mechanically from the existing data using the lookup in §8:

| Preset | activeWord | motion.in | Notes |
| --- | --- | --- | --- |
| Classic (经典) | `color #18E1D6` | — | Default for new projects |
| Shorts | `lift 0.22, color #FFE14D` | — | Placement `anchor bottom, y 0.72` |
| Simple (简洁) | `color #FFFFFF, scale 1.06` | — | The no-plate version of the business plate style |
| Reading emphasis (朗读强调) | `color #FC75E9, scale 1.18, durationSeconds 0.2` | — | |
| Word-by-word block (逐词底块) | `box {#FFD84D}, color #191919, scale 1.04` | — | `surface.wordBox` keeps a dark base always on |
| Word-by-word drop-in (逐词入场) | `color` | `cascade, word, enter, 0.22s, stagger 0.04` | |
| Character-by-character reveal (逐字显现) | `none, unspoken hidden` | `typewriter, grapheme, enter` | |
| Line-by-line slide-in (逐行滑入) | `color` | `slide-mask, line, enter, 0.36s` | |
| Soft-focus reveal (柔焦显现) | `color` | `blur-in, cue, enter, 0.38s` | |
| Rise and settle (升起落定) | `color` | `rise, cue` + `out: fade-down` | |
| Character wave (字符波浪) | `color #FFE547` | `wave-in, grapheme` + `loop: wave` | |
| KTV lyrics (KTV 歌词) | `sweep #FF6A1A, guide, nextLine` | — | |
| Daoyazi (倒鸭子) | Determined by `layout.sequence.palette` | — | `layout.mode sequence` |

After the user changes any dimension on the property page, the card's selected state stays lit (judged by `preset.id`), and "modified · revert" is shown beside it. Styles the user saves go into the brand library, with the same shape as built-in presets.

## 8. Compiling to the kernel: new body → Studio style

A single pure function `compileCaptionStyle(body, ctx) → StudioStyle`. `ctx` carries the canvas size, the track role (source language / translation), and whether word-level timing exists. The three surfaces and the export share it. In the prototype it is first written in JS (`model-captionstyle.js`, run with `node --test`). After confirmation it moves to `packages/ui`, and a copy is kept beside the kernel with a cross-check test.

| New key | Studio key | Status |
| --- | --- | --- |
| `typography.fontFamily / fontWeight / italic` | `fontFamily`, `fontWeight`, `italic`, `bold = weight ≥ 700` | Landed |
| `typography.size` | `fontSize = round(size × 540)` (reference short side 540) | Landed |
| `typography.lineHeight / letterSpacing / casing / align` | `lineHeight`, `letterSpacing` (em × font size), `textTransform`, `textAlign` | Landed |
| `surface.color / stroke / shadow / glow` | `fontColor`, `textOutline`, `dropShadow`, `glow` | Landed |
| `surface.plate` | `background`, `backgroundColor`, `backgroundStyle wrap/block`, `backgroundPadding`, `backgroundPaddingY`, `borderRadius` | Landed |
| `surface.wordBox` + `activeWord.box` | `wordBackground {color, activeColor, paddingXEm, paddingYEm, radiusEm}` | Landed |
| `layout.anchor / y / width` | `verticalAlign`, `y`, `width` | Landed |
| `layout.maxLines` | — | Pending (the kernel wraps by LayoutProfile; the style does not limit line count) |
| `activeWord.mode color / scale / lift / underline`, `spoken`, `unspoken` | `wordAnimation {animationId, animationName, spoken, active, unspoken}` (catalog cell + three-state overrides) | Landed |
| `activeWord.scale` stacking, `durationSeconds` | `textMotion.emphasis {color, scale, durationSeconds}` | Landed |
| `activeWord.mode sweep` | `textMotion.karaoke {color, guide, nextLine}` | `grapheme` landed; `word` pending |
| `motion.in/out/loop` (`trigger: enter`) | `textMotion.in/out/loop` | Landed (preset names map one-to-one) |
| `motion.in` (`trigger: spoken`) | Corresponding catalog cell for word-level animation (§4 table); combinations not in the catalog are pending | Partial |
| `emphasis` | Prototype `highlight {color, font, bold, italic, scale}`; the kernel reads only the color of `captionEmphasis` for recipes | Pending (appearance of emphasized words in plain captions) |
| `layout.mode sequence` + `layout.sequence` | `wordAnimation.caption {schema 1, content 'orig', style {id 'caption-daoyazi', version 1}, palette, intensity, speed, seed, options: [{kind:'object', key:'daoyazi', value:{preset, sequence, layout, camera, entrance, reveal, presentation}}]}` | Landed (v2 keys kept as-is) |

Compilation is deterministic and side-effect free. The same body produces the same Studio style on all three surfaces; this is the basis for "thumbnail = canvas = final render". The reverse direction (Studio → new body) is only a best-effort parse, used to open old projects. Keys that cannot be parsed are kept under `legacy` and written back unchanged, so nothing is lost.

## 9. Interface: gallery and property page

Prototype first (`designs/cuccut`). After confirmation, sync to Electron / Web.

**Gallery** (caption styles): cards are arranged into the six sections in §7. Each card's thumbnail loops using that preset's own `activeWord` and `motion`, and no longer borrows the animation of the current document. A small badge in the card corner marks the current word mode (color block / word box / sweep / lift / none).

**Property page** sections map to the seven dimensions, in this order:

1. Text (typography)
2. Appearance (surface: color, stroke, shadow, glow, plate, word box)
3. **Current word** (activeWord): a row of mode cells (none / color change / box / scale / lift / underline / sweep), each live-previewed with the current track's text. Below are color, scale, transition, and two three-way choices, "spoken words" and "unspoken words". When sweep is selected, extra options appear: "by character / by word", "guide dot", and "preview next line".
4. Motion: three cells for entrance / exit / loop, each with its own selector, with unit, trigger (on appearance / when spoken), duration, and strength.
5. Emphasis (emphasis): tap a word + appearance.
6. Layout (layout).
7. Bilingual, lead / lag, punctuation, scope (all / this item only). These are not part of the style and stay as they are.

When `layout.mode = 'sequence'`, sections 2–6 are replaced by the Daoyazi section (the settings in §6, grouped into four sets: "Style", "Camera and layout", "Lead word and block breaks", and "Adjust layout").

## 10. Landing order and verification

1. **Prototype**: `model-captionstyle.js` (seven-dimension model, §8 compilation, §4 lookup, conversion of the 31 + 12 built-in presets) + `node --test`. The gallery is arranged by §7 sections. The property page is split by §9, with each new section in its own `panel-*.jsx`. `WordLine` supports `sweep` (progressive per-character color change) and the three-state `spoken` / `unspoken`. Both the App and Web entry points must pass, with no console errors.
2. After the user confirms the prototype: add `caption-style-body.ts` to `packages/ui` (types + compilation + parsing), switch the preset table to the new body, sync the gallery and property page, and make `applyPreset` stop writing only the finish. The Daoyazi property page goes into the editor. The kernel gains `sweep.unit = 'word'`, the emphasized-word appearance for plain captions, and `maxLines`.
3. Acceptance: the thumbnail, canvas, and export render the same body identically (checked by pixel sampling). After compilation, the 31 old presets match their v2 Studio styles key by key (regression table). Changing the current-word mode does not change the finish, and changing the finish does not change the current-word mode (properties do not bleed into each other). The current word on the translation track is always `none`. The 16 Daoyazi settings round-trip to kernel keys without loss.

## 11. Differences from the existing spec and prototype

- The `CaptionStyle` draft in the video format spec §5.6 (`highlight {mode: 'word' | 'none'}`) is superseded by `CaptionStyleBody` in this document; the spec body now references this document (same task).
- The 19-entry catalog in spec §5.6 continues to exist as the **kernel contract**; the new body does not expose catalog ids directly, and the compile layer looks them up.
- Prototype status: the gallery sections “我的品牌库” (My Brand Library) / “默认” (Default) / Shorts / “动态排版” (Dynamic Typography) / “社交” (Social) / “商务” (Business) / “复古” (Retro) change to §7. The single “字幕动画” (Caption Animation) row (19 entries) is split into two parts, “当前词” (Current Word) and “动效” (Motion). `look.activeColor` is merged into `activeWord.color`. The track keys `wordAnim` / `caption` / `textMotion` / `wordBackground` / `highlight` are derived from the new body, and the grouping of `CUE_KEYS` is adjusted accordingly.
- The motion caption recipes (`caption-*`, 16 items) remain withdrawn (user ruling in round 74). This document only reserves a place for them as `layout.mode: 'recipe'`.
- The example payload `ccut-daoyazi-caption-style.example.json` for 倒鸭子 (Daoyazi) is inconsistent with the kernel (`options` should be an array, `reveal` defaults to `block`, and the historical opacity default is 1.0). This document follows the kernel.
