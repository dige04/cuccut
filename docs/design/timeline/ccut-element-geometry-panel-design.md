> Ported from CucCut v2. The data-model names in this text (timeline.json, Element, Source / Clip / Cut, etc.) refer to the v2 model. For how they map to v3 sequences, tracks and instances, see [element model mapping](element-model-mapping.md) and [architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# CucCut Element Geometry Panel Design (position · size · pin alignment, unified across template layers and all elements)

> Status: **landed** (2026-09-13). All of §10 was decided as recommended: pin points are not written to disk, percentages are kept, changing the aspect ratio does not reflow, multi-select is read-only, the layout editor gains eight handles plus snapping, directional offsets, and `subs_bottom` is unchanged. The optional CLI `--pin` in §8.1 is deferred and not built.
> Commits: core `3d00de6dc` `af611b4f4`, spec note `e5caa621f`, prototype `85cc73c40`, App v2 `f0f41ab55` `72ebf9a64`, Web `559e7218f`. Landing logs: [`core`](../../changelog/core/2026-09-13-130829.md), [`prototype`](../../changelog/prototype/2026-09-13-134903.md) (ledger [`ledger`](../../changelog/prototype-ledger/2026-09-13-134903.md)), [`app-v2`](../../changelog/app-v2/2026-09-13-140518.md), [`web`](../../changelog/web/2026-09-13-143324.md).
> Main deviations from this draft: template-layer snapping uses `geometry_panel::layer_snap_box` rather than `stage_snap::SnapBox::from_top_left`; wasm exports a `GeometryPanel` class rather than four free functions; the nine-point pins draw dots on all three surfaces and no new icon was added; element ⌥ fine-tuning is wired only to ⌥↑↓ (⌥←→ already does time nudging); “Snap to pin” zeroes both axes together, replacing the original four single-axis chips (a user-visible behaviour change).
> The body below keeps the original text from the handover. For the current state, the code and the per-surface logs are authoritative.
> Upstream basis: [`product-design/14/14.5.md`](../product/product-design/14/14.5.md) (template system and layout editor), [`product-design/14/14.2.md`](../product/product-design/14/14.2.md) (element canvas handles and snapping), [`product-design/14/14.4.md`](../product/product-design/14/14.4.md) (round 83: position / size removed from the element properties page), [`cuccut-format-spec/19.md`](../bcf/cuccut-format-spec/19.md) §19 (`place`) and [`cuccut-format-spec/20.md`](../bcf/cuccut-format-spec/20.md) §20 (template `box`), [`app-v2/template-layers.md`](../../archive/app-v2/template-layers.md) (App v2 template-layer landing ledger).

## 0. In one sentence

Give **template layers and all Timeline elements** one shared geometry panel: a **nine-point pin** (choose which edge or the centre of the frame to measure from) + **X / Y offset** + **width / height** (aspect lock optional), plus rotation and flip. The panel is an **edit projection**. The stored truth is still today's `place.x/y/w` (centre origin) and `box.x/y/w/h` (top-left origin), with **zero protocol changes**. Units stay as percentages of the frame, one decimal place, not pixels. The screenshot showing “the progress line runs off the frame after snapping to bottom” is a rendering / layout defect, not out-of-range data; §11 gives a repro recipe.

## 1. Background and problem

### 1.1 Trigger

In the App v2 layout editor (Edit layout), the user clicked “Snap bottom” on the “Progress line” layer. The panel showed Left 0.0% / Top 99.2% / Width 100.0% / Height 0.8%, yet on the stage the progress line was drawn **below** the canvas. The user's requests:

1. The panel only has “left / top”. To pin to the right or bottom, one has to mentally compute `100 − w` / `100 − h`, which is inconvenient.
2. Wants Xcode-style positioning: first pick which edge to align to, then enter the distance. And **all elements** should use the same scheme, so they can be fine-tuned by hand after placing them on stage.
3. Not just alignment: wants **unified position and size settings** for all elements.
4. Question: position is currently in percentages. Should it, like font size, be unified into “numbers”?

### 1.2 Five existing inconsistencies (survey findings)

| # | Inconsistency | Consequence |
|---|---|---|
| ① | **Three position UIs**: the layout editor uses a hand-built `− value +` stepper (%, one decimal, step 0.5 / 0.2); the subtitle style page uses `drag_slider` (%, zero decimals, step 1); the general element properties page has **no** position / size inputs (removed in round 83) | Users learn three different gestures in three places; elements can only be adjusted via canvas handles |
| ② | **Two coordinate systems**: template `LayerBox{x,y,w,h}` is top-left origin with a real `h`, hard clamping and hard validation; element `Place{x,y,w,scale,scaleY,rot}` is centre origin with **no `h`** (ruling D2) and only checks `is_finite` | The same “align” control cannot directly span both |
| ③ | **Snapping exists only for elements**: elements go through `stage_drag` (±1.5% midline) + `stage_snap` (6px multi-line + guide lines + ⌥ to disable) + a 15° rotation grid. The template `drag_box` / `resize_box` path has no snapping at all | Layer dragging in the layout editor does not snap to edges or centre |
| ④ | **The four chips are not orthogonal**: three manage vertical (snap top / snap bottom / full width actually manages horizontal), and `Center` **only centres x**. Chips never highlight and there is no state showing what is currently aligned | No snap-left / snap-right / vertical centre |
| ⑤ | The **only** persistent spatial anchor in the whole repo is `Element.vertical_align` (vertical only, text only, stringly-typed). There is no horizontal counterpart and nothing on template layers. The only complete anchor UI precedent is on the subtitle style page | The new panel must align with it and must not create a second vertical anchor |

### 1.3 Existing rulings this design overturns

Round 83 ([`14.4.md`](../product/product-design/14/14.4.md), “position / size / layer order / replace source sections all retired together”) removed the X/Y position and width/height inputs from the element properties page, on the grounds that canvas handles were enough. This draft **explicitly reverses** that, because the user has asked for manual fine-tuning and unified settings. Implementation must update in sync the “single source of truth” section of [`14.2.md`](../product/product-design/14/14.2.md), the round 83 section of [`14.4.md`](../product/product-design/14/14.4.md), and the layout editor section of [`14.5.md`](../product/product-design/14/14.5.md). It must also add a new divergence entry under `docs/changelog/prototype-ledger/` recording the reversal (see §8.5).

## 2. Current facts (by surface; line numbers match `main` as of 2026-09-13)

### 2.1 Core (`core/`)

**Template layer**

- Shape: [`ccut-protocol/src/template.rs`](../../../core/crates/ccut-protocol/src/template.rs) `LayerBox{x,y,w,h}` :54 (doc “percent of frame”; x/y are the **top-left corner**), `TemplateLayer` :203 (serde `box`), `TemplateDoc` :228, `LayerKind` :133 (`chapters|progress|logo|text`; within each kind, `size` = **% of frame height**), `TextAlign{Left,Center,Right}` :82 (governs text layout only), `MIN_W = 4.0` :14, `MIN_H = 0.6` :16, `check_box` :437-456 (**reports errors, does not clamp**, EPS 0.051).
- Geometry: [`ccut-timeline/src/template.rs`](../../../core/crates/ccut-timeline/src/template.rs) `Frame` :15, `r1` :73, `clamp_box` :91 (**clamps size first, then position**, one decimal place), `drag_box` :103, `resize_box` :112 (changes only w/h), `hit_test` :121, `subs_bottom` :249 (criterion `on && kind.is_strip() && y >= 50` → `100 − y + 2`, **ignores x/w/h**), default placement for new layers :512-548 (chapters `0,91,100,9`; progress `0,98,100,2`; logo `2,4,14,8`; text `4,14,40,6`).
- Editing semantics: [`ccut-editor-core/src/template.rs`](../../../core/crates/ccut-editor-core/src/template.rs) `update_layer` :143, `move_box` :151 (calls `clamp_box` again internally), `StudioSession{base,draft,sel,instance}` :203-283 (undo granularity = the whole document in one `setTemplate`), `KindMeta.strip` :31.
- The only write path is the whole-document `setTemplate` ([`ccut-kernel/src/cmd/template.rs`](../../../core/crates/ccut-kernel/src/cmd/template.rs) :24-60, five whole-set verbs). There are no per-layer ops.
- Protocol artifacts: `LayerBox` / `TemplateDoc` in [`docs/generated/protocol-schema.json`](../../generated/protocol-schema.json) (:4790 / :5646), sync test [`ccut-protocol/src/schema.rs`](../../../core/crates/ccut-protocol/src/schema.rs) :667 `generated_files_are_in_sync_with_the_source`. Web-side types are generated by `npm run protocol:gen` into [`apps/web/packages/protocol/index.ts`](../../../apps/web/packages/protocol/index.ts).

**Element**

- [`ccut-timeline/src/schema.rs`](../../../core/crates/ccut-timeline/src/schema.rs) `Place{x,y,w,scale,scale_y,rot,opacity,radius,corner_radii,flip_x,flip_y}` :1892-1911 (**no `h`**), `Place::validate` :1936-1967 (only checks `is_finite`), `Element.vertical_align: Option<String>` :375-384 (`"top"|"center"|"bottom"`; absent = center; `Element` is `deny_unknown_fields`), `CONFETTI_ORIGIN_RANGE = (-20,120)` :1338 (**% within the box**, a fourth base reference).
- [`ccut-timeline/src/geometry.rs`](../../../core/crates/ccut-timeline/src/geometry.rs) (ADR-E01, the single source of geometry): `DEFAULT_ELEMENT_W=20 / X=50 / Y=50`, `STICKER_BOX_HEIGHT_RATIO=0.62` :16-25; `width_basis` :214 (square-form stickers measure `w` on the **short side**); `element_height` :231; `static_box` :274 (centre origin → top-left pixel box).
- Stage math: [`ccut-editor-core/src/stage_drag.rs`](../../../core/crates/ccut-editor-core/src/stage_drag.rs) (percentage space) `SNAP_DISTANCE=1.5` :18, `TEXT_X_LIMITS=(3,97)` / `TEXT_Y_LIMITS=(4,96)` :62-63, `BROLL_*_LIMITS=(6,94)` :65-66, `corner_scale_about` :113, `EdgeResize` :170, `PlaceResize{x,y,w,scale_y}` :290, `place_resize_on` :327 (`h_pct = w_pct × aspect × scaleY`); [`stage_snap.rs`](../../../core/crates/ccut-editor-core/src/stage_snap.rs) (pixel space) `SNAP_THRESHOLD_PX=6` :30, `ROTATION_STEP_DEG=15` :33, `SnapBox::from_center` :56, `edges_x/edges_y` :66-71 (left/centre/right and top/middle/bottom, six lines; in effect the nine-point grid geometry, but it only lives inside one gesture).
- Default widths: [`ccut-editor-core/src/elements.rs`](../../../core/crates/ccut-editor-core/src/elements.rs) :583-607 (Shape 15, Sticker 18, Counter 28, others 30).
- Unit contract declaration: [`ccut-motion/src/preset_registry/textpreset.rs`](../../../core/crates/ccut-motion/src/preset_registry/textpreset.rs) :22-25, “`place.x/y` is percentage of the frame, `style.fontSize` is pixels on a reference short edge of 540, `place.rot` is an angle; there is no second unit at runtime”. `REFERENCE_SHORT_EDGE=540` in [`effects.rs`](../../../core/crates/ccut-timeline/src/effects.rs) :33; `REFERENCE_FONT_SIZE=30` in [`ccut-subtitle-render/src/document.rs`](../../../core/crates/ccut-subtitle-render/src/document.rs) :64, conversion :1995-2016.
- Consumers of `vertical_align`: [`render_plan.rs`](../../../core/crates/ccut-subtitle-render/src/render_plan.rs) :1423, :3407, :4114, :5995; [`raster.rs`](../../../core/crates/ccut-subtitle-render/src/raster.rs) :903-918 `anchor_block / seam_align`.
- Kernel CLI: [`ccut-kernel/src/cmd/timeline.rs`](../../../core/crates/ccut-kernel/src/cmd/timeline.rs) `ElementPatchArgs` :242-259 (`--x --y --w --opacity`; no h / anchor / rot).
- Gates and golden: `ccut-editor-core/tests/purity_gate.rs` (any newly added gpui-free geometry module must pass it), `ccut-subtitle-render/tests/no_second_implementation.rs`, `ccut-subtitle-render/tests/golden/template-layer-frames.json` (`CCUT_UPDATE_GOLDEN=1`), `ccut-wasm-editor/tests/api_shape.rs` :1614-1667 and :2373-2409 (`element_geometry` compared value by value), `core/fixtures/editor/*.json`.

### 2.2 App v2 (`apps/cuccut/`)

- Layout editor [`elements/template_studio.rs`](../../../apps/cuccut/src/app/editor/elements/template_studio.rs): four `box_line` :455-495 (step left/top/width 0.5, height 0.2, readout `{value:.1}%`, writes `ta::studio_set_box`); `box_line` implementation :499 (hand-built 24×22 `−`/`+`, **not** `drag_slider`. The slider unification in commit `c0c24465b` did not touch it, and the gate [`tests.rs`](../../../apps/cuccut/src/tests.rs) :2016 is a blocklist, so it raises no alarm); four chips :437-450 (`rows::chip(…, false, …)` never highlights; testids `template-studio-snap-{full|top|bottom|center}`).
- Criteria in [`template_actions.rs`](../../../apps/cuccut/src/app/editor/template_actions.rs): `Snap` :768-775, `studio_set_box` :1044 (clamp), `studio_snap` :1050, `snapped` :1061-1073 (`Bottom ⇒ y = 100 − h`, `Center ⇒ x = (100 − w)/2`, centres x only); gestures `studio_begin_gesture` :1218 / `studio_update_gesture` :1245-1271 (`drag_box` / `resize_box`, no snapping). Unit test :1328 `snaps_move_the_box_along_one_axis_only` (Bottom → y 92, Center → x 35; **does not assert y**).
- Stage [`stage/studio.rs`](../../../apps/cuccut/src/app/editor/stage/studio.rs): each layer gets a hit box (`chrome::layer_rect` = `box × frame_size`, [`stage/chrome.rs`](../../../apps/cuccut/src/app/editor/stage/chrome.rs) :29-37) with a 1px `0xFFFFFF55` border. When selected, **only one handle, at bottom-right** (12px circle, `studio_begin_gesture(…, true)`); subtitle guide lines :108-140.
- Element properties page [`elements/panel.rs`](../../../apps/cuccut/src/app/editor/elements/panel.rs) :1-45: the file header records “position / size retired (ledger #90)”. The only geometry row is `rotate_row` :435 (`ve::Slot::Rotation`, −180..180; flip goes through `toolbar::commit_flip`). [`value_edit.rs`](../../../apps/cuccut/src/app/editor/elements/value_edit.rs) has 47 `Slot`s :48-175 with **no X/Y/W/H**. The custom-origin rows for confetti :2852-2892 are the only numeric element x/y rows (% within the box).
- Stage gestures [`stage/objects.rs`](../../../apps/cuccut/src/app/editor/stage/objects.rs): `StageGesture::{Move,Width,Rotate,Corner,Edge,…}`, `snapped_position` :392, `snapped_width` :436, `snap_guide_lines` :468; `:2220` “the ±1.5% centre snap applies first, then the §5 6px edge / midline snap is layered on top”; rotation 15° grid :2301-2305. Arrow-key nudging is in [`stage/marquee.rs`](../../../apps/cuccut/src/app/editor/stage/marquee.rs) `nudge_subtitle`.
- Subtitle style page [`stylepane/sections.rs`](../../../apps/cuccut/src/app/editor/stylepane/sections.rs): `POSITION_RANGE = (0,100,1.0)` :149; `block_position` ≈:1838 = three-step Segmented control (`subtitle-position-quick`, y 10/50/90 + `verticalAlign`) + `style-y` slider (`%`, zero decimals) + off-stack rows `style-linex` / `style-liney` + three anchor-line icons `style-lineanchor` (`icons/align-{top,middle,bottom}.svg`). This is **the only complete anchor UI precedent in the repo**.
- Shared slider [`ui/slider.rs`](../../../apps/cuccut/src/ui/slider.rs): `SliderRange::new(min,max,step)`, `drag_slider` :275, `drag_slider_with_release` :284.
- Copy [`locales/template.yml`](../../../apps/cuccut/locales/template.yml): `template.studio.pos.{left,top,width,height}` :1253-1301, `template.studio.snap.{full,top,bottom,center}` :1317-1365 (translated into all 15 languages; [`apps/web/scripts/build-locales.mjs`](../../../apps/web/scripts/build-locales.mjs) :69 already bundles `apps/cuccut/locales/*.yml` into the Web bundle).
- Snapshot hooks [`app-v2/guide/snapshot-hooks.md`](../../guide/app-v2/snapshot-hooks.md): `CCUT_GPUI_TEMPLATE='apply=<id>;studio'`, `VK_ELPROPS=<selector>`, `CCUT_GPUI_SNAPSHOT=editor:<substring>:<png>`. `apply=` really writes `timeline.json`, so it needs a project whose media is on disk.
- In the App, the word “anchor” is already taken by text selection (`ui/selectable_text.rs`) and popover positioning (`ui/overlay.rs`, `ToolbarAnchor`). In core it is taken by the time domain (`TimeValue::Anchor` in [`schema.rs`](../../../core/crates/ccut-timeline/src/schema.rs) :357, `anchors.rs`, `align.rs`).

### 2.3 Web（`apps/web/`）

- **No layout editor**: [`panes/elements/TemplateProps.tsx`](../../../apps/web/src/features/editor/panes/elements/TemplateProps.tsx) only has the aspect-ratio lock switch plus a footer reading “Web 暂不提供” (“not offered on Web”) (ruling at :1-8); the template write path [`editor-core/template-lock.logic.ts`](../../../apps/web/src/editor-core/template-lock.logic.ts) `setTemplateOp` :83-85 replaces the whole template.
- Element property page [`panes/elements/ElementProps.tsx`](../../../apps/web/src/features/editor/panes/elements/ElementProps.tsx) :159-182 only has rotation / flip / opacity; text [`panes/text/TextProps.tsx`](../../../apps/web/src/features/editor/panes/text/TextProps.tsx) :112-134 / :234-259 has width % and rotation inside a `<details>`.
- Subtitle style [`panes/subtitle/style/Props.tsx`](../../../apps/web/src/features/editor/panes/subtitle/style/Props.tsx) :63-71 / :159-186: preset Segmented (top/center/bottom ↔ y 10/50/90) + `ValueRow` y% + anchor-line Segmented; when detached from a preset, `value=''`; logic in [`style/style.logic.ts`](../../../apps/web/src/features/editor/panes/subtitle/style/style.logic.ts) :161-224.
- Geometry logic: [`editor-core/element-box.logic.ts`](../../../apps/web/src/editor-core/element-box.logic.ts) :37-43 / :56-58 / :87-113; [`editor-core/stage-pose.logic.ts`](../../../apps/web/src/editor-core/stage-pose.logic.ts) :23-45, Caps :52-73, `fitPose` :169, `subClampY` :182; stage [`stage/InteractionLayer.tsx`](../../../apps/web/src/features/editor/stage/InteractionLayer.tsx) :49-72 / :197-266 / :288-300 / :341-350; write path [`apps/web/src/state/actions/elements.ts`](../../../apps/web/src/state/actions/elements.ts) :22-82 (`patch / place / placeMany / nudge / flip` atoms, accepting any `place` delta).
- Controls [`apps/web/src/ui/`](../../../apps/web/src/ui/): `Segmented.tsx`, `Field.tsx`, `Stepper.tsx`, `Slider.tsx`, `IconBtn.tsx`, `Toggles.tsx`. There is **no** NumberField and no nine-point picker. The `ValueRow` in `panes/elements/PropRows.tsx` (slider + number) and the `ValueRow` in `subtitle/style/rows.tsx` (−/+ slider number unit) are two separate copies. Component page [`features/components/ComponentsPage.tsx`](../apps/web/src/features/components/ComponentsPage.tsx) :163-190; DS gate `scripts/ds-check.mjs`.

### 2.4 Prototype (`designs/cuccut/`)

- [`app/model-template.js`](../../../designs/cuccut/app/model-template.js): `MIN_W/MIN_H` :82, `clampBox` :85-89, `dragBox/resizeBox` :136-140, `subsBottom` :190-199; export block :257-264 has **no snap helper and no `COLORS`**.
- [`app/panel-template-studio.jsx`](../../../designs/cuccut/app/panel-template-studio.jsx): four `window.ValueRow` :50-53 (steps 0.5/0.5/0.5/0.2); four `Btn` with inline arrow functions :54-58 (no pure model, no `node --test`, which violates [`designs/cuccut/AGENTS.md`](../../../designs/cuccut/AGENTS.md) :34, “computed things sink into `.js`”). **Existing bug** at :42: `const C = TPL.COLORS` is undefined, so choosing the background color “深 / 浅 / 无” (dark / light / none) on the chapters layer throws a TypeError.
- [`app/template-render.jsx`](../../../designs/cuccut/app/template-render.jsx): boxes use `%` directly for CSS at :104; font size `Math.max(7, p/100*fh)` at :18; `TemplateStudioStage` :168-203 frames by **`ctx.ratio` (project aspect ratio) rather than `tpl.canvas`** at :180.
- [`app/model-pose.js`](../../../designs/cuccut/app/model-pose.js) (`BC_POSE`, the pure-layer twin of `stage_drag.rs` / `stage_snap.rs`): `POSE0={x:50,y:50,w:20,scale:1,rot:0}` :53, `SNAP_PX=6 / CENTER_SNAP=1.5 / ROT_STEP=15 / MIN_W=2 / MIN_PX=10`, `TEXT_LIMITS / BROLL_LIMITS / CLIP_LIMITS={x:[-50,150],…}` (main-track clips are **deliberately allowed to go outside the frame**), `VALIGN_ITEMS` :408, `fitPose`, `handlesFor`. The file header at :17-18 and [`14.2.md`](../product/product-design/14/14.2.md) record that `pose.h` exists only in the `free` tier (round 122); the core uses `scaleY`.
- Stage [`app/stage-objects.jsx`](../../../designs/cuccut/app/stage-objects.jsx) `startMove` :165-183, `startCorner` :186-200; placement [`app/stage-elements.jsx`](../../../designs/cuccut/app/stage-elements.jsx) :534-537 (`translate(-50%,-50%)`, i.e. center-based).
- Property pages: [`app/panel-element-edit.jsx`](../../../designs/cuccut/app/panel-element-edit.jsx) :72-73, :202 and [`app/panel-element-style.jsx`](../../../designs/cuccut/app/panel-element-style.jsx) :184-185. All three state plainly “位置 / 尺寸不在这一页” (“position / size is not on this page”). The only geometry input is `RotateRow` :78-110.
- Subtitles [`app/panel-subprops.jsx`](../../../designs/cuccut/app/panel-subprops.jsx) :363-400, a four-part set (preset Segmented + `ValueRow` y inside a `<details>` + anchor-line Segmented + note). :380-381 deliberately labels it “锚线位置” (anchor-line position, not “垂直对齐” (vertical alignment)), because **alignment is a result, not a setting**. Historical lesson: the earlier `anchor + offset(0–30)` combination was overturned because “把两者绑死了，量纲也对不上” (“it tied the two together and the units don't match”) (round 49).
- Controls [`app/ui.jsx`](../../../designs/cuccut/app/ui.jsx): `Segmented` :265-288 (item `{k,label,icon,tip}`; icon-only uses `seg__b--icon`), `Stepper` :353-360 (no input box); [`app/panel-shared.jsx`](../../../designs/cuccut/app/panel-shared.jsx) `ValueRow` :49-75 (typing does not clamp; parse and clamp on blur / Enter; Esc rolls back). **There is no compact numeric grid and no nine-point control.** A new control must first go into `ui.jsx` → `Components.html` → screens, with its geometry checked against `_ds/adobe-spectrum-2/components/control-geometry.json`.
- The prototype has no i18n; all copy is inline Chinese. Font size uses the discrete px steps `B.SIZES = [12,14,…,140]` ([`app/model-toolbar.js`](../../../designs/cuccut/app/model-toolbar.js) :262).

## 3. Goals and Non-Goals

**Goals**

- G1 One panel, one set of math: the template layer and all elements with `place` (sticker / shape / text / counter / image / video / visualizer / progress / confetti / whiteboard / B-roll) share the “geometry” section.
- G2 Optional pin: any of the nine points can serve as the reference. X / Y is the distance to the reference edge (or center). “Pin to bottom” means pin the bottom point and set Y to 0, which can never go out of bounds.
- G3 Manual fine-tuning: fields can be typed into, stepped, and driven with arrow keys, at one-decimal precision. They are the same source of truth as the stage handles and follow each other in real time.
- G4 Three surfaces in sync (prototype / App v2 / Web). Web also gets the element geometry section. The Web layout editor is still not built (see non-goals).
- G5 Pure model pushed down: projection, inverse projection, default pin, and clamping are all gpui-free, DOM-free pure functions, implemented once (`ccut-editor-core`) + wasm export + prototype `.js` mirror + unit-test cross-checks.

**Non-goals**

- N1 Do not change the on-disk semantics of `place` / `LayerBox`, and do not add render-time fields (alternatives in §6.3 need a separate ruling).
- N2 Do not change position units to pixels (§5).
- N3 Do not rework the four-part position block of the subtitle style page. It is already the precedent for this design; only its icons and copy keys are aligned.
- N4 Do not build a layout editor for Web (the ruling at [`TemplateProps.tsx`](../../../apps/web/src/features/editor/panes/elements/TemplateProps.tsx) :1-8 stands).
- N5 No multi-select alignment / distribution (aligning to each other), and no re-layout by pin when the aspect ratio changes (§10 Q3).
- N6 Do not unify the two font-size units, template `size` (frame-height %) and element font size (reference 540 px). §5.3 only records this.

## 4. Concept Model

### 4.1 Terms

- **Canvas box `B = (l, t, w, h)`**: the visible rectangle of an element or layer on the canvas. All four values are canvas percentages (`l,w` relative to frame width, `t,h` relative to frame height), origin top-left. This is the panel's internal shared intermediate representation and is not persisted.
- **Pin `pin = (px, py)`**, where `px ∈ {left, center, right}` and `py ∈ {top, middle, bottom}`, a nine-point grid. It is named **pin / 钉点** to avoid the time-domain `anchor`, the text-layout `align`, and Confetti's `origin`. It uses the same verb as the existing copy “`place.y` 钉住文本块的哪条边” (“which edge of the text block `place.y` pins”) ([`schema.rs`](../../../core/crates/ccut-timeline/src/schema.rs) :375-384).
- **Panel value `V = (X, Y, W, H)`**: the four numbers the user sees and types. `X` / `Y` are the signed distances from the box to the pin reference. `W` / `H` are simply `w` / `h`.

### 4.2 Projection: canvas box → panel value

```
X = l                     if px = left      (distance from left edge)
X = (l + w/2) − 50        if px = center    (horizontal offset; 0 = centered, right positive, left negative)
X = 100 − (l + w)         if px = right     (distance from right edge)

Y = t                     if py = top       (distance from top edge)
Y = (t + h/2) − 50        if py = middle    (vertical offset; 0 = centered, down positive, up negative)
Y = 100 − (t + h)         if py = bottom    (distance from bottom edge)
```

Inverse projection solves the same equations for `l, t`. All four numbers use one decimal place (`r1`), and the projection round trip is lossless at one decimal.

### 4.3 Conversion between the two hosts and the canvas box

| Host | How `B` is obtained | What is written back |
|---|---|---|
| Template layer `LayerBox` | `l=x, t=y, w, h` taken directly | `x=l, y=t, w, h`, passed through `clamp_box` |
| Element `Place` (non-text, or `vertical_align` absent / center) | `w' = display width as canvas width percentage` (`w × scale`; for square variants, `width_basis` swaps the short-edge basis for a frame-width basis), `h' = element_height(...)` converted to frame-height percentage; `l = x − w'/2, t = y − h'/2` | `x = l + w'/2, y = t + h'/2`; `w` back-solved to its own basis; `h'` writes `scaleY` only for the free tier (the inverse of `place_resize_on`); H is read-only for other tiers |
| Text / timer element with `vertical_align = top / bottom` | `t = y` (top) or `t = y − h'` (bottom), rest the same as above | `y = t` (top) / `y = t + h'` (bottom) |

`h'` is always measured by the core `static_box` / `element_height` (the stage already does this). The panel does not compute height itself. When a text change causes `h'` to change, the panel values refresh accordingly, which matches today's handle behavior.

### 4.4 Where pins come from (not persisted)

The pin is the **reference frame for the edit projection**, not data. Each element / layer remembers the pin the user last chose within an edit session (App: `HashMap<String, Pin>` in editor state; Web: jotai atom; prototype: a `ctx` table). On first open, use `default_pin(B)`: for each axis, take the box's three candidate lines and pick the one closest to the corresponding canvas line (`left: l`, `center: |l + w/2 − 50|`, `right: 100 − l − w`; vertical likewise). Ties prefer `left` / `top`.
Text elements are the vertical exception: `py` takes `vertical_align` directly (absent = middle), and selecting a vertical pin **also writes `verticalAlign`** (since it is already render semantics, see §6.2).

### 4.5 Clamping and limits

- Template layer: after write-back, pass through `clamp_box` (size first, then position). Any cell of the pin grid with `X = Y = 0` stays inside the box. **This is the right fix for the kind of problem in the screenshot**: the panel no longer makes the user calculate `100 − h` in their head.
- Elements: keep the existing limits from `stage_drag` (text 3–97 / 4–96, B-roll 6–94, others unlimited and allowed outside the frame). Panel write-back uses the same `position` limit function as dragging. The `W` lower bound is `MIN_W 2%` and `MIN_PX 10` (the prototype `BC_POSE` matches the core).
- Clamping does not happen while typing. Parse and clamp on blur / Enter, and Esc rolls back (copying the semantics of `panel-shared.jsx` `ValueRow` :30-75 and the App `value_edit.rs`).

### 4.6 Editable matrix per element type

| Host | Pin | X / Y | W | H | Aspect lock | Rotate / flip |
|---|---|---|---|---|---|---|
| Template layer (4 kinds) | ✓ | ✓ | ✓ | ✓ | ✓ (off by default) | — |
| sticker / shape / image / video (`corner` / `free` tiers) | ✓ | ✓ | ✓ | free tier ✓ (writes `scaleY`); corner tier read-only | free tier ✓ | ✓ (existing row merged in) |
| text / counter (`text` tier, height follows content) | ✓ (vertical = `verticalAlign`) | ✓ | ✓ | read-only | — | ✓ |
| visualizer / progress / confetti / whiteboard | ✓ | ✓ | ✓ | the same kind's handle tier | same as left | same as left |
| B-roll | ✓ | ✓ (6–94 limits) | ✓ | read-only | — | existing strip |
| Subtitle | host not changed; keep the four-part set | — | — | — | — | — |

The “handle tiers” follow the three tiers of `BC_POSE.handlesFor` in [`14.2.md`](../product/product-design/14/14.2.md). Do not create a separate table during implementation.

## 5. Unit decision: percent vs “numbers”

### 5.1 Four baselines in the current code

| Quantity | Unit | Source |
|---|---|---|
| Template `box`, element `place.x/y`, caption `y` | Canvas percent | §2.1 |
| Element `place.w` | Percent of frame **width** (square models use the short side) | `geometry.rs` :214 |
| Template layer `size` | Percent of frame **height**, minimum 7px | `ccut-protocol/template.rs` :7-8, `template_layer.rs` :204-207 |
| Caption and text element `fontSize` | **Logical pixels on a reference short side of 540** (not output pixels) | `textpreset.rs` :22-25, `document.rs` :64 |
| Confetti `origin` | Percent within the box, may exceed 0–100 | `schema.rs` :1338 |

The “numbers” in the font-size scheme are also **virtual units**: `30px` means 30 pixels on the 540p reference frame, which becomes 60 pixels when exported at 1080p. They are not “real pixels”.

### 5.2 Decision: position and size **stay in canvas percent**, and the panel shows one decimal place

Reasons:

1. The frame is a project-level variable (16:9 ↔ 9:16, template `ratio` / `lockRatio`). Percent keeps its meaning when the frame changes, but pixels, even reference-540 pixels, change their long-edge value with the frame (960 for 16:9, 540 for 9:16), so the same `X = 40` means different things in the two frames.
2. Rendering, export fingerprints, golden files, wasm cross-checks, and the CSS placement in Web and prototype all work in percent. Changing the unit would change the contract, and the only gain would be display.
3. The user's pain points are “hard to align” and “three surfaces disagree”. Pins and a unified panel already solve these. Changing the unit does not.
4. The pixel scale differs between `x` and `y` (one multiplies by frame width, the other by frame height). Showing pixels in the panel would distort the intuition that “X and Y both being 10” look the same.

**What is unified is precision and gesture, not the unit**: every geometry field shows one decimal place; steps are `±0.5`, ⇧ `±5`, ⌥ `±0.1`. Arrow-key nudges keep 1% / ⇧ 5% ([`19.md`](../product/product-design/19.md) :34), and ⌥ 0.1% is new. On the caption style page, the y slider changes from zero decimal places to one decimal place (step size 1 unchanged).

### 5.3 Optional display unit (off by default, §10 Q2)

If users still want to see pixels, add a **display-only** preference “Geometry unit: % / px”, where px = reference-540 pixels (the same ruler as font size). Nothing is written to disk. Not recommended for phase 1. Merging the template `size` (frame height %) with element font size (reference-540 px) needs its own design; this draft does not touch it.

## 6. Data model and protocol

### 6.1 Recommended: Option B, the panel is a projection and the protocol has zero changes

- The on-disk truth does not change: `Place{x,y,w,scale,scaleY,rot,…}` is center-based, `LayerBox{x,y,w,h}` is top-left-based, and `Element.vertical_align` is unchanged.
- Pins are not persisted (§4.4).
- Therefore `docs/generated/protocol-schema.json` is unchanged, `timelineSchema` is unchanged, golden files are unchanged, export fingerprints are unchanged, and the `--x/--y/--w` semantics of `ccut-kernel` are unchanged.
- The only additions are one pure-function module (§8.1) and UI on three surfaces.

### 6.2 Ownership of `vertical_align`

Today it already defines the render semantics for “which edge `place.y` is pinned to”, which is exactly the vertical pin of a text element. This draft does not rename it or expand it into an object. The panel reads and writes it as `py`. Absent = middle. `Element` is `deny_unknown_fields`, and Web's `timelineSchema` is `additionalProperties:false`. **Any** new field must be synced in both places, which is another reason not to add a field.

### 6.3 Alternative: Option A, pins become the truth (`x,y` become pin coordinates)

Extend the `vertical_align` idea to two dimensions and to all elements: add `place.pin{x,y}` / `box.pin{x,y}`, and define `x,y` as the pin coordinates. The benefit is that pin semantics survive a frame change naturally, and the panel maps one-to-one onto the data. The cost:

- `geometry.rs::static_box`, the `stage_drag` clamp (`TEXT_X_LIMITS` computes from center), `stage_snap::SnapBox::from_center`, Web `element-box.logic.ts` / `stage-pose.logic.ts`, the prototype `stage-elements.jsx` `translate(-50%,-50%)`, the places in `ccut-motion` presets that read `place.x/y`, whiteboard `beats.box`, the wasm `api_shape` cross-check, fixtures, golden files, the protocol schema and Web generated types, and the field allowlists of `Element` / `timelineSchema` would all need to change.
- Migration of old documents: a missing `pin` is read as center (elements) / top-left (templates). A read-side fallback is possible, but the two defaults are themselves a new inconsistency.

Conclusion: not in phase 1. If §10 Q3, “on frame change, re-layout by pin”, is requested, revisit this option.

### 6.4 Naming avoidance

- `anchor`: already taken by the time domain (`TimeValue::Anchor`, `anchors.rs`, 243 occurrences in `align.rs`) and by UI popover positioning.
- `align`: already taken by `TextAlign` / `ALIGNS` / `cntAlign` text layout; the caption panel deliberately does not use the label “Align”.
- `origin`: already taken by the Confetti emission origin.
- Adopted: the concept is called **pin** (钉点); i18n key prefix `geometry.*` (new file `apps/cuccut/locales/geometry.yml`, 15 languages), copy in §7.4.

## 7. UI spec

### 7.1 Panel “Geometry” section (same layout on all three surfaces)

```
Geometry                                             [ % ]  (not shown in phase 1, §5.3)
┌─────────┐   Pin         X  From left  [ 12.0 ] %      W  [ 40.0 ] %
│ ○ ○ ○ │              Y  From top   [  4.0 ] %      H  [  6.0 ] %   [🔒]
│ ○ ● ○ │   (3×3 grid)
│ ○ ○ ○ │              [Snap to pin]  [Full width]  [Full height]
└─────────┘
Rotate  [   0 ] °   [⟷] [⇕]
```

- **3×3 pin grid**: an icon-only Segmented control in 3×3 layout (prototype `Segmented` in icon-only mode; App `seg_icons`; Web `Segmented`), with the current cell filled solid. Clicking changes only the reference frame and **does not move the element**; the X / Y readouts are recalculated. Icons: compose the nine cells from the geometry of the existing `align-top / align-middle / align-bottom` and `align-left / align-center / align-right` icons (new icons are added only in `designs/cuccut/app/icons.jsx`, via `scripts/dev/sync-ui-icons.mjs`).
- **X / Y labels change with the pin**: `From left / Offset X / From right`, `From top / Offset Y / From bottom`; the offset is a signed number (0 = centered).
- **Number fields**: compact numeric boxes (typing / arrow keys / scroll wheel) with a unit suffix. All three surfaces **add** a `NumField` (prototype `ui.jsx` + `Components.html`; Web `ui/NumField.tsx` + component page; App reuses the slot mechanism of `value_edit` and adds `Slot::{GeomX,GeomY,GeomW,GeomH}`). No sliders: position and size have no natural slider range (elements may extend outside the frame).
- **Lock ratio**: appears only on hosts where H is editable (§4.6). When on, changing W also updates H (template layers use the current `w/h`; elements use `aspect × scaleY`).
- **Quick actions**: `Snap to pin` (X = Y = 0), `Full width` (change the pin's horizontal side to left, X = 0, W = 100), `Full height` (same, vertically; appears only for template layers and the free mode). They replace today's four chips: `Top` = pin top + snap, `Bottom` = pin bottom + snap, `Center` = pin center/middle + snap (**both axes together**, which fixes ④).
- **Rotate / flip**: move the existing `rotate_row` / `RotateRow` / Web rotate-and-flip row into the last row of this section, without rewriting it.
- The element properties page goes before the style section and after the animation section. The layout editor's `LayerProps` four `ValueRow`s plus four `Btn`s are replaced as a whole.

### 7.2 Stage

- Elements: handles, snapping, guide lines, and the 15° grid are all unchanged. The panel and the handles share one source of truth (`place`). While dragging, the panel readouts follow in real time (App's `style_writes_repaint_too…` already guarantees the repaint).
- Template layout editor: **bring it up to element parity**: four corner and four edge handles (via a new `resize_box_from(box0, handle, dx, dy, frame)` in `ccut-timeline::template`, opposite-edge anchored, finished with `clamp_box`). While dragging, connect `stage_snap::snap_move` (canvas three lines + other layers' edges, 6px, ⌥ disables). Rotation is not supported (template layers have no `rot`).
- Arrow keys: 1% / ⇧ 5% unchanged; ⌥ 0.1% is new (wired for both elements and template layers).

### 7.3 Interaction details

- Invalid typed values are not written; out-of-range values are clamped on commit and the clamped number is echoed back.
- Undo granularity for template layers is unchanged (the whole `setTemplate`). For elements, each commit writes one `patch_element_op`; consecutive steps are merged into one undo step, following the existing slider convention (the rule from `1e0d2c87d`).
- Changing a text element's vertical pin = writing `verticalAlign`, and converting `place.y` to the new pin so the picture does not move (consistent with the caption style page's anchor-line Segmented behavior).
- Multi-select: the panel shows the first element's values; writes apply the same X / Y to all selected elements according to each one's own pin. Phase 1 may support single selection only, with multi-select greyed out (§10 Q4).

### 7.4 Copy keys (`geometry.yml`, en / zh-CN examples, all 15 languages translated)

| Key | en | zh-CN |
|---|---|---|
| `geometry.section` | Geometry | 几何 |
| `geometry.pin` | Pin | 钉点 |
| `geometry.pin.tip` | Measure position from this point | 位置从这个点量起 |
| `geometry.x.left` / `.center` / `.right` | From left / Offset X / From right | 距左 / 横向偏移 / 距右 |
| `geometry.y.top` / `.middle` / `.bottom` | From top / Offset Y / From bottom | 距顶 / 纵向偏移 / 距底 |
| `geometry.w` / `geometry.h` | Width / Height | 宽 / 高 |
| `geometry.lock_ratio` | Lock ratio | 锁定比例 |
| `geometry.snap_to_pin` | Snap to pin | 贴齐钉点 |
| `geometry.full_width` / `geometry.full_height` | Full width / Full height | 整宽 / 整高 |

After the layout editor is reworked, `template.studio.pos.*` and `template.studio.snap.*` are no longer referenced. Delete them (delete all 15 languages together; `locale_placeholders_match_english_in_every_language` checks this).

## 8. Per-surface implementation plan

Order: 8.1 core pure functions → 8.2 prototype (including product spec and ledger) → 8.3 App v2 → 8.4 Web → 8.5 documentation wrap-up. Commit each step separately. The core and the three surfaces may open worktrees in parallel, but only one cargo may run at a time (they share `core/target`).

### 8.1 Core: `ccut-editor-core::geometry_panel` (gpui-free, passes `purity_gate`)

New file `core/crates/ccut-editor-core/src/geometry_panel.rs`:

```rust
pub enum PinX { Left, Center, Right }   pub enum PinY { Top, Middle, Bottom }
pub struct Pin { pub x: PinX, pub y: PinY }
pub struct CanvasBox { pub l: f64, pub t: f64, pub w: f64, pub h: f64 }   // canvas percent
pub struct PanelValues { pub x: f64, pub y: f64, pub w: f64, pub h: f64 } // one decimal place
pub fn project(b: CanvasBox, pin: Pin) -> PanelValues;
pub fn unproject(v: PanelValues, pin: Pin) -> CanvasBox;
pub fn default_pin(b: CanvasBox) -> Pin;
pub fn layer_box(b: &LayerBox) -> CanvasBox;              // template host
pub fn layer_from(b: CanvasBox) -> LayerBox;              // goes through clamp_box
pub fn element_box(place, kind, vertical_align, frame) -> CanvasBox;   // via geometry::static_box
pub fn element_from(b: CanvasBox, prev: &Place, kind, vertical_align, frame) -> PlaceResize; // reuses stage_drag::PlaceResize
pub fn pin_y_from_vertical_align(&Option<String>) -> PinY;  pub fn vertical_align_for(PinY) -> Option<String>;
```

- Unit tests: project / unproject round trips (3×3 grid × several boxes), the tie-breaking rule of `default_pin`, bottom and right pins never overflowing, the three-state conversion of text `vertical_align`, and square-model short-side round trips. Move the semantics of the unit test at [`template_actions.rs`](../../../apps/cuccut/src/app/editor/template_actions.rs) :1328 (Bottom → y 92) here and **add an assertion for y centering**.
- `ccut-timeline::template` gains `resize_box_from(box0, handle: Handle, dx, dy, frame)` (eight handles, opposite-edge anchored) with tests; `stage_snap` adds `SnapBox::from_top_left` for template layers.
- wasm: `ccut-wasm-editor` exports `geometryProject / geometryUnproject / geometryDefaultPin / layerResizeFrom`, and `tests/api_shape.rs` cross-checks them value by value.
- Kernel CLI (optional, same commit or later): `ccut timeline element patch` gains `--pin <lx|cx|rx>-<ty|my|by> --px --py`, converting internally through the same module; the matching file in chapter 6 of [`ccut-cli-server-reference/`](../cli/ccut-cli-server-reference/) is updated in sync.
- Verification: `cd core && cargo fmt --all -- --check && cargo test -p ccut-editor-core -p ccut-timeline -p ccut-wasm-editor`. Golden files should not change; if they do, the implementation is wrong.

### 8.2 Prototype `designs/cuccut` (before the production surfaces, per [`designs/cuccut/AGENTS.md`](../../../designs/cuccut/AGENTS.md))

- `app/model-geometry.js` (`BC_GEOM`): mirror `project / unproject / defaultPin / layerBox / layerFrom / elementBox / elementFrom` from 8.1; `model-geometry.test.js` checks against the same set of numbers.
- `app/model-template.js`: move the four quick-action buttons down into `snap(box, mode)` (mirrors Rust `snapped`, and fixes “centering only centers x”), add `resizeBoxFrom`, and add `node --test`. While there, fix the undefined `TPL.COLORS` bug from §2.4 (log it in a separate changelog entry).
- `app/ui.jsx`: add `NumField` (compact number box: typing / ↑↓ / ⇧ / ⌥ stepping, commit on blur, Esc to revert) and `PinGrid` (3×3 icon Segmented variant). Add one cell each in `Components.html`; geometry is checked against `control-geometry.json`.
- `app/panel-shared.jsx`: add `GeometrySection` (§7.1 layout) for reuse in the template, element and text panels.
- `app/panel-template-studio.jsx` :50-58: replace the whole block with `GeometrySection`. `app/template-render.jsx`: add eight handles and snapping (`BC_POSE.snapMove` already exists; pass the top-left box).
- `app/panel-element-edit.jsx` / `panel-text.jsx` / `panel-element-style.jsx`: add the geometry section back, and replace the three “not on this page” comments.
- `app/editor-keys.jsx`: ⌥ arrow keys move 0.1%.
- Changed `<script>` tags in `CucCut.html` get `?v=YYYYMMDD-HHMM`.
- Docs: edit [`14.2.md`](../product/product-design/14/14.2.md) (add “the panel is a projection” to the single-source-of-truth section), [`14.4.md`](../product/product-design/14/14.4.md) (add a reversal note to the round-83 section), and [`14.5.md`](../product/product-design/14/14.5.md) (replace the layout-editor section with the pin-point layout). Create `docs/changelog/prototype/<timestamp>.md` and `docs/changelog/prototype-ledger/<timestamp>.md` (recording the reversal of round 83 and the difference that Web has no layout editor).
- Verification: three gates (the DS checker prints `ok:`; `node --test designs/cuccut/app/*.test.js`; HTTP preview. In the worktree, start `python3 -m http.server 4326 --directory designs` yourself and `curl` to confirm the new files).

### 8.3 App v2 `apps/cuccut`

- `elements/template_studio.rs` :437-495: delete the four `box_line` rows and the four chips, and replace them with the new module `elements/geometry_section.rs::render(host: GeometryHost, …)`. The `box_line` stepper implementation at :499 is deleted.
- `elements/geometry_section.rs` (new): nine-grid `seg_icons`, four `value_edit` number cells (new `Slot::GeomX/GeomY/GeomW/GeomH`, ranges supplied by the host), an aspect-lock switch, and three quick `rows::chip`s. The host enumerates `GeometryHost::{TemplateLayer(id), Element(id)}`. The pin-session table hangs off editor state: `geometry_pins: HashMap<String, Pin>`.
- `template_actions.rs`: delete the `Snap` enum and `snapped` at :768-775 / :1061-1073, and replace them with `studio_set_panel(id, pin, values)` → `geometry_panel::unproject` → `studio_set_box`. `studio_snap` goes through the same path. The gestures at :1245-1271 wire in `resize_box_from` + `stage_snap`. The unit test at :1328 moves to core, then is either deleted or changed to call core.
- `stage/studio.rs`: replace the single bottom-right handle at :77-103 with eight handles (reuse the handle drawing from `objects::`), and draw snap guide lines while dragging (reuse `snap_guide_lines`).
- `elements/panel.rs`: insert the geometry section at the rotation row position and merge `rotate_row` at :435 into it. Rewrite the file header at :1-45 and the note on ledger #90.
- `text/props.rs`: hook in the geometry section the same way (the vertical pin writes `verticalAlign`).
- `stage/marquee.rs`: ⌥ arrow keys move 0.1%.
- New `locales/geometry.yml` (15 languages). Remove `template.studio.pos.*` / `snap.*` from `template.yml`.
- Verification: `cargo test` (in `apps/cuccut/`, including `locale_placeholders_match_english_in_every_language`, `single_value_sliders_go_through_the_shared_drag_slider` and `stage_toolbar_layer_contract`). Snapshots: `CCUT_GPUI_TEMPLATE='apply=tpl-chapter-bar;studio' CCUT_GPUI_SNAPSHOT=editor:demo:/tmp/geom-studio.png ./run.sh`, `VK_ELPROPS=<sticker id> CCUT_GPUI_SNAPSHOT=editor:demo:/tmp/geom-el.png ./run.sh`, `VK_TEXTVIEW=<text id>:props …`. For projects that need media on disk, a locked screen gives a black image.
- Landing log: `docs/changelog/app-v2/<timestamp>.md`. In [`app-v2/template-layers.md`](../../archive/app-v2/template-layers.md), add one commit line to §1, and remove the “template layout editor has no snapping” type of gap from §4.

### 8.4 Web `apps/web`

- `apps/web/src/ui/NumField.tsx` and `apps/web/src/ui/PinGrid.tsx`: add them new and include them in `ComponentsPage.tsx`; pass `npm run ds:check`.
- `panes/elements/GeometrySection.tsx` (new): takes `place` + kind + `verticalAlign` + the box measured from the stage (`element-box.logic.ts` already exists). Conversion goes through the wasm-exported `geometryProject / geometryUnproject` (**do not write another formula in TS**, to avoid a second implementation). Write-back goes through `placeElementAtom`.
- `ElementProps.tsx` :159-182 and `TextProps.tsx` :112-134: wire it in. The width % row inside the `<details>` of `TextProps` merges into the geometry section.
- `TemplateProps.tsx` is not touched (N4). If the user later wants a Web layout editor, the geometry section can be reused directly.
- `InteractionLayer.tsx`: ⌥ arrow keys move 0.1% (the `nudge` atom gets a step-size parameter).
- Verification: `npm run wasm` (after core export changes), `npm run typecheck`, `npm run lint`, `npm test` (add round-trip cases to `GeometrySection.test.tsx` and `element-ops.test.ts`), `npm run ds:check`, and `test:e2e` if needed.
- Landing log: `docs/changelog/web/<timestamp>.md`.

### 8.5 Docs and spec wrap-up

- [`cuccut-format-spec/19.md`](../bcf/cuccut-format-spec/19.md) / [`20.md`](../bcf/cuccut-format-spec/20.md): add a paragraph to each stating “the editor panel is shown as a pin-point projection; the on-disk format is unchanged” (the contract is unchanged, this is only a clarification).
- [`ccut-cli-server-reference/`](../cli/ccut-cli-server-reference/): if 8.1 implements `--pin`, sync the `element patch` entry as well.
- Change the status line at the top of this document to “landed” and link it to each surface's commit.
- `skills/`: does not involve distributed skill commands or templates, so not applicable (basis for the final reply: `skills/cuccut` does not expose element geometry editing).

## 9. Handoff checklist (the implementing agent follows this from the start)

1. Read §4–§7 of this draft and the decisions in §10. Then, following the task routing in [`AGENTS.md`](../../../AGENTS.md), read [`14.2.md`](../product/product-design/14/14.2.md), [`14.5.md`](../product/product-design/14/14.5.md) and [`app-v2/template-layers.md`](../../archive/app-v2/template-layers.md).
2. Run `git status` to confirm the working tree; open a worktree; run only one cargo at a time.
3. Land 8.1 first (core pure functions + tests + wasm exports) and commit. Golden files and fixtures should not change.
4. Land the 8.2 prototype (including `Components.html`, the three gates, the three product-design sections, and one changelog and one ledger entry), and commit.
5. Land 8.3 App v2 (including `geometry.yml` in 15 languages, three snapshots, and the changelog), and commit.
6. Land 8.4 Web (including the component page, unit tests and the changelog), and commit.
7. 8.5 doc wrap-up, and commit. The final reply reports each commit hash, the gates actually run, skipped items, and the basis for “skill not applicable”.

Key files (the ten places with the most changes):
`core/crates/ccut-editor-core/src/geometry_panel.rs` (new), `core/crates/ccut-timeline/src/template.rs`, `core/crates/ccut-editor-core/src/stage_snap.rs`, `apps/cuccut/src/app/editor/elements/template_studio.rs`, `apps/cuccut/src/app/editor/template_actions.rs`, `apps/cuccut/src/app/editor/stage/studio.rs`, `apps/cuccut/src/app/editor/elements/panel.rs`, `designs/cuccut/app/panel-template-studio.jsx`, `designs/cuccut/app/panel-element-edit.jsx`, `apps/web/src/features/editor/panes/elements/ElementProps.tsx`.

## 10. Open questions (for the user to decide)

| # | Question | Recommendation |
|---|---|---|
| Q1 | Should pin points be persisted (plan B vs plan A, §6) | **B**: not persisted; session memory + `default_pin`. Text vertical alignment keeps using `verticalAlign` |
| Q2 | Units: keep % (§5.2); should a “show as px” preference be added (§5.3) | **Keep %**; do not add the px preference |
| Q3 | When the aspect ratio changes (16:9 ↔ 9:16, applying a template `ratio`), should elements be re-laid out by pin points | **Not in phase one**; evaluate plan A when needed |
| Q4 | When multiple items are selected, should the geometry section be writable (apply the same X / Y to all selected according to each one's pin) | **Read-only in phase one** (shows the first item, fields greyed out) |
| Q5 | Should the template layout editor get eight handles + snapping (§7.2) | **Yes**, for parity with elements |
| Q6 | Offset readout: signed offset (0 = centered) or center coordinate (50 = centered) | **Signed offset**, consistent with “flush = 0” |
| Q7 | `subs_bottom` ignores x/w: a short progress line with `x=40,w=10` still lifts the subtitles. Should it be changed to check horizontal overlap | Not changed in this draft; a separate small task |

## 11. Screenshot defect: after snapping to the bottom, the progress line is drawn outside the canvas (to be reproduced)

The data layer cannot go out of bounds. `snapped` writes `y = 100 − h = 99.2`, `studio_set_box` and `move_box` each clamp once, and the y upper bound of `clamp_box` is exactly `100 − h` ([`template.rs`](../../../core/crates/ccut-timeline/src/template.rs) :91-98). The unit test at :699 and [`template_actions.rs`](../../../apps/cuccut/src/app/editor/template_actions.rs) :1332-1336 both lock this. The panel readout Top 99.2 / Height 0.8 also confirms that the box is inside the frame. So the problem is in **stage drawing**, with three candidates:

1. The hit box `border_1()` and `selection_outline` in `stage/studio.rs` are drawn outset when `h = 0.8%` (about 2–3 px), so visually they overpower the canvas bottom edge. The handle circle (12px) is also centered on the box's bottom-right corner, so half of it lies outside the canvas.
2. The `frame_size` used by `chrome::layer_rect` is not the same rectangle as the canvas actually drawn (the aspect-clamped picture frame; see the [`ccut-app-preview-canvas-aspect-clamp`](../../changelog/app-v2/README.md) series), so the bottom edges do not line up.
3. When the template `canvas` differs from the project aspect ratio, the stage frames the view by the project aspect ratio (same as prototype `template-render.jsx` :180), and layers are positioned as percentages of the visible frame. The bottom edge therefore appears to lie outside “another canvas”.

Reproduction recipe (project with media on disk): `CCUT_GPUI_TEMPLATE='apply=tpl-chapter-bar;studio' CCUT_GPUI_SNAPSHOT=editor:demo:/tmp/tpl-studio-bottom.png ./run.sh`. Once inside, snap the progress layer to the bottom and capture. Compare with the exported frame from `ccut render` on the same `timeline.json` (direct draw in `ccut-subtitle-render::template_layer`) to check whether the box is inside the frame. When implementing 8.3, fix this one first and record the root cause in the changelog.
