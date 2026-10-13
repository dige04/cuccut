> Ported from CucCut v2. The data model names in this document (such as TranscriptDoc) refer to the v2 models. For their correspondence to the v3 document model, see [Architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# Subtitle Style and Layered Text Animation Extension Plan

Status: implemented per the merged plan. The user confirmed execution afterwards and asked to merge CucCut's existing styles with the reference styles, and to slightly increase the default font size. §13 is the final implementation basis, and §14 records the actual verification and the checks not yet done. §3–§11 keep the research data and the original acceptance targets.

## 1. Goals and conclusions

Use 31 subtitle and text designs as the behavioural reference to complete CucCut's subtitle style library with full appearances, entrances, exits, loops and per-word emphasis. Keep CucCut's Transcript truth, editing scope and the shared Rust render path. Parameters and behaviour are implemented in this repository; third-party research code and previews are kept outside the repository. The adopted OFL fonts are packaged with their licence.

Directory counts after checking the installed package against the local code this time:

- **10 complete subtitle designs**, of which Clean Line is static and the other 9 are animated.
- **16 current text presets**. The screenshot shows the first 12; below it are Handwritten, Typewriter, Lower Third and Label. Of the 16, 12 are animated and 4 are static. The Basic section does not mean all of them are static.
- **5 static subtitle presets**, provided by a separate caption preset interface.
- The current migration analysis therefore covers **31 sets**. The bundle also keeps 13 older text template IDs, which must not be counted as 13 new current sets. They should be audited as legacy-project compatibility objects.
- The base is **17 text animation primitives plus independent per-word emphasis**. The 10 subtitle cards are combinations of these primitives, fonts and colour schemes. They cannot be mapped mechanically onto CucCut's existing per-word animation catalogue.

Recommended approach: extend the shared text animation compile and render path first, then register the presets as data. Adding only cards, or writing CSS animation in the web client, would make preview, export, per-word timing and the native app diverge.

## 2. Research evidence and coverage

Analysis material is stored in the `subtitle-research/` directory outside the repository.

| Evidence | Extracted content |
| --- | --- |
| Plugin `dist/shared/subtitle-presets/subtitle-animation.mjs` | Complete style parameters for 10 sets, and createSubtitleAnimationMotion |
| Same directory `subtitle-design-metadata.mjs` | Names and purposes of the 10 sets, and the 5 static subtitle sets |
| Editor `feature-editing-core-DdQnU3jr.js` | 16 text presets, 17 primitives, timing window / word splitting / render logic |
| `subtitle-research/source/editor-features.pretty.js` | Formatted version of the bundle above. Primitives about 32940 lines, text presets about 33190 lines, sampling about 66230 lines, subtitle mapping and drawing about 79920 lines |
| `subtitle-research/*.json` | Data literals read with an AST allowlist, without executing the analysed code. Contains the full numeric values |
| `subtitle-research/previews/` | 10 original MP4 clips and 10 posters |
| `animation-contact-sheet.jpg` | Each clip sampled at 0.1 / 0.4 / 0.8 / 1.9 / 3.9s, 50 frames in total, manually reviewed |
| `reference-fonts/` | Fonts bundled with the app and licence snapshots, for research only. When implementing, verify font version, weights, licence and cross-platform packaging |

These are evidence from the installed package, not speculation about server capabilities. Visual frame sampling confirmed entrances, static holds, emphasis and tail behaviour. It does not replace acceptance testing of continuous playback speed, and a pixel-level comparison against CucCut output has not yet been done.

## 3. Exact semantics of the ten subtitle designs

Size convention: `H` is canvas height, `W` is canvas width, `S=min(W,H)`, `F=round(H×fontSizeRatio)`. `yRatio` offsets downward from the canvas centre; for example, 0.28 means the centre sits at 78% of the height. The letter-spacing ratio multiplies font size F; the stroke ratio multiplies the short side S.

| Original ID / name | Font, base colour, layout | Animation and timing |
| --- | --- | --- |
| `zoom-punch` · Zoom Punch (impact emphasis) | Anton / normal / normal; #FFFFFF; F=0.073H, width=0.78W, y=0.28H, line height=0.95 | Whole sentence always visible; current word pink #FC75E9, scale 1.18→1, 0.20s, ease-out; during pauses the previous word stays emphasised |
| `reveal` · Clean Line (clear full sentence) | Inter / medium / normal; #FFFDF7; F=0.052H, width=0.82W, y=0.29H, line height=1.08 | No animation; the full warm-white text stays still (the name "reveal" does not mean word-by-word reveal) |
| `pulse` · Accent Pulse (light emphasis) | Poppins Black / bold / normal; #FFFDF7; F=0.06H, width=0.82W, y=0.29H, line height=1 | Whole sentence always visible; current word yellow #FFE15A, 1.10→1, 0.16s, ease-out; during pauses the previous word stays emphasised |
| `glass` · Word Blocks (per-word blocks) | Inter / medium / normal; #FFFDF7; F=0.048H, width=0.86W, y=0.29H, line height=1.12 | Every word has a black block; current block #FFD84D, text #191919; current text 1.04→1, 0.14s; the blocks do not scale with the text |
| `drop-in` · Word Drop (per-word drop-in) | Poppins Black / bold / normal; #232323; F=0.058H, width=0.76W, y=0.29H, line height=1.04 | Per-word one-shot cascade entrance: 0.22s, staggered 0.04s, intensity 0.85, ease-out; static after completion, the whole-sentence green plate stays stable |
| `typewriter` · Typewriter (paper typing) | Roboto Mono / medium / normal; #241F1A; F=0.042H, width=0.7W, y=0.28H, line height=1.16 | Per-character stepped reveal: unit duration 1/30s, staggered 0.04s, linear; full text pre-laid out, paper-coloured plate stable |
| `slide-mask` · Line Swipe (line-by-line slide-in) | Poppins Black / bold / normal; #FFF8F2; F=0.058H, width=0.82W, y=0.27H, line height=1 | Entrance by final visual line: 0.36s, staggered 0.08s, intensity 0.92, ease-out; text moves in from outside the left edge into a fixed clipping box |
| `whisper` · Soft Focus (soft-focus reveal) | Inter / medium / normal; #FFFDF7; F=0.048H, width=0.82W, y=0.29H, line height=1.1 | Whole-sentence blur-in: 0.38s, intensity 0.55, ease-out; opacity rises while the blur clears; no loop |
| `rise-fall` · Rise & Settle (rise and settle) | Playfair Display / normal / italic; #F5E6CF; F=0.058H, width=0.82W, y=0.27H, line height=1.12 | Whole-sentence rise entrance 0.36s, intensity 0.5, ease-out; fade-down exit 0.22s, intensity 0.35, ease-in |
| `kinetic-wave` · Kinetic Wave (character wave) | Oswald / bold / normal; #FFFFFF; F=0.066H, width=0.86W, y=0.27H, line height=0.98 | Per-character wave-in: 0.32s / stagger 0.025s / intensity 0.62; after the entrance a wave loops: period 0.96s / stagger 0.03s / intensity 0.32 |

### 3.1 Appearance details that must not be omitted

- **Zoom Punch**: all caps, Anton; hard black shadow, black outline; the current word is always emphasised within the full sentence.
- **Accent Pulse**: Poppins Black, all caps, warm white, yellow emphasis; both amplitude and duration are smaller than Zoom Punch. Its ID `pulse` shares a name with the underlying continuous loop primitive `pulse`, but this card has no loop.
- **Word Blocks**: all words continuously carry an `rgba(18,18,19,0.84)` block; paddingX=0.2F, paddingY=0.1F, radius=0.12F. The current block turns yellow. It is not a single moving highlight pill, nor a yellow fill that advances word by word from left to right.
- **Word Drop**: the whole sentence has a `#C7FF5A` plate with dark text. The plate does not narrow for words not yet shown. Words fall in from above; the entrance is driven by sentence start plus index stagger, and is not equivalent to triggering by ASR speech time.
- **Typewriter**: Roboto Mono, whole-sentence `#F4EBDD` paper-coloured plate, left aligned. The full sentence is laid out first, then visibility is controlled. Do not re-lay-out by slicing the string on every frame.
- **Line Swipe**: warm-white text, coral hard shadow. The source moves each visual line by `dx=-(1-p)×boxWidth×0.92` and clips to a fixed text box. It is not a wipe where the text stays put and the clipping width grows. The early preview showed the line ends moving first, which is a result of this mechanism.
- **Soft Focus**: whole-sentence opacity and text blur change together. This is not merely reducing the shadow's shadowBlur.
- **Rise & Settle**: Playfair Display italic, cream colour. The entrance moves the whole block upward; the exit fades it downward.
- **Kinetic Wave**: Oswald Bold, cyan hard shadow, yellow outline. Only this set holds a continuous wave. Amplitude = 0.18F×0.32≈0.0576F.

The black card background in the screenshots and the deep-blue canvas in the reference videos are display backgrounds. They should not be written up as a full-screen background for each subtitle set.

### 3.2 Active word and timing rules

1. A subtitle cue maps to a text item with its own start and duration; each sentence restarts its animation clock.
2. Zoom Punch / Accent Pulse / Word Blocks use real word start times converted to frames to get `unitStartFrames`.
3. The active word is the last word with `startFrame <= currentFrame`. Between word start times the previous word stays emphasised. Emphasis is not cancelled early by endFrame. The last word stays until the cue ends.
4. When there are no word timings, the reference implementation divides unitStartFrames evenly. This is a display estimate, not real ASR time. If CucCut adopts it, it must be labelled as an estimate and must not be written back to the Transcript.
5. The scale of the three emphasis styles decays over fixed 0.20/0.16/0.14 seconds, rather than being stretched to each word's spoken duration. ease-out is the quadratic `p(2-p)`, not the default CSS ease-out, and not a spring.
6. The other entrances mainly use sentence start plus unit-order stagger. They must not be forced to sync to spoken words.
7. A single in/out window is `duration + stagger×maxOrder`. If it exceeds half of the cue, duration and stagger are compressed proportionally so the head and tail do not overlap. Out takes priority in the tail window. Loop starts after the entrance completes and stops when the exit window begins.
8. Waves are sampled with absolute-time sine, with a fixed seed for random order. Dragging, reverse playback and out-of-order sampling must not depend on which frames were played before.

### 3.3 Multilingual: keep the target effect, fix the reference implementation's limits

The reference implementation's word units prefer Intl.Segmenter; without that capability it splits on whitespace. Its character path uses JS character iteration / Array.from (Unicode code points), not full grapheme clusters. All-caps and partial matching explicitly use en-US.

CucCut continues to use Unicode graphemes and shaping clusters, so that combining accents, Indic scripts, emoji ZWJ sequences or Arabic joining are not broken apart. `word` prefers stable word IDs when a transcript exists. Content without timestamps uses display segmentation, which is clearly a display unit. `line` must group by laid-out visual lines and cannot simply split on newline characters. RTL must state logical versus visual order explicitly, defaulting to reading order. Unknown languages keep generic Unicode behaviour.

Original text and translations can both use appearance and cue/line/grapheme entrance and exit. Only real, usable word timings can drive "follow the reading". A translation must not pose as having target-language per-word alignment, and the migration must not change the trans / transAlign truth.

## 4. Sixteen text presets (full Basic section)

These are presets for ordinary text items, including layout, demo text and animation. When borrowed for subtitles, apply only appearance and motion. Do not overwrite the subtitle text or automatically write in names, quotes or attributions. The second line of Quote and Lower Third belongs to a different rich-text role. Faithful reproduction should keep it in the text element preset, while also providing a subtitle-adapted version with the demo copy removed.

Font sizes here are `clamp(round(H×ratio), min, max)`, multiplied by the user's styleScale. Shadows, outlines, spacing and similar values are mainly pixel parameters, unlike the ratio parameters in the previous section. Basic animations' durationFrames default to frame counts, not fixed seconds converted by fps. CucCut should explicitly record the baseline fps or normalise to seconds, and must not hide this difference.

| ID / name | Font and main colour | Font size H ratio (min–max px) | Animation unit / primitive |
| --- | --- | --- | --- |
| `basic-text` · Basic Text | Inter normal / #ffffff | 0.056 (36–84) | Static |
| `basic-heading` · Heading | Montserrat bold / #ffffff | 0.09 (58–136) | whole-clip / fade-up |
| `social-tiktok` · Word Pop | TikTok Sans bold / #ffffff | 0.072 (48–108) | word / pop |
| `social-bold-caption` · Bold Caption | Poppins bold / #facc15 | 0.074 (48–112) | word / fade-up |
| `social-hook` · Hook | Anton normal / #ffffff | 0.112 (72–164) | whole-clip / pop |
| `social-outline` · Outline | Montserrat bold / #ffffff | 0.082 (54–124) | Static |
| `title-poster` · Poster | Anton normal / #fef3c7 | 0.11 (72–164) | whole-clip / blur-in |
| `title-cinematic` · Cinematic | Bebas Neue normal / #f8e6b8 | 0.11 (72–164) | line / fade-up |
| `title-condensed` · Condensed | Oswald bold / #ffffff | 0.096 (64–146) | line / slide-mask |
| `title-neon` · Neon | Roboto Mono medium / #67e8f9 | 0.086 (56–132) | whole-clip / blur-in |
| `editorial-elegant` · Elegant | Playfair Display bold / #fff7ed | 0.084 (56–128) | line / fade-up |
| `editorial-quote` · Quote | Playfair Display normal / #fafaf9 | 0.072 (48–108) | Static |
| `editorial-handwritten` · Handwritten | Caveat bold / #fde68a | 0.082 (54–124) | character / wave-in |
| `utility-typewriter` · Typewriter | Roboto Mono medium / #86efac | 0.056 (36–84) | character / typewriter |
| `utility-lower-third` · Lower Third | Inter semibold / #ffffff | 0.058 (38–88) | line / slide-mask |
| `utility-label` · Label | Montserrat bold / #111827 | 0.046 (30–70) | Static |

The four presets not visible in the screenshot are Handwritten, green-terminal typing, a name-and-title bar and a yellow capsule label. The base catalogue contains 4 static designs: Basic Text, Outline, Quote and Label. The rest have entrances.

## 5. Five static subtitle styles

Their IDs keep the historical brand names, while the current display names have become more generic. CucCut should use its own stable IDs and localized display names, to avoid name clashes with the existing styles.

| Original ID / display name | Font, main color, backing plate | Size/position |
| --- | --- | --- |
| `netflix` · Classic Box | Inter semibold / #ffffff / rgba(0, 0, 0, 0.55) | F=0.04H, y=0.36H, width=0.7W |
| `youtube` · Soft Shadow | Roboto medium / #ffffff / no backing plate | F=0.045H, y=0.34H, width=0.85W |
| `bold-yellow` · Bold Yellow | Roboto Slab bold / #FFD400 / no backing plate | F=0.05H, y=0.38H, width=0.85W |
| `minimal-stroke` · Outlined | Manrope medium / #ffffff / no backing plate | F=0.04H, y=0.34H, width=0.85W |
| `tiktok` · Bold Center | Anton normal / #ffffff / no backing plate | F=0.075H, y=0H, width=0.9W |

## 6. Seventeen low-level animation primitives

The following is the animation expression layer. Not every one needs to become a new caption style card, but the full text-animation editor must keep these combinational capabilities.

| Phase | Primitive | Main channel |
| --- | --- | --- |
| in | typewriter | character alpha step |
| in | fade-up | alpha + vertical shift of 0.25F×intensity |
| in | rise | alpha + vertical shift of 0.6F×intensity |
| in | cascade | alpha + drop in from above by 0.8F×intensity |
| in | pop | alpha + scale, can overshoot |
| in | blur-in | alpha + soften, blur radius 0.4F×intensity |
| in | slide-mask | horizontal shift, cropped by a fixed box |
| in | wave-in | alpha + entry vertical shift varying by unit index sin(index×0.9) |
| out | fade-down / sink | alpha + downward vertical shift |
| out | pop-out | alpha + shrink |
| out | blur-out | alpha + increasing blur |
| out | typewriter-erase | reverse character alpha step |
| loop | pulse | scale=1+0.06×intensity×sin(2πp) |
| loop | wave | dy=0.18F×intensity×sin(2πp) |
| loop | shimmer | per-unit deterministic brightness emphasis |
| loop | swing | rotation=0.09×intensity×sin(2πp); Canvas uses radians, so multiply by 180/π when converting to CucCut's degree channel |

Beyond in/out/loop, wordEmphasis works as an independent overlay: it multiplies scale and overrides the active word color. The primitives support whole-clip, line, word, and character units; forward/backward/center/random order; and intensity, easing, and seed. The three phases are selected by time and must not be stacked unconditionally at the same time.

## 7. Reusable capabilities in CucCut today and real gaps

The following is based on a static audit of the current source. It is not a declaration that the new implementation has passed acceptance.

| Capability | Current state | Supplement needed for this migration |
| --- | --- | --- |
| Font, weight, case, letter spacing, line height, stroke, shadow, backing plate, corner radius | LineStyle and line_style already exist | Add recipe data and unit adaptation; verify exact font coverage separately |
| Word coloring and deformation for spoken source text | WordAnimation / word_motion already has 19 items, in three states plus a continuous track | Add fixed-second emphasis, hold-previous, and combination with independent in/out; do not change the time semantics of the old IDs |
| Designed Caption | Already has channel recipes triggered by word/group, with complex rendering | The data/sampling approach can be reused, but do not claim it covers all line/grapheme semantics |
| Character, word, and line splitting | ccut-motion::text_parts already has Char/Word/Line; PartMap can handle cluster starts | Line currently mainly follows explicit line breaks; add mapping to post-layout visual lines, and also fill in character mapping within subtitle word runs |
| Split-animation for regular text elements | render_plan/raster already wired to animation_parts | chunk_part_delta currently takes only opacity/dx/dy; full scale/rotation/blur/clip requires a unified pose |
| Whole-sentence blur/scale | transition and the shared effect stack have a foundation, and the GPU glyph scene has a fallback | The existing caption transition is not a full in/out/loop text animation; whole-sentence subtitle blur must propagate correctly through rendering and caching |
| Per-word plate | Existing WordVisual/pill plate foundation | Add a persistent idle/active block, independent X/Y padding, and stable geometry; the existing active box cannot be passed off as this directly |
| Whole-sentence paper/green plate | Plate already exists | The plate must use full layout; character reveal must not trigger relayout or width changes; the current fixed horizontal/vertical padding ratio must be decoupled |
| Static/dynamic thumbnails | App has a shared Rust word_motion_demo; Web Thumb.tsx also has a CSS projection | New style previews must be generated from the same sampler or shared render output; no more separately written approximate frame tables |
| Translation | layout_motion currently limited to Original; translations have no real word timing | Keep word-timing-free boundaries, support free cue/line/grapheme entry, and make the emphasis clock source explicit |
| Multilingual shaping | Rust shaping and unicode-segmentation already exist | Shape the full text first, then associate clusters and animation units; do not shape character by character independently, which breaks connected scripts |

### 7.1 Font audit

The current bundled_studio_fonts include Montserrat, Anton, Bebas Neue, Poppins (400/500/600/800), and others. Full matching still needs verifying Inter, Poppins 900, Oswald, Playfair Display (including italic), Roboto Mono, TikTok Sans, Caveat, and the static-style Roboto/Roboto Slab/Manrope.

System fonts may make these look available on some Mac, but they cannot be a reliable source for Web, Windows, and export. At implementation time, pin the font files, family aliases, weights, and licenses, and distribute them through the existing font injection pipeline. The research directory already has the original package fonts and licenses for checking, but do not depend directly on the user's machine directories.

`Poppins Black` must map to Poppins' true 900 weight; it must not be set to bold=700 just because the name contains Black. Uncovered text falls back to the existing per-script fallback, preserving each language's shaping and direction; do not uniformly treat it as English.

### 7.2 Parameters cannot be copied directly

- The reference implementation's full caption font size is proportional to H, while CucCut's current logical fontSize is scaled by `min(W,H)/540 × scale`. When a canvas is specified it can be converted: `logicalF = round(H×ratio) / (min(W,H)/540×scale)`. After changing the frame aspect, recompute by the declared basis; do not save only the first converted value.
- The reference implementation offsets from the center, while CucCut's line position is a center percentage: `x%=50+100×xRatio`, `y%=50+100×yRatio`. Also make verticalAlign=center explicit, so the old bilingual seam anchor does not change results.
- The reference letter spacing is `letterSpacingRatio×F`, while CucCut's is `letterSpacing×F/30`, so the ratio recipe can be written as `letterSpacing=30×ratio`. Basic fixed pixels must be converted separately.
- **Stroke has two multipliers**: the reference renderer multiplies stroke.width by 2 as the Canvas lineWidth, while CucCut's current centered stroke is `textOutline.width×F/200`. To match the same stroke line width, use `textOutline.width=400×refStrokeWidth/F`. Confirm the outward expansion with a real stroke image; do not copy 0.006 or pixel counts directly.
- Shadow ratios multiply X by W, Y by H, and blur by S, while CucCut's distance/blur is currently based on font size. First solve for the target dx/dy, then convert: `distance=hypot(dx,dy)/F`, `rotation=atan2(dy,dx)×180/π`, `blur=blurPx/F`. The browser and CPU blur kernels still need visual tolerance acceptance.
- CucCut's backgroundPadding currently derives a fixed horizontal/vertical ratio of 1.4, while in the reference implementation the whole-sentence padding and per-word padding can be independent. When adding explicit paddingX/paddingY, the default still uses the old formula.
- Do not put CSS rgba alpha directly into the internal SubtitleColor.a: the internal storage's transparency direction differs from the common opacity and must go through the existing parse/paint conversion.

## 8. Suggested data and module design (not yet landed)

### 8.1 Persistent data layers

On each subtitle style scope, add an optional, versioned `textMotion`, split into `in`, `out`, `loop`, and `emphasis`. Appearance still belongs to the existing style fields; where necessary, add an explicit size basis and an independent word-plate configuration. The example below is a design draft: the current CLI/project does not support it, and it cannot be used as a ready-made command.

```json
{
  "textMotion": {
    "version": 1,
    "in": {"preset": "rise", "unit": "cue", "durationSeconds": 0.36, "intensity": 0.5, "easing": "easeOutQuad"},
    "out": {"preset": "fade-down", "unit": "cue", "durationSeconds": 0.22, "intensity": 0.35, "easing": "easeInQuad"}
  }
}
```

The clock should distinguish sentence intervals, visual staggering, and real spoken words; word gapPolicy is modeled independently. Write data in seconds first and quantize when compiling to the project fps; if importing exact-frame recipes, referenceFps must be included. Preset IDs are kept separate from UI titles. A naming like `caption.zoom-punch@1` is suggested, and the final naming must be checked against the existing registry for conflicts before implementation.

All clocks first pass through the existing clip projection to map to output time, including trim, concatenation, and speed change; the original media word.start must not be used directly as the finished-video moment. Sentence-level entry uses the effective display interval, and reading emphasis uses the projected real word start time. The existing lead-in/tail is kept as display configuration, and when aligning against the reference clip it is explicitly fixed, so early display is not mistaken for a sampling offset.

Applying a preset atomically replaces the appearance/motion group of this scope and clears incompatible old wordAnimation/transition/caption state; there must be no leftover old bounce with a new wave stacked on it. Old projects keep byte semantics when the new fields are absent. Changing only font/color keeps the animation; switching to a static style explicitly clears motion. Record provenance and version; after the user edits appearance, keep it editable, and do not determine behavior by string name.

The style library, brand library, cueStyles, and original/translation local overrides must all save the new fields. Truncation at any serialization whitelist causes "preview is normal now, but reopening falls back to static." Unknown versions must keep the original data and show an unsupported-version notice, and must not silently be overwritten with the default style.

### 8.2 Compilation and sampling reuse

1. Use the current TextEngine to do whole-passage shaping and stable line wrapping, retaining the source word ID, UTF-8 ranges, grapheme/cluster, and final visual line index.
2. Add a text-animation compilation adapter in ccut-subtitle-render, mapping these semantic targets to ccut-motion's MotionProgram/curve/combination capabilities. Do not write separate samplers in GPUI and React.
3. Cue/line/word/grapheme units share `TextUnitPose`: opacity, translation, scale, rotation, blur, clip, color, and word-plate state. Cache geometry, and update only the per-frame pose/uniform.
4. in/out/loop are planned using unit order and short cue windows. emphasis separately reads the real word starts and combines with the base pose under explicit ordering.
5. Text, stroke, and shadow follow the text pose; static plates and per-word blocks are independent of glyph scaling. The fixed text-box clip for slide-mask is applied after movement.
6. The CPU reference and the retained glyph scene use the same sampling result and coordinate system. Supported transforms/clips use existing uniforms; blur uses a bounded offscreen layer or an already supported effect stack, falling back per cue when necessary, and must not degrade the whole video into full-frame CPU rasterization each frame.
7. Cache keys include textMotion, font version, geometry, and clock source. After the entry finishes, styles without loop should enter the static cache and must not keep refreshing.

Currently ccut-motion already has basic curves, PartMap, and stagger, and the subtitle layer has style, glyph, and effect capabilities. The focus of this plan is to fill in the unified semantic targets and the compilation connection, rather than building another animation engine disconnected from BCF/Timeline.

### 8.3 Three surfaces and product flow

- Style cards still go through CucCut's existing caption gallery. Do not copy the reference implementation's Media/Text/Transcript shell, and do not stuff its Basic text menu as-is into caption content editing.
- 10 main designs go in the featured caption group, and 5 static ones serve as base appearances. 16 text presets keep their full role structure in the text element library, while the caption library provides content-independent adapted versions. For subtitles, clicking any card changes only the style of the selected scope, and does not change the original or translation text.
- Preview, save to brand library, copy style, global/single cue, and original/translation switching must all use the same payload.
- App/Web/prototype use localized names and descriptions. All new keys must be complete in every locale. Subtitle on-screen colors belong to the work's content, while UI chrome continues to follow Spectrum 2.
- Web is in scope for §22: styles/animation belong to the existing editing Tab, and no AI entry point is introduced.
- The prototype and both entry points are synced; shared components and cache stamps are updated together. When implementing, also sync product spec §13/§16 and the prototype changelog/ledger.

## 9. Concrete code touchpoints

Everything marked "new" refers to the next implementation task. The Rust/TS/JS features themselves were not created in this round.

| Module | File / directory | Work |
| --- | --- | --- |
| Recipe data | The existing registry under core/assets/ or core/presets/ | Store versioned appearance, animation and declared size basis, so the values are not copied into three UIs |
| Base motion | [ccut-motion](../../../core/crates/ccut-motion/src/lib.rs), [text_parts](../../../core/crates/ccut-motion/src/text_parts.rs) | Reuse MotionProgram and curves; extend pure functions for final layout unit binding and window policy |
| Subtitle semantics | [document.rs](../../../core/crates/ccut-subtitle-render/src/document.rs), [word_motion.rs](../../../core/crates/ccut-subtitle-render/src/word_motion.rs), new text_motion module | New field parsing, clock source, active-word gap rules, combined pose; keep old word motion compatible |
| Geometry and rendering | [raster.rs](../../../core/crates/ccut-subtitle-render/src/raster.rs), [render_plan.rs](../../../core/crates/ccut-subtitle-render/src/render_plan.rs) | cluster / visual-line index, fixed plate, word blocks, masks, blur, CPU/GPU consistency |
| Style persistence | [style_sync.rs](../../../core/crates/ccut-subtitle-render/src/style_sync.rs), [style_library.rs](../../../core/crates/ccut-editor-core/src/style_library.rs), [stylepane.rs](../../../core/crates/ccut-editor-core/src/stylepane.rs) | Register 31 designs, conversion, scope, save and restore, clear the old animation group |
| WASM interface | [ccut-wasm-editor style_pane](../../../core/crates/ccut-wasm-editor/src/api/style_pane.rs), core/crates/ccut-wasm-subtitle | Output the style catalog and preview capability; sync declarations and necessary schema |
| App | [stylepane](../../../apps/cuccut/src/app/editor/stylepane/), [host style_library](../../../apps/cuccut/src/host/style_library.rs), apps/cuccut/locales/ | Subtitle / text library, preview, parameter editing, i18n |
| Web | [subtitle/style](../../../apps/web/src/features/editor/panes/subtitle/style/) | Catalog, scope, real animated thumbnails; rebuild the corresponding WASM |
| Prototype | designs/cuccut/app/model-substyle.js, model-subanim.js, panel-substyle.jsx | Shared catalog and model semantics, controls, two entry-point previews; do not claim the production engine is complete based on an approximate prototype |
| Fonts | [fonts.rs](../../../core/crates/ccut-render/src/fonts.rs), core/assets/fonts/ and each host's font pipeline | Font family aliases, exact weights, fallback, licensing and fixed digests |
| CLI / skill | docs/design/cli/ccut-cli-server-reference/, the subtitle style entry in skills/cuccut | If the style write / validate / enumerate contract changes, sync the reference and the actual spec; the user skill only adds a usage entry and does not copy internal algorithms |

If new public fields affect the protocol schema or spec, generate them from the protocol single source; do not hand-edit docs/generated. Style fields are loose JSON and must still validate input and save capability; skipping the contract doc just because no new Rust enum is needed is not acceptable.

## 10. Implementation order and completion criteria

| Stage | Deliverable | Completion criterion |
| --- | --- | --- |
| A: Freeze the reference | All 31 machine catalogs, fonts and the 10-segment timing reference, with corresponding parameter tables | Research extraction completed in this round; the 13 legacy IDs are listed separately for compatibility and new templates are not counted again |
| B: Style and layout basis | Unit / basis conversion, font weight, independent padding, stable plate, word plate | The 31 static looks are readable in landscape and portrait and in multilingual samples; pixel baselines of existing projects unchanged |
| C: Unified text motion | cue / line / word / grapheme, in / out / loop, emphasis, short-sentence window, glyph mapping | Motion behavior of the 10 subtitle sets is compared frame by frame; the 17 primitives have boundary tests; no carrying over of incorrect approximate animation |
| D: Full catalog integration | 10 main designs + 5 static + 16 text / subtitle adapters, full save / undo | App, Web and prototype can all select, modify, save and restore; preview and export go through the same kernel |
| E: Cross-platform / export acceptance | Fonts, mixed scripts, long scripts, dynamic thumbnails, output limitation notes | The migration may be called complete only after all matrices pass; advanced animations unsupported by SRT / ASS / external NLEs must pre-check capability and explicitly degrade or bake |

Getting the static looks connected first is only an intermediate stage; "all 31 cards are clickable" must not be the completion standard. Usable capability and correct preview must be delivered together. Cards not yet implemented must not be shown as supported in advance.

## 11. Required verification matrix

### Time and layout

- fps: 24/25/30/50/60/120; landscape 1920×1080, portrait 1080×1920, square; check the difference between sizing by H and by the short side.
- cue: 0.2s, 1s, a normal 4s, a long sentence; 0 / 1 / multiple words, long silence, zero length or identical starts, missing word timing, still visible after the last word ends.
- For each set, at least: start−ε, start, entrance midpoint, entrance end, before and after active-word switches, inter-word gaps, two loop periods, exit midpoint, end−ε / end; random seek and sequential playback match frame by frame.
- One line / auto wrap / manual line break / overlong word; typewriter keeps the full-text layout fixed with a fixed plate; line swipe works by visual line and is clipped by the fixed box; word blocks must not shift adjacent words when color or scale changes.
- Languages: Latin, Chinese, Japanese, Arabic RTL, Indic scripts, Thai, combining accents, emoji ZWJ, bilingual mixing; the rules must not depend on any one language. Emoji and ligatures may keep the defined cluster atomicity, but the codepoint difference from the reference must be stated.

### Editing and persistence

- Original / translation, single cue / global, independent bilingual placement, saving to the brand library, style copy, undo / redo, close and reopen all remain intact.
- Dynamic → static clears old effects; static → dynamic carries no old color, plate or transition; changing color or font does not reset the animation.
- With and without fonts, and with system font changes: fixed-package output is consistent; missing fonts have a defined fallback and must never silently use the wrong weight.
- Large scripts and large style libraries are virtualized; only the current cue and visible preview cards are sampled, and caches are bounded; do not scan the whole timeline every frame, and do not create one persistent timeline element per character.

### Rendering and output

- The CPU reference, retained glyph scene, actual App stage, Web WASM and MP4 burn-in use the same time point; PNG checks cannot be replaced by DOM thumbnails.
- clean line is fully static; of the 9 dynamic sets only kinetic-wave loops continuously; check that pause and reduced-motion affect only the UI preview and not the output work.
- crop / clip must not cut off strokes or shadows that should be kept; soft focus is text blur; whether the background and word box take part in transforms is decided by explicit rules.
- Native App screenshots and actual playback acceptance, recording the display scale factor; shadow blur may use an explicit pixel tolerance, but timing and text content must not be smoothed over by tolerance.
- For subtitle-file or editable-project exports that do not support complex animation, list the support matrix and pre-check it; MP4 burn-in is the full-effect baseline.

Planned check commands (to run after the next implementation; not run this round):

```bash
cd core
cargo fmt --all -- --check
cargo test -p ccut-motion -p ccut-subtitle-render -p ccut-editor-core
# back to the repo root, run separately:
node scripts/dev/doc-seam-check.mjs
```

The app runs cargo test and native snapshots according to the impact scope; Web rebuilds the editor / subtitle WASM and runs typecheck, lint, test, ds:check and the subtitle end-to-end regression; the prototype runs the Spectrum gate, node --test and HTTP preview of both entry points. If the CLI public contract changes, also check help / spec, the ccut-serve comparison and the product skill directory.

## 12. First analysis delivery and boundaries (recorded before implementation)

The first analysis only submitted the plan and the directory index. It did not modify the renderer, style library, UI, protocol, fonts or product skill, and did not deploy. The product UI has no changes yet, so this round does not modify the prototypes or product specs for the three surfaces in advance; these are mandatory sync items for stage D.

Executed: static source inspection; AST extraction and verification of 10 / 16 / 5 presets and 17 primitives; 50-frame decoding and manual review of 10 preview videos; research material copy consistency and document link checks. No code tests, cross-platform visual regression, or 31-set CucCut export comparison were run, because this round has no product implementation.


## 13. Consolidated implementation scope

### 13.1 Consolidate existing and reference catalogs together

The gallery merges the original 33 families into 9 representatives, then adds 8 non-duplicate behavior recipes, for **17 entries** in total. 倒鸭子 (Daoyazi) stays independent: it changes cross-sentence typesetting and the camera, so it cannot be treated as a color variant. The original advanced Caption recipes keep their existing compatibility entries and are not deleted just because their colors are similar.

| Representative family | Merged looks / semantics |
| --- | --- |
| classic | prettymarketer, slay, kitty, hustle, grape, sprout, snugle, mint, rizz: current-word color change |
| shorts | Keeps frame-size adaptation and the Shorts layout |
| ali | matcha, beans, diego: narration light/dark; highlight can still switch through the original animation attribute |
| karl | flex, vinta, yeet: legacy float-in by narration timing |
| lime | boba, boo, plain, slant: legacy drop-in by narration timing |
| phantom / bulb / vegas | Respectively keep the moving highlight block, narration reveal, and page-turn behavior |
| simple | shadeplay, casper, corpo, capri, lowkey, plus Clean Line / 5 static references: static look set by attribute editing |
| studio-focus | Zoom Punch + Accent Pulse: emphasis color, scale and duration adjustable |
| studio-word-tiles | Word Blocks: every word has a fixed base block; the current word is emphasized independently |
| studio-word-drop | Word Drop: entrance staggered by the whole-sentence clock, distinct from the original narration Drop |
| studio-paper-typewriter | Fixed full-text typesetting, then reveal by glyph cluster, with a stable plate |
| studio-line-swipe | Lines from real wrapping slide in and are clipped |
| studio-soft-focus | Text soft-focus entrance |
| studio-rise-settle | Whole sentence rises and settles, tail exit |
| studio-kinetic-wave | Character entrance and continuous wave |
| studio-ktv | KTV lyrics: sung characters get a color sweep, a bouncing guide dot, and a two-line preview of the next line (added 2026-09-30, see §15) |

All original IDs stay in the registry. Loading by ID, recently used, archive, brand styles and project snapshots can still restore their original look. The merge only affects gallery display and representative-card selection state; old projects are not rewritten into representative cards. Basic's 16 sets are combinations of text roles and looks that reuse CucCut's existing 27 text presets and their font, plate and stroke properties; they do not add 16 new subtitle types.

Machine source of truth: `core/assets/subtitle-gallery.json` (representatives and aliases) and `subtitle-designs.json` (8 sets of parameters). The prototype syncs its data through `scripts/dev/sync-subtitle-designs.mjs`.

### 13.2 Time, storage and rendering

- `textMotion.version=1` expresses in, out, loop and independent word emphasis. The 17 primitives are compiled by `ccut-motion::text_motion` into the shared MotionProgram progress curve and sampled. Supports cue / line / word / grapheme and deterministic ordering.
- Typesetting completes before animation, reusing existing shaping. Do not split composed characters, ligatures or emoji grapheme clusters. Short sentences compress into the entrance and exit window. Absolute-time sampling supports reverse playback and random jumps.
- `wordBackground` is independent of text scaling; `backgroundPaddingY` can be set separately; `fontSizeBasis: height` explicitly converts against canvas height. Old projects without a basis keep using the short side.
- Real timestamps drive word emphasis. Translation and derived placeholder timestamps disable word emphasis; sentence-by-sentence in and out playback still applies.
- Style writes validate the version and parameters first. Scope override, copy / save and style switching follow the original transaction. Switching back to an old style clears the new animation fields.
- New animation pixels have one implementation: the shared CPU raster (`text_motion_raster.rs`). Native, WASM and MP4 use the same implementation; it is not yet encoded directly as a retained glyph scene. Only the active cue is sampled; static intervals reuse the cache. When a large font size exceeds the temporary layer budget, the static glyphs and base plate are kept.
- Fallback is decided per frame and applies only to the **subtitle layer**. Only when the line actually drawn in this frame (after the whole track is overlaid line by line) carries `textMotion` / `wordBackground` does the subtitle glyph scene report `WordAnimation`. Frames with no active motion cue go through the glyph scene as usual, and static admission (`subtitle_scene_static_fallback*`, `compositor_scene_support`) no longer rejects the whole film because of new animation.
  - Desktop compositor (App GPU preview, offscreen GPU for `studio export`): the subtitle layer of motion frames is rendered by `render_subtitle_frame`, cropped by the non-zero alpha bounding box into 1:1 texture nodes (integer rectangle, identity transform, window width and height rounded up to multiples of 64 to reuse textures), and placed at the z-order position of the original subtitle node. Slot names are stable per plan and do not change per frame. Video, stickers, shapes and templates remain GPU nodes; the export envelope keeps `render_backend: "gpu"`. Motion frames with non-Normal compositing still fall back.
  - Text elements with `textMotion` (writable via `ccut element style --patch`) likewise enter the scene as one CPU raster texture at the element position. They are rebuilt per frame only on frames that move (entrance, exit, loop, or the element also has `animation`). Static segments between the end of the entrance and the start of the exit are judged by the compiled motion's `boundary_windows` / `changing_at` (same basis as the raster: local clock snapped to frame, duration = end − start, text elements have no word timing, units = displayed text grapheme count). `next_change` points directly to half a frame before the exit starts (or to the element end if there is no exit). The Structural identity and the texture sampling clock take the static segment's start and do not mix in moments. The whole segment is one image, not re-rasterized or re-uploaded. The sampling clock of the subtitle layer texture is likewise fixed; its identity changes only with the frame key (moving frames carry the frame number, static frames carry `@settled`).
  - Web preview unchanged: as long as the film has animated subtitles, the whole subtitle layer goes through `renderSubtitleRaster`. Elements stay on GPU, because per-frame judgment would leave the first animated frame missing its subtitle.
- Subtitle files do not carry these effects. The editable-project pre-check uses the existing `attr-animation` warning; MP4 is the full-effect output.

### 13.3 Font sizes and UI

The system default single-language font size is 34. In bilingual mode, the top line takes 32 and the bottom line takes 20, regardless of language. The default translation sits on top and the original below; the seed ratios are `20/34` and `32/20`. When the ratio key is missing, rendering falls back to the root font size of 30 as its baseline, using `20/30` and `32/20`. The prototype's default track set also uses 32 for the top line and 20 for the bottom line; when the stacking is inverted, positions and sizes are swapped. Saved custom project styles and user defaults are not rewritten. Projects that follow the system default take the new values after the projection refreshes.

The property pages of all three surfaces edit the same duration, stagger interval, intensity, emphasis color/scale, and word-block color. Ordinary font, background plate, stroke, and shadow still use the existing controls. The pixels of new cards come from the shared Rust renderer. Web and the prototype build the subtitle WASM first. Prototype runtime assets are copied into the git-ignored `.runtime/subtitles/` via `--runtime`.

The six supplementary fonts and their OFL text are listed in `core/assets/fonts/subtitle-design-fonts.json`. CJK and other missing glyphs still use the original fallback. The sample text language is not set as the user content default.


## 14. Actual verification and limitations

- Native App `cargo check --bin cuccut` passed. The currently installed App was not replaced. No GPUI live snapshot or full App test was run.
- `ccut-motion` 180 tests and `ccut-editable` 43 tests passed. In the native test program built this round, subtitle rendering passed 248 tests and workspace passed 158 tests.
- editor-core, first run: 2,333 passed, 2 failed. The new bilingual recipe wrongly carried a fixed font size; this is fixed. The new save-restore test read a single-line partial as a root style; this is corrected to follow the Both write path of the single-language UI. The 60 regression tests for style, scope, write, and font on the new editor WASM all passed, including the bilingual ratio chain and the merged catalog.
- Prototype: 1,515 model tests passed. The App and Web entry points were checked over HTTP for the card, the bilingual stage, and parameter editing. Entry duration can be changed to 0.5 seconds, and track names and content are preserved. These browser screens were not used in place of GPUI anti-aliasing acceptance.
- Web typecheck, lint, design-system checks on both surfaces, catalog generation cross-check, doc links, SHA-256 and license checks for the 6 fonts, and the new coverage check of 15 keys × 15 languages passed. The product skill audit and catalog check passed.
- Production subtitle WASM rendered 8 families × 5 moments, 40 frames in total. Separately, a 1080p four-word sample was tested with the first 12 frames of each family. Under the machine's concurrent compile load at the time, this averaged about 10–38 ms/frame. Blur and multi-word scenes may be slower, so do not promise 30/60 fps for all projects. After trimming the transparent edges of temporary layers, this dropped significantly from the first version's 220–620 ms/frame.
- The 4 earlier native wasm-safe rendering integration tests passed. The native integration rerun extended to 7 tests (the last additions were missing-word timing, tail exit, and deterministic adjacent word blocks), and the full native rerun of editor-core, were not completed. They were held up by the queue behind 30+ Cargo jobs on the whole machine. I stopped the two commands from this task that were still queued, without interrupting other sessions. Do not record them as passed.

- 2026-09-28 per-frame rollback fix (GPU is no longer turned off for the whole piece because of new animation): subtitle render lib passed 254 tests, including the newly added `text_motion_subtitles_rasterize_into_a_texture_node_per_frame`, `text_elements_with_text_motion_become_texture_nodes`, and `text_motion_elements_hold_one_identity_while_still` (a 0–3 s element with a 0.6 s rise entrance: at t=1.0 and 2.0 the Structural identity and pixels are the same and `next_change` points to end; at t=0.1 and 0.3 the identities differ). Texture bytes equal the cropped CPU frame, the area outside the window is empty, slot names are stable across frames, and frames without motion cues are still glyph scenes. Integration tests passed except `text_motion_frames_match_golden`, which was not regenerated after a parallel session changed the rasterization. wasm-safe `text_motion` passed 8 tests. `ccut-compositor --features gpu --test gpu_target` passed 37 tests with 2 ignored. The newly added `compositor_text_motion_subtitle_texture_matches_cpu_and_plain_cues_stay_glyphs` actually ran on local Metal, and GPU readback is byte-identical to the CPU reference (`max_deviation == 0`). The kernel test `text_motion_subtitles_keep_auto_export_on_the_gpu` actually encoded with the auto backend, with receipt `render_backend: "gpu"` and `fallbacks: []`. `cargo check -p ccut-kernel`, the wasm32 check of `ccut-wasm-subtitle`, and App `cargo check --bin cuccut` passed. Not done: Windows / D3D, live Web browser, and GPUI snapshot.
- 2026-09-28 per-frame rasterization load reduction ([core log](../../changelog/core/2026-09-28-204033.md)): 1080p entrance window, before and after runs alternated and averaged. The eight design sets take 0.40–3.98 ms/frame (before: 0.58–4.23). A 30-glyph blur went from 8.7 to 1.56 ms, with shadow from 15.4 to 5.5 ms, and with glow from 17.1 to 6.4 ms. The SHA-256 of 324 frames is byte-identical to before. Afterwards, under parent transforms with translation, rasterization switched to subpixel and other textures to Bilinear. Pixels changed intentionally, and `text_motion_frames_match_golden` was regenerated accordingly. The fallback cap changed to canvas area × 4 (clamped between 16 Mpx and 8192²), so an 8K full-width line no longer degrades to static.

Checks that can still be run:

```bash
cd core
cargo test -p ccut-editor-core -p ccut-subtitle-render -p ccut-workspace --lib
cargo test -p ccut-subtitle-render --features wasm-safe --test text_motion
cargo run -p ccut-subtitle-render --example subtitle_design_sheet -- /tmp/subtitle-designs
```

Not run: the final native rerun above, the native example program, the full MP4 encoding chain, Windows, and the full Web E2E. CPU rasterization of the new animated subtitle layer and animation degradation in external editable projects are known limits; see §13.2. Rendered images and sampling timings were put back in the local analysis directory `subtitle-research/cuccut-implementation/`.

## 15. KTV lyrics (addendum 2026-09-30)

Four requirements were checked against existing capabilities. A dark stroke with a bright fill and shadow already exist (the style's own `textOutline` / `dropShadow`), so the new card only writes this set of parameters. Per-character color change, the junction guide dot, and the two-line preview did not exist before. They were added to `textMotion.karaoke`, and the gallery gained a representative card, `studio-ktv` (18 entries in total).

```json
{"textMotion":{"version":1,"karaoke":{"color":"#FF6A1A","guide":true,"nextLine":true}}}
```

- **Sweep**: words already sung are replaced wholesale with `color`. The word being sung advances by its own real start and end times, split evenly across the grapheme clusters within the word. The junction grapheme is drawn twice (base color once, then the sung color clipped to the left of the junction and overlaid once more), so a single character can be half-sung. Stroke and shadow do not change color. Pauses between words keep the sung part. Timing comes only from the original text's real word times. Translation lines have no word times of their own, so a translation line borrows real original words from the same time span (words whose midpoint falls within the span of this translation cue). When the original reaches a given word and how far into it, the translation sweeps proportionally across all of its own graphemes, and both lines start and end together (`TextMotionItem.karaoke_words` → `LineLayout.karaoke_words`). Lines that cannot borrow real original words (no word times, only derived placeholder words) do not sweep. They keep the base color and do not trigger per-frame redraws. The algorithm is `ccut-motion::text_motion::CompiledTextMotion::karaoke_sung`. The pixels are in the shared CPU rasterizer `text_motion_raster.rs`. The App preview, Web preview, and MP4 export all use the same implementation.
- **Guide dot** (`guide`): at the sweep junction, a small dot in the sung color sits above the top of the line, with its outer ring in the stroke color. In bilingual stacked mode, the lower line draws the dot below its own bottom edge and jumps downward (`LineLayout.guide_below`), so it does not press onto the text of the line above. The dot follows only original lines. Translation lines that sweep via borrowed timing do not get a dot, so two dots do not compete for the beat. It hops once per grapheme crossed (`karaoke_guide_hop`, using `libm` to keep output byte-identical across platforms). No dot is drawn before the first word starts.
- **Two-line preview** (`nextLine`): effective only in single-line mode (original-only or translation-only). The line being sung is placed on top. The next cue on the same track, using the same style and all in base color, is placed below (`LineLayout.preview`). It does not sample motion, does not sweep, and is not part of the frame cache key (the current line alone determines it). A next line that appears more than 8 seconds after the current line ends (an interlude) is not previewed. In bilingual mode the screen already shows two lines, so no third line is added. In the geometry sidecar, the preview line is still one `orig` line as usual; clicking it selects the next cue.
- The property page in all three surfaces edits the same set: sung color, the guide dot toggle, and the preview-next-line toggle. Font, stroke, and shadow still use the original controls. The translation line of the bilingual set keeps `karaoke` (only the read-aloud emphasis is removed), so after choosing the KTV card, the original and translation lines sweep together.
- Known limit: junction positions are computed from typeset layout and only the `dx` offset is applied. If the same style also stacks a scale or rotation entrance animation, the junction drifts slightly while the animation runs and is accurate after it ends. Subtitle files and editable projects do not carry the sweep (following the `attr-animation` warning in §13.2). For the full effect, use MP4.
