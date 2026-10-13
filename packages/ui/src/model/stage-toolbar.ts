import { live, type ArrangeDirection, type AssetRecord, type BrandMediaKind, type Id, type LibrarySource } from '@cuccut/protocol';
import { asObject } from '../render/text-style.ts';
import { canDetachAudio } from './detach-audio.ts';
import { assetLibrarySource, brandKindForAsset } from './library-brand.ts';
import { editableTextStyle } from './property-values.ts';
import type { PlacedItem, Rect } from './stage-pose.ts';
import { M, type StageToolbarMessages } from './stage-toolbar-copy.ts';

/**
 * Rules for the floating canvas toolbar (`BC_BAR` in the prototype model-toolbar.js and stage-toolbar.jsx): when a clip on the frame is selected, which cells the bar shows by group, what is in the overflow menu (⋯), and what each cell does.
 *
 * Groups are laid out item by item from the prototype's config table (vertical dividers are drawn between groups; a nested group inside the menu is a row of icon buttons). Here each cell is then mapped to CucCut's way of doing things: opening a popover to change a value (the same write path as the properties panel: dragging only layers a draft, and release commits one transaction), drilling one level down in the menu, toggles, commands that commit at once, jumping to a section of the properties panel, or stating why it cannot be used yet (the protocol has no matching operation). The bar only handles drawing; it no longer hand-writes a second copy per type.
 */

/**
 * Which category the bar is laid out for (the prototype's `kind`; compositions are split by built-in generator). Unrecognised compositions fall back to a single “Properties” button.
 * `subtitle` is the subtitle bar (subtitles are not clips on the frame; see `captionToolbar`).
 */
export type BarKind =
  | 'text'
  | 'video'
  | 'image'
  | 'shape'
  | 'sticker'
  | 'progress'
  | 'wave'
  | 'counter'
  | 'confetti'
  | 'whiteboard'
  | 'subtitle'
  | 'other';

export type ToolId =
  | 'color'
  | 'font'
  | 'size'
  | 'text-styles'
  | 'animation'
  | 'transitions'
  | 'volume'
  | 'speed'
  | 'adjust'
  | 'border'
  | 'fill-list'
  | 'progress-colors'
  | 'progress-picker'
  | 'wave-colors'
  | 'wave-picker'
  | 'counter-mode'
  | 'volume-levels'
  | 'properties'
  | 'copy'
  | 'arrange'
  | 'save-to-brand-kit'
  | 'adjust-timing'
  | 'disable'
  | 'delete'
  | 'bold'
  | 'italic'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'line-height'
  | 'letter-spacing'
  | 'flip-vertical'
  | 'flip-horizontal'
  | 'fit-canvas'
  | 'fill-canvas'
  | 'opacity'
  | 'round-corners'
  | 'filters'
  | 'effects'
  | 'crop-video'
  | 'replace-video'
  | 'replace-image'
  | 'detach-audio'
  | 'sub-scope'
  | 'sub-edit'
  | 'sub-style'
  | 'sub-animation'
  | 'case'
  | 'hide-subs';

/**
 * Display name of each cell (prototype `ITEM`). For icon buttons, the name is the hover tooltip.
 * The prototype writes “copy” as “复制” (copy), which means making another copy (⌘D); here “复制” already means putting it on the clipboard with ⌘C, so it is written as “复制一份” (duplicate), the wording used on the prototype's multi-select page.
 */
export const TOOL_LABEL: Record<ToolId, string> = live(() => M.toolLabel);

/** One section of the config table: a group of cells; if a section inside the menu is a nested array, it is a row of icon buttons (further split into clusters within the row). */
type Group = ToolId[];
type Row = ToolId[][];
interface Layout {
  visible: Group[];
  more?: (Group | Row)[];
}

const FLIP_FIT: Row = [
  ['flip-vertical', 'flip-horizontal'],
  ['fit-canvas', 'fill-canvas'],
];

/**
 * The categories in the prototype `BAR` that match clips on the frame; grouping and order are copied item by item (templates, the text group, etc. are not on the CucCut canvas; for subtitles see `SUBTITLE_BAR`).
 * Opacity and “Disable clip” are added to match the CucCut v2 bars: every category except video has them in its menu (v2 calls it “Hide”), and “Disable clip” sits one cell before delete.
 */
export const BAR: Record<Exclude<BarKind, 'other' | 'subtitle'>, Layout> = {
  text: {
    visible: [
      ['color', 'font', 'size'],
      ['text-styles', 'animation'],
    ],
    more: [
      [
        ['bold', 'italic'],
        ['align-left', 'align-center', 'align-right'],
      ],
      ['line-height', 'letter-spacing'],
      ['opacity'],
      ['copy', 'arrange', 'save-to-brand-kit'],
      ['properties'],
      ['adjust-timing', 'disable', 'delete'],
    ],
  },
  video: {
    visible: [
      ['animation', 'transitions'],
      ['volume', 'speed'],
    ],
    more: [
      FLIP_FIT,
      ['opacity', 'round-corners'],
      ['filters', 'effects', 'adjust'],
      ['copy', 'arrange'],
      ['adjust-timing', 'crop-video', 'replace-video', 'detach-audio', 'save-to-brand-kit', 'delete'],
    ],
  },
  image: {
    visible: [['animation'], ['adjust']],
    more: [FLIP_FIT, ['opacity', 'round-corners'], ['copy', 'arrange'], ['adjust-timing', 'replace-image', 'save-to-brand-kit', 'disable', 'delete']],
  },
  shape: {
    visible: [['color'], ['border'], ['animation']],
    more: [FLIP_FIT, ['opacity'], ['copy', 'arrange'], ['properties'], ['adjust-timing', 'disable', 'delete']],
  },
  sticker: {
    visible: [['fill-list'], ['animation']],
    more: [FLIP_FIT, ['opacity'], ['copy', 'arrange'], ['properties'], ['adjust-timing', 'disable', 'delete']],
  },
  progress: {
    visible: [['progress-colors'], ['progress-picker'], ['animation']],
    more: [['opacity'], ['copy', 'arrange'], ['adjust-timing', 'disable', 'delete']],
  },
  wave: {
    visible: [['wave-colors'], ['wave-picker'], ['animation']],
    more: [['volume-levels', 'opacity'], ['copy', 'arrange'], ['adjust-timing', 'disable', 'delete']],
  },
  counter: {
    visible: [['counter-mode'], ['color', 'font', 'size'], ['animation']],
    more: [
      [
        ['bold', 'italic'],
        ['align-left', 'align-center', 'align-right'],
      ],
      ['opacity'],
      ['copy', 'arrange'],
      ['properties'],
      ['adjust-timing', 'disable', 'delete'],
    ],
  },
  // Confetti and whiteboard drawings: colour, shape, hand and paper are all on their own properties page, so only animation stays on the bar; they already fill the frame, so there is no flip and no fit-to-canvas.
  // The menu, like the other categories, has opacity and disable clip (in v2 they use the generic menu).
  confetti: {
    visible: [['animation']],
    more: [['opacity'], ['copy', 'arrange'], ['properties'], ['adjust-timing', 'disable', 'delete']],
  },
  whiteboard: {
    visible: [['animation']],
    more: [['opacity'], ['copy', 'arrange'], ['properties'], ['adjust-timing', 'disable', 'delete']],
  },
};

/**
 * Elements that do not have their own bar yet (hand drawing, placeholder boxes, code-package compositions): the bar shows only one “Properties” button, and the menu holds what the v2 categories share: opacity, copy / layer, duration, disable clip, and delete.
 */
export const OTHER_BAR: Layout = {
  visible: [['properties']],
  more: [['opacity'], ['copy', 'arrange'], ['adjust-timing', 'disable', 'delete']],
};

/**
 * Subtitle bar (prototype `BAR.subtitle`): first comes line-break editing (two lines when bilingual), then colour, font, and size, followed by Edit / Styles / Animation. The menu holds B / I, the three alignments plus case, line height and letter spacing, saving to the brand library, and hiding the subtitles. There is no delete: the source of truth for subtitle content is the transcript document, so the canvas only offers hide.
 *
 * The prototype's “All subtitles / This one only” (`sub-cue-scope`) in the first section and “Apply style to all subtitles” (`apply-style-to-global`) in the menu are not shown: subtitle styles in the video format are one whole document, with no per-cue overrides to write (see the note in caption-presets.ts).
 */
export const SUBTITLE_BAR: Layout = {
  visible: [['sub-scope'], ['color', 'font', 'size'], ['sub-edit', 'sub-style', 'sub-animation']],
  more: [
    [
      ['bold', 'italic'],
      ['align-left', 'align-center', 'align-right', 'case'],
    ],
    ['line-height', 'letter-spacing'],
    ['save-to-brand-kit', 'hide-subs'],
  ],
};

/**
 * Classified by element kind: text with a timer readout is the timer kind; a waveform is `wave` (animated stickers share the same bar as stickers: in the prototype, Lottie also goes down the side that can recolour). Hand drawing, placeholder boxes and code-package compositions have no bar of their own in either the prototype or the legacy version, so they fall back to a single “Properties” button.
 */
export function barKindOf(item: PlacedItem): BarKind {
  switch (item.type) {
    case 'text':
      return item.counter ? 'counter' : 'text';
    case 'video':
    case 'image':
    case 'shape':
    case 'sticker':
    case 'progress':
      return item.type;
    case 'visualizer':
      return 'wave';
    case 'confetti':
    case 'whiteboard':
      return item.type;
    case 'draw':
    case 'placeholder':
    case 'composition':
      return 'other';
  }
}

// ---- What each cell does ----

/**
 * - `pop`: opens a popover on the bar to change a value; `sub`: drills one level down in the menu (slider, time); `toggle`: the toggle button on that menu row;
 * - `command`: commits at once; `jump`: opens the properties panel and scrolls to this section (`null` is the top of the page; section names are stable keys, and section header text follows the UI language);
 * - `off`: cannot be used right now; `reason` is shown to the user.
 */
export type ToolAction =
  | { kind: 'pop' }
  | { kind: 'sub' }
  | { kind: 'toggle' }
  | { kind: 'command' }
  | { kind: 'jump'; section: InspectorSection | null }
  | { kind: 'off'; reason: string };

export interface Tool {
  id: ToolId;
  label: string;
  action: ToolAction;
}

/** One section of the menu: a row of icon buttons (split into clusters) or a column of menu items. */
export type MenuGroup = { kind: 'row'; clusters: Tool[][] } | { kind: 'list'; tools: Tool[] };

export interface ToolbarSpec {
  kind: BarKind;
  visible: Tool[][];
  /** null when there is no overflow menu: no ⋯ is drawn. */
  more: MenuGroup[] | null;
}

/** For cells with no matching operation in the protocol yet: why they cannot be used. */
export const OFF_REASON: StageToolbarMessages['offReason'] = live(() => M.offReason);

/** The four rows (display names) of the “Layer” drill-down page and the name of this operation. */
export const ARRANGE_COPY: StageToolbarMessages['arrange'] = live(() => M.arrange);
/** Order of the “Layer” drill-down page: two rows for moving forward, a line, then two rows for moving backward. */
export const ARRANGE_ROWS: readonly (readonly ArrangeDirection[])[] = [
  ['front', 'forward'],
  ['backward', 'back'],
];

/** Sections in the properties panel that can be jumped to directly. */
export type InspectorSection = 'style' | 'transition' | 'effects';

const jump = (section: InspectorSection | null): ToolAction => ({ kind: 'jump', section });
const off = (reason: string): ToolAction => ({ kind: 'off', reason });
const POP: ToolAction = { kind: 'pop' };
const SUB: ToolAction = { kind: 'sub' };
const TOGGLE: ToolAction = { kind: 'toggle' };
const COMMAND: ToolAction = { kind: 'command' };

/** When a text style carries a schema (a style object from another format), the cells that change text are unavailable. */
function textStyleAction(item: PlacedItem, action: ToolAction): ToolAction {
  if (item.type !== 'text' || editableTextStyle(item.style)) return action;
  return off(M.textStyleLocked(String(asObject(item.style).schema)));
}

/** Beyond the bar: this item's asset (where the file comes from when saving to the brand library), and whether the UI is running in a browser. */
export interface BarContext {
  asset?: AssetRecord;
  /** The brand library cannot be called in a browser session (`library.*` is not on the Web service's allowlist). */
  web?: boolean;
}

/** The asset the clip draws (videos, images, and stickers and placeholder boxes drawn from an asset). */
export function itemAsset(item: PlacedItem, assets: Record<Id, AssetRecord>): AssetRecord | undefined {
  return 'assetRef' in item && item.assetRef ? assets[item.assetRef.id] : undefined;
}

/**
 * Which section a clip asset is saved to in the brand library, and where its file is taken from: it can only be saved if the original file can be obtained (generated assets use the output; linked assets use the original file); when it cannot, the reason is given. Whether this cell is usable on the bar and what gets saved when pressed follow the same rule.
 */
export function brandTarget(asset: AssetRecord | undefined): { kind: BrandMediaKind; source: LibrarySource } | { reason: string } {
  const kind = asset && brandKindForAsset(asset);
  if (!asset || !kind) return { reason: OFF_REASON.brand };
  const found = assetLibrarySource(asset);
  return 'source' in found ? { kind, source: found.source } : found;
}

/** What a cell turns into for this item. */
export function toolAction(id: ToolId, item: PlacedItem, kind: BarKind, context: BarContext = {}): ToolAction {
  switch (id) {
    case 'color':
      // The timer's colour, font and size are generator parameters; the controls are on the properties panel.
      if (kind === 'counter') return jump(null);
      return item.type === 'shape' ? POP : textStyleAction(item, POP);
    case 'font':
    case 'size':
      return kind === 'counter' ? jump(null) : textStyleAction(item, POP);
    case 'bold':
    case 'italic':
    case 'align-left':
    case 'align-center':
    case 'align-right':
      return kind === 'counter' ? jump(null) : textStyleAction(item, TOGGLE);
    case 'line-height':
    case 'letter-spacing':
      return textStyleAction(item, SUB);
    case 'text-styles':
      return textStyleAction(item, jump('style'));
    case 'border':
      return POP;
    case 'animation':
      return off(OFF_REASON.animation);
    case 'transitions':
      return jump('transition');
    case 'adjust':
    case 'effects':
      // Colour grading, blur, shadow and stroke are all in the “Effects” section of the properties panel (the prototype's “Adjust” page is here colour grading within the effect stack).
      return jump('effects');
    case 'volume':
      return item.type === 'video' || (item.type === 'composition' && item.audio) ? POP : off(OFF_REASON.sound);
    case 'speed':
      return item.type === 'video' && item.timeMap.kind === 'linear' ? POP : off(OFF_REASON.speed);
    case 'fill-list':
    case 'progress-colors':
    case 'progress-picker':
    case 'wave-colors':
    case 'wave-picker':
    case 'counter-mode':
    case 'volume-levels':
      // Composition parameters (these change generator parameters): the controls are all at the top of the properties panel.
      return jump(null);
    case 'properties':
      return jump(null);
    case 'copy':
    case 'delete':
    case 'disable':
    case 'fit-canvas':
    case 'fill-canvas':
      return COMMAND;
    case 'flip-vertical':
    case 'flip-horizontal':
      return TOGGLE;
    case 'opacity':
    case 'adjust-timing':
      return SUB;
    case 'arrange':
      // The four directions drill down one level in the menu (`OrderSub` in the prototype stage-toolbar-menu.jsx); directions that cannot move are greyed out.
      return SUB;
    case 'save-to-brand-kit': {
      // The brand library holds assets and subtitle styles; there is no text style section.
      if (item.type === 'text') return off(OFF_REASON.brandText);
      if (context.web) return off(OFF_REASON.brandWeb);
      const target = brandTarget(context.asset);
      return 'reason' in target ? off(target.reason) : COMMAND;
    }
    case 'round-corners':
      return off(OFF_REASON.roundCorners);
    case 'filters':
      return off(OFF_REASON.filters);
    case 'crop-video':
      return off(OFF_REASON.crop);
    case 'replace-video':
    case 'replace-image':
      // Opens the replace-asset window, replacing only this segment (`itemId` in asset-replace.ts).
      return COMMAND;
    case 'detach-audio':
      // After separating, the video's own sound is turned off, so pressing this cell again still means “no sound”.
      return item.type === 'video' && canDetachAudio(item, context.asset) ? COMMAND : off(OFF_REASON.sound);
    case 'sub-scope':
    case 'sub-edit':
    case 'sub-style':
    case 'sub-animation':
    case 'case':
    case 'hide-subs':
      // Only for the subtitle bar (see `captionAction`); it is not in the config table for frame elements.
      return COMMAND;
  }
}

const isRow = (group: Group | Row): group is Row => group.some((entry) => Array.isArray(entry));

function specOf(kind: BarKind, layout: Layout, tool: (id: ToolId) => Tool): ToolbarSpec {
  return {
    kind,
    visible: layout.visible.map((group) => group.map(tool)),
    more: layout.more
      ? layout.more.map((group) =>
          isRow(group) ? { kind: 'row', clusters: group.map((cluster) => cluster.map(tool)) } : { kind: 'list', tools: group.map(tool) },
        )
      : null,
  };
}

/** What the bar and menu look like when this item is selected. */
export function toolbarFor(item: PlacedItem, context: BarContext = {}): ToolbarSpec {
  const kind = barKindOf(item);
  const layout: Layout = kind === 'other' || kind === 'subtitle' ? OTHER_BAR : BAR[kind];
  return specOf(kind, layout, (id) => ({ id, label: TOOL_LABEL[id], action: toolAction(id, item, kind, context) }));
}

// ---- Subtitles ----

export interface CaptionBarInput {
  /** The original and translation share this style (two lines when bilingual): the two line-break chips appear only at the front of the bar. */
  paired: boolean;
  /** Subtitles already have their own style document, so there is something to save to the brand library only then (nothing while the default style is still in use). */
  styled: boolean;
  /** The brand library cannot be called in a browser session. */
  web?: boolean;
}

/** What a cell on the subtitle bar turns into: the text-style cells take the same form as text elements, but they write to the subtitle style document. */
function captionAction(id: ToolId, { styled, web }: CaptionBarInput): ToolAction {
  switch (id) {
    case 'color':
    case 'font':
    case 'size':
      return POP;
    case 'bold':
    case 'italic':
    case 'align-left':
    case 'align-center':
    case 'align-right':
      return TOGGLE;
    case 'line-height':
    case 'letter-spacing':
      return SUB;
    case 'save-to-brand-kit':
      if (web) return off(OFF_REASON.brandWeb);
      return styled ? COMMAND : off(OFF_REASON.captionDefaultStyle);
    default:
      // Line break, Edit, Styles, Animation (opens the properties panel at “Current word”), case cycling one step at a time, and hiding subtitles: all take effect immediately.
      return COMMAND;
  }
}

/** What the bar and menu look like when subtitles are selected. When only one kind of line uses this style, the first section (line break) is not shown at all. */
export function captionToolbar(input: CaptionBarInput): ToolbarSpec {
  const layout: Layout = input.paired ? SUBTITLE_BAR : { ...SUBTITLE_BAR, visible: SUBTITLE_BAR.visible.filter((g) => !g.includes('sub-scope')) };
  return specOf('subtitle', layout, (id) => ({ id, label: TOOL_LABEL[id], action: captionAction(id, input) }));
}

/** The four case modes for subtitles (the same set as the “Case” dropdown in the properties panel; `capitalize` capitalises the first letter). */
export const CAPTION_CASES = ['none', 'uppercase', 'title', 'lowercase'] as const;
export type CaptionCase = (typeof CAPTION_CASES)[number];

export function captionCase(transform: unknown): CaptionCase {
  if (transform === 'uppercase' || transform === 'lowercase') return transform;
  return transform === 'title' || transform === 'capitalize' ? 'title' : 'none';
}

/** Pressing the case button in the menu moves to the next mode (prototype `case`: as is → all caps → capitalised → all lower case → as is). */
export function nextCaptionCase(transform: unknown): CaptionCase {
  return CAPTION_CASES[(CAPTION_CASES.indexOf(captionCase(transform)) + 1) % CAPTION_CASES.length]!;
}

// ---- Placement ----

/** The bar sits 12px from the selection box (prototype `.mtb`); when there is a rotation handle above the selection box, it is raised to 50px to clear it (`.mtb--rot`). At least 8px from the stage edge. */
export const BAR_GAP = 12;
export const BAR_LIFT = 50;
export const BAR_MARGIN = 8;

export interface Size {
  w: number;
  h: number;
}

export interface BarPlacement {
  left: number;
  top: number;
  /** Flipped to below the selection box. */
  below: boolean;
  /** When the stage is narrower than the bar, the bar is at most this wide (it scrolls horizontally). */
  maxWidth: number;
}

/**
 * Where the bar goes (stage pixels; `box` is the rotated bounding box of the selected item): horizontally centred on the selection box and clamped inside the stage; vertically it goes above first; if there is no room above (against the top of the stage), it flips below; if there is no room below either, it is clamped within the bottom edge of the stage.
 */
export function toolbarPlacement(box: Rect, area: Size, bar: Size, knob: boolean): BarPlacement {
  const maxWidth = Math.max(0, area.w - BAR_MARGIN * 2);
  const width = Math.min(bar.w, maxWidth);
  const left = Math.max(BAR_MARGIN, Math.min(box.x + box.w / 2 - width / 2, area.w - width - BAR_MARGIN));
  const above = box.y - (knob ? BAR_LIFT : BAR_GAP) - bar.h;
  if (above >= BAR_MARGIN) return { left: Math.round(left), top: Math.round(above), below: false, maxWidth: Math.round(maxWidth) };
  const below = box.y + box.h + BAR_GAP;
  const top = Math.max(BAR_MARGIN, Math.min(below, area.h - bar.h - BAR_MARGIN));
  return { left: Math.round(left), top: Math.round(top), below: true, maxWidth: Math.round(maxWidth) };
}
