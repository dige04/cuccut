/** Restored application module; prepare first, initialize in original order. */
import type {
  MemoExoticComponent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactElement,
  ReactNode,
  RefObject,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type { DeckSection, Slide, SlideId } from "../deck-contracts";
import type { SlideDocumentCodec } from "../documents/slide-codec";
import type { SectionGroup, SectionInsertTarget } from "../model/sections";
import type { ContextMenuPoint } from "../ui/context-menu-popup";
import type {
  CameraView,
  GridEnterFrom,
  GridPick,
  GridZoomApi,
  GridZoomLimits,
  ScreenRect,
  SlideGridSelection,
} from "./app";
import type { GridSlideHit } from "./grid-notes-click";

/** A point on the canvas, in canvas units. */
export interface GridPoint {
  x: number;
  y: number;
}
/** A rectangle on the canvas, in canvas units. */
export interface GridRect extends GridPoint {
  w: number;
  h: number;
}
/** Where the canvas element sits on screen (the part of a client rect the camera maths reads). */
export interface GridContainerOrigin {
  left: number;
  top: number;
}
/** One slide placed on the canvas. */
export interface SlideGridTile extends GridPoint {
  id: SlideId;
  /** Index of the row it sits in. */
  row: number;
  /** Column within that row. */
  col: number;
  /** 1-based position in deck order. */
  n: number;
  /** Index of the section group it belongs to. */
  seg: number;
}
/** One row of tiles; a long section wraps onto continuation rows. */
export interface SlideGridRow {
  key: string;
  section: DeckSection | null;
  seg: number;
  y: number;
  ids: SlideId[];
  continuation: boolean;
}
/** Where every slide and section row sits on the canvas. */
export interface SlideGridLayout {
  tiles: SlideGridTile[];
  rows: SlideGridRow[];
  width: number;
  height: number;
  left: number;
  sectioned: boolean;
  /** Height of the speaker-notes strip under each tile (0 when notes are hidden). */
  notes: number;
}
/** Where a dragged slide would land: in a gap between rows (a new section) or beside a tile. */
export interface SlideGridDropHit {
  kind: "gap" | "tile";
  row: number;
  before: SlideId | null;
  gapIndex: number;
}
/** The section and position that a drop resolves to. */
export interface SlideGridMoveTarget {
  sectionId: string | null;
  index: number;
}
/** Size of the "add slide" button that appears in the gap between tiles. */
export interface GridAddButtonSize {
  size: number;
  fits: boolean;
  fitsTouch: boolean;
}
/** The part of a pointer event that decides whether a drag starts a marquee. */
export interface GridPointerInfo {
  pointerType: string;
  button: number;
  /** The press landed on bare canvas. */
  bare: boolean;
}
/** Slides and sections picked on the canvas. */
export interface GridSelectionSet {
  slides: SlideId[];
  sections: string[];
}
/** Props of the canvas (slide grid) view. */
export interface SlideGridProps {
  order: SlideId[];
  sections: DeckSection[] | undefined;
  slides: Readonly<Record<SlideId, Slide>>;
  assets: ReadonlyMap<string, string>;
  currentId: SlideId | null;
  readOnly: boolean;
  /** Space the toolbar takes at the top of the canvas. */
  topInset?: number;
  /** The canvas is covered by the editor: it ignores input. */
  inert?: boolean;
  /** The slide surface the canvas should grow out of when it opens. */
  enterFrom?: GridEnterFrom | null;
  /** The slide that is open in the editor in front of the canvas. */
  behind?: SlideId | null;
  coverId?: SlideId | null;
  notesShown?: boolean;
  commentCounts?: ReadonlyMap<SlideId, number>;
  commenting?: boolean;
  commentLayer?: (container: RefObject<HTMLDivElement | null>) => ReactNode;
  peerLayer?: (glyphScale: number, tiles: SlideGridTile[]) => ReactNode;
  heldSlide?: SlideDocumentCodec["slideHtmlHold"];
  zoomApiRef?: { current: GridZoomApi | null };
  onScaleChange?: (scale: number) => void;
  onCameraChange?: () => void;
  onSelectionChange?: (selection: SlideGridSelection) => void;
  onSelect: (id: SlideId) => void;
  onOpen: (id: SlideId, pick?: GridPick) => void;
  onClose: () => void;
  onDuplicate: (id: SlideId) => void;
  onCopy: (id: SlideId) => void;
  onDelete: (id: SlideId) => void;
  onToggleSkip: (id: SlideId) => void;
  onSetCover?: (id: SlideId) => void;
  onAdd: () => void;
  onMove: (id: SlideId, index: number) => void;
  /** Duplicates the slides (after `target` when given) and returns the new ids. */
  onDuplicateSlides: (ids: SlideId[], target?: SectionInsertTarget) => SlideId[];
  onCopySlides: (ids: SlideId[]) => void;
  onDeleteSlides: (ids: SlideId[]) => void;
  onSetSlidesSkipped: (ids: SlideId[], skipped: boolean) => void;
  onSectionFromSlides: (ids: SlideId[]) => void;
  onMoveSlidesTo: (ids: SlideId[], sectionId: string | null, index: number) => void;
  onMoveSections: (sectionIds: string[], gapIndex: number) => void;
  onStartSectionWithSlides: (ids: SlideId[], gapIndex: number) => void;
  onSetSectionDescription: (sectionId: string | null, description: string) => void;
  onRemoveSection: (sectionId: string) => void;
  onAddSection: (sectionId: string) => void;
}
/** Props of one slide thumbnail on the canvas. */
export interface GridSlideThumbnailProps {
  slide: Slide;
  assets: ReadonlyMap<string, string>;
  readOnly: boolean;
}
/** The section description being edited in place. */
interface GridSectionEdit {
  key: string;
  sectionId: string | null;
  text: string;
}
/** A slide or section drag that is in progress (pointer down, possibly not yet moved). */
interface GridPointerDrag {
  kind: "tile" | "row";
  /** The dragged slide, or the dragged section. */
  id: string;
  ids: string[];
  copy: boolean;
  pointerId: number;
  sx: number;
  sy: number;
  moved: boolean;
}
/** What a drag looks like on the canvas while it moves. */
type GridDragPreview =
  | {
      kind: "tile";
      id: SlideId;
      ids: SlideId[];
      copy: boolean;
      dx: number;
      dy: number;
      target: SlideGridDropHit | null;
    }
  | {
      kind: "row";
      sectionId: string;
      sectionIds: string[];
      dx: number;
      dy: number;
      gap: { gapIndex: number };
    };
/** The window listeners that follow a drag. */
interface GridDragListeners {
  move: (event: PointerEvent) => void;
  up: (event: PointerEvent) => void;
  cancel: () => void;
}
/** A camera glide that is running. */
interface GridZoomAnimation {
  raf: number;
  onEnd?: (completed: boolean) => void;
  tile?: SlideId;
}
/** The editor camera replayed onto the canvas while a slide is open in front of it. */
interface GridFollowTarget {
  id: SlideId;
  ev: CameraView;
  rect: ScreenRect;
}
/** How a rectangle selection ends. */
type GridMarqueeEnd = "settle" | "drop" | "restore";
/** The rectangle selection that is in progress. */
interface GridMarquee {
  live: boolean;
  sweep: () => void;
  end: (how: GridMarqueeEnd) => void;
}
/** A press on bare canvas that may turn into a click that clears the selection. */
interface GridBarePress {
  pointerId: number;
  sx: number;
  sy: number;
}
/** The open slide actions menu on the canvas. */
interface GridMenuState extends ContextMenuPoint {
  id: SlideId;
  keyboard?: boolean;
  tap?: boolean;
}
/** The modifier keys a click carries. */
interface GridModifierKeys {
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}
/** A React event whose target is known to be an element. */
type TargetedEvent<E> = E & { target: HTMLElement };
/** The preview of a slide drag. */
type GridTileDragPreview = Extract<GridDragPreview, { kind: "tile" }>;

declare module "../bindings" {
  interface RuntimeBindings {
    SlideGridJsx: JsxNamespace;
    GRID_SLIDE_WIDTH: number;
    GRID_SLIDE_HEIGHT: number;
    GRID_COLUMN_GAP: number;
    GRID_ROW_GAP: number;
    GRID_MAX_COLUMNS: number;
    GRID_NOTES_HEIGHT: number;
    GRID_LABEL_HEIGHT: number;
    GRID_TILE_CORNER_RADIUS: number;
    GRID_LABEL_FONT_SIZE: number;
    GRID_TOUCH_LABEL_FONT_SIZE: number;
    GRID_SELECTION_OUTSET: number;
    GRID_CHROME_GAP: number;
    GRID_TOUCH_CHROME_SIZE: number;
    EMPTY_GRID_SELECTION_SET: ReadonlySet<SlideId>;
    copiedGridSlideKey: (id: SlideId) => string;
    GRID_DRAG_THRESHOLD_PX: number;
    GRID_WHEEL_PAN_FACTOR: number;
    GRID_ZOOM_ANIMATION_MS: number;
    MIN_FOCUSED_GRID_SLIDE_WIDTH: number;
    FOCUSED_GRID_SLIDE_SIDE_PADDING: number;
    GRID_RECT_SELECTION_THRESHOLD_PX: number;
    GRID_PREVIEW_SLIDE_ID: string;
    GRID_INTERACTIVE_TARGET_SELECTOR: string;
    GridSlideThumbnail: MemoExoticComponent<
      (props: GridSlideThumbnailProps) => ReactElement
    >;
    calculateGridAddButtonSize: (scale: number) => GridAddButtonSize;
    buildSlideGridLayout: (
      sections: readonly SectionGroup[],
      showNotes?: boolean,
    ) => SlideGridLayout;
    hitTestSlideGridDrop: (
      layout: SlideGridLayout,
      x: number,
      y: number,
      excludedIds: ReadonlySet<SlideId>,
    ) => SlideGridDropHit | null;
    findSlideGridRow: (layout: SlideGridLayout, y: number) => number;
    hitTestSlideGridSectionDrop: (
      layout: SlideGridLayout,
      y: number,
      excludedSections: number,
    ) => { gapIndex: number };
    resolveSlideGridMoveTarget: (
      layout: SlideGridLayout,
      sections: readonly SectionGroup[],
      hit: SlideGridDropHit,
      excludedIds: ReadonlySet<SlideId>,
    ) => SlideGridMoveTarget | null;
    scrollOffsetToExposeRange: (
      offset: number,
      viewportSize: number,
      start: number,
      end: number,
    ) => number;
    panGridViewToSlide: (
      view: CameraView,
      slide: GridPoint,
      viewportWidth: number,
      viewportHeight: number,
      topInset?: number,
      bottomInset?: number,
    ) => CameraView;
    panGridViewToPoint: (
      view: CameraView,
      point: GridPoint,
      viewportWidth: number,
      viewportHeight: number,
      topInset?: number,
      padding?: number,
    ) => CameraView;
    zoomGridViewToSlidePoint: (
      view: CameraView,
      slide: GridPoint,
      point: GridPoint,
      viewportWidth: number,
      viewportHeight: number,
      topInset: number,
      bottomInset: number,
      scaleLimits: GridZoomLimits,
    ) => CameraView;
    gridTileScreenRect: (
      tile: GridPoint,
      view: CameraView,
      containerRect: GridContainerOrigin,
    ) => ScreenRect;
    interpolateGridViewport: (
      from: CameraView,
      to: CameraView,
      point: GridPoint,
      progress: number,
    ) => CameraView;
    gridOriginScreenRect: (
      view: CameraView,
      containerRect: GridContainerOrigin,
    ) => ScreenRect;
    gridViewportFromTileRect: (
      tile: GridPoint,
      screenRect: ScreenRect,
      containerRect: GridContainerOrigin,
    ) => CameraView | null;
    canStartGridRectSelection: (pointer: GridPointerInfo) => boolean;
    collectGridTilesInRect: (
      tiles: readonly SlideGridTile[],
      rect: GridRect,
    ) => SlideId[];
    hitTestGridTile: (
      tiles: readonly SlideGridTile[],
      point: GridPoint,
    ) => GridSlideHit | null;
    extendGridSelection: (
      selection: GridSelectionSet,
      ids: readonly SlideId[],
      extend: boolean,
    ) => GridSelectionSet;
    SlideGrid: (props: SlideGridProps) => ReactElement;
  }
}

export function installEditorSlideGrid(runtime: RuntimeBindings): () => void {
  var GRID_SLIDE_WIDTH: RuntimeBindings["GRID_SLIDE_WIDTH"];
  var GRID_SLIDE_HEIGHT: RuntimeBindings["GRID_SLIDE_HEIGHT"];
  var GRID_COLUMN_GAP: RuntimeBindings["GRID_COLUMN_GAP"];
  var GRID_ROW_GAP: RuntimeBindings["GRID_ROW_GAP"];
  var GRID_MAX_COLUMNS: RuntimeBindings["GRID_MAX_COLUMNS"];
  var GRID_NOTES_HEIGHT: RuntimeBindings["GRID_NOTES_HEIGHT"];
  var SlideGridJsx: JsxNamespace;
  var GRID_LABEL_HEIGHT: RuntimeBindings["GRID_LABEL_HEIGHT"];
  var GRID_TILE_CORNER_RADIUS: RuntimeBindings["GRID_TILE_CORNER_RADIUS"];
  var GRID_LABEL_FONT_SIZE: RuntimeBindings["GRID_LABEL_FONT_SIZE"];
  var GRID_TOUCH_LABEL_FONT_SIZE: RuntimeBindings["GRID_TOUCH_LABEL_FONT_SIZE"];
  var GRID_SELECTION_OUTSET: RuntimeBindings["GRID_SELECTION_OUTSET"];
  var GRID_CHROME_GAP: RuntimeBindings["GRID_CHROME_GAP"];
  var GRID_TOUCH_CHROME_SIZE: RuntimeBindings["GRID_TOUCH_CHROME_SIZE"];
  var EMPTY_GRID_SELECTION_SET: RuntimeBindings["EMPTY_GRID_SELECTION_SET"];
  var copiedGridSlideKey: RuntimeBindings["copiedGridSlideKey"];
  var GRID_DRAG_THRESHOLD_PX: RuntimeBindings["GRID_DRAG_THRESHOLD_PX"];
  var GRID_WHEEL_PAN_FACTOR: RuntimeBindings["GRID_WHEEL_PAN_FACTOR"];
  var GRID_ZOOM_ANIMATION_MS: RuntimeBindings["GRID_ZOOM_ANIMATION_MS"];
  var MIN_FOCUSED_GRID_SLIDE_WIDTH: RuntimeBindings["MIN_FOCUSED_GRID_SLIDE_WIDTH"];
  var FOCUSED_GRID_SLIDE_SIDE_PADDING: RuntimeBindings["FOCUSED_GRID_SLIDE_SIDE_PADDING"];
  var GRID_RECT_SELECTION_THRESHOLD_PX: RuntimeBindings["GRID_RECT_SELECTION_THRESHOLD_PX"];
  var GRID_PREVIEW_SLIDE_ID: RuntimeBindings["GRID_PREVIEW_SLIDE_ID"];
  var GRID_INTERACTIVE_TARGET_SELECTOR: RuntimeBindings["GRID_INTERACTIVE_TARGET_SELECTOR"];
  var GridSlideThumbnail: RuntimeBindings["GridSlideThumbnail"];
  function calculateGridAddButtonSize(scale: number): GridAddButtonSize {
    let gap = GRID_COLUMN_GAP * scale,
      size = Math.max(12, Math.min(32, gap / 2));
    return {
      size: size,
      fits: gap >= size + 4,
      fitsTouch: gap >= 24,
    };
  }
  function buildSlideGridLayout(
    sections: readonly SectionGroup[],
    showNotes: boolean = false,
  ): SlideGridLayout {
    let sectioned = sections.some(
        (input) => input.section !== null,
      ),
      notesHeight = showNotes ? GRID_NOTES_HEIGHT : 0,
      index = 0,
      items: SlideGridTile[] = [],
      items2: SlideGridRow[] = [],
      index2 = 0,
      index3 = 0,
      count = 1;
    sections.forEach((input, options) => {
      let items3: SlideId[][] = [];
      if (sectioned || input.ids.length === 0) {
        items3.push(input.ids);
      } else {
        for (
          let index4 = 0;
          index4 < input.ids.length;
          index4 += GRID_MAX_COLUMNS
        )
          items3.push(input.ids.slice(index4, index4 + GRID_MAX_COLUMNS));
      }
      let value = input.section?.id ?? "~head";
      items3.forEach((items4, options2) => {
        let length = items2.length;
        items2.push({
          key: value + ":" + String(options2),
          section: options2 === 0 ? input.section : null,
          seg: options,
          y: index3,
          ids: items4,
          continuation: options2 > 0,
        });
        items4.forEach((input2, options3) => {
          index2 += 1;
          items.push({
            id: input2,
            x: 0 + options3 * (GRID_SLIDE_WIDTH + GRID_COLUMN_GAP),
            y: index3,
            row: length,
            col: options3,
            n: index2,
            seg: options,
          });
        });
        count = Math.max(count, items4.length);
        index3 += GRID_SLIDE_HEIGHT + notesHeight + GRID_ROW_GAP;
      });
    });
    return {
      tiles: items,
      rows: items2,
      width: 0 + count * (GRID_SLIDE_WIDTH + GRID_COLUMN_GAP) - GRID_COLUMN_GAP,
      height: Math.max(GRID_SLIDE_HEIGHT + notesHeight, index3 - GRID_ROW_GAP),
      left: 0,
      sectioned: sectioned,
      notes: notesHeight,
    };
  }
  function hitTestSlideGridDrop(
    layout: SlideGridLayout,
    x: number,
    y: number,
    excludedIds: ReadonlySet<SlideId>,
  ): SlideGridDropHit | null {
    if (layout.rows.length === 0) {
      return null;
    }
    let value = findSlideGridRow(layout, y),
      value2 = layout.rows[value]!,
      value3 = GRID_SLIDE_HEIGHT + layout.notes,
      value4 = y - value2.y,
      sectioned = layout.sectioned,
      value5 =
        value4 < -GRID_ROW_GAP * 0.2 &&
        (value === 0 || (sectioned && value4 > -GRID_ROW_GAP * 0.8)),
      value6 =
        value === layout.rows.length - 1
          ? value4 > value3 + GRID_ROW_GAP * 0.2
          : sectioned &&
            value4 > value3 + GRID_ROW_GAP * 0.2 &&
            value4 < value3 + GRID_ROW_GAP * 0.8;
    if (value5 || value6) {
      let value8 = value5 ? value : value + 1,
        value9 =
          value8 < layout.rows.length
            ? layout.rows[value8]!.seg
            : layout.rows[layout.rows.length - 1]!.seg + 1;
      return {
        kind: "gap",
        row: value8,
        before: null,
        gapIndex: value9,
      };
    }
    let value7 = Math.round(
      (x - layout.left + GRID_COLUMN_GAP / 2) /
        (GRID_SLIDE_WIDTH + GRID_COLUMN_GAP),
    );
    value7 = Math.max(0, Math.min(value2.ids.length, value7));
    return {
      kind: "tile",
      row: value,
      before:
        value2.ids
          .slice(value7)
          .find((input) => !excludedIds.has(input)) ?? null,
      gapIndex: value2.seg,
    };
  }
  function findSlideGridRow(layout: SlideGridLayout, y: number): number {
    let index = layout.rows.findIndex(
      (input) =>
        y < input.y + GRID_SLIDE_HEIGHT + layout.notes + GRID_ROW_GAP / 2,
    );
    if (index < 0) {
      return layout.rows.length - 1;
    } else {
      return index;
    }
  }
  function hitTestSlideGridSectionDrop(
    layout: SlideGridLayout,
    y: number,
    excludedSections: number,
  ): { gapIndex: number } {
    let rowPositions = [
        ...layout.rows.map((input) => input.y),
        layout.height + GRID_ROW_GAP,
      ],
      index = 0;
    rowPositions.forEach((input, options) => {
      if (Math.abs(y - input) < Math.abs(y - rowPositions[index]!)) {
        index = options;
      }
    });
    while (
      index > 0 &&
      index < layout.rows.length &&
      layout.rows[index]!.continuation
    )
      index -= 1;
    return {
      gapIndex:
        index < layout.rows.length ? layout.rows[index]!.seg : excludedSections,
    };
  }
  function resolveSlideGridMoveTarget(
    layout: SlideGridLayout,
    sections: readonly SectionGroup[],
    hit: SlideGridDropHit,
    excludedIds: ReadonlySet<SlideId>,
  ): SlideGridMoveTarget | null {
    let row = layout.rows[hit.row];
    if (!row) {
      return null;
    }
    let section = sections[row.seg];
    if (!section) {
      return null;
    }
    let before = hit.before;
    for (
      let value3 = hit.row + 1;
      before === null && layout.rows[value3]?.continuation === true;
      value3++
    )
      before =
        layout.rows[value3]!.ids.find(
          (input) => !excludedIds.has(input),
        ) ?? null;
    let value = section.ids.filter(
        (input) => !excludedIds.has(input),
      ),
      value2 = before === null ? -1 : value.indexOf(before);
    return {
      sectionId: section.section?.id ?? null,
      index: value2 < 0 ? value.length : value2,
    };
  }
  function scrollOffsetToExposeRange(
    offset: number,
    viewportSize: number,
    start: number,
    end: number,
  ): number {
    if (end - start <= viewportSize) {
      if (start < offset) {
        return start;
      } else {
        if (end > offset + viewportSize) {
          return end - viewportSize;
        } else {
          return offset;
        }
      }
    }
    if (end > offset && start < offset + viewportSize) {
      return offset;
    }
    if (start >= offset + viewportSize) {
      return start;
    } else {
      return end - viewportSize;
    }
  }
  function panGridViewToSlide(
    view: CameraView,
    slide: GridPoint,
    viewportWidth: number,
    viewportHeight: number,
    topInset: number = 0,
    bottomInset: number = 0,
  ): CameraView {
    let value = 24 / view.scale,
      value2 = GRID_LABEL_HEIGHT / view.scale,
      value3 = topInset / view.scale,
      value4 = view.y + value3,
      value5 = (viewportHeight - topInset) / view.scale,
      value6 = scrollOffsetToExposeRange(
        view.x,
        viewportWidth / view.scale,
        slide.x - value,
        slide.x + GRID_SLIDE_WIDTH + value,
      ),
      value7 = slide.y - value2 - value,
      value8 = slide.y + GRID_SLIDE_HEIGHT + value,
      value9 =
        value8 - value7 > value5
          ? scrollOffsetToExposeRange(value4, value5, value7, value8)
          : value7 < value4
            ? value7
            : Math.min(Math.max(value4, value8 + bottomInset - value5), value7),
      value10 = value9 === value4 ? view.y : value9 - value3;
    if (value6 === view.x && value10 === view.y) {
      return view;
    } else {
      return {
        ...view,
        x: value6,
        y: value10,
      };
    }
  }
  function panGridViewToPoint(
    view: CameraView,
    point: GridPoint,
    viewportWidth: number,
    viewportHeight: number,
    topInset: number = 0,
    padding: number = 48,
  ): CameraView {
    let value = padding / view.scale,
      value2 = topInset / view.scale,
      value3 = scrollOffsetToExposeRange(
        view.x,
        viewportWidth / view.scale,
        point.x - value,
        point.x + value,
      ),
      value4 = scrollOffsetToExposeRange(
        view.y + value2,
        (viewportHeight - topInset) / view.scale,
        point.y - value,
        point.y + value,
      ),
      value5 = value4 === view.y + value2 ? view.y : value4 - value2;
    if (value3 === view.x && value5 === view.y) {
      return view;
    } else {
      return {
        ...view,
        x: value3,
        y: value5,
      };
    }
  }
  function zoomGridViewToSlidePoint(
    view: CameraView,
    slide: GridPoint,
    point: GridPoint,
    viewportWidth: number,
    viewportHeight: number,
    topInset: number,
    bottomInset: number,
    scaleLimits: GridZoomLimits,
  ): CameraView {
    let value = Math.min(
        MIN_FOCUSED_GRID_SLIDE_WIDTH,
        viewportWidth - 2 * FOCUSED_GRID_SLIDE_SIDE_PADDING - 1,
      ),
      value2: CameraView =
        view.scale * GRID_SLIDE_WIDTH < value
          ? (0, runtime.zoomViewportAt)(
              view,
              (point.x - view.x) * view.scale,
              (point.y - view.y) * view.scale,
              value / (view.scale * GRID_SLIDE_WIDTH),
              scaleLimits,
            )
          : view;
    return panGridViewToPoint(
      panGridViewToSlide(
        value2,
        slide,
        viewportWidth,
        viewportHeight,
        topInset,
        bottomInset,
      ),
      point,
      viewportWidth,
      viewportHeight,
      topInset,
    );
  }
  function gridTileScreenRect(
    tile: GridPoint,
    view: CameraView,
    containerRect: GridContainerOrigin,
  ): ScreenRect {
    return {
      left: containerRect.left + (tile.x - view.x) * view.scale,
      top: containerRect.top + (tile.y - view.y) * view.scale,
      width: GRID_SLIDE_WIDTH * view.scale,
      height: GRID_SLIDE_HEIGHT * view.scale,
    };
  }
  function interpolateGridViewport(
    from: CameraView,
    to2: CameraView,
    point: GridPoint,
    progress: number,
  ): CameraView {
    if (progress >= 1) {
      return to2;
    }
    let value = from.scale * (to2.scale / from.scale) ** progress,
      value2 =
        (point.x - from.x) * from.scale * (1 - progress) +
        (point.x - to2.x) * to2.scale * progress,
      value3 =
        (point.y - from.y) * from.scale * (1 - progress) +
        (point.y - to2.y) * to2.scale * progress;
    return {
      scale: value,
      x: point.x - value2 / value,
      y: point.y - value3 / value,
    };
  }
  function gridOriginScreenRect(
    view: CameraView,
    containerRect: GridContainerOrigin,
  ): ScreenRect {
    return {
      left: containerRect.left - view.x * view.scale,
      top: containerRect.top - view.y * view.scale,
      width: GRID_SLIDE_WIDTH * view.scale,
      height: GRID_SLIDE_HEIGHT * view.scale,
    };
  }
  function gridViewportFromTileRect(
    tile: GridPoint,
    screenRect: ScreenRect,
    containerRect: GridContainerOrigin,
  ): CameraView | null {
    if (!(screenRect.width > 0)) {
      return null;
    }
    let scale = screenRect.width / GRID_SLIDE_WIDTH;
    return {
      scale: scale,
      x: tile.x - (screenRect.left - containerRect.left) / scale,
      y: tile.y - (screenRect.top - containerRect.top) / scale,
    };
  }
  function canStartGridRectSelection(pointer: GridPointerInfo): boolean {
    return (
      pointer.bare && pointer.pointerType === "mouse" && pointer.button === 0
    );
  }
  function collectGridTilesInRect(
    tiles: readonly SlideGridTile[],
    rect: GridRect,
  ): SlideId[] {
    return tiles
      .filter(
        (input) =>
          rect.x <= input.x + GRID_SLIDE_WIDTH &&
          input.x <= rect.x + rect.w &&
          rect.y <= input.y + GRID_SLIDE_HEIGHT &&
          input.y <= rect.y + rect.h,
      )
      .map((input) => input.id);
  }
  function hitTestGridTile(
    tiles: readonly SlideGridTile[],
    point: GridPoint,
  ): GridSlideHit | null {
    let tile = tiles.find(
      (input) =>
        point.x >= input.x &&
        point.x <= input.x + GRID_SLIDE_WIDTH &&
        point.y >= input.y &&
        point.y <= input.y + GRID_SLIDE_HEIGHT,
    );
    if (tile) {
      return {
        id: tile.id,
        fx: (point.x - tile.x) / GRID_SLIDE_WIDTH,
        fy: (point.y - tile.y) / GRID_SLIDE_HEIGHT,
      };
    } else {
      return null;
    }
  }
  function extendGridSelection(
    selection: GridSelectionSet,
    ids: readonly SlideId[],
    extend: boolean,
  ): GridSelectionSet {
    if (!extend) {
      return {
        slides: [...ids],
        sections: [],
      };
    }
    if (
      ids.every((input) => selection.slides.includes(input))
    ) {
      return selection;
    } else {
      return {
        slides: [
          ...selection.slides,
          ...ids.filter(
            (input) => !selection.slides.includes(input),
          ),
        ],
        sections: selection.sections,
      };
    }
  }
  function SlideGrid(input: SlideGridProps): ReactElement {
    let {
        order: order,
        sections: sections,
        slides: slides,
        assets: assets,
        currentId: currentId,
        readOnly: readOnly,
        onSelect: onSelect,
        onOpen: onOpen,
        onClose: onClose,
        zoomApiRef: zoomApiRef,
        onScaleChange: onScaleChange,
        heldSlide: heldSlide,
        behind: behind,
        coverId: coverId,
        notesShown: notesShown,
        commentCounts: commentCounts,
      } = input,
      value = input.topInset ?? 0,
      value2 = input.inert === true,
      ref = runtime.ReactGridMemo.useRef(input);
    ref.current = input;
    let memo = runtime.ReactGridMemo.useMemo(
        () =>
          (0, runtime.sectionGroups)(
            (0, runtime.reconcileSectionsWithSlideOrder)(sections, order),
            order,
          ),
        [sections, order],
      ),
      ref2 = runtime.ReactGridMemo.useRef(memo);
    ref2.current = memo;
    let [value3, value4] = runtime.ReactGridMemo.useState<GridSectionEdit | null>(null),
      value5 =
        notesShown === true &&
        order.some(
          (input2) =>
            (slides[input2]?.notes ?? "").trim() !== "",
        ),
      memo2 = runtime.ReactGridMemo.useMemo(
        () => buildSlideGridLayout(memo, value5),
        [memo, value5],
      ),
      ref3 = runtime.ReactGridMemo.useRef(memo2);
    ref3.current = memo2;
    let memo3 = runtime.ReactGridMemo.useMemo(
        () =>
          new Map(
            memo2.tiles.map((input2) => [input2.id, input2]),
          ),
        [memo2],
      ),
      ref4 = runtime.ReactGridMemo.useRef<string | null>(null),
      [value6, value7] = runtime.ReactGridMemo.useState<GridSelectionSet>(
        () => ({
          slides: currentId !== null ? [currentId] : [],
          sections: [],
        }),
      ),
      ref5 = runtime.ReactGridMemo.useRef(value6);
    ref5.current = value6;
    let ref6 = runtime.ReactGridMemo.useRef(currentId),
      ref7 = runtime.ReactGridMemo.useRef(currentId),
      ref8 = runtime.ReactGridMemo.useRef<string | null>(null),
      callback = runtime.ReactGridMemo.useCallback(
        (input2: SlideId) => {
          ref6.current = ref7.current = input2;
          value7({
            slides: [input2],
            sections: [],
          });
          if (input2 !== ref.current.currentId) {
            ref.current.onSelect(input2);
          }
        },
        [],
      ),
      ref9 = runtime.ReactGridMemo.useRef(currentId);
    runtime.ReactGridMemo.useEffect(() => {
      if (currentId !== ref9.current) {
        ref9.current = currentId;
        ref6.current = ref7.current = currentId;
        if (currentId !== null && !ref5.current.slides.includes(currentId)) {
          value7({
            slides: [currentId],
            sections: [],
          });
          return;
        }
      }
      let values = new Set(
          memo.flatMap(
            (input2) =>
              input2.section ? [input2.section.id] : [],
          ),
        ),
        current2 = ref5.current,
        value47 = current2.slides.filter(
          (input2) => memo3.has(input2),
        ),
        value48 = current2.sections.filter(
          (input2) => values.has(input2),
        );
      if (ref6.current !== null && !memo3.has(ref6.current)) {
        ref6.current = ref7.current = currentId;
      }
      if (ref7.current !== null && !memo3.has(ref7.current)) {
        ref7.current = ref6.current;
      }
      if (ref8.current !== null && !values.has(ref8.current)) {
        ref8.current = null;
      }
      if (
        value47.length === current2.slides.length &&
        value48.length === current2.sections.length
      ) {
        return;
      }
      if (value47.length === 0 && value48.length === 0 && currentId !== null) {
        callback(currentId);
      } else {
        value7({
          slides: value47,
          sections: value48,
        });
      }
    }, [currentId, memo3, memo, callback]);
    let callback2 = (input2: SlideId, options: SlideId) => {
        let value47 = ref3.current.tiles.map(
            (input3) => input3.id,
          ),
          value48 = value47.indexOf(input2),
          value49 = value47.indexOf(options);
        if (value48 < 0 || value49 < 0) {
          return [options];
        }
        let value50 = value47.slice(
          Math.min(value48, value49),
          Math.max(value48, value49) + 1,
        );
        if (value48 <= value49) {
          return value50;
        } else {
          return value50.reverse();
        }
      },
      callback3 = (input2: SlideId, options: GridModifierKeys) => {
        let current2 = ref5.current;
        if (
          options.shiftKey &&
          ref6.current !== null &&
          memo3.has(ref6.current)
        ) {
          ref7.current = input2;
          value7({
            slides: callback2(ref6.current, input2),
            sections: [],
          });
        } else if (options.metaKey || options.ctrlKey || options.altKey) {
          if (current2.slides.includes(input2)) {
            let value47 = current2.slides.filter(
              (input3) => input3 !== input2,
            );
            value7({
              ...current2,
              slides: value47,
            });
            if (input2 === currentId && value47.length > 0) {
              onSelect(value47[value47.length - 1]!);
            }
          } else if (
            ((ref6.current = ref7.current = input2),
            value7({
              ...current2,
              slides: [...current2.slides, input2],
            }),
            input2 !== currentId)
          ) {
            onSelect(input2);
          }
        } else {
          callback(input2);
        }
      },
      callback4 = (input2: string, options: GridModifierKeys) => {
        let current2 = ref5.current,
          value47 = memo.flatMap(
            (input3) =>
              input3.section ? [input3.section.id] : [],
          );
        if (
          options.shiftKey &&
          ref8.current !== null &&
          value47.includes(ref8.current)
        ) {
          let value48 = value47.indexOf(ref8.current),
            value49 = value47.indexOf(input2),
            value50 = value47.slice(
              Math.min(value48, value49),
              Math.max(value48, value49) + 1,
            );
          value7({
            slides: [],
            sections: value48 <= value49 ? value50 : value50.reverse(),
          });
        } else if (options.metaKey || options.ctrlKey || options.altKey) {
          ref8.current = input2;
          value7({
            ...current2,
            sections: current2.sections.includes(input2)
              ? current2.sections.filter(
                  (input3) => input3 !== input2,
                )
              : [...current2.sections, input2],
          });
        } else {
          ref8.current = input2;
          value7({
            slides: [],
            sections: [input2],
          });
        }
      },
      ref10 = runtime.ReactGridMemo.useRef<HTMLDivElement | null>(null),
      ref11 = runtime.ReactGridMemo.useRef(Date.now()),
      callback5 = () =>
        Date.now() - ref11.current < 500 || ref17.current !== null,
      ref12 = runtime.ReactGridMemo.useRef(false),
      callback6 = () => ref12.current,
      [value8, value9] = runtime.ReactGridMemo.useState({
        w: 0,
        h: 0,
      }),
      ref13 = runtime.ReactGridMemo.useRef(value8);
    ref13.current = value8;
    runtime.ReactGridMemo.useLayoutEffect(() => {
      let current2 = ref10.current;
      if (!current2) {
        return;
      }
      let callback43 = () =>
        value9({
          w: current2.clientWidth,
          h: current2.clientHeight,
        });
      callback43();
      let observer = new ResizeObserver(callback43);
      observer.observe(current2);
      return () => observer.disconnect();
    }, []);
    let [value10, value11] = runtime.ReactGridMemo.useState<CameraView>({
        x: 0,
        y: 0,
        scale: 0.1,
      }),
      ref14 = runtime.ReactGridMemo.useRef(value10),
      ref15 = runtime.ReactGridMemo.useRef<GridZoomLimits>({
        minScale: 0.02,
        maxScale: GRID_DRAG_THRESHOLD_PX,
      }),
      callback7 = runtime.ReactGridMemo.useCallback(
        (input2: CameraView) => {
          ref14.current = input2;
          value11(input2);
        },
        [],
      ),
      ref16 = runtime.ReactGridMemo.useRef(true),
      ref17 = runtime.ReactGridMemo.useRef<GridZoomAnimation | null>(null),
      [, value12] = runtime.ReactGridMemo.useState(0),
      callback8 = runtime.ReactGridMemo.useCallback(
        (input2: boolean) => {
          let current2 = ref17.current;
          if (!current2) {
            return;
          }
          ref17.current = null;
          cancelAnimationFrame(current2.raf);
          value12((input3) => input3 + 1);
          current2.onEnd?.(input2);
        },
        [],
      );
    runtime.ReactGridMemo.useEffect(
      () => () => callback8(false),
      [callback8],
    );
    let callback9 = runtime.ReactGridMemo.useCallback(
        (input2: CameraView) => {
          if (input2 === ref14.current) {
            return;
          }
          callback8(false);
          ref16.current = false;
          callback7(input2);
        },
        [callback8, callback7],
      ),
      callback10 = runtime.ReactGridMemo.useCallback(
        (
          input2: CameraView,
          options: GridPoint,
          context?: (completed: boolean) => void,
          value47?: SlideId,
        ) => {
          callback8(false);
          let current2 = ref14.current;
          if (
            window.matchMedia?.("(prefers-reduced-motion: reduce)")
              .matches
          ) {
            callback7(input2);
            context?.(true);
            return;
          }
          let value48 = -1,
            state2 = {
              raf: 0,
              onEnd: context,
              tile: value47,
            },
            callback43 = (input3: number) => {
              if (value48 < 0) {
                value48 = input3;
              }
              let value49 = Math.min(
                1,
                (input3 - value48) / GRID_ZOOM_ANIMATION_MS,
              );
              callback7(
                interpolateGridViewport(
                  current2,
                  input2,
                  options,
                  1 - (1 - value49) ** 3,
                ),
              );
              if (value49 < 1) {
                state2.raf = requestAnimationFrame(callback43);
              } else {
                state2.raf = requestAnimationFrame(() => {
                  ref17.current = null;
                  value12((input4) => input4 + 1);
                  context?.(true);
                });
              }
            };
          ref17.current = state2;
          state2.raf = requestAnimationFrame(callback43);
        },
        [callback8, callback7],
      ),
      callback11 = runtime.ReactGridMemo.useCallback(
        (input2: SlideId, options: ScreenRect) => {
          let value47 = ref3.current.tiles.find(
              (input3) => input3.id === input2,
            ),
            value48 = ref10.current?.getBoundingClientRect();
          if (value47 && value48) {
            return gridViewportFromTileRect(value47, options, value48);
          } else {
            return null;
          }
        },
        [],
      ),
      callback12 = runtime.ReactGridMemo.useCallback(() => {
        let { w: current2, h: current3 } = ref13.current,
          current4 = ref3.current;
        if (current2 <= 0 || current3 <= 0) {
          return null;
        }
        let value47 =
            (ref.current.topInset ?? 0) +
            GRID_TOUCH_CHROME_SIZE +
            GRID_LABEL_HEIGHT +
            30,
          value48 =
            current4.width + (ref.current.readOnly ? 0 : GRID_COLUMN_GAP),
          value49 =
            current4.height + (ref.current.readOnly ? 0 : GRID_ROW_GAP),
          value50 = Math.min(
            GRID_WHEEL_PAN_FACTOR,
            (current2 - 2 * GRID_TOUCH_CHROME_SIZE) / value48,
            (current3 - value47 - GRID_TOUCH_CHROME_SIZE) / value49,
          );
        if (!(value50 > 0)) {
          return null;
        }
        return {
          scale: value50,
          x: -(current2 / value50 - value48) / 2,
          y:
            -(
              (current3 - value47 - GRID_TOUCH_CHROME_SIZE) / value50 -
              value49
            ) /
              2 -
            value47 / value50,
        };
      }, []),
      callback13 = runtime.ReactGridMemo.useCallback(() => {
        let value47 = callback12();
        if (!value47) {
          return;
        }
        callback9(value47);
        ref16.current = true;
      }, [callback12, callback9]);
    runtime.ReactGridMemo.useLayoutEffect(() => {
      if (ref16.current && !ref17.current && !ref.current.inert) {
        callback13();
      }
    }, [value8.w, value8.h, value, callback13]);
    runtime.ReactGridMemo.useLayoutEffect(() => {
      let value47 = callback12();
      if (value47) {
        ref15.current.minScale = Math.min(
          value47.scale,
          ref14.current.scale,
          Math.max(0.02, Math.min(0.15, value47.scale) * 0.8),
        );
      }
    }, [value8.w, value8.h, value, memo2, callback12]);
    let callback14 = runtime.ReactGridMemo.useCallback(
        (input2: SlideId) => {
          let value47 = callback12(),
            value48 = ref3.current.tiles.find(
              (input3) => input3.id === input2,
            );
          if (!value47 || !value48) {
            return callback13();
          }
          callback10(
            value47,
            {
              x: value48.x + GRID_SLIDE_WIDTH / 2,
              y: value48.y + GRID_SLIDE_HEIGHT / 2,
            },
            (input3: boolean) => {
              if (input3) {
                callback13();
              }
            },
            value48.id,
          );
        },
        [callback12, callback13, callback10],
      ),
      ref18 = runtime.ReactGridMemo.useRef(false),
      ref19 = runtime.ReactGridMemo.useRef(input.enterFrom);
    runtime.ReactGridMemo.useLayoutEffect(() => {
      if (ref18.current || !callback12()) {
        return;
      }
      ref18.current = true;
      let value47 = ref.current.inert ? null : ref19.current,
        value48 = value47
          ? callback11(value47.id, value47.rect)
          : null;
      if (!value47 || !value48) {
        return;
      }
      callback7(value48);
      callback14(value47.id);
    }, [value8.w, value8.h, callback12, callback11, callback7, callback14]);
    let ref20 = runtime.ReactGridMemo.useRef(memo2);
    runtime.ReactGridMemo.useLayoutEffect(() => {
      let current2 = ref20.current;
      ref20.current = memo2;
      if (
        current2.notes === memo2.notes ||
        ref.current.inert ||
        ref17.current
      ) {
        return;
      }
      if (ref16.current) {
        callback13();
        return;
      }
      let current3 = ref14.current,
        value47 = ref13.current.h / current3.scale,
        value48 = current2.tiles.find(
          (input2) => input2.id === ref.current.currentId,
        ),
        value49 =
          value48 !== undefined &&
          value48.y + GRID_SLIDE_HEIGHT > current3.y &&
          value48.y < current3.y + value47
            ? current2.rows[value48.row]
            : current2.rows.reduce(
                (input2, options) =>
                  Math.abs(
                    options.y +
                      GRID_SLIDE_HEIGHT / 2 -
                      (current3.y + value47 / 2),
                  ) <
                  Math.abs(
                    input2.y +
                      GRID_SLIDE_HEIGHT / 2 -
                      (current3.y + value47 / 2),
                  )
                    ? options
                    : input2,
                current2.rows[0]!,
              ),
        value50 =
          value49 &&
          memo2.rows.find(
            (input2) => input2.key === value49.key,
          );
      if (value49 && value50 && value50.y !== value49.y) {
        callback9({
          ...current3,
          y: current3.y + (value50.y - value49.y),
        });
      }
    }, [memo2, callback9, callback13]);
    let callback15 = runtime.ReactGridMemo.useCallback(
        (input2: number) => {
          let { w: current2, h: current3 } = ref13.current,
            value47 = ref.current.topInset ?? 0;
          callback9(
            (0, runtime.zoomViewportAt)(
              ref14.current,
              current2 / 2,
              value47 + (current3 - value47) / 2,
              input2,
              ref15.current,
            ),
          );
        },
        [callback9],
      ),
      ref21 = runtime.ReactGridMemo.useRef<GridFollowTarget | null>(null),
      callback16 = runtime.ReactGridMemo.useCallback(() => {
        let current2 = ref21.current,
          value47 =
            current2 &&
            ref3.current.tiles.find(
              (input2) => input2.id === current2.id,
            ),
          value48 = ref10.current?.getBoundingClientRect();
        if (!current2 || !value47 || !value48 || !(current2.ev.scale > 0)) {
          return;
        }
        let value49 = gridViewportFromTileRect(
            value47,
            gridOriginScreenRect(current2.ev, current2.rect),
            value48,
          ),
          current3 = ref14.current;
        if (
          !value49 ||
          (value49.x === current3.x &&
            value49.y === current3.y &&
            value49.scale === current3.scale)
        ) {
          return;
        }
        callback8(false);
        callback7(value49);
      }, [callback8, callback7]);
    runtime.ReactGridMemo.useLayoutEffect(() => {
      if (behind != null) {
        callback16();
      } else {
        ref21.current = null;
      }
    }, [memo2, behind, callback16]);
    let ref22 = runtime.ReactGridMemo.useRef(value2);
    runtime.ReactGridMemo.useEffect(() => {
      if (value2 && !ref22.current) {
        value7(
          (input2) =>
            input2.sections.length === 0 &&
            input2.slides.length === 1 &&
            input2.slides[0] === ref.current.currentId
              ? input2
              : {
                  slides:
                    ref.current.currentId !== null
                      ? [ref.current.currentId]
                      : [],
                  sections: [],
                },
        );
      }
      if (ref22.current && !value2) {
        ref10.current?.focus({
          preventScroll: true,
        });
      }
      ref22.current = value2;
    }, [value2]);
    let ref23 = runtime.ReactGridMemo.useRef<GridZoomApi | null>(null);
    if (zoomApiRef) {
      ref23.current = zoomApiRef.current = {
        getScale: () => ref14.current.scale,
        getLimits: () => ({
          ...ref15.current,
        }),
        setScaleTo: (input2) =>
          callback15(input2 / ref14.current.scale),
        fitAll: (input2) =>
          input2 !== undefined ? callback14(input2) : callback13(),
        stepZoom: callback15,
        glideToSlide: (
          input2,
          options,
          context,
        ) => {
          ref33.current?.end("drop");
          if (ref26.current) {
            callback23();
          }
          let value47 = ref3.current.tiles.find(
              (input3) => input3.id === input2,
            ),
            value48 = callback11(input2, options);
          if (!value47 || !value48) {
            context?.(false);
          } else {
            callback10(
              value48,
              {
                x: value47.x + GRID_SLIDE_WIDTH / 2,
                y: value47.y + GRID_SLIDE_HEIGHT / 2,
              },
              context,
              input2,
            );
          }
        },
        follow: (
          input2,
          options,
          context,
        ) => {
          callback8(false);
          ref16.current = false;
          ref21.current = {
            id: input2,
            ev: options,
            rect: context,
          };
          callback16();
        },
        tileRect: (input2) => {
          let value47 = ref3.current.tiles.find(
              (input3) => input3.id === input2,
            ),
            value48 = ref10.current?.getBoundingClientRect();
          if (!value47 || !value48 || !(value48.width > 0)) {
            return null;
          }
          let value49 = panGridViewToSlide(
            ref14.current,
            value47,
            value48.width,
            value48.height,
            ref.current.topInset,
          );
          callback9(value49);
          return gridTileScreenRect(value47, value49, value48);
        },
        tileAt: (input2, options) => {
          let value47 = callback17(input2, options),
            current2 = ref3.current,
            value48 = current2.tiles.find(
              (input3) =>
                value47.x >= input3.x &&
                value47.x <= input3.x + GRID_SLIDE_WIDTH &&
                value47.y >= input3.y &&
                value47.y <=
                  input3.y +
                    GRID_SLIDE_HEIGHT +
                    (current2.notes > 0 &&
                    (ref.current.slides[input3.id]?.notes ?? "").trim() !== ""
                      ? current2.notes
                      : 0),
            );
          if (value48 && value48.id !== ref.current.behind) {
            return value48.id;
          } else {
            return null;
          }
        },
        showSlide: (input2, options) => {
          let value47 = ref3.current.tiles.find(
              (input3) => input3.id === input2,
            ),
            value48 = ref10.current?.getBoundingClientRect();
          if (!value47 || !value48 || !(value48.width > 0)) {
            return false;
          }
          if (!options) {
            callback18(input2);
            return true;
          }
          let value49 = callback17(options.x, options.y),
            value50 = zoomGridViewToSlidePoint(
              ref14.current,
              value47,
              value49,
              value48.width,
              value48.height,
              ref.current.topInset ?? 0,
              ref3.current.notes,
              ref15.current,
            );
          if (value50 !== ref14.current) {
            ref16.current = false;
            callback10(value50, value49);
          }
          return true;
        },
        settling: callback5,
        slideAt: (input2, options) => {
          let value47 = ref10.current?.getBoundingClientRect();
          if (
            !value47 ||
            input2 < value47.left ||
            input2 > value47.right ||
            options < value47.top ||
            options > value47.bottom
          ) {
            return null;
          }
          return hitTestGridTile(
            ref3.current.tiles,
            callback17(input2, options),
          );
        },
      };
    }
    runtime.ReactGridMemo.useEffect(
      () => () => {
        if (zoomApiRef && zoomApiRef.current === ref23.current) {
          zoomApiRef.current = null;
        }
      },
      [zoomApiRef],
    );
    runtime.ReactGridMemo.useEffect(() => {
      onScaleChange?.(value10.scale);
    }, [value10.scale, onScaleChange]);
    let onCameraChange = input.onCameraChange;
    runtime.ReactGridMemo.useEffect(() => {
      onCameraChange?.();
    }, [value10, memo2, onCameraChange]);
    let callback17 = (
      input2: number,
      options: number,
    ) => {
      let bounds = ref10.current!.getBoundingClientRect(),
        current2 = ref14.current;
      return {
        x: current2.x + (input2 - bounds.left) / current2.scale,
        y: current2.y + (options - bounds.top) / current2.scale,
      };
    };
    runtime.ReactGridMemo.useEffect(() => {
      let current2 = ref10.current;
      if (!current2 || value2) {
        return;
      }
      let flag = false,
        value47: { destroy(): void } = (0, runtime.attachViewportGestures)({
          element: current2,
          getView: () => ref14.current,
          setView: callback9,
          get limits(): GridZoomLimits {
            return ref15.current;
          },
          onGestureEnd: () => {
            if (!flag) {
              return;
            }
            flag = false;
            (0, runtime.clearGestureCursor)();
          },
          shouldPan: (event: PointerEvent) => {
            if (
              (event.button !== 0 && event.button !== 1) ||
              ref33.current ||
              ref26.current
            ) {
              return false;
            }
            if (event.button === 1) {
              flag = true;
              (0, runtime.setGestureCursor)("grabbing");
              return true;
            }
            let value48 = (event.target as Element | null)?.closest?.(
              GRID_INTERACTIVE_TARGET_SELECTOR,
            );
            if (!value48) {
              return !canStartGridRectSelection({
                pointerType: event.pointerType,
                button: event.button,
                bare: true,
              });
            }
            return (
              event.pointerType === "touch" &&
              value48.matches("[data-grid-tile]") &&
              value48.getAttribute("data-grid-tile") !== ref.current.currentId
            );
          },
        });
      return () => {
        value47.destroy();
        if (flag) {
          (0, runtime.clearGestureCursor)();
        }
      };
    }, [callback9, value2]);
    let callback18 = runtime.ReactGridMemo.useCallback(
        (input2: SlideId) => {
          let value47 = ref3.current.tiles.find(
              (input3) => input3.id === input2,
            ),
            { w: current2, h: current3 } = ref13.current;
          if (!value47 || current2 <= 0) {
            return;
          }
          let value48 = panGridViewToSlide(
            ref14.current,
            value47,
            current2,
            current3,
            ref.current.topInset,
            ref3.current.notes,
          );
          if (value48 !== ref14.current) {
            callback9(value48);
          }
        },
        [callback9],
      ),
      ref24 = runtime.ReactGridMemo.useRef(memo3),
      ref25 = runtime.ReactGridMemo.useRef(currentId);
    runtime.ReactGridMemo.useLayoutEffect(() => {
      let current2 = ref25.current;
      if (currentId === current2) {
        return;
      }
      if (
        !ref.current.inert &&
        currentId !== null &&
        memo3.has(currentId) &&
        !ref24.current.has(currentId) &&
        (current2 === null || memo3.has(current2))
      ) {
        callback18(currentId);
      }
      ref25.current = currentId;
      ref24.current = memo3;
    }, [currentId, memo3, callback18]);
    ref4.current = value3 ? (value3.sectionId ?? "-") : null;
    let current = ref4.current;
    runtime.ReactGridMemo.useEffect(() => {
      if (value2) {
        return;
      }
      let callback43 = (input2: SlideId) =>
        memo[memo3.get(input2)?.seg ?? -1]?.section?.id ?? "-";
      ref.current.onSelectionChange?.({
        slides: value6.slides,
        slideSections: value6.slides.map(callback43),
        sections: value6.sections,
        editingSection: ref4.current,
      });
    }, [value6, memo, memo3, current, value2]);
    runtime.ReactGridMemo.useEffect(() => {
      if (ref.current.inert) {
        return;
      }
      let value47 = window.setTimeout(() => {
        if (
          document.activeElement?.closest(
            "[data-slides-comments]",
          ) == null
        ) {
          ref10.current?.focus({
            preventScroll: true,
          });
        }
      }, 60);
      return () => window.clearTimeout(value47);
    }, []);
    runtime.ReactGridMemo.useEffect(() => {
      let callback43 = (event: KeyboardEvent) => {
        if (
          event.defaultPrevented ||
          ref.current.inert ||
          !(event.metaKey || event.ctrlKey) ||
          event.altKey ||
          event.shiftKey
        ) {
          return;
        }
        if (
          event.key !== "0" &&
          event.key !== "=" &&
          event.key !== "+" &&
          event.key !== "-"
        ) {
          return;
        }
        let target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        event.preventDefault();
        if (ref17.current) {
          return;
        }
        if (event.key === "0") {
          callback13();
        } else {
          callback15(event.key === "-" ? 0.8 : 1.25);
        }
      };
      window.addEventListener("keydown", callback43);
      return () =>
        window.removeEventListener("keydown", callback43);
    }, [callback13, callback15]);
    let callback19 = (event: TargetedEvent<ReactKeyboardEvent<HTMLDivElement>>) => {
        if (
          value2 ||
          value3 ||
          event.defaultPrevented ||
          !ref10.current?.contains(event.target)
        ) {
          return;
        }
        if (input.commenting === true) {
          if (
            (event.metaKey || event.ctrlKey) &&
            (event.key === "a" || event.key === "A")
          ) {
            event.preventDefault();
          }
          return;
        }
        let target = event.target,
          value47 =
            target.closest('[data-kit="thumb-actions"]') !== null;
        if (
          target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          (target.tagName === "BUTTON" && !value47) ||
          target.isContentEditable
        ) {
          return;
        }
        if (
          value47 &&
          (event.key === "Enter" ||
            event.key === " " ||
            event.key === "Delete" ||
            event.key === "Backspace")
        ) {
          return;
        }
        let callback43 = () => {
            if (value47) {
              ref10.current?.focus({
                preventScroll: true,
              });
            }
          },
          value48 = event.metaKey || event.ctrlKey;
        if (ref17.current && !(event.key === "Escape" && ref33.current)) {
          if (!value48 || event.key === "a" || event.key === "A") {
            event.preventDefault();
          }
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          callback43();
          ref36.current = null;
          if (ref33.current) {
            ref33.current.end("restore");
          } else if (ref26.current) {
            callback23();
            ref12.current = true;
            let callback44 = () => {
              window.removeEventListener("pointerup", callback44);
              window.removeEventListener(
                "pointercancel",
                callback44,
              );
              setTimeout(() => (ref12.current = false), 0);
            };
            window.addEventListener("pointerup", callback44);
            window.addEventListener("pointercancel", callback44);
          } else if (
            value6.sections.length > 0 ||
            value6.slides.length > 1 ||
            (value6.slides.length === 1 && value6.slides[0] !== currentId)
          ) {
            if (currentId !== null) {
              callback(currentId);
            } else {
              value7({
                slides: [],
                sections: [],
              });
            }
          } else if (!event.repeat) {
            onClose();
          }
          return;
        }
        if (
          value48 &&
          !event.shiftKey &&
          !event.altKey &&
          (event.key === "a" || event.key === "A")
        ) {
          event.preventDefault();
          callback43();
          value7({
            slides: ref3.current.tiles.map(
              (input2) => input2.id,
            ),
            sections: [],
          });
          return;
        }
        if (
          value48 &&
          !event.shiftKey &&
          !event.altKey &&
          (event.key === "d" || event.key === "D")
        ) {
          if (readOnly) {
            return;
          }
          event.preventDefault();
          callback43();
          if (
            event.repeat ||
            value6.sections.length > 0 ||
            value6.slides.length === 0
          ) {
            return;
          }
          let value53 = ref.current.onDuplicateSlides(
            ref3.current.tiles
              .filter(
                (input2) =>
                  value6.slides.includes(input2.id),
              )
              .map((input2) => input2.id),
          );
          if (value53.length > 0) {
            ref6.current = ref7.current = value53[value53.length - 1]!;
            value7({
              slides: value53,
              sections: [],
            });
          }
          return;
        }
        let value49 =
          value6.sections.length === 1 && value6.slides.length === 0
            ? ref3.current.rows.find(
                (input2) =>
                  input2.section?.id === value6.sections[0],
              )
            : undefined;
        if (
          event.key === "Enter" &&
          !value48 &&
          !readOnly &&
          value49?.section
        ) {
          event.preventDefault();
          callback40(
            value49.key,
            value49.section.id,
            value49.section.description,
          );
          return;
        }
        if (event.key === "Enter" && currentId !== null && !value48) {
          event.preventDefault();
          if (!event.repeat) {
            onOpen(currentId);
          }
          return;
        }
        if (
          (event.key === "Delete" || event.key === "Backspace") &&
          !value48 &&
          !event.altKey
        ) {
          event.preventDefault();
          if (
            readOnly ||
            value6.sections.length > 0 ||
            value6.slides.length === 0
          ) {
            return;
          }
          if (value6.slides.length === 1) {
            ref.current.onDelete(value6.slides[0]!);
          } else {
            ref.current.onDeleteSlides(
              ref3.current.tiles
                .filter(
                  (input2) =>
                    value6.slides.includes(input2.id),
                )
                .map((input2) => input2.id),
            );
          }
          return;
        }
        if ((0, runtime.isContextMenuKey)(event)) {
          event.preventDefault();
          callback43();
          if (currentId !== null) {
            callback36(currentId);
          }
          return;
        }
        if (!event.key.startsWith("Arrow") || value48) {
          return;
        }
        event.preventDefault();
        callback43();
        value20(true);
        let current2 = ref3.current,
          value50 = event.shiftKey
            ? (ref7.current ?? currentId)
            : currentId,
          value51 = value50 !== null ? memo3.get(value50) : undefined,
          value52 = current2.tiles[0];
        if (value51) {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            value52 =
              current2.tiles[
                current2.tiles.indexOf(value51) +
                  (event.key === "ArrowLeft" ? -1 : 1)
              ] ?? value51;
          } else {
            let value53 = event.key === "ArrowUp" ? -1 : 1,
              value54 = value51.row + value53;
            while (
              value54 >= 0 &&
              value54 < current2.rows.length &&
              current2.rows[value54]!.ids.length === 0
            )
              value54 += value53;
            let value55 = current2.rows[value54];
            value52 = value55
              ? memo3.get(
                  value55.ids[Math.min(value51.col, value55.ids.length - 1)]!,
                )
              : value51;
          }
        }
        if (!value52) {
          return;
        }
        if (event.shiftKey && ref6.current !== null) {
          ref7.current = value52.id;
          value7({
            slides: callback2(ref6.current, value52.id),
            sections: [],
          });
          callback18(value52.id);
        } else if (
          value52.id !== currentId ||
          value6.slides.length !== 1 ||
          value6.sections.length > 0
        ) {
          callback(value52.id);
          callback18(value52.id);
        }
      },
      ref26 = runtime.ReactGridMemo.useRef<GridPointerDrag | null>(null),
      ref27 = runtime.ReactGridMemo.useRef<GridPoint>({
        x: 0,
        y: 0,
      }),
      [value13, value14] = runtime.ReactGridMemo.useState<GridDragPreview | null>(null),
      ref28 = runtime.ReactGridMemo.useRef<GridDragPreview | null>(null),
      callback20 = (input2: GridDragPreview | null) => {
        ref28.current = input2;
        value14(input2);
      },
      ref29 = runtime.ReactGridMemo.useRef<GridDragListeners | null>(null),
      callback21 = () => {
        let state2 = {
          move: (input2: PointerEvent) => callback28(input2),
          up: (input2: PointerEvent) => callback29(input2),
          cancel: () => callback23(),
        };
        ref29.current = state2;
        window.addEventListener("pointermove", state2.move);
        window.addEventListener("pointerup", state2.up);
        window.addEventListener("pointercancel", state2.cancel);
        window.addEventListener("blur", state2.cancel);
      },
      callback22 = () => {
        let current2 = ref29.current;
        ref29.current = null;
        if (!current2) {
          return;
        }
        window.removeEventListener("pointermove", current2.move);
        window.removeEventListener("pointerup", current2.up);
        window.removeEventListener(
          "pointercancel",
          current2.cancel,
        );
        window.removeEventListener("blur", current2.cancel);
      };
    runtime.ReactGridMemo.useEffect(
      () => () => {
        callback22();
        if (ref26.current?.copy === true) {
          (0, runtime.clearGestureCursor)();
        }
      },
      [],
    );
    let callback23 = () => {
        if (ref26.current?.copy === true) {
          (0, runtime.clearGestureCursor)();
        }
        ref26.current = null;
        callback22();
        callback30();
        callback20(null);
      },
      callback24 = (input2: ReactPointerEvent<HTMLElement>, options: SlideId) => {
        if (input2.button !== 0 || ref26.current) {
          return;
        }
        if (input2.pointerType === "touch" && options !== currentId) {
          return;
        }
        input2.stopPropagation();
        ref10.current?.focus({
          preventScroll: true,
        });
        if (input2.shiftKey || input2.metaKey || input2.ctrlKey) {
          return;
        }
        let altKey = input2.altKey;
        if (!altKey) {
          if (!ref5.current.slides.includes(options)) {
            callback(options);
          } else if (options !== currentId) {
            onSelect(options);
          }
        }
        if (readOnly) {
          return;
        }
        ref27.current = callback17(input2.clientX, input2.clientY);
        let slides2 = ref5.current.slides,
          value47 =
            slides2.includes(options) && slides2.length > 1
              ? ref3.current.tiles
                  .filter(
                    (input3) => slides2.includes(input3.id),
                  )
                  .map((input3) => input3.id)
              : [options];
        ref26.current = {
          kind: "tile",
          id: options,
          ids: value47,
          copy: altKey,
          pointerId: input2.pointerId,
          sx: input2.clientX,
          sy: input2.clientY,
          moved: false,
        };
        callback21();
      },
      callback25 = (input2: ReactPointerEvent<HTMLElement>, options: string) => {
        if (input2.button !== 0 || ref26.current || readOnly) {
          return;
        }
        input2.stopPropagation();
        ref27.current = callback17(input2.clientX, input2.clientY);
        let sections2 = ref5.current.sections,
          value47 =
            sections2.includes(options) && sections2.length > 1
              ? ref2.current.flatMap(
                  (input3) =>
                    input3.section !== null &&
                    sections2.includes(input3.section.id)
                      ? [input3.section.id]
                      : [],
                )
              : [options];
        ref26.current = {
          kind: "row",
          id: options,
          ids: value47,
          copy: false,
          pointerId: input2.pointerId,
          sx: input2.clientX,
          sy: input2.clientY,
          moved: false,
        };
        callback21();
      },
      callback26 = (
        input2: SlideGridLayout,
        options: readonly SectionGroup[],
        source: SlideGridDropHit,
      ) =>
        source.kind === "gap"
          ? {
              gapIndex: source.gapIndex,
            }
          : resolveSlideGridMoveTarget(
              input2,
              options,
              source,
              EMPTY_GRID_SELECTION_SET,
            ),
      ref30 = runtime.ReactGridMemo.useRef<GridPoint>({
        x: 0,
        y: 0,
      }),
      callback27 = (input2: number, options: number) => {
        let current2 = ref26.current;
        if (!current2 || !current2.moved) {
          return;
        }
        ref30.current = {
          x: input2,
          y: options,
        };
        let value47 = callback17(input2, options);
        if (current2.kind === "tile") {
          callback20({
            kind: "tile",
            id: current2.id,
            ids: current2.ids,
            copy: current2.copy,
            dx: value47.x - ref27.current.x,
            dy: value47.y - ref27.current.y,
            target: hitTestSlideGridDrop(
              ref3.current,
              value47.x,
              value47.y,
              current2.copy ? EMPTY_GRID_SELECTION_SET : new Set(current2.ids),
            ),
          });
        } else {
          callback20({
            kind: "row",
            sectionId: current2.id,
            sectionIds: current2.ids,
            dx: value47.x - ref27.current.x,
            dy: value47.y - ref27.current.y,
            gap: hitTestSlideGridSectionDrop(
              ref3.current,
              value47.y,
              ref2.current.length,
            ),
          });
        }
      },
      callback28 = (input2: PointerEvent) => {
        let current2 = ref26.current;
        if (!current2 || current2.pointerId !== input2.pointerId) {
          return;
        }
        if (input2.pointerType === "mouse" && input2.buttons === 0) {
          return callback23();
        }
        if (
          !current2.moved &&
          Math.hypot(
            input2.clientX - current2.sx,
            input2.clientY - current2.sy,
          ) < GRID_RECT_SELECTION_THRESHOLD_PX
        ) {
          return;
        }
        if (!current2.moved) {
          let current3 = ref5.current,
            currentId2 = ref.current.currentId;
          if (
            current2.kind === "tile" &&
            current2.copy &&
            !current3.slides.includes(current2.id)
          ) {
            callback(current2.id);
          } else if (
            current2.kind === "tile" &&
            (current3.sections.length > 0 ||
              current3.slides.length !== current2.ids.length)
          ) {
            value7({
              slides:
                currentId2 !== null && current2.ids.includes(currentId2)
                  ? [
                      ...current2.ids.filter(
                        (input3) => input3 !== currentId2,
                      ),
                      currentId2,
                    ]
                  : current2.ids,
              sections: [],
            });
          }
          if (
            current2.kind === "row" &&
            (current3.slides.length > 0 ||
              current3.sections.length !== current2.ids.length)
          ) {
            value7({
              slides: [],
              sections: current2.ids,
            });
          }
          if (current2.copy && input2.pointerType !== "touch") {
            (0, runtime.setGestureCursor)("copy");
          }
        }
        current2.moved = true;
        callback27(input2.clientX, input2.clientY);
        callback31(input2.clientX, input2.clientY);
      },
      callback29 = (input2: PointerEvent) => {
        let current2 = ref26.current;
        if (!current2 || current2.pointerId !== input2.pointerId) {
          return;
        }
        let moved = current2.moved,
          current3 = ref28.current;
        callback23();
        if (!moved || !current3) {
          return;
        }
        ref12.current = true;
        setTimeout(() => (ref12.current = false), 0);
        let current4 = ref.current,
          current5 = ref2.current;
        if (current3.kind === "row") {
          if (current3.gap) {
            current4.onMoveSections(current3.sectionIds, current3.gap.gapIndex);
          }
          return;
        }
        let target = current3.target;
        if (!target) {
          return;
        }
        let value47 = current3.ids.filter(
          (input3) => current4.order.includes(input3),
        );
        if (value47.length === 0) {
          return;
        }
        if (current3.copy) {
          let value49 = callback26(ref3.current, current5, target),
            value50 = value49
              ? current4.onDuplicateSlides(value47, value49)
              : [];
          if (value50.length > 0) {
            ref6.current = ref7.current = value50[value50.length - 1]!;
            value7({
              slides: value50,
              sections: [],
            });
          }
          return;
        }
        if (target.kind === "gap") {
          current4.onStartSectionWithSlides(value47, target.gapIndex);
          return;
        }
        let value48 = resolveSlideGridMoveTarget(
          ref3.current,
          current5,
          target,
          new Set(value47),
        );
        if (value48) {
          current4.onMoveSlidesTo(value47, value48.sectionId, value48.index);
        }
      },
      ref31 = runtime.ReactGridMemo.useRef(0),
      ref32 = runtime.ReactGridMemo.useRef({
        x: 0,
        y: 0,
      }),
      callback30 = () => {
        cancelAnimationFrame(ref31.current);
        ref31.current = 0;
        ref32.current = {
          x: 0,
          y: 0,
        };
      },
      callback31 = (input2: number, options: number) => {
        let bounds = ref10.current!.getBoundingClientRect(),
          count = 48,
          value47 =
            input2 < bounds.left + 48 ? -1 : input2 > bounds.right - 48 ? 1 : 0,
          value48 =
            options < bounds.top + (ref.current.topInset ?? 0) + 48
              ? -1
              : options > bounds.bottom - 48
                ? 1
                : 0;
        ref32.current = {
          x: value47,
          y: value48,
        };
        if ((value47 !== 0 || value48 !== 0) && ref31.current === 0) {
          let callback43 = () => {
            let { x: current2, y: current3 } = ref32.current;
            if (current2 === 0 && current3 === 0) {
              ref31.current = 0;
              return;
            }
            let current4 = ref14.current,
              { w: current5, h: current6 } = ref13.current,
              current7 = ref3.current,
              value49 = Math.max(
                -(current5 - 96) / current4.scale,
                Math.min(
                  current7.width - 96 / current4.scale,
                  current4.x + (12 * current2) / current4.scale,
                ),
              ),
              value50 = Math.max(
                -(current6 - 96) / current4.scale,
                Math.min(
                  current7.height - 96 / current4.scale,
                  current4.y + (12 * current3) / current4.scale,
                ),
              );
            if (value49 !== current4.x || value50 !== current4.y) {
              callback9({
                ...current4,
                x: value49,
                y: value50,
              });
            }
            callback27(ref30.current.x, ref30.current.y);
            ref31.current = requestAnimationFrame(callback43);
          };
          ref31.current = requestAnimationFrame(callback43);
        }
      };
    runtime.ReactGridMemo.useEffect(() => callback30, []);
    let ref33 = runtime.ReactGridMemo.useRef<GridMarquee | null>(null),
      [value15, value16] = runtime.ReactGridMemo.useState<GridRect | null>(null),
      ref34 = runtime.ReactGridMemo.useRef(-1 / 0),
      ref35 = runtime.ReactGridMemo.useRef(0),
      callback32 = () =>
        performance.now() - ref34.current < 700 && ref35.current < 2,
      callback33 = (input2: ReactPointerEvent<HTMLDivElement>) => {
        let currentTarget = input2.currentTarget,
          {
            pointerId: value47,
            clientX: value48,
            clientY: value49,
          } = input2,
          value50 = callback17(value48, value49),
          current2 = ref5.current,
          value51 =
            input2.shiftKey ||
            input2.metaKey ||
            input2.ctrlKey ||
            input2.altKey,
          value52 = value48,
          value53 = value49,
          value54: GridSelectionSet | null = null,
          callback43 = () => {
            let value55 = callback17(value52, value53),
              state2 = {
                x: Math.min(value50.x, value55.x),
                y: Math.min(value50.y, value55.y),
                w: Math.abs(value55.x - value50.x),
                h: Math.abs(value55.y - value50.y),
              },
              current3 = ref14.current;
            value16({
              x: (state2.x - current3.x) * current3.scale,
              y: (state2.y - current3.y) * current3.scale,
              w: state2.w * current3.scale,
              h: state2.h * current3.scale,
            });
            let value56 = extendGridSelection(
              current2,
              collectGridTilesInRect(ref3.current.tiles, state2),
              value51,
            );
            if (
              value54 !== null &&
              value56.slides.join(",") === value54.slides.join(",") &&
              value56.sections.join(",") === value54.sections.join(",")
            ) {
              return;
            }
            value54 = value56;
            value7(value56);
          },
          callback44 = (input3: PointerEvent) => {
            if (input3.pointerId !== value47) {
              return;
            }
            if (!(input3.buttons & 1)) {
              return callback45("settle");
            }
            let current3 = ref33.current;
            if (!current3) {
              return;
            }
            if (!current3.live) {
              if (
                Math.hypot(input3.clientX - value48, input3.clientY - value49) <
                GRID_RECT_SELECTION_THRESHOLD_PX
              ) {
                return;
              }
              current3.live = true;
              ref36.current = null;
              currentTarget.style.userSelect =
                currentTarget.style.webkitUserSelect = "none";
              try {
                currentTarget.setPointerCapture(value47);
              } catch {}
            }
            value52 = input3.clientX;
            value53 = input3.clientY;
            callback43();
          },
          callback45 = (input3?: GridMarqueeEnd) => {
            window.removeEventListener("pointermove", callback44);
            window.removeEventListener("pointerup", callback47);
            window.removeEventListener(
              "pointercancel",
              callback47,
            );
            window.removeEventListener("blur", callback48);
            window.removeEventListener("contextmenu", callback46);
            let value55 = ref33.current?.live === true;
            ref33.current = null;
            value16(null);
            currentTarget.style.userSelect =
              currentTarget.style.webkitUserSelect = "";
            if (currentTarget.hasPointerCapture(value47)) {
              currentTarget.releasePointerCapture(value47);
            }
            if (!value55 || input3 === "drop") {
              return;
            }
            ref34.current = performance.now();
            ref35.current = 0;
            ref12.current = true;
            setTimeout(() => (ref12.current = false), 0);
            let current3 = ref.current,
              value56 = ref2.current.flatMap(
                (input4) =>
                  input4.section ? [input4.section.id] : [],
              ),
              callback49 = (input4: GridSelectionSet) => ({
                slides: input4.slides.filter(
                  (input5) =>
                    current3.order.includes(input5),
                ),
                sections: input4.sections.filter(
                  (input5) => value56.includes(input5),
                ),
              });
            if (input3 === "restore") {
              value7(callback49(current2));
            } else if (value54 !== null) {
              let value57 = callback49(value54);
              value7(value57);
              if (
                value57.slides.length > 0 &&
                (current3.currentId === null ||
                  !value57.slides.includes(current3.currentId))
              ) {
                current3.onSelect(value57.slides[value57.slides.length - 1]!);
              }
            }
          },
          callback46 = () => callback45("settle"),
          callback47 = (input3: PointerEvent) => {
            if (input3.pointerId === value47) {
              callback45("settle");
            }
          },
          callback48 = () => {
            if (!document.hasFocus()) {
              callback45("settle");
            }
          };
        ref33.current = {
          live: false,
          sweep: callback43,
          end: callback45,
        };
        window.addEventListener("pointermove", callback44);
        window.addEventListener("pointerup", callback47);
        window.addEventListener("pointercancel", callback47);
        window.addEventListener("blur", callback48);
        window.addEventListener("contextmenu", callback46);
      };
    runtime.ReactGridMemo.useEffect(
      () => () => ref33.current?.end("drop"),
      [],
    );
    runtime.ReactGridMemo.useEffect(() => {
      if (ref33.current?.live) {
        ref33.current.sweep();
      }
    }, [value10]);
    let ref36 = runtime.ReactGridMemo.useRef<GridBarePress | null>(null);
    runtime.ReactGridMemo.useLayoutEffect(() => {
      if (!value2) {
        return;
      }
      ref33.current?.end("drop");
      if (ref26.current) {
        callback23();
      }
      ref36.current = null;
    }, [value2]);
    let [value17, value18] = runtime.ReactGridMemo.useState<GridMenuState | null>(null),
      [value19, value20] = runtime.ReactGridMemo.useState(false);
    runtime.ReactGridMemo.useEffect(() => {
      let current2 = ref10.current;
      if (!current2) {
        return;
      }
      let callback43 = (event: FocusEvent) => {
          let target = event.target;
          if (target instanceof HTMLElement) {
            value20(
              target === current2
                ? target.matches(":focus-visible")
                : target.closest('[data-kit="thumb-actions"]') !== null,
            );
          }
        },
        callback44 = (input2: FocusEvent) => {
          let relatedTarget = input2.relatedTarget;
          if (
            !(relatedTarget instanceof Node) ||
            !current2.contains(relatedTarget)
          ) {
            value20(false);
          }
        };
      current2.addEventListener("focusin", callback43);
      current2.addEventListener("focusout", callback44);
      return () => {
        current2.removeEventListener("focusin", callback43);
        current2.removeEventListener("focusout", callback44);
      };
    }, []);
    let value21 = value17 ? memo3.get(value17.id) : undefined,
      value22 =
        value17 === null
          ? []
          : value6.slides.length > 1 && value6.slides.includes(value17.id)
            ? memo2.tiles
                .filter(
                  (input2) =>
                    value6.slides.includes(input2.id),
                )
                .map((input2) => input2.id)
            : [value17.id],
      value23 =
        value22.length > 0
          ? memo.find(
              (input2) => input2.ids.includes(value22[0]!),
            )
          : undefined,
      value24 =
        value23 !== undefined &&
        value23.ids.length === value22.length &&
        value23.ids.every(
          (input2, options) =>
            input2 === value22[options],
        ),
      value25 =
        value23 === undefined
          ? 1
          : (() => {
              let value47 = value23.ids.indexOf(value22[0]!);
              if (
                value23.ids
                  .slice(value47 + 1)
                  .some(
                    (input2) => !value22.includes(input2),
                  ) &&
                !(value47 === 0 && value23.section !== null)
              ) {
                return 2;
              } else {
                return 1;
              }
            })(),
      value26 =
        (sections?.length ?? 0) + value25 > runtime.maxDeckSections;
    runtime.ReactGridMemo.useEffect(() => {
      if (value17 !== null && value21 === undefined) {
        value18(null);
      }
    }, [value17, value21]);
    let value27 =
      value3 !== null &&
      !memo2.rows.some(
        (input2) => input2.key === value3.key,
      );
    runtime.ReactGridMemo.useEffect(() => {
      if (value27) {
        value4(null);
      }
    }, [value27]);
    let callback34 = () => {
        value18(null);
        ref10.current?.focus({
          preventScroll: true,
        });
      },
      callback35 = () => {
        queueMicrotask(
          () =>
            ref10.current?.focus({
              preventScroll: true,
            }),
        );
        value18(null);
      },
      callback36 = (input2: SlideId) => {
        let value47 = ref10.current
          ?.querySelector('[data-grid-tile="' + CSS.escape(input2) + '"]')
          ?.getBoundingClientRect();
        if (value47) {
          value18({
            x: value47.left + Math.min(40, value47.width / 2),
            y: value47.top + Math.min(24, value47.height / 2),
            id: input2,
            keyboard: true,
          });
        }
      },
      callback37 =
        (input2: () => void) =>
        () => {
          callback35();
          input2();
        },
      ref37 = runtime.ReactGridMemo.useRef(false),
      callback38 = (input2: string = value3?.text ?? "") => {
        if (!value3 || ref37.current) {
          return;
        }
        ref37.current = true;
        let current2 = ref.current,
          value47 =
            ref3.current.rows.find(
              (input3) => input3.key === value3.key,
            )?.section?.description ?? "";
        value4(null);
        ref10.current?.focus({
          preventScroll: true,
        });
        if (input2.trim() !== value47.trim()) {
          current2.onSetSectionDescription(value3.sectionId, input2.trim());
        }
      },
      callback39 = () => {
        ref37.current = true;
        value4(null);
        ref10.current?.focus({
          preventScroll: true,
        });
      },
      callback40 = (
        input2: string,
        options: string | null,
        context: string,
      ) => {
        callback38();
        ref37.current = false;
        value4({
          key: input2,
          sectionId: options,
          text: context,
        });
      },
      callback41 = (input2: string) => {
        ref8.current = input2;
        value7({
          slides: [],
          sections: [input2],
        });
        callback40(input2 + ":0", input2, "");
        let value47 = ref3.current.rows.find(
            (input3) => input3.key === input2 + ":0",
          ),
          { w: current2, h: current3 } = ref13.current;
        if (!value47 || current2 <= 0) {
          return;
        }
        let current4 = ref14.current,
          value48 = 24 / current4.scale,
          value49 =
            value47.y -
            ((value37 + value36) * value38) / current4.scale -
            value48,
          { x: value50, y: value51 } = current4;
        if (value50 > 0) {
          value50 = -value48;
        } else if (value50 + current2 / current4.scale < 320 / current4.scale) {
          value50 = Math.min(-value48, (320 - current2) / current4.scale);
        }
        if (
          value49 + value48 <
          value51 + (ref.current.topInset ?? 0) / current4.scale
        ) {
          value51 = value49 - current3 / current4.scale / 3;
        } else if (
          value47.y - (value37 * value38) / current4.scale >
          value51 + current3 / current4.scale
        ) {
          value51 = value47.y + value48 - current3 / current4.scale;
        }
        if (value50 !== current4.x || value51 !== current4.y) {
          callback9({
            ...current4,
            x: value50,
            y: value51,
          });
        }
      },
      ref38 = runtime.ReactGridMemo.useRef<string | null>(null);
    runtime.ReactGridMemo.useEffect(() => {
      let current2 = ref38.current;
      ref38.current = null;
      if (
        current2 !== null &&
        memo.some(
          (input2) => input2.section?.id === current2,
        )
      ) {
        callback41(current2);
      }
    }, [memo]);
    let callback42 = () => {
        let value47 = memo[memo.length - 1]?.section;
        if (
          value47 &&
          (0, runtime.emptySectionHasNoDescription)(value47) &&
          value3?.sectionId !== value47.id
        ) {
          return callback41(value47.id);
        }
        callback38();
        let value48 = (0, runtime.createModelId)();
        ref38.current = value48;
        ref.current.onAddSection(value48);
      },
      value28 = (sections?.length ?? 0) >= runtime.maxDeckSections,
      memo4 = runtime.ReactGridMemo.useMemo(() => {
        if (!value13) {
          return null;
        }
        let state2 = {
            order: [...order],
            sections: sections?.map(
              (input2) => ({
                ...input2,
              }),
            ),
          },
          value47: typeof state2 | undefined;
        if (value13.kind === "tile") {
          let target = value13.target;
          if (!target) {
            return null;
          }
          let value48 = value13.ids.filter(
            (input2) => order.includes(input2),
          );
          if (value13.copy) {
            let value49 = callback26(memo2, memo, target);
            value47 = value49
              ? (0, runtime.insertSlidesAtSectionTarget)(
                  state2,
                  value48.map(copiedGridSlideKey),
                  value49,
                  GRID_PREVIEW_SLIDE_ID,
                )
              : undefined;
          } else if (target.kind === "gap") {
            value47 = (0, runtime.moveSlidesIntoNewSection)(
              state2,
              value48,
              target.gapIndex,
              GRID_PREVIEW_SLIDE_ID,
            );
          } else {
            let value49 = resolveSlideGridMoveTarget(
              memo2,
              memo,
              target,
              new Set(value48),
            );
            if (!value49) {
              return null;
            }
            value47 = (0, runtime.moveSlidesToSection)(
              state2,
              value48,
              value49.sectionId,
              value49.index,
            );
          }
        } else {
          if (!value13.gap) {
            return null;
          }
          value47 = (0, runtime.moveSectionsToGap)(
            state2,
            value13.sectionIds,
            value13.gap.gapIndex,
          );
        }
        if (!value47) {
          return memo2;
        }
        return buildSlideGridLayout(
          (0, runtime.sectionGroups)(value47.sections, value47.order),
          value5,
        );
      }, [value13, memo, memo2, order, sections, value5]),
      value29 = memo4 ?? memo2,
      memo5 = runtime.ReactGridMemo.useMemo(
        () =>
          new Map(
            value29.tiles.map(
              (input2) => [input2.id, input2],
            ),
          ),
        [value29],
      ),
      scale = value10.scale,
      value30 = 1 / scale,
      value31 = GRID_ROW_GAP * scale,
      value32 =
        GRID_SLIDE_WIDTH * scale >= 56 &&
        value31 >=
          GRID_LABEL_HEIGHT + 2 + GRID_TOUCH_LABEL_FONT_SIZE + GRID_CHROME_GAP,
      value33 = calculateGridAddButtonSize(scale),
      value34 = value33.size / 24,
      state = {
        "--gap-add-slop": String((40 / value34 - 24) / 2) + "px",
      },
      value35 =
        value31 < GRID_TOUCH_LABEL_FONT_SIZE + 6 + GRID_CHROME_GAP,
      value36 = value35
        ? GRID_SELECTION_OUTSET
        : GRID_TOUCH_LABEL_FONT_SIZE,
      value37 = value32 ? GRID_LABEL_HEIGHT + 2 : value35 ? 3 : 6,
      value38 = Math.max(
        0.1,
        Math.min(1, (value31 - GRID_CHROME_GAP) / (value36 + value37)),
      ),
      value39 =
        !value35 && value31 - GRID_CHROME_GAP >= value36 + value37 + 18,
      value40 = memo2.notes * scale,
      value41 = Math.max(
        1,
        Math.floor((value40 - GRID_TILE_CORNER_RADIUS) / GRID_LABEL_FONT_SIZE),
      ),
      value42 = Math.min(
        1,
        value40 / (GRID_TILE_CORNER_RADIUS + GRID_LABEL_FONT_SIZE),
      ),
      value43 = Math.max(
        0,
        Math.min(
          value10.x + GRID_TOUCH_CHROME_SIZE * value30,
          memo2.width - 64 * value30,
        ),
      ),
      value44 = value13?.kind === "tile" ? value13.id : null,
      value45 = value13?.kind === "tile" && value13.copy,
      memo6 = runtime.ReactGridMemo.useMemo(
        () => new Set(value13?.kind === "tile" ? value13.ids : []),
        [value13],
      ),
      memo7 = runtime.ReactGridMemo.useMemo(
        () =>
          new Set(
            value13?.kind === "tile" && value13.copy
              ? [
                  value13.id,
                  ...value13.ids
                    .filter(
                      (input2) => input2 !== value13.id,
                    )
                    .slice(0, 3),
                ]
              : [],
          ),
        [value13],
      ),
      memo8 = runtime.ReactGridMemo.useMemo(
        () =>
          new Set(value13?.kind === "row" ? value13.sectionIds : []),
        [value13],
      ),
      memo9 = runtime.ReactGridMemo.useMemo(
        () =>
          memo2.tiles.flatMap(
            (input2) =>
              input2.id === behind ||
              (!value45 && memo6.has(input2.id)) ||
              memo8.has(memo[input2.seg]?.section?.id ?? "")
                ? []
                : [memo5.get(input2.id) ?? input2],
          ),
        [memo2, memo5, behind, value45, memo6, memo8, memo],
      ),
      value46 = value44 !== null ? memo3.get(value44) : undefined;
    return SlideGridJsx.jsxs("div", {
      ref: ref10,
      "data-slides-grid": "",
      tabIndex: value2 ? -1 : 0,
      role: "application",
      "aria-label": "Canvas",
      "aria-hidden": value2 || undefined,
      className: (0, runtime.joinClassNames)(
        "relative h-full w-full overflow-hidden bg-editor-canvas outline-none",
        value2 && "pointer-events-none",
      ),
      onKeyDown: callback19,
      onWheelCapture: (input2: ReactWheelEvent<HTMLDivElement>) => {
        if (ref17.current && !input2.ctrlKey) {
          input2.stopPropagation();
        }
      },
      onPointerDownCapture: () => {
        ref35.current += 1;
        ref36.current = null;
      },
      onPointerDown: (event: TargetedEvent<ReactPointerEvent<HTMLDivElement>>) => {
        if (
          value17 === null &&
          !event.target.closest("textarea,input,button,[data-mc-menu]")
        ) {
          ref10.current?.focus({
            preventScroll: true,
          });
        }
        if (ref33.current !== null || ref26.current !== null) {
          return;
        }
        let value47 =
          event.currentTarget.contains(event.target) &&
          !event.target.closest(
            GRID_INTERACTIVE_TARGET_SELECTOR + ", [data-slides-comments]",
          );
        if (
          value47 &&
          event.isPrimary &&
          event.button === 0 &&
          !(event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) &&
          !callback5()
        ) {
          ref36.current = {
            pointerId: event.pointerId,
            sx: event.clientX,
            sy: event.clientY,
          };
        }
        if (
          canStartGridRectSelection({
            pointerType: event.pointerType,
            button: event.button,
            bare: value47,
          })
        ) {
          callback33(event);
        }
      },
      onPointerMove: (input2: ReactPointerEvent<HTMLDivElement>) => {
        let current2 = ref36.current;
        if (
          current2 !== null &&
          current2.pointerId === input2.pointerId &&
          Math.hypot(
            input2.clientX - current2.sx,
            input2.clientY - current2.sy,
          ) >= GRID_RECT_SELECTION_THRESHOLD_PX
        ) {
          ref36.current = null;
        }
      },
      onPointerUp: (input2: ReactPointerEvent<HTMLDivElement>) => {
        let current2 = ref36.current;
        if (current2 === null || current2.pointerId !== input2.pointerId) {
          return;
        }
        ref36.current = null;
        let current3 = ref5.current;
        if (
          Math.hypot(
            input2.clientX - current2.sx,
            input2.clientY - current2.sy,
          ) < GRID_RECT_SELECTION_THRESHOLD_PX &&
          (current3.slides.length > 0 || current3.sections.length > 0)
        ) {
          value7({
            slides: [],
            sections: [],
          });
        }
      },
      onPointerCancel: (input2: ReactPointerEvent<HTMLDivElement>) => {
        if (ref36.current?.pointerId === input2.pointerId) {
          ref36.current = null;
        }
      },
      onDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => {
        if (
          event.target === event.currentTarget &&
          !callback5() &&
          !callback32()
        ) {
          callback13();
        }
      },
      children: [
        SlideGridJsx.jsxs("div", {
          className: "absolute top-0 left-0 pointer-fine:will-change-transform",
          style: {
            transform:
              "translate(" +
              String(-value10.x * scale) +
              "px, " +
              String(-value10.y * scale) +
              "px) scale(" +
              String(scale) +
              ")",
            transformOrigin: "0 0",
          },
          children: [
            value29.rows.map((input2) => {
              if (input2.continuation) {
                return null;
              }
              let section = input2.section,
                value47 = value3?.key === input2.key,
                value48 =
                  section !== null && memo8.has(section.id)
                    ? memo2.rows.find(
                        (input3) =>
                          input3.key === input2.key,
                      )
                    : undefined,
                value49 =
                  value48 && value13?.kind === "row"
                    ? {
                        y: value48.y,
                        dx: value13.dx,
                        dy: value13.dy,
                      }
                    : null,
                value50 = section?.description ?? "",
                value51 = "Section " + String(input2.seg + 1),
                text = "Describe this section",
                value52 =
                  !readOnly && section?.id !== GRID_PREVIEW_SLIDE_ID,
                value53 =
                  section !== null && value6.sections.includes(section.id),
                value54 = value47 ? 1 : value38,
                value55 = value49 ? value49.y + value49.dy : input2.y;
              return SlideGridJsx.jsxs(
                "div",
                {
                  children: [
                    SlideGridJsx.jsx("div", {
                      "data-grid-label": section?.id ?? "",
                      className: (0, runtime.joinClassNames)(
                        "group/label absolute",
                        value49 ? "z-40" : "z-[35]",
                        !value49 &&
                          value13 !== null &&
                          "transition-[top] duration-150 ease-out",
                        section?.id === GRID_PREVIEW_SLIDE_ID && "opacity-60",
                      ),
                      style: {
                        left: value49 ? value49.dx : 0,
                        top: value55 - value37 * value54 * value30,
                        width: value29.width,
                        height: 0,
                      },
                      children: SlideGridJsx.jsxs("div", {
                        "data-mc-chrome": "",
                        ...(section !== null &&
                        section.id !== GRID_PREVIEW_SLIDE_ID
                          ? {
                              role: "button",
                              "aria-pressed": value53,
                              "aria-label":
                                value50 !== ""
                                  ? value50
                                  : value52
                                    ? value51 + ", " + text
                                    : value51,
                            }
                          : {}),
                        className: (0, runtime.joinClassNames)(
                          "absolute bottom-0 left-0 z-[35] flex items-end gap-2 pb-[5px] text-[13px] leading-[18px] select-none",
                          value53 ? "font-medium text-app-accent" : "text-fg",
                          value52 &&
                            section !== null &&
                            !value47 &&
                            "cursor-grab",
                          value49 && "cursor-grabbing",
                        ),
                        style: {
                          minHeight: value36,
                          width: (value29.width * scale) / value54,
                          transform: "scale(" + String(value30 * value54) + ")",
                          transformOrigin: "left bottom",
                        },
                        onPointerDown: (input3: ReactPointerEvent<HTMLDivElement>) => {
                          if (
                            value47 ||
                            section === null ||
                            section.id === GRID_PREVIEW_SLIDE_ID ||
                            callback5()
                          ) {
                            return;
                          }
                          if (
                            input3.shiftKey ||
                            input3.metaKey ||
                            input3.ctrlKey ||
                            input3.altKey
                          ) {
                            input3.stopPropagation();
                            return;
                          }
                          callback25(input3, section.id);
                        },
                        onClick: (event: TargetedEvent<ReactMouseEvent<HTMLDivElement>>) => {
                          if (
                            value47 ||
                            section === null ||
                            section.id === GRID_PREVIEW_SLIDE_ID ||
                            callback5() ||
                            callback6() ||
                            event.target.closest("button,input,textarea")
                          ) {
                            return;
                          }
                          callback4(section.id, event);
                        },
                        onDoubleClick: (event: TargetedEvent<ReactMouseEvent<HTMLDivElement>>) => {
                          event.stopPropagation();
                          if (
                            !value52 ||
                            callback5() ||
                            callback32() ||
                            value47 ||
                            event.target.closest("button,input,textarea")
                          ) {
                            return;
                          }
                          callback40(input2.key, section?.id ?? null, value50);
                        },
                        children: [
                          value47
                            ? SlideGridJsx.jsx(runtime.CommitTextInput, {
                                value: value3!.text,
                                maxLength: runtime.maxSectionDescriptionLength,
                                placeholder: text,
                                "aria-label": "Describe " + value51,
                                selectOnOpen: false,
                                className:
                                  "min-w-0 [--kit-rn-max-w:45rem] [--kit-rn-min-w:10rem]",
                                onChange: (input3: string) =>
                                  value4({
                                    ...value3!,
                                    text: input3,
                                  }),
                                onPointerDown: (input3: ReactPointerEvent<HTMLElement>) =>
                                  input3.stopPropagation(),
                                onCommit: callback38,
                                onCancel: callback39,
                              })
                            : section?.id === GRID_PREVIEW_SLIDE_ID
                              ? SlideGridJsx.jsx("span", {
                                  className:
                                    "max-w-[70%] shrink-0 truncate font-medium text-fg-muted italic",
                                  children: "New section",
                                })
                              : SlideGridJsx.jsx("span", {
                                  className: (0, runtime.joinClassNames)(
                                    "max-w-[45rem] min-w-0 font-medium",
                                    value39
                                      ? "line-clamp-2 break-words"
                                      : "truncate",
                                    value50 === "" &&
                                      !value53 &&
                                      "text-fg-secondary",
                                    value50 === "" && value52 && "cursor-text",
                                  ),
                                  title: value50 !== "" ? value50 : undefined,
                                  onClick:
                                    value50 === "" && value52
                                      ? (input3: ReactMouseEvent<HTMLSpanElement>) => {
                                          if (
                                            input3.shiftKey ||
                                            input3.metaKey ||
                                            input3.ctrlKey ||
                                            input3.altKey ||
                                            callback5() ||
                                            callback6()
                                          ) {
                                            return;
                                          }
                                          input3.stopPropagation();
                                          callback40(
                                            input2.key,
                                            section?.id ?? null,
                                            "",
                                          );
                                        }
                                      : undefined,
                                  children:
                                    value50 !== ""
                                      ? value50
                                      : value52
                                        ? text
                                        : value51,
                                }),
                          value52 &&
                          section !== null &&
                          !value47 &&
                          value13 === null
                            ? SlideGridJsx.jsx("span", {
                                "data-grid-chrome": "",
                                "data-kit": "strip-action",
                                className:
                                  "mb-[-1px] hidden shrink-0 items-center group-hover/label:flex pointer-coarse:flex",
                                onPointerDown: (input3: ReactPointerEvent<HTMLSpanElement>) =>
                                  input3.stopPropagation(),
                                onMouseDown: (event: ReactMouseEvent<HTMLSpanElement>) =>
                                  event.preventDefault(),
                                onDoubleClick: (input3: ReactMouseEvent<HTMLSpanElement>) =>
                                  input3.stopPropagation(),
                                children: SlideGridJsx.jsx(runtime.Button, {
                                  variant: "ghost",
                                  size: "xxs",
                                  iconOnly: true,
                                  tabIndex: -1,
                                  icon: SlideGridJsx.jsx(runtime.Icon, {
                                    name: "Trash",
                                    size: "xs",
                                  }),
                                  "aria-label": "Remove section",
                                  tooltip:
                                    "Remove this section (its slides stay where they are)",
                                  onClick: () => {
                                    ref10.current?.focus({
                                      preventScroll: true,
                                    });
                                    ref.current.onRemoveSection(section.id);
                                  },
                                }),
                              })
                            : null,
                          SlideGridJsx.jsx("span", {
                            "aria-hidden": "true",
                            className: (0, runtime.joinClassNames)(
                              "mb-[8.5px] min-w-4 flex-1",
                              value53 ? "h-0.5 bg-app-accent" : "h-px",
                              !value53 &&
                                (value49
                                  ? "bg-app-accent"
                                  : "bg-border-line group-hover/label:bg-border-strong"),
                            ),
                          }),
                        ],
                      }),
                    }),
                    input2.ids.length === 0
                      ? SlideGridJsx.jsx("div", {
                          className:
                            "absolute border-dashed border-border-strong",
                          style: {
                            left: 0,
                            top: input2.y,
                            width: GRID_SLIDE_WIDTH,
                            height: GRID_SLIDE_HEIGHT,
                            borderWidth: 2 * value30,
                            borderRadius: 6 * value30,
                          },
                          children:
                            GRID_SLIDE_WIDTH * scale >= 200
                              ? SlideGridJsx.jsx("div", {
                                  "data-mc-chrome": "",
                                  className:
                                    "absolute top-0 left-0 flex items-center justify-center text-[12px] text-fg-muted",
                                  style: {
                                    width: GRID_SLIDE_WIDTH * scale,
                                    height: GRID_SLIDE_HEIGHT * scale,
                                    transform: "scale(" + String(value30) + ")",
                                    transformOrigin: "top left",
                                  },
                                  children:
                                    "An empty section. Drop slides here.",
                                })
                              : null,
                        })
                      : null,
                    !readOnly && !value2 && value13 === null
                      ? memo2.rows
                          .filter(
                            (input3) =>
                              input3 === input2 ||
                              (input3.continuation &&
                                input3.seg === input2.seg),
                          )
                          .flatMap(
                            (
                              input3,
                              options,
                              items,
                            ) => [
                              ...input3.ids
                                .map(
                                  (
                                    input4,
                                    options2,
                                  ) => ({
                                    id: input4,
                                    col: options2,
                                    y: input3.y,
                                    end: false,
                                  }),
                                )
                                .filter(
                                  ({ col: col }) =>
                                    col > 0 || input3.continuation,
                                ),
                              ...(options === items.length - 1 &&
                              input3.ids.length > 0
                                ? [
                                    {
                                      id: input3.ids[input3.ids.length - 1]!,
                                      col: input3.ids.length,
                                      y: input3.y,
                                      end: true,
                                    },
                                  ]
                                : []),
                            ],
                          )
                          .map(
                            ({
                              id: id,
                              col: col,
                              y: y,
                              end: end,
                            }) =>
                              SlideGridJsx.jsx(
                                "div",
                                {
                                  className: "group/split absolute z-[38]",
                                  style: {
                                    left:
                                      col *
                                        (GRID_SLIDE_WIDTH + GRID_COLUMN_GAP) -
                                      GRID_COLUMN_GAP,
                                    top: y,
                                    width: end
                                      ? GRID_COLUMN_GAP + GRID_SLIDE_WIDTH
                                      : GRID_COLUMN_GAP,
                                    height: GRID_SLIDE_HEIGHT,
                                  },
                                  onDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => {
                                    if (
                                      event.target === event.currentTarget &&
                                      !callback5() &&
                                      !callback32()
                                    ) {
                                      callback13();
                                    }
                                  },
                                  children: SlideGridJsx.jsx("div", {
                                    "data-grid-chrome": "",
                                    "data-kit": "gap-add",
                                    className: (0, runtime.joinClassNames)(
                                      "absolute top-1/2 opacity-0 transition-opacity group-hover/split:opacity-100",
                                      !value33.fits && "pointer-fine:hidden",
                                      value33.fitsTouch
                                        ? "pointer-coarse:opacity-100"
                                        : "pointer-coarse:hidden",
                                    ),
                                    style: {
                                      left: GRID_COLUMN_GAP / 2,
                                      transform:
                                        "translate(-50%, -50%) scale(" +
                                        String(value30 * value34) +
                                        ")",
                                      ...state,
                                    },
                                    onPointerDown: (
                                      input3: ReactPointerEvent<HTMLDivElement>,
                                    ) => input3.stopPropagation(),
                                    onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) =>
                                      event.preventDefault(),
                                    children: SlideGridJsx.jsx(runtime.Button, {
                                      variant: "primary",
                                      size: "xs",
                                      iconOnly: true,
                                      tabIndex: -1,
                                      icon: SlideGridJsx.jsx(runtime.Icon, {
                                        name: "Add",
                                        size: "xs",
                                      }),
                                      "aria-label": "Add a slide here",
                                      tooltip: "New slide here",
                                      onClick: () => {
                                        let value56 = end
                                          ? id
                                          : order[order.indexOf(id) - 1];
                                        if (value56 === undefined) {
                                          return;
                                        }
                                        onSelect(value56);
                                        ref.current.onAdd();
                                      },
                                    }),
                                  }),
                                },
                                (end ? "end:" : "split:") + id,
                              ),
                          )
                      : null,
                  ],
                },
                input2.key,
              );
            }),
            !readOnly && !value2 && value13 === null && memo2.rows.length > 0
              ? SlideGridJsx.jsx("div", {
                  className: "group/end absolute z-[38]",
                  style: {
                    left: 0,
                    top: memo2.height + GRID_ROW_GAP * 0.2,
                    width: memo2.width,
                    height: GRID_ROW_GAP * 0.8,
                  },
                  onDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => {
                    if (
                      event.target === event.currentTarget &&
                      !callback5() &&
                      !callback32()
                    ) {
                      callback13();
                    }
                  },
                  children: SlideGridJsx.jsxs("div", {
                    className:
                      "pointer-events-none absolute flex items-center gap-2 opacity-0 transition-opacity group-hover/end:opacity-100 pointer-coarse:opacity-100",
                    style: {
                      left: value43,
                      bottom: value37 * value38 * value30,
                      width: ((memo2.width - value43) * scale) / value38,
                      height: value36,
                      transform: "scale(" + String(value30 * value38) + ")",
                      transformOrigin: "left bottom",
                    },
                    children: [
                      SlideGridJsx.jsx("span", {
                        "data-grid-chrome": "",
                        "data-kit": "strip-action",
                        className: "pointer-events-auto flex",
                        onPointerDown: (input2: ReactPointerEvent<HTMLSpanElement>) =>
                          input2.stopPropagation(),
                        onMouseDown: (event: ReactMouseEvent<HTMLSpanElement>) =>
                          event.preventDefault(),
                        children: SlideGridJsx.jsx(runtime.Button, {
                          variant: "primary",
                          size: "xs",
                          iconOnly: true,
                          tabIndex: -1,
                          icon: SlideGridJsx.jsx(runtime.Icon, {
                            name: "Add",
                            size: "xs",
                          }),
                          "aria-label": "Add a section here",
                          tooltip: "New section here",
                          disabled: value28,
                          disabledReason:
                            "This presentation has as many sections as it can hold",
                          onClick: callback42,
                        }),
                      }),
                      SlideGridJsx.jsx("span", {
                        "aria-hidden": "true",
                        className: "h-px min-w-4 flex-1 bg-border-line",
                      }),
                    ],
                  }),
                })
              : null,
            value13?.kind === "row" && memo4
              ? value29.rows
                  .filter(
                    (input2) =>
                      input2.section !== null && memo8.has(input2.section.id),
                  )
                  .map(
                    (input2) =>
                      SlideGridJsx.jsx(
                        "div",
                        {
                          className:
                            "pointer-events-none absolute border-dashed border-app-accent/70 bg-app-accent/5",
                          style: {
                            left: 0,
                            top: input2.y,
                            width:
                              Math.max(1, input2.ids.length) *
                                (GRID_SLIDE_WIDTH + GRID_COLUMN_GAP) -
                              GRID_COLUMN_GAP,
                            height: GRID_SLIDE_HEIGHT,
                            borderWidth: 2 * value30,
                            borderRadius: 6 * value30,
                          },
                        },
                        "slot:" + input2.key,
                      ),
                  )
              : null,
            value13?.kind === "tile" && memo4
              ? value13.ids.map((input2) => {
                  let entry = memo5.get(
                    value13.copy ? copiedGridSlideKey(input2) : input2,
                  );
                  if (entry) {
                    return SlideGridJsx.jsx(
                      "div",
                      {
                        className:
                          "pointer-events-none absolute border-dashed border-app-accent/70 bg-app-accent/5",
                        style: {
                          left: entry.x,
                          top: entry.y,
                          width: GRID_SLIDE_WIDTH,
                          height: GRID_SLIDE_HEIGHT,
                          borderWidth: 2 * value30,
                          borderRadius: 6 * value30,
                        },
                      },
                      "slot:" + input2,
                    );
                  } else {
                    return null;
                  }
                })
              : null,
            memo2.tiles.flatMap(
              (input2) =>
                (memo7.has(input2.id) ? [false, true] : [false]).map(
                  (input3) => {
                    let value47 = slides[input2.id];
                    if (!value47) {
                      return null;
                    }
                    let value48 = input2.id === behind,
                      value49 = value6.slides.includes(input2.id),
                      value50 = value45
                        ? input3
                        : memo6.has(input2.id),
                      value51 =
                        value50 && input2.id !== value44 && value46
                          ? Math.min(
                              3,
                              (value13 as GridTileDragPreview).ids
                                .filter(
                                  (input4) =>
                                    input4 !== value44,
                                )
                                .indexOf(input2.id) + 1,
                            )
                          : 0,
                      value52 =
                        value51 > 0 && value46 ? value46 : input2,
                      value53 =
                        value13?.kind === "row" &&
                        memo8.has(memo[input2.seg]?.section?.id ?? ""),
                      value54 = value53
                        ? input2
                        : (memo5.get(input2.id) ?? input2),
                      value55 = value50
                        ? value13!.dx + value51 * 28 * value30
                        : value53
                          ? value13!.dx
                          : 0,
                      value56 = value50
                        ? value13!.dy + value51 * 28 * value30
                        : value53
                          ? value13!.dy
                          : 0,
                      value57 =
                        (0, runtime.slideDisplayLabel)(value47) ?? "",
                      value58 = value47.skipped === true,
                      value59 = ref17.current?.tile === input2.id,
                      value60 = value5
                        ? (value47.notes ?? "").trim()
                        : "",
                      state2 = {
                        onPointerDown: (input4: ReactPointerEvent<HTMLElement>) => {
                          if (!callback5()) {
                            callback24(input4, input2.id);
                          }
                        },
                        onClick: (input4: ReactMouseEvent<HTMLElement>) => {
                          if (!callback5() && !callback6()) {
                            callback3(input2.id, input4);
                          }
                        },
                        onContextMenu: (event: ReactMouseEvent<HTMLElement>) => {
                          event.preventDefault();
                          if (ref26.current?.moved) {
                            return;
                          }
                          if (!value6.slides.includes(input2.id)) {
                            callback(input2.id);
                          } else if (input2.id !== currentId) {
                            onSelect(input2.id);
                          }
                          value18({
                            x: event.clientX,
                            y: event.clientY,
                            id: input2.id,
                          });
                        },
                      };
                    return SlideGridJsx.jsxs(
                      "div",
                      {
                        "data-grid-tile": input3 ? undefined : input2.id,
                        "aria-hidden": input3 || undefined,
                        className: (0, runtime.joinClassNames)(
                          "group/tile absolute",
                          input3 && "pointer-events-none",
                          value50 || value53
                            ? value51 > 0
                              ? "z-[39] opacity-80"
                              : "z-40 opacity-80"
                            : value13 !== null &&
                                "transition-[left,top] duration-150 ease-out",
                        ),
                        style: {
                          left: (value50 ? value52.x : value54.x) + value55,
                          top: (value50 ? value52.y : value54.y) + value56,
                          width: GRID_SLIDE_WIDTH,
                          height: GRID_SLIDE_HEIGHT,
                        },
                        children: [
                          value50 &&
                          input2.id === value44 &&
                          (memo6.size > 1 || value45)
                            ? SlideGridJsx.jsx("div", {
                                "data-mc-chrome": "",
                                "data-testid": value45
                                  ? "grid-copy-badge"
                                  : undefined,
                                className:
                                  "pointer-events-none absolute top-0 right-0 z-50 flex h-6 min-w-6 items-center justify-center rounded-full bg-app-accent px-1.5 text-xs font-medium text-white",
                                style: {
                                  transform:
                                    "translate(40%, -40%) scale(" +
                                    String(value30) +
                                    ")",
                                  transformOrigin: "center",
                                },
                                children:
                                  (value45 ? "+" : "") +
                                  (memo6.size > 1 ? String(memo6.size) : ""),
                              })
                            : null,
                          value32
                            ? SlideGridJsx.jsxs("div", {
                                "data-mc-chrome": "",
                                className: (0, runtime.joinClassNames)(
                                  "absolute bottom-full left-0 z-30 flex items-center gap-1 text-xs select-none",
                                  value49
                                    ? "font-medium text-app-accent"
                                    : "text-fg-muted group-hover/tile:text-fg-secondary",
                                  (value50 || value53 || value59) &&
                                    "invisible",
                                ),
                                style: {
                                  height: GRID_LABEL_HEIGHT,
                                  transform: "scale(" + String(value30) + ")",
                                  transformOrigin: "left bottom",
                                },
                                children: [
                                  value54.n,
                                  input2.id === coverId
                                    ? SlideGridJsx.jsx(
                                        runtime.ThumbnailIndicator,
                                        {},
                                      )
                                    : null,
                                ],
                              })
                            : null,
                          value48
                            ? null
                            : SlideGridJsx.jsxs("div", {
                                className: (0, runtime.joinClassNames)(
                                  "absolute inset-0 overflow-hidden bg-panel",
                                  value50 && "opacity-90",
                                ),
                                style: {
                                  borderRadius: value59
                                    ? 0
                                    : 6 * Math.min(value30, 6),
                                  boxShadow: value50
                                    ? "0 " +
                                      String(8 * value30) +
                                      "px " +
                                      String(24 * value30) +
                                      "px rgb(0 0 0 / 0.18)"
                                    : "0 0 0 " +
                                      String(value30) +
                                      "px var(--t-border), 0 " +
                                      String(value30) +
                                      "px " +
                                      String(2 * value30) +
                                      "px rgb(0 0 0 / 0.05)",
                                  outline:
                                    value49 && !value59
                                      ? String(3 * value30) +
                                        "px solid var(--cds-fill-accent)"
                                      : undefined,
                                  outlineOffset: 2 * value30,
                                },
                                children: [
                                  SlideGridJsx.jsx("div", {
                                    "data-grid-surface": "",
                                    className: (0, runtime.joinClassNames)(
                                      "absolute inset-0 pointer-coarse:[&_*]:[backdrop-filter:none]! pointer-coarse:[&_*]:[-webkit-backdrop-filter:none]!",
                                      input.commenting === true
                                        ? "pointer-events-auto"
                                        : "pointer-events-none",
                                      value58 && !value59 && "opacity-40",
                                    ),
                                    "aria-hidden": "true",
                                    children: SlideGridJsx.jsx(
                                      GridSlideThumbnail,
                                      {
                                        slide: value47,
                                        assets: assets,
                                        readOnly: readOnly,
                                      },
                                    ),
                                  }),
                                  SlideGridJsx.jsx("div", {
                                    role: "button",
                                    "aria-label":
                                      "Slide " +
                                      String(input2.n) +
                                      (input2.id === coverId
                                        ? " (thumbnail)"
                                        : "") +
                                      (value57 !== "" ? ": " + value57 : "") +
                                      (0, runtime.formatOpenCommentCount)(
                                        commentCounts?.get(input2.id) ?? 0,
                                      ),
                                    "aria-current":
                                      input2.id === currentId
                                        ? "true"
                                        : undefined,
                                    "aria-pressed": value49,
                                    "aria-description":
                                      value60 !== ""
                                        ? (0, runtime.truncateUtf16Safely)(
                                            value60,
                                            200,
                                          ) + (value60.length > 200 ? "…" : "")
                                        : undefined,
                                    className: (0, runtime.joinClassNames)(
                                      "absolute inset-0 select-none",
                                      readOnly
                                        ? "cursor-default"
                                        : "cursor-grab",
                                      value50 && "cursor-grabbing",
                                      !value49 &&
                                        !value59 &&
                                        "hover:shadow-[inset_0_0_0_calc(1px*var(--inv))_var(--t-border-strong)]",
                                    ),
                                    style: {
                                      ["--inv"]: String(value30),
                                    },
                                    ...state2,
                                    onDoubleClick: (
                                      input4: ReactMouseEvent<HTMLDivElement>,
                                    ) => {
                                      input4.stopPropagation();
                                      let bounds =
                                        input4.currentTarget.getBoundingClientRect();
                                      if (!callback5() && !callback32()) {
                                        onOpen(input2.id, {
                                          fx:
                                            (input4.clientX - bounds.left) /
                                            bounds.width,
                                          fy:
                                            (input4.clientY - bounds.top) /
                                            bounds.height,
                                        });
                                      }
                                    },
                                  }),
                                  GRID_SLIDE_WIDTH * scale >= 56 &&
                                  value13 === null &&
                                  !value59
                                    ? SlideGridJsx.jsx(
                                        runtime.SlideCommentCountBadge,
                                        {
                                          count:
                                            commentCounts?.get(input2.id) ?? 0,
                                          className: "absolute",
                                          style: {
                                            left: 4 * value30,
                                            bottom: 4 * value30,
                                            transform:
                                              "scale(" + String(value30) + ")",
                                            transformOrigin: "left bottom",
                                          },
                                        },
                                      )
                                    : null,
                                  value58 && value13 === null && !value59
                                    ? SlideGridJsx.jsx(
                                        runtime.SkippedSlideBadge,
                                        {
                                          why: readOnly
                                            ? runtime.READ_ONLY_PRESENTATION_MESSAGE
                                            : heldSlide?.(input2.id) !==
                                                undefined
                                              ? "Can’t be edited until its saved content is fixed"
                                              : undefined,
                                          onUnskip: () =>
                                            input.onToggleSkip(input2.id),
                                          style: {
                                            transform:
                                              "scale(" + String(value30) + ")",
                                            transformOrigin: "right bottom",
                                          },
                                        },
                                      )
                                    : null,
                                  GRID_SLIDE_WIDTH * scale >=
                                    (value58 ? 96 : 56) &&
                                  value13 === null &&
                                  !value59
                                    ? SlideGridJsx.jsx(
                                        runtime.ThumbnailActionsButton,
                                        {
                                          label:
                                            "Slide " +
                                            String(value54.n) +
                                            " actions",
                                          current:
                                            input2.id === currentId &&
                                            input.commenting !== true,
                                          expanded: value17?.id === input2.id,
                                          skipped: value58,
                                          inv: value30,
                                          className: (0,
                                          runtime.joinClassNames)(
                                            input.commenting === true
                                              ? "hidden"
                                              : value17?.id === input2.id ||
                                                  (value19 &&
                                                    input2.id === currentId)
                                                ? "flex"
                                                : "hidden pointer-fine:group-hover/tile:flex",
                                            value49 &&
                                              input.commenting !== true &&
                                              "pointer-coarse:flex",
                                          ),
                                          onMouseDown: (
                                            event: ReactMouseEvent<HTMLButtonElement>,
                                          ) => event.preventDefault(),
                                          onOpen: (
                                            input4: DOMRect,
                                            options: boolean,
                                          ) => {
                                            onSelect(input2.id);
                                            value18({
                                              x: input4.left + input4.width / 2,
                                              y: input4.top + input4.height / 2,
                                              id: input2.id,
                                              tap: true,
                                              keyboard: options,
                                            });
                                          },
                                        },
                                      )
                                    : null,
                                ],
                              }),
                          value60 !== ""
                            ? SlideGridJsx.jsx("div", {
                                "data-mc-chrome": "",
                                "aria-hidden": "true",
                                dir: "auto",
                                title: value60,
                                className: (0, runtime.joinClassNames)(
                                  "absolute top-full left-0 overflow-hidden text-[13px] whitespace-pre-wrap text-fg-muted select-none",
                                  readOnly ? "cursor-default" : "cursor-grab",
                                  (value50 || value53 || value59 || value48) &&
                                    "invisible",
                                ),
                                style: {
                                  width:
                                    Math.min(GRID_SLIDE_WIDTH * scale, 720) /
                                    value42,
                                  paddingTop: GRID_TILE_CORNER_RADIUS,
                                  lineHeight:
                                    String(GRID_LABEL_FONT_SIZE) + "px",
                                  transform:
                                    "scale(" + String(value30 * value42) + ")",
                                  transformOrigin: "top left",
                                  display: "-webkit-box",
                                  WebkitBoxOrient: "vertical",
                                  WebkitLineClamp: value41,
                                },
                                ...state2,
                                onDoubleClick: (input4: ReactMouseEvent<HTMLDivElement>) => {
                                  input4.stopPropagation();
                                  if (!callback5() && !callback32()) {
                                    onOpen(input2.id);
                                  }
                                },
                                children: value60,
                              })
                            : null,
                        ],
                      },
                      input3 ? copiedGridSlideKey(input2.id) : input2.id,
                    );
                  },
                ),
            ),
            input.peerLayer?.(value30, memo9),
          ],
        }),
        value15
          ? SlideGridJsx.jsx("div", {
              "data-grid-marquee": "",
              "aria-hidden": "true",
              className:
                "pointer-events-none absolute z-30 bg-accent-muted outline-1 -outline-offset-1 outline-fill-accent",
              style: {
                left: value15.x,
                top: value15.y,
                width: value15.w,
                height: value15.h,
              },
            })
          : null,
        input.commentLayer?.(ref10),
        order.length === 0
          ? SlideGridJsx.jsx("p", {
              className:
                "absolute inset-0 flex items-center justify-center text-sm text-fg-muted",
              children: "No slides yet.",
            })
          : null,
        SlideGridJsx.jsx(runtime.ContextMenuPopup, {
          at: value17 && value21 ? value17 : null,
          anchor: value17?.tap ? "tap" : "point",
          "aria-label": value21
            ? value22.length > 1
              ? "Actions for " + String(value22.length) + " slides"
              : "Slide " + String(value21.n) + " actions"
            : undefined,
          focusFirstItem: value17?.keyboard === true,
          onClose: callback34,
          children:
            value17 && value21
              ? SlideGridJsx.jsx(runtime.SlideContextMenu, {
                  id: value17.id,
                  index: value21.n - 1,
                  count: order.length,
                  skipped: slides[value17.id]?.skipped === true,
                  isCover: value17.id === coverId,
                  readOnly: readOnly,
                  heldSlide: heldSlide,
                  via: callback37,
                  group:
                    value22.length > 1
                      ? {
                          ids: value22,
                          allSkipped: value22.every(
                            (input2) =>
                              slides[input2]?.skipped === true,
                          ),
                          onDuplicate: input.onDuplicateSlides,
                          onCopy: input.onCopySlides,
                          onDelete: input.onDeleteSlides,
                          onSetSkipped: input.onSetSlidesSkipped,
                          moveReason: "Drag to move several slides",
                        }
                      : undefined,
                  onNewSection: () =>
                    input.onSectionFromSlides(value22),
                  newSectionDisabledReason: value24
                    ? value23!.section === null
                      ? value22.length > 1
                        ? "These slides already make up Section 1"
                        : "This slide already makes up Section 1"
                      : value22.length > 1
                        ? "These slides are already a section of their own"
                        : "Already a section of its own"
                    : value26
                      ? "This presentation has as many sections as it can hold"
                      : undefined,
                  onDuplicate: input.onDuplicate,
                  onCopy: input.onCopy,
                  onDelete: input.onDelete,
                  onToggleSkip: input.onToggleSkip,
                  onSetCover: input.onSetCover,
                  onAdd: input.onAdd,
                  onMove: input.onMove,
                })
              : null,
        }),
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "GRID_SLIDE_WIDTH",
    () => GRID_SLIDE_WIDTH,
    (value) => {
      GRID_SLIDE_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_SLIDE_HEIGHT",
    () => GRID_SLIDE_HEIGHT,
    (value) => {
      GRID_SLIDE_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_COLUMN_GAP",
    () => GRID_COLUMN_GAP,
    (value) => {
      GRID_COLUMN_GAP = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_ROW_GAP",
    () => GRID_ROW_GAP,
    (value) => {
      GRID_ROW_GAP = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_MAX_COLUMNS",
    () => GRID_MAX_COLUMNS,
    (value) => {
      GRID_MAX_COLUMNS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_NOTES_HEIGHT",
    () => GRID_NOTES_HEIGHT,
    (value) => {
      GRID_NOTES_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "calculateGridAddButtonSize",
    () => calculateGridAddButtonSize,
  );
  bindRuntimeValue(runtime, "buildSlideGridLayout", () => buildSlideGridLayout);
  bindRuntimeValue(runtime, "hitTestSlideGridDrop", () => hitTestSlideGridDrop);
  bindRuntimeValue(runtime, "findSlideGridRow", () => findSlideGridRow);
  bindRuntimeValue(
    runtime,
    "hitTestSlideGridSectionDrop",
    () => hitTestSlideGridSectionDrop,
  );
  bindRuntimeValue(
    runtime,
    "resolveSlideGridMoveTarget",
    () => resolveSlideGridMoveTarget,
  );
  bindRuntimeValue(
    runtime,
    "SlideGridJsx",
    () => SlideGridJsx,
    (value) => {
      SlideGridJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_LABEL_HEIGHT",
    () => GRID_LABEL_HEIGHT,
    (value) => {
      GRID_LABEL_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_TILE_CORNER_RADIUS",
    () => GRID_TILE_CORNER_RADIUS,
    (value) => {
      GRID_TILE_CORNER_RADIUS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_LABEL_FONT_SIZE",
    () => GRID_LABEL_FONT_SIZE,
    (value) => {
      GRID_LABEL_FONT_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_TOUCH_LABEL_FONT_SIZE",
    () => GRID_TOUCH_LABEL_FONT_SIZE,
    (value) => {
      GRID_TOUCH_LABEL_FONT_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_SELECTION_OUTSET",
    () => GRID_SELECTION_OUTSET,
    (value) => {
      GRID_SELECTION_OUTSET = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_CHROME_GAP",
    () => GRID_CHROME_GAP,
    (value) => {
      GRID_CHROME_GAP = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_TOUCH_CHROME_SIZE",
    () => GRID_TOUCH_CHROME_SIZE,
    (value) => {
      GRID_TOUCH_CHROME_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_GRID_SELECTION_SET",
    () => EMPTY_GRID_SELECTION_SET,
    (value) => {
      EMPTY_GRID_SELECTION_SET = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "copiedGridSlideKey",
    () => copiedGridSlideKey,
    (value) => {
      copiedGridSlideKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_DRAG_THRESHOLD_PX",
    () => GRID_DRAG_THRESHOLD_PX,
    (value) => {
      GRID_DRAG_THRESHOLD_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_WHEEL_PAN_FACTOR",
    () => GRID_WHEEL_PAN_FACTOR,
    (value) => {
      GRID_WHEEL_PAN_FACTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_ZOOM_ANIMATION_MS",
    () => GRID_ZOOM_ANIMATION_MS,
    (value) => {
      GRID_ZOOM_ANIMATION_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "scrollOffsetToExposeRange",
    () => scrollOffsetToExposeRange,
  );
  bindRuntimeValue(runtime, "panGridViewToSlide", () => panGridViewToSlide);
  bindRuntimeValue(runtime, "panGridViewToPoint", () => panGridViewToPoint);
  bindRuntimeValue(
    runtime,
    "zoomGridViewToSlidePoint",
    () => zoomGridViewToSlidePoint,
  );
  bindRuntimeValue(runtime, "gridTileScreenRect", () => gridTileScreenRect);
  bindRuntimeValue(
    runtime,
    "interpolateGridViewport",
    () => interpolateGridViewport,
  );
  bindRuntimeValue(runtime, "gridOriginScreenRect", () => gridOriginScreenRect);
  bindRuntimeValue(
    runtime,
    "gridViewportFromTileRect",
    () => gridViewportFromTileRect,
  );
  bindRuntimeValue(
    runtime,
    "MIN_FOCUSED_GRID_SLIDE_WIDTH",
    () => MIN_FOCUSED_GRID_SLIDE_WIDTH,
    (value) => {
      MIN_FOCUSED_GRID_SLIDE_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FOCUSED_GRID_SLIDE_SIDE_PADDING",
    () => FOCUSED_GRID_SLIDE_SIDE_PADDING,
    (value) => {
      FOCUSED_GRID_SLIDE_SIDE_PADDING = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_RECT_SELECTION_THRESHOLD_PX",
    () => GRID_RECT_SELECTION_THRESHOLD_PX,
    (value) => {
      GRID_RECT_SELECTION_THRESHOLD_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_PREVIEW_SLIDE_ID",
    () => GRID_PREVIEW_SLIDE_ID,
    (value) => {
      GRID_PREVIEW_SLIDE_ID = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_INTERACTIVE_TARGET_SELECTOR",
    () => GRID_INTERACTIVE_TARGET_SELECTOR,
    (value) => {
      GRID_INTERACTIVE_TARGET_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canStartGridRectSelection",
    () => canStartGridRectSelection,
  );
  bindRuntimeValue(
    runtime,
    "collectGridTilesInRect",
    () => collectGridTilesInRect,
  );
  bindRuntimeValue(runtime, "hitTestGridTile", () => hitTestGridTile);
  bindRuntimeValue(runtime, "extendGridSelection", () => extendGridSelection);
  bindRuntimeValue(
    runtime,
    "GridSlideThumbnail",
    () => GridSlideThumbnail,
    (value) => {
      GridSlideThumbnail = value;
    },
  );
  bindRuntimeValue(runtime, "SlideGrid", () => SlideGrid);
  return () => {
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeModelEditing)();
    (0, runtime.initializeSections)();
    (0, runtime.initializeSlideRenderer)();
    (0, runtime.initializeSlideModel)();
    GRID_SLIDE_WIDTH = runtime.SLIDE_WIDTH;
    GRID_SLIDE_HEIGHT = runtime.SLIDE_HEIGHT;
    GRID_COLUMN_GAP = 160;
    GRID_ROW_GAP = 480;
    GRID_MAX_COLUMNS = 6;
    GRID_NOTES_HEIGHT = 440;
    SlideGridJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    GRID_LABEL_HEIGHT = 22;
    GRID_TILE_CORNER_RADIUS = 8;
    GRID_LABEL_FONT_SIZE = 18;
    GRID_TOUCH_LABEL_FONT_SIZE = 28;
    GRID_SELECTION_OUTSET = 20;
    GRID_CHROME_GAP = 6;
    GRID_TOUCH_CHROME_SIZE = 32;
    EMPTY_GRID_SELECTION_SET = new Set();
    copiedGridSlideKey = (input: SlideId) => "copy:" + input;
    GRID_DRAG_THRESHOLD_PX = 4;
    GRID_WHEEL_PAN_FACTOR = 1;
    GRID_ZOOM_ANIMATION_MS = 250;
    MIN_FOCUSED_GRID_SLIDE_WIDTH = 420;
    FOCUSED_GRID_SLIDE_SIDE_PADDING = 24;
    GRID_RECT_SELECTION_THRESHOLD_PX = 5;
    GRID_PREVIEW_SLIDE_ID = "__preview__";
    GRID_INTERACTIVE_TARGET_SELECTOR =
      "[data-grid-tile],[data-grid-label],[data-grid-chrome],button,input";
    GridSlideThumbnail = runtime.ReactGridMemo.memo(function ({
      slide: slide,
      assets: assets,
      readOnly: readOnly,
    }: GridSlideThumbnailProps) {
      return SlideGridJsx.jsx(runtime.SlideSurface, {
        slide: slide,
        assets: assets,
        animate: false,
        editorChrome: !readOnly,
      });
    });
  };
}
