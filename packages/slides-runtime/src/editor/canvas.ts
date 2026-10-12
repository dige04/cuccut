/** Restored application module; prepare first, initialize in original order. */
import type {
  ChangeEvent as ReactChangeEvent,
  DragEvent as ReactDragEvent,
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
  RefObject,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type { SlidePeerSelectionsProps } from "../collaboration/slide-selection";
import type {
  Axis,
  FontFace as DeckFontFace,
  Frame,
  FlowContainerNode,
  Slide,
  SlideNode,
  SlideNodeKind,
  SpacerNode,
  StylePropertyName,
  TableNode,
  TextAlignment,
  TextMark,
  TextNode,
  ThemeFonts,
} from "../deck-contracts";
import type { AxisSnaps, SnapCandidate } from "../layout/snapping";
import type {
  GroupMeasure,
  GroupRect,
  NodePath,
  NodeSelection,
} from "../layout/selection-groups";
import type {
  ResizeEdge,
  RotatedSlideRect,
  SlideAxisName,
  SlideRect,
} from "../model/geometry";
import type { ConnectorPoint } from "../model/deck";
import type { SlideNodeUpdate } from "../model/editing";
import type { NavigationTreeEntry } from "../model/navigation";
import type { BoxStyleBinding } from "../ui/box-style-toolbar";
import type { RectangleAttachmentPoint } from "./drag-geometry";
import type { DistanceMeasurements } from "./measurement-overlay";
import type { PointerSnapshot, TouchPressState } from "./touch-long-press";
import type { EditableRichText, RichTextSelectionFormat } from "../model/rich-text-dom";
import type { RichTextFormatName, SlideEditSession } from "../rendering/slides";
import type {
  ObjectContextEditing,
  TableCellAddress,
} from "../model/selection";
import type { TypographyStyle } from "../model/typography";
import type { ColorSwatch } from "../ui/color-select";
import type { SelectionHandle } from "../ui/editor-selection";
import type {
  SelectionActionButtonsProps,
  TextListKind,
} from "../ui/selection-actions";
import type {
  SessionChoiceOption,
  SessionCustomColor,
  SessionTextStyleOption,
  SessionTextStylePopoverProps,
} from "../ui/session-properties";

/** Pan and zoom of the editor camera: the slide's top-left in stage units (negated) and the zoom factor. */
export interface EditorViewport {
  x: number;
  y: number;
  scale: number;
}
/** The stage box the camera is fitted into; `top` and `sidePad` are insets in pixels. */
export interface EditorViewportBox {
  w: number;
  h: number;
  top?: number;
  sidePad?: number;
}
/** A selection rect: slide coordinates, rotation in radians and the scale the node itself applies. */
export interface EditorSelectionRect extends RotatedSlideRect {
  nodeScale?: number;
}
/** Keys of the formatting toolbar labels: a node kind, `mixed` for a mixed selection or `cell` for table cells. */
export type EditorFormattingLabelKey = SlideNodeKind | "mixed" | "cell";
/** An on-screen rectangle in client pixels (the subset of `DOMRect` the canvas reads). */
export interface EditorScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
/** Edges of the editor stage in client pixels. */
export interface EditorViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
/** An event target that may be an element: the code probes `closest` before using it. */
export type ClosestCapableTarget = EventTarget & Partial<Pick<Element, "closest">>;
/** Vertical extent of the text caret; `lineTop` is set when the caret sits at the end of a wrapped line. */
export interface EditableCaretRect {
  top: number;
  bottom: number;
  lineTop?: number;
}
/** Everything `placeFloatingEditorToolbar` needs to place the toolbar relative to the selection and the visible band. */
export interface FloatingToolbarLayout {
  selTop: number;
  selBottom: number;
  menuH: number;
  bandTop: number;
  bandBottom: number;
  caret: () => EditableCaretRect | null;
}
/** Where the floating toolbar goes and whether it covers the selection or the caret. */
export interface FloatingToolbarPlacement {
  top: number;
  placed: "above" | "below";
  overlaps: boolean;
}
/** Which side of a selection a resize grip sits on, per axis (`null` when the grip does not move that axis). */
export interface SelectionGrip {
  x: "left" | "right" | null;
  y: "top" | "bottom" | null;
}
/** A single selected unit that can be resized or rotated, and whether it sits in a flow container. */
export type SingleUnitTransformTarget =
  | { unit: NodeSelection; flow: false }
  | { unit: NodeSelection; flow: true; mainAxis: SlideAxisName | undefined };
/** Hit-test behaviour of a frame, as `pointerSelection` expects it. */
export interface FrameHitTestOptions {
  groupFirst: boolean;
  textTap: boolean;
  flow: boolean;
}
/** What `canStartCanvasPinch` checks. */
export interface CanvasPinchContext {
  dragActive: boolean;
  editTarget: unknown;
}
/** Where a pointer went down, as `canStartCanvasRectSelection` reads it. */
export interface CanvasRectSelectionContext {
  pointerType: string;
  button: number;
  surface: "object" | "empty" | "slide";
  textEdit: boolean;
}
/** A selected unit together with its measured rect. */
export interface SelectionUnitRect {
  unit: NodeSelection;
  rect: SlideRect;
}
/** Outcome of a press on an already selected group of units: drag the selection from this unit. */
export interface SelectionDragHit {
  unit: NodeSelection;
  clickSelect: NodeSelection[];
}
/** The press context `resolveSelectionDragHit` decides on. */
export interface SelectionDragHitContext {
  selection: readonly NodeSelection[];
  selRects: ReadonlyArray<RotatedSlideRect | null>;
  unit: NodeSelection | null;
  toggle: boolean;
  x: number;
  y: number;
}
/** A node together with the rect it was measured at. */
export interface FlowDragDeepEntry {
  path: NodePath;
  rect: SlideRect;
}
/** A flow container child with its measured rect. */
export interface FlowDragChild {
  rect: SlideRect;
}
/** A node whose measured size must be pinned as a minimum when it moves out of its container. */
export interface FlowDragPin {
  path: NodePath;
  w: number;
  h: number;
}
/** Which nodes of a flow container leave it during a drag, with the measurements needed to re-home them as frames. */
export interface FlowDragRequest {
  frameId: string;
  children: FlowDragChild[];
  selectedChildren: number[];
  deep: FlowDragDeepEntry[];
  dragIndex?: number;
  dragPath?: NodePath;
  /** Rect of the container itself; set when the container stays behind as a frame. */
  keep?: SlideRect;
  pins?: FlowDragPin[];
}
/** The slide after nodes were pulled out of a flow container, with the frames that were minted. */
export interface FlowDragResult {
  slide: Slide;
  newFrames: Array<Frame | null>;
  plucked: Array<{ frame: Frame; path: NodePath }>;
  pruned: NodePath[];
  drag: Frame | undefined;
}
/** Children a container loses (and the rects they had), used to find the rect of each remaining child. */
export interface FlowShed {
  frameId: string;
  kids: readonly SlideNode[];
  gone: ReadonlySet<number>;
  rects: ReadonlyArray<SlideRect | null | undefined>;
}
/** The flow container a drag started in, with the rects of the children that stay behind. */
export interface FlowDragOrigin {
  frameId: string;
  path: NodePath;
  index: number;
  dir: "h" | "v" | "grid";
  pinned: SlideAxisName[];
  rests: Array<SlideRect | null | undefined>;
  had: number;
}
/** Where an insertion into a flow container goes. */
export interface FlowInsertionTarget {
  frameId: string;
  path: NodePath;
  index: number;
  /** Axes whose fixed size the frame gives up. */
  release?: SlideAxisName[];
}
/** Where a flow insertion ended up in the container the drag started in. */
export interface FlowReparent {
  path: NodePath;
  index: number;
  stay: number[];
  before: NodePath;
  had: number;
}
/** A flow container child with the width it was measured at. */
export interface FlowChildWidth {
  w: number;
  node: SlideNode | undefined;
}
/** The flow container children that may be lifted out, and the path prefixes that must be pinned. */
export interface CollapsibleFlowAncestors {
  lift: NodePath[];
  pin: NodePath[];
}
/** The result of collapsing a flow frame down to its only child. */
export interface CollapsedFlowFrame {
  slide: Slide;
  minted?: Frame;
  from?: number;
}
/** A placeholder spacer that shows the node being dragged into a flow container. */
export interface GhostSpacerNode extends SpacerNode {
  ghost: SlideNode;
}
/** A selected unit to copy, and the free frame that holds a copy of it. */
export interface SelectionCopy {
  unit: NodeSelection;
  copy: Frame;
  rect?: SlideRect;
}
/** Selection bounds in the form `{l, t, r, b}` (left, top, right, bottom). */
export interface BoundsLtrb {
  l: number;
  t: number;
  r: number;
  b: number;
}
/** Bounds of the selected units and of the container they live in. */
export interface SelectionBoundsPair {
  a: BoundsLtrb;
  b: BoundsLtrb;
}

/** A link being typed for the selected text: where it goes and the editable that owns the selection. */
export interface TextLinkDraft {
  range: Range;
  url: string;
  editable: HTMLElement | null;
}
/** The live-editing hooks a text toolbar gets while the text itself is being edited. */
export interface TextFormattingSession {
  linkDraft: TextLinkDraft | null;
  setLinkDraft: (draft: TextLinkDraft | null) => void;
  onLinkClick: () => void;
  commitFromEditable: (element: Element) => void;
}
/** The text color popover of the toolbar, with the fill editor behind its custom tab. */
export interface TextColorConfig {
  /** Name of the chosen swatch, or null when none matches. */
  value: string | null;
  /** CSS color or image of the dot on the trigger. */
  paint: string | undefined;
  swatches: ColorSwatch[];
  onChange: (name: string) => void;
  custom: SessionCustomColor;
  /** Contrast requirement used while a part of the text is colored. */
  runContrast: SessionCustomColor["contrast"];
  fill: NonNullable<Parameters<RuntimeBindings["useFillEditor"]>[0]>;
}
export interface TextColorControlProps {
  color: TextColorConfig;
}
export interface FloatingTableCellToolbarProps {
  left: number;
  top: number;
  placed: "above" | "below";
  children: ReactNode;
}
export interface TextFormattingToolbarProps {
  selKey: string;
  compact: boolean;
  /** Lay the groups out in one row instead of letting them wrap. */
  oneRow?: boolean;
  styleValue: string | null;
  styleChip: string | undefined;
  styleOptions: SessionTextStyleOption[] | undefined;
  onStyle: (id: string) => void;
  custom: SessionTextStylePopoverProps["custom"];
  color: TextColorConfig;
  bold: boolean;
  onBold: () => void;
  italic: boolean;
  onItalic: () => void;
  underline: boolean;
  onUnderline: () => void;
  /** Why the underline is unavailable, if it is. */
  underlineDead?: string | null;
  elementLink: string | undefined;
  onElementLink: (href: string | undefined) => void;
  align: TextAlignment;
  alignMixed?: boolean;
  onAlign: (align: string) => void;
  list: TextListKind | undefined;
  listMixed?: boolean;
  onList: (list: string | undefined) => void;
  wholeBold?: boolean;
  wholeItalic?: boolean;
  session: TextFormattingSession | null;
  /** Controls of the element kind that are shown besides the text ones. */
  extra: ReactNode;
  onComment: SelectionActionButtonsProps["onComment"];
  onDelete: SelectionActionButtonsProps["onDelete"];
  deleteTitle: SelectionActionButtonsProps["deleteTitle"];
  onOpenInspector: SelectionActionButtonsProps["onOpenInspector"];
  moreMenu: SelectionActionButtonsProps["moreMenu"];
}


/** The open text edit: the frame and node (and table cell) being edited, and where the caret starts. */
export interface CanvasTextEdit extends ObjectContextEditing {
  caret?: "end";
}
/** An upload in flight: the box shown over the slide until the file lands. */
export interface CanvasPendingUpload {
  id: string;
  slideId: string;
  rect: SlideRect;
  url: string;
  what: "video" | "image";
}
/** Where an object menu opens and how it was invoked. */
export interface CanvasMenuAnchor {
  x: number;
  y: number;
  from: "key" | "right-click" | "more";
  /** True when the menu was opened from the keyboard, so the first item takes focus. */
  keyboard?: boolean;
}
/** The grid tile the editor grew out of: where it sat, the camera limits and the callbacks that keep the grid in step. */
export interface CanvasSurround {
  seat: EditorScreenRect;
  pick?: { x: number; y: number };
  minScale: number;
  maxScale: number;
  onViewChange(view: EditorViewport, rect: EditorScreenRect): void;
  onOutsideClick(x: number, y: number): void;
  onFit(): void;
}
/** The imperative handle the canvas gives its host. */
export interface CanvasZoomApi {
  getScale(): number;
  getLimits(): { minScale: number; maxScale: number };
  setScaleTo(scale: number): void;
  returnToFit(): void;
  stepZoom(factor: number): void;
  focusSlide(): void;
  focusSelection(): boolean;
  endTextEdit(): boolean;
  landOnCreated(frameId: string): void;
  measureUnit(unit: NodeSelection): { w?: number; h?: number } | undefined;
  groupMeasure: GroupMeasure;
  menuPoint(): { x: number; y: number } | null;
  endCrop(): void;
}
/** Props of the slide canvas editor. */
export interface SlideCanvasEditorProps {
  slide: Slide;
  slideNumber: number;
  slideName: string;
  busy?: boolean;
  designColors?: string[];
  slideColors?: string[];
  assets: Map<string, string>;
  faces?: DeckFontFace[];
  facesFull?: boolean;
  fonts?: ThemeFonts;
  typeStyles?: TypographyStyle[];
  deckTypeStyles?: TypographyStyle[];
  onReplaceImage?: (frameId: string, path: NodePath, file: File) => void;
  pickImage?: (file: File) => Promise<string>;
  pending?: CanvasPendingUpload[];
  covered?: boolean;
  peerLayer?: (scale: number, measure: SlidePeerSelectionsProps["measure"]) => ReactNode;
  onPointerNorm?: (x: number, y: number) => void;
  selection: NodeSelection[];
  onSelectionChange: (selection: NodeSelection[]) => void;
  onLiveChange: (slide: Slide) => void;
  onGestureEnd: (slide: Slide) => void;
  onMenu?: (anchor: CanvasMenuAnchor, items: NodeSelection[]) => void;
  dragLiveRef?: RefObject<boolean>;
  textEdit: CanvasTextEdit | null;
  onTextEdit: (target: CanvasTextEdit | null) => void;
  onDropImage?: (file: File, x: number, y: number) => void;
  onDropInsert?: (kind: string, x: number, y: number) => void;
  deckCellCount?: number;
  withinStyleBudget?: (nodes: SlideNode[]) => boolean;
  onOpenInspector?: (event: ReactMouseEvent<HTMLElement>) => void;
  moreMenu?: SelectionActionButtonsProps["moreMenu"];
  onDeleteSelection?: () => void;
  selectionMenuHidden?: boolean;
  onChangeSlide?: (slide: Slide, face?: DeckFontFace) => void;
  presenting?: boolean;
  commenting?: boolean;
  zoomApiRef?: RefObject<CanvasZoomApi | null>;
  onScaleChange?: (scale: number) => void;
  bottomInset?: number;
  topInset?: number;
  sideInset?: number;
  readOnly?: boolean;
  stageOverlay?: ReactNode;
  surround?: CanvasSurround;
}
/** A text edit zoomed into view: the camera it came from, the one it restores and where it is anchored. */
export interface TextZoomState {
  key: string;
  slide: string;
  from: EditorViewport | null;
  base: EditorViewport;
  anchor: { x: number; y: number };
  kept: boolean;
  held: boolean;
}
/** A running camera animation: its frame request, target and how to land immediately. */
export interface ViewportAnimation {
  raf: number;
  to: EditorViewport;
  land: () => void;
}
/** The object under the pointer, remembered with the slide and camera it was measured against. */
export interface HoverTarget {
  unit: NodeSelection;
  slide: Slide;
  view: EditorViewport;
}
/** The object the distance guides measure to while Alt is held (`unit` is null over empty space). */
export interface DistanceHoverTarget {
  unit: NodeSelection | null;
}
/** Where a dragged flow child would land: the container box and the insertion bar inside it. */
export interface FlowDropPreview {
  box: SlideRect;
  bar: SlideRect | null;
}


/** A pointer press on the stage that is not yet a drag: where it started and whether it began outside the slide. */
export interface StagePress {
  pointerId: number;
  sx: number;
  sy: number;
  outside: boolean;
}
/** A rubber-band selection in progress. */
export interface RectSelectionDrag {
  pointerId: number;
  sx: number;
  sy: number;
  /** Stage origin in client pixels. */
  ox: number;
  oy: number;
  live: boolean;
  lastKey: string | null;
  /** Selection the band adds to. */
  base: NodeSelection[];
  /** Selection restored when the band is cancelled. */
  prev: NodeSelection[];
  /** Selection applied when the press ends without becoming a band. */
  clickSelect: NodeSelection[] | null;
}

/** Ids minted for frames promoted out of a flow container while it is dragged apart. */
interface FlowPromotion {
  root: boolean;
  tag: string;
  taken: Set<string>;
}
/** The frame an extraction works on (the kept container or a minted frame) with the path inside it. */
interface FlowFrameSlot {
  get: () => Frame | null;
  set: (frame: Frame) => Frame;
  rel: number[];
}

/** The corner a rotate handle sits on. */
export type RotateCorner = "nw" | "ne" | "se" | "sw";
/** The frames a dragged frame lifts out of flow containers, keyed by frame id, with the container direction they left. */
export type FlowLiftedNodes = Map<string, { node: SlideNode; dir: "h" | "v" | "grid" }>;
/** Where a dragged frame would drop into a flow container, with the room it needs there. */
export interface FlowDropCandidate {
  target: FlowInsertionTarget;
  extent: number;
  /** Nodes the target already holds that the drag lifted out of it. */
  originals?: Map<string, SlideNode>;
  /** Placeholder shown at the target. */
  ghost?: SlideNode;
}
/** The slide shown while a drag hovers a flow container, with the drop target it previews. */
export interface FlowDragPreview {
  slide: Slide;
  target: FlowInsertionTarget;
}
/** A frame that moves together with the dragged one: its id and the axis specs it started from. */
export interface DragExtraFrame {
  frameId: string;
  xSpec: Axis;
  ySpec: Axis;
}
/** The fields every pointer drag on the canvas keeps. */
export interface CanvasDragBase {
  frameId: string;
  pointerId: number;
  /** Pointer type that started the drag ("mouse", "touch" or "pen"). */
  type: string;
  /** Camera scale the pointer deltas are divided by. */
  k: number;
  downX: number;
  downY: number;
  startX: number;
  startY: number;
  /** The slide as it was when the drag began. */
  before: Slide;
  moved: boolean;
}
/** Moving one or several frames (also used for the copies an Alt drag leaves behind). */
export interface CanvasMoveDrag extends CanvasDragBase {
  kind: "move";
  /** Distance the pointer may travel before the press counts as a drag. */
  slop: number | undefined;
  applyBase: Slide;
  baseFrame: Frame;
  xSpec: Axis;
  ySpec: Axis;
  /** Measured width of text frames without an explicit width, by frame id. */
  autoW: Map<string, number>;
  altDup: boolean;
  pendingBreakouts: FlowDragRequest[];
  extras: DragExtraFrame[];
  clickSelect: NodeSelection[] | null;
  startRect: SlideRect;
  siblingRects: SlideRect[];
  candidates: SnapCandidate[];
  lastSnaps: AxisSnaps;
  last: { slide: Slide; frame: Frame } | null;
  origin: FlowDragOrigin | null;
  lifted: FlowLiftedNodes;
  sheds: FlowShed[];
  drop: FlowInsertionTarget | null;
  preview: FlowDragPreview | null;
  restore: Map<string, SlideNode> | null;
  at: { x: number; y: number } | null;
}
/** Moving one layer of an overlay frame. */
export interface CanvasLayerMoveDrag extends CanvasDragBase {
  kind: "layer-move";
  layerIndex: number;
  slop: number | undefined;
  lastDx: number;
  lastDy: number;
  clickSelect: NodeSelection[] | null;
  xSpec: Axis;
  ySpec: Axis;
  autoW: number | undefined;
  roomW: number;
  wrapperRect: SlideRect;
  layerRect: SlideRect;
  memberSizes?: ReadonlyArray<GroupRect | undefined>;
}
/** Resizing a free frame from a grip. */
export interface CanvasResizeDrag extends CanvasDragBase {
  kind: "resize";
  xSpec: Axis;
  ySpec: Axis;
  xEdge: ResizeEdge | null;
  yEdge: ResizeEdge | null;
  w: number;
  h: number;
  rotation: number;
  nodeScale: number;
  applyBase: Slide;
  startRect: SlideRect;
  candidates: SnapCandidate[];
}
/** Resizing a node inside a flow container; it may break out of the container into a free frame. */
export interface CanvasFlowResizeDrag extends CanvasDragBase {
  kind: "flow-resize";
  path: NodePath;
  xEdge: ResizeEdge | null;
  yEdge: ResizeEdge | null;
  w: number;
  h: number;
  rotation: number;
  nodeScale: number;
  mainAxis: SlideAxisName | undefined;
  minW: number;
  minH: number;
  breakout: { rect: SlideRect; record: FlowDragRequest; siblingRects: SlideRect[] } | null;
}
/** Dragging one end of a connector or line. */
export interface CanvasEndpointDrag extends CanvasDragBase {
  kind: "endpoint";
  path: NodePath;
  which: 0 | 1;
  strokeWidth: number | undefined;
  /** Line shapes edit a bar of this thickness, inside this span. */
  bar: { thickness: number; span: [number, number] } | null;
  start: [number, number];
  fixed: ConnectorPoint;
  origin: [number, number];
  sites: RectangleAttachmentPoint[];
  last: { dx: number; dy: number } | null;
}
/** Rotating a node about its centre. */
export interface CanvasRotateDrag extends CanvasDragBase {
  kind: "rotate";
  path: NodePath;
  corner: RotateCorner;
  cx: number;
  cy: number;
  startBearing: number;
  startDeg: number;
  lastDeg: number | null;
}
/** The pointer drag in progress on the canvas. */
export type CanvasDragSession =
  | CanvasMoveDrag
  | CanvasLayerMoveDrag
  | CanvasResizeDrag
  | CanvasFlowResizeDrag
  | CanvasEndpointDrag
  | CanvasRotateDrag;
/** A touch that may become a drag, a pan or a long press. */
export interface CanvasTouchPress extends TouchPressState {
  pointerId: number;
  frameId: string;
  press: PointerSnapshot;
  popped: boolean;
  selected: boolean;
}

/** A flow container level the drop finder walked into: its paths, node, measured rect and the gap the dragged node leaves. */
export interface FlowDropLevel {
  path: NodePath;
  dom: NodePath;
  node: FlowContainerNode;
  rect: SlideRect;
  gapAt: number;
}
/** A flow child whose measured width is kept while the container reflows around a drop. */
export interface FlowDropWidthOverride {
  frameId: string;
  index: number;
  w: number;
}

/** The text of a text node or table cell while it is being edited, with its inline formatting. */
export interface TextEditContent {
  text: string;
  marks?: TextMark[];
  list?: "bullet" | "number";
}
/** The working copy of the open text edit: what the editor started from and whether it has changed. */
export interface TextEditDraft extends TextEditContent {
  key: string;
  gen?: number;
  dirty?: boolean;
  closed?: boolean;
}

/** The one color the toolbar edits for the selected object, and how a picked color is written back. */
export interface NodeColorEditor {
  title: string;
  current: string | undefined;
  seed: string;
  paint: string | undefined;
  unset: boolean;
  contrast: SessionCustomColor["contrast"];
  apply: (source: SlideNode, color: string) => SlideNode;
}

/** The numeric text properties the custom typography panel edits. */
export type TypographyScalarProperty = "fontSize" | "lineHeight" | "letterSpacing";

/** A React DOM event whose target is known to be an element (pointer, mouse and focus events always target elements). */
export type ElementTargetEvent<E extends { target: EventTarget }> = E & {
  target: Element;
};

declare module "../bindings" {
  interface RuntimeBindings {
    CanvasEditorJsx: JsxNamespace;
    EMPTY_EDITOR_TOOL_OPTIONS: SessionTextStyleOption[];
    NODE_BACKGROUND_AND_PADDING_PROPERTIES: StylePropertyName[];
    TEXT_ALIGNMENT_LABELS: Record<TextAlignment, string>;
    TEXT_ALIGNMENT_ICONS: Record<TextAlignment, string>;
    TABLE_TEXT_ALIGNMENT_OPTIONS: SessionChoiceOption[];
    TEXT_ALIGNMENT_OPTIONS: SessionChoiceOption[];
    textFormattingSnapshotsEqual: (
      left: RichTextSelectionFormat | null,
      right: RichTextSelectionFormat | null,
    ) => boolean;
    trimTrailingTextNewlines: (text: string) => string;
    FloatingTableCellToolbar: (
      props: FloatingTableCellToolbarProps,
    ) => ReactElement;
    TextColorControl: (props: TextColorControlProps) => ReactElement;
    TextFormattingToolbar: (props: TextFormattingToolbarProps) => ReactElement;
    SlideCanvasEditor: (props: SlideCanvasEditorProps) => ReactElement;
    typeStylesToEditorOptions: (
      typeStyles: readonly TypographyStyle[],
    ) => SessionTextStyleOption[];
    resolveSingleUnitTransformTarget: (
      slide: Slide,
      selection: readonly NodeSelection[],
    ) => SingleUnitTransformTarget | null;
    resolveSingleUnitStyleTarget: (
      slide: Slide,
      selection: readonly NodeSelection[],
    ) => NodeSelection | null;
    placementSideToSnapLine: (
      side: "left" | "right" | "top" | "bottom" | null,
    ) => ResizeEdge | null;
    HORIZONTAL_GROUP_RESIZE_HANDLES: SelectionGrip[];
    /**
     * Despite its restored name this sets the gesture cursor for a resize grip (first parameter) on a selection
     * rotated by an angle in radians (second parameter).
     */
    copySelectedUnitsToClipboard: (grip: SelectionGrip, rotation: number) => void;
    EDITOR_ENTER_KEY_HINTS: Record<"multi" | "enter" | "text" | "cell", string>;
    editorRectsEqual: (
      left: EditorSelectionRect,
      right: EditorSelectionRect,
    ) => boolean;
    EDITOR_VIEWPORT_PADDING: number;
    EDITOR_MIN_STAGE_HEIGHT: number;
    EDITOR_STAGE_PADDING_FRACTION: number;
    EDITOR_FALLBACK_STAGE_WIDTH: number;
    EDITOR_FORMATTING_LABELS: Record<EditorFormattingLabelKey, string>;
    centerViewportAxis: (
      viewportSize: number,
      slideSize: number,
      scale: number,
      inset: number,
    ) => number;
    fitSlideEditorViewport: (viewport: EditorViewportBox) => EditorViewport;
    editorViewportFromScreenRect: (
      slideRect: EditorScreenRect,
      containerRect: EditorScreenRect,
    ) => EditorViewport;
    clampEditorViewport: (
      view: EditorViewport,
      viewport: EditorViewportBox,
    ) => EditorViewport;
    EDITOR_TEXT_ZOOM_DURATION_MS: number;
    EDITOR_TEXT_ZOOM_SIDE_PADDING: number;
    EDITOR_TEXT_ZOOM_TOP_PADDING: number;
    calculateTextEditingZoom: (
      textRect: SlideRect,
      viewport: EditorViewportBox,
      currentView: EditorViewport,
      maxScale: number,
    ) => EditorViewport | null;
    getEditorViewportBounds: (
      element: Element | null | undefined,
      topInset?: number,
    ) => EditorViewportBounds;
    constrainEditorBandBottom: (
      bottom: number,
      viewportHeight: number,
      bottomInset: number,
    ) => number;
    unscaleEditorScreenRect: (
      rect: EditorScreenRect,
      originX: number,
      originY: number,
      scaleX: number,
      scaleY: number,
    ) => EditorScreenRect;
    parseCssScaleFactors: (cssScale: string | null | undefined) => [number, number];
    SLIDE_LIFT_SCALE_ATTRIBUTE: string;
    getUnliftedBoundingClientRect: (element: Element) => EditorScreenRect;
    placeFloatingEditorToolbar: (
      layout: FloatingToolbarLayout,
    ) => FloatingToolbarPlacement;
    getEditableCaretClientRect: () => EditableCaretRect | null;
    chooseTextEditingTarget: (
      element: Element,
      frameElement: number,
      node: number,
    ) => Element;
    pointerDragThreshold: (pointerType: string) => number;
    isAdditionalTouchPointer: (
      pointers: { readonly size: number; has(pointerId: number): boolean },
      event: Pick<PointerEvent, "pointerType" | "isPrimary" | "pointerId">,
    ) => boolean;
    isFrameOrResizeTarget: (target: ClosestCapableTarget | null) => boolean;
    canStartCanvasPinch: (context: CanvasPinchContext) => boolean;
    canStartCanvasRectSelection: (context: CanvasRectSelectionContext) => boolean;
    rectanglesOverlap: (left: SlideRect, right: SlideRect) => boolean;
    collectUnitsIntersectingSelectionRect: (
      rect: SlideRect,
      units: readonly SelectionUnitRect[],
      selection: readonly NodeSelection[],
    ) => NodeSelection[];
    pathsOverlap: (leftPath: readonly number[], rightPath: readonly number[]) => boolean;
    getFrameHitTestOptions: (slide: Slide, frame: Frame) => FrameHitTestOptions;
    getFrameTransformScreenRect: (
      slide: Slide,
      frameId: string,
      element: Element,
    ) => DOMRect;
    resolveSelectionDragHit: (
      context: SelectionDragHitContext,
    ) => SelectionDragHit | null;
    preservePinchAnchorCoordinate: (
      start: number,
      anchor: number,
      previousScale: number,
      nextScale: number,
    ) => number;
    parseEditorNodePath: (path: string | null | undefined) => number[];
    removeNodeFromFrame: (frame: Frame, path: readonly number[]) => Frame;
    ceilMeasuredNodeSize: (size: number) => number;
    createFreeFrameFromNode: (node: SlideNode, rect: SlideRect) => Frame;
    fillMissingFrameSizes: (frame: Frame, rect: Pick<SlideRect, "w" | "h">) => Frame;
    isEmptyUnstyledFlowContainer: (node: SlideNode) => boolean;
    setNodeMinimumPlacementSize: (
      node: SlideNode,
      rect: Pick<SlideRect, "w" | "h">,
    ) => SlideNode;
    findChangedFrameIds: (before: Slide, after: Slide) => Set<string>;
    findSurvivingNodePath: (
      before: SlideNode,
      after: SlideNode,
      path: readonly number[],
    ) => NodePath | undefined;
    removeNodeAndEmptyAncestors: (
      frame: Frame,
      path: readonly number[],
      removedPaths?: NodePath[],
    ) => Frame;
    extractFlowDragSelection: (
      slide: Slide,
      extraction: FlowDragRequest,
    ) => FlowDragResult | null;
    collectFlowDragChildPaths: (
      drag: FlowDragRequest,
      paths: SlideRect | undefined,
    ) => FlowDragRequest;
    normalizeFlowDragExtraction: (
      drag: FlowDragRequest,
      frame: Frame,
      flow: boolean,
      paths: SlideRect,
    ) => FlowDragRequest;
    createFlowChildIndexRemapper: (
      extraction: FlowShed,
      children: readonly SlideNode[],
    ) => (index: number) => SlideRect | null;
    collapseSingleChildFlowFrame: (
      slide: Slide,
      frameId: string,
      measure: (index: number) => SlideRect | null | undefined,
    ) => CollapsedFlowFrame;
    reparentExtractedFlowNode: (
      before: SlideNode,
      after: SlideNode,
      dragPath: NodePath,
      extracted: ReadonlyArray<{ path: NodePath }>,
      removedPaths?: NodePath[],
    ) => FlowReparent | null;
    getRemainingFlowChildRects: (drag: FlowDragRequest) => SlideRect[];
    removeFrameAxisSizes: (
      frame: Frame,
      axes: readonly SlideAxisName[],
    ) => Frame;
    removeFlowNodePlacement: (
      frame: Frame,
      rect: SlideNode | undefined,
    ) => SlideNode;
    calculateNestedOverlayDepth: (
      node: SlideNode | undefined,
      path: readonly number[],
    ) => number;
    insertFramesIntoFlowContainer: (
      slide: Slide,
      frameIds: readonly string[],
      target: FlowInsertionTarget,
      measure?: ReadonlyMap<string, SlideNode>,
    ) => Slide | null;
    canInsertNodeIntoFlow: (node: SlideNode) => boolean;
    setFlowInsertionSize: (
      slide: Slide,
      unit: FlowInsertionTarget,
      size: number,
      axis?: SlideNode,
    ) => Slide;
    findFlowInsertionIndex: (
      node: FlowContainerNode,
      rects: readonly SlideRect[],
      x: number,
      y: number,
    ) => number;
    calculateFlowInsertionGuide: (
      node: FlowContainerNode,
      rects: readonly SlideRect[],
      index: number,
      gap: number,
    ) => SlideRect | null;
    shouldExtractOversizedNode: (
      dragRect: SlideRect,
      containerRect: SlideRect,
      forced: boolean,
    ) => boolean;
    canFitHorizontalFlowInsertion: (
      node: SlideNode,
      containerWidth: number,
      children: readonly FlowChildWidth[],
      dragWidth: number,
    ) => boolean;
    pairFlowRectsWithRemainingNodes: (
      rects: ReadonlyArray<Pick<SlideRect, "w">>,
      nodes: readonly SlideNode[],
      removedIndex: number,
    ) => FlowChildWidth[];
    flowInsertionTargetMatches: (
      target: FlowDragOrigin | null,
      frameId: string,
      path: readonly number[],
      dragNodes: readonly string[],
      selectedKeys: ReadonlyMap<string, unknown>,
    ) => boolean;
    collectCollapsibleFlowAncestors: (
      node: SlideNode,
      path: readonly number[],
      minimumDepth: number,
    ) => CollapsibleFlowAncestors;
    flowRectsAligned: (
      left: SlideRect,
      right: SlideRect,
      xHandle: ResizeEdge | null,
      yHandle: ResizeEdge | null,
      tolerance?: number,
    ) => boolean;
    isStrictPathAncestor: (
      ancestor: readonly number[],
      descendant: readonly number[],
    ) => boolean;
    duplicateFrameWithFixedFillPlacement: (frame: Frame) => Frame;
    deleteSelectedUnits: (
      slide: Slide,
      selection: readonly NodeSelection[],
      options: (unit: NodeSelection) => SlideRect | null | undefined,
    ) => SelectionCopy[];
    rotatedRectBounds: (rect: RotatedSlideRect | null) => BoundsLtrb | null;
    selectionBoundsForUnits: (
      units: readonly NodeSelection[],
      rects: ReadonlyArray<RotatedSlideRect | null | undefined>,
      slide: NodeSelection | null,
      measure: (unit: NodeSelection) => RotatedSlideRect | null,
    ) => SelectionBoundsPair | null;
    getSelectedTextStyle: (slide: Slide, unit: ObjectContextEditing) => boolean;
  }
}

export function installEditorCanvas(runtime: RuntimeBindings): () => void {
  var CanvasEditorJsx: JsxNamespace;
  var EMPTY_EDITOR_TOOL_OPTIONS: RuntimeBindings["EMPTY_EDITOR_TOOL_OPTIONS"];
  var placementSideToSnapLine: RuntimeBindings["placementSideToSnapLine"];
  var HORIZONTAL_GROUP_RESIZE_HANDLES: RuntimeBindings["HORIZONTAL_GROUP_RESIZE_HANDLES"];
  var EDITOR_ENTER_KEY_HINTS: RuntimeBindings["EDITOR_ENTER_KEY_HINTS"];
  var EDITOR_VIEWPORT_PADDING: RuntimeBindings["EDITOR_VIEWPORT_PADDING"];
  var EDITOR_MIN_STAGE_HEIGHT: RuntimeBindings["EDITOR_MIN_STAGE_HEIGHT"];
  var EDITOR_STAGE_PADDING_FRACTION: RuntimeBindings["EDITOR_STAGE_PADDING_FRACTION"];
  var EDITOR_FALLBACK_STAGE_WIDTH: RuntimeBindings["EDITOR_FALLBACK_STAGE_WIDTH"];
  var EDITOR_FORMATTING_LABELS: RuntimeBindings["EDITOR_FORMATTING_LABELS"];
  var centerViewportAxis: RuntimeBindings["centerViewportAxis"];
  var EDITOR_TEXT_ZOOM_DURATION_MS: RuntimeBindings["EDITOR_TEXT_ZOOM_DURATION_MS"];
  var EDITOR_TEXT_ZOOM_SIDE_PADDING: RuntimeBindings["EDITOR_TEXT_ZOOM_SIDE_PADDING"];
  var EDITOR_TEXT_ZOOM_TOP_PADDING: RuntimeBindings["EDITOR_TEXT_ZOOM_TOP_PADDING"];
  var SLIDE_LIFT_SCALE_ATTRIBUTE: RuntimeBindings["SLIDE_LIFT_SCALE_ATTRIBUTE"];
  var getFrameHitTestOptions: RuntimeBindings["getFrameHitTestOptions"];
  var isEmptyUnstyledFlowContainer: RuntimeBindings["isEmptyUnstyledFlowContainer"];
  var canInsertNodeIntoFlow: RuntimeBindings["canInsertNodeIntoFlow"];
  var NODE_BACKGROUND_AND_PADDING_PROPERTIES: RuntimeBindings["NODE_BACKGROUND_AND_PADDING_PROPERTIES"];
  var TEXT_ALIGNMENT_LABELS: RuntimeBindings["TEXT_ALIGNMENT_LABELS"];
  var TEXT_ALIGNMENT_ICONS: RuntimeBindings["TEXT_ALIGNMENT_ICONS"];
  var TABLE_TEXT_ALIGNMENT_OPTIONS: RuntimeBindings["TABLE_TEXT_ALIGNMENT_OPTIONS"];
  var TEXT_ALIGNMENT_OPTIONS: RuntimeBindings["TEXT_ALIGNMENT_OPTIONS"];
  function typeStylesToEditorOptions(typeStyles: readonly TypographyStyle[]): SessionTextStyleOption[] {
    return typeStyles.map((input) => {
      return {
        value: input.id,
        text: input.name,
        label: CanvasEditorJsx.jsx("span", {
          className: "min-w-0 whitespace-nowrap",
          style: (0, runtime.typographyStyleCss)(input),
          children: input.name,
        }),
        hint: input.hint,
        ...(input.title !== undefined
          ? {
              title: input.title,
            }
          : {}),
        ...(input.group !== undefined
          ? {
              group: input.group,
            }
          : {}),
        ...(input.subgroup !== undefined
          ? {
              subgroup: input.subgroup,
            }
          : {}),
      };
    });
  }
  function resolveSingleUnitTransformTarget(
    slide: Slide,
    selection: readonly NodeSelection[],
  ): SingleUnitTransformTarget | null {
    if (selection.length !== 1) {
      return null;
    }
    let unit = selection[0]!,
      frame = (0, runtime.frameById)(slide, unit.frameId);
    if (unit.child === undefined) {
      if (
        !runtime.GROUP_RESIZING_ENABLED &&
        frame !== undefined &&
        (0, runtime.isEmptyGroupBase)(frame.node)
      ) {
        return null;
      } else {
        return {
          unit: unit,
          flow: false,
        };
      }
    }
    if (!frame) {
      return null;
    }
    let value = (0, runtime.selectionNodePath)(unit),
      value2 = (0, runtime.nodeAtPath)(frame.node, value),
      value3 = (0, runtime.nodeAtPath)(frame.node, value.slice(0, -1));
    if (
      !value2 ||
      !value3 ||
      !(0, runtime.isFlowContainer)(value3) ||
      !(0, runtime.nodeSupportsSizing)(value2)
    ) {
      return null;
    }
    let value4: SlideAxisName | undefined =
      value3.kind === "stack" ? (value3.dir === "h" ? "x" : "y") : undefined;
    return {
      unit: unit,
      flow: true,
      mainAxis: value4,
    };
  }
  function resolveSingleUnitStyleTarget(
    slide: Slide,
    selection: readonly NodeSelection[],
  ): NodeSelection | null {
    if (selection.length !== 1) {
      return null;
    }
    let unit = selection[0]!,
      node = (0, runtime.selectedNode)(slide, unit);
    if (node === undefined || node.kind === "overlay") {
      return null;
    }
    let path = (0, runtime.selectionNodePath)(unit);
    if (
      path.length > 0 &&
      path[path.length - 1] === 0 &&
      (0, runtime.selectedNode)(
        slide,
        (0, runtime.createNodeSelection)(unit.frameId, path.slice(0, -1)),
      )?.kind === "overlay"
    ) {
      return null;
    }
    if (
      node.kind === "shape"
        ? node.shape !== "connector"
        : (0, runtime.nodeStyleKind)(node) !== undefined
    ) {
      return unit;
    } else {
      return null;
    }
  }
  function copySelectedUnitsToClipboard(
    slide: SelectionGrip,
    selection: number,
  ): void {
    (0, runtime.setGestureCursor)(
      (0, runtime.rotatedResizeCursor)(slide, selection),
    );
  }
  function editorRectsEqual(left: EditorSelectionRect, right: EditorSelectionRect): boolean {
    return (
      left.x === right.x &&
      left.y === right.y &&
      left.w === right.w &&
      left.h === right.h &&
      left.rotation === right.rotation &&
      left.nodeScale === right.nodeScale
    );
  }
  function fitSlideEditorViewport(viewport: EditorViewportBox): EditorViewport {
    let bottomPadding = Math.min(
        EDITOR_VIEWPORT_PADDING,
        Math.max(
          viewport.h - EDITOR_MIN_STAGE_HEIGHT,
          viewport.h * EDITOR_STAGE_PADDING_FRACTION,
        ),
      ),
      width = Math.min(
        viewport.w - 2 * (viewport.sidePad ?? EDITOR_VIEWPORT_PADDING / 2),
        ((viewport.h - bottomPadding) * runtime.SLIDE_WIDTH) /
          runtime.SLIDE_HEIGHT,
      ),
      scale =
        (width > 0 ? width : EDITOR_FALLBACK_STAGE_WIDTH) / runtime.SLIDE_WIDTH;
    return {
      x: centerViewportAxis(viewport.w, runtime.SLIDE_WIDTH, scale, 0),
      y: centerViewportAxis(
        viewport.h,
        runtime.SLIDE_HEIGHT,
        scale,
        viewport.top ?? 0,
      ),
      scale: scale,
    };
  }
  function editorViewportFromScreenRect(
    slideRect: EditorScreenRect,
    containerRect: EditorScreenRect,
  ): EditorViewport {
    let scale = slideRect.width / runtime.SLIDE_WIDTH;
    return {
      scale: scale,
      x: -(slideRect.left - containerRect.left) / scale,
      y: -(slideRect.top - containerRect.top) / scale,
    };
  }
  function clampEditorViewport(view: EditorViewport, viewport: EditorViewportBox): EditorViewport {
    if (view.scale <= 0) {
      return view;
    }
    let padding = EDITOR_VIEWPORT_PADDING / view.scale,
      callback = (
        input: number,
        options: number,
        context: number,
        value3: number,
      ) => {
        let value4 = options / view.scale;
        if (value4 >= context) {
          return centerViewportAxis(options, context, view.scale, value3);
        }
        let value5 = value3 / view.scale;
        return Math.min(
          context - value4 + padding - value5,
          Math.max(-padding - value5, input),
        );
      },
      value = callback(view.x, viewport.w, runtime.SLIDE_WIDTH, 0),
      value2 = callback(
        view.y,
        viewport.h,
        runtime.SLIDE_HEIGHT,
        viewport.top ?? 0,
      );
    if (value === view.x && value2 === view.y) {
      return view;
    }
    return {
      x: value,
      y: value2,
      scale: view.scale,
    };
  }
  function calculateTextEditingZoom(
    textRect: SlideRect,
    viewport: EditorViewportBox,
    currentView: EditorViewport,
    maxScale: number,
  ): EditorViewport | null {
    let value = viewport.w - 2 * EDITOR_TEXT_ZOOM_SIDE_PADDING;
    if (!(textRect.w > 0) || !(value > 0)) {
      return null;
    }
    let value2 = Math.min(value / textRect.w, 1, maxScale);
    if (value2 < currentView.scale * 1.2) {
      return null;
    }
    let value3 =
      viewport.h >= 2 * EDITOR_TEXT_ZOOM_TOP_PADDING
        ? EDITOR_TEXT_ZOOM_TOP_PADDING
        : 8;
    return clampEditorViewport(
      {
        scale: value2,
        x: textRect.x + textRect.w / 2 - viewport.w / (2 * value2),
        y: textRect.y - ((viewport.top ?? 0) + value3) / value2,
      },
      viewport,
    );
  }
  function getEditorViewportBounds(
    element: Element | null | undefined,
    topInset: number = 0,
  ): EditorViewportBounds {
    let bounds = element?.getBoundingClientRect();
    if (bounds !== undefined && bounds.width > 0) {
      return {
        left: bounds.left,
        top: bounds.top + topInset,
        right: bounds.right,
        bottom: bounds.bottom,
      };
    } else {
      return {
        left: 0,
        top: topInset,
        right: (window).innerWidth,
        bottom: (window).innerHeight,
      };
    }
  }
  function constrainEditorBandBottom(
    bottom: number,
    viewportHeight: number,
    bottomInset: number,
  ): number {
    if (bottomInset > 0) {
      return Math.min(bottom, viewportHeight - bottomInset);
    } else {
      return bottom;
    }
  }
  function unscaleEditorScreenRect(
    rect: EditorScreenRect,
    originX: number,
    originY: number,
    scaleX: number,
    scaleY: number,
  ): EditorScreenRect {
    if (!(scaleX > 0) || !(scaleY > 0)) {
      return rect;
    }
    return {
      left: originX + (rect.left - originX) / scaleX,
      top: originY + (rect.top - originY) / scaleY,
      width: rect.width / scaleX,
      height: rect.height / scaleY,
    };
  }
  function parseCssScaleFactors(cssScale: string | null | undefined): [number, number] {
    let [scaleX, scaleY] = (cssScale ?? "")
        .trim()
        .split(/\s+/)
        .map(parseFloat),
      fallback = scaleX !== undefined && scaleX > 0 ? scaleX : 1;
    return [fallback, scaleY !== undefined && scaleY > 0 ? scaleY : fallback];
  }
  function getUnliftedBoundingClientRect(element: Element): EditorScreenRect {
    let rect = element.getBoundingClientRect(),
      liftedAncestor = element.closest(
        "[" + SLIDE_LIFT_SCALE_ATTRIBUTE + "]",
      );
    if (liftedAncestor === null) {
      return rect;
    }
    let value = getComputedStyle(liftedAncestor),
      [value2, value3] = parseCssScaleFactors(value.scale),
      [value4, value5] = parseCssScaleFactors(
        liftedAncestor.getAttribute(SLIDE_LIFT_SCALE_ATTRIBUTE),
      ),
      value6 =
        liftedAncestor === element
          ? rect
          : liftedAncestor.getBoundingClientRect(),
      [value7, value8] = (value.transformOrigin ?? "")
        .split(" ")
        .map(parseFloat),
      value9 =
        liftedAncestor instanceof HTMLElement ? liftedAncestor.offsetWidth : 0,
      value10 =
        liftedAncestor instanceof HTMLElement ? liftedAncestor.offsetHeight : 0,
      value11 =
        value9 > 0 && value7 !== undefined && !Number.isNaN(value7)
          ? value7 / value9
          : 0.5,
      value12 =
        value10 > 0 && value8 !== undefined && !Number.isNaN(value8)
          ? value8 / value10
          : 0.5;
    return unscaleEditorScreenRect(
      rect,
      value6.left + value11 * value6.width,
      value6.top + value12 * value6.height,
      value2 / value4,
      value3 / value5,
    );
  }
  function placeFloatingEditorToolbar(layout: FloatingToolbarLayout): FloatingToolbarPlacement {
    let maxTop = layout.bandTop + 8,
      desiredTop = Math.max(
        maxTop,
        layout.bandBottom - 8 - layout.menuH,
      ),
      value = Math.max(maxTop, layout.selTop - layout.menuH - 10);
    if (value + layout.menuH + 8 <= layout.selTop) {
      return {
        top: Math.min(value, desiredTop),
        placed: "above",
        overlaps: false,
      };
    }
    let value2 = layout.selBottom + 10;
    if (value2 <= desiredTop) {
      return {
        top: Math.max(maxTop, value2),
        placed: "below",
        overlaps: false,
      };
    }
    let value3 = layout.caret();
    if (value3 === null || value3.top >= maxTop + layout.menuH + 10) {
      return {
        top: maxTop,
        placed: "above",
        overlaps: true,
      };
    }
    let value4 = Math.max(maxTop, value3.bottom + 10);
    if (value4 <= desiredTop) {
      return {
        top: value4,
        placed: "below",
        overlaps: true,
      };
    }
    let callback = (input: number, options: number) =>
        Math.max(
          0,
          Math.min(input + layout.menuH, value3.bottom) -
            Math.max(input, options),
        ),
      value5 = value3.lineTop ?? value3.top;
    if (
      (callback(maxTop, value5) - callback(desiredTop, value5) ||
        callback(maxTop, value3.top) - callback(desiredTop, value3.top)) <= 0
    ) {
      return {
        top: maxTop,
        placed: "above",
        overlaps: true,
      };
    } else {
      return {
        top: desiredTop,
        placed: "below",
        overlaps: true,
      };
    }
  }
  function getEditableCaretClientRect(): EditableCaretRect | null {
    let selection = (document).getSelection(),
      focusNode: Node | null = selection?.focusNode ?? null,
      focusOffset = selection?.focusOffset ?? 0,
      focusElement =
        focusNode instanceof Element
          ? focusNode
          : (focusNode?.parentElement ?? null);
    if (
      focusNode === null ||
      focusElement === null ||
      focusElement.closest("[data-text-path][contenteditable]") === null
    ) {
      return null;
    }
    while (focusNode.nodeType === 1 && focusNode.childNodes.length > 0) {
      let childNodes: NodeListOf<ChildNode> = focusNode.childNodes,
        value7 = focusOffset >= childNodes.length,
        value8: ChildNode | undefined =
          childNodes[value7 ? childNodes.length - 1 : focusOffset];
      if (value8 === undefined) {
        break;
      }
      focusNode = value8;
      focusOffset = value7
        ? value8.nodeType === 3
          ? (value8.textContent ?? "").length
          : value8.childNodes.length
        : 0;
    }
    let value = (document).createRange();
    value.setStart(focusNode, focusOffset);
    let value2 = value.getClientRects()[0];
    if (
      value2 === undefined &&
      focusNode.nodeType === 3 &&
      (focusNode.textContent ?? "") !== ""
    ) {
      let value7 = Math.max(1, focusOffset);
      value.setStart(focusNode, value7 - 1);
      value.setEnd(focusNode, value7);
      value2 = [...value.getClientRects()].pop();
    }
    let value3 =
        value2 ??
        (focusNode instanceof Element
          ? focusNode
          : (focusNode.parentElement ?? focusElement)
        ).getBoundingClientRect(),
      bottom = value3.bottom,
      value4: number | undefined,
      value5 = focusNode.nodeType === 3 ? focusNode : null,
      value6 = focusOffset,
      ancestor = focusElement.closest(
        "[data-text-path][contenteditable]",
      );
    if (
      value5 !== null &&
      ancestor !== null &&
      focusOffset >= (focusNode.textContent ?? "").length
    ) {
      let value7 = (document).createTreeWalker(ancestor, 5);
      value7.currentNode = focusNode;
      value5 = null;
      value6 = 0;
      for (
        let value8 = value7.nextNode();
        value8 !== null;
        value8 = value7.nextNode()
      )
        if (value8.nodeType !== 3) {
          if (
            value8.nodeName === "BR" ||
            (value8 instanceof Element &&
              getComputedStyle(value8).display !== "inline")
          ) {
            break;
          }
        } else if ((value8.textContent ?? "") !== "") {
          value5 = value8;
          break;
        }
    }
    if (value5 !== null && value6 < (value5.textContent ?? "").length) {
      value.setStart(value5, value6);
      value.setEnd(value5, value6 + 1);
      let value7 = value.getClientRects()[0];
      if (value7 !== undefined && value7.bottom > bottom) {
        bottom = value7.bottom;
        value4 = Math.round(value7.top);
      }
    }
    if (value4 === undefined) {
      return {
        top: Math.round(value3.top),
        bottom: Math.round(bottom),
      };
    } else {
      return {
        top: Math.round(value3.top),
        bottom: Math.round(bottom),
        lineTop: value4,
      };
    }
  }
  function chooseTextEditingTarget(
    element: Element,
    frameElement: number,
    node: number,
  ): Element {
    if (element.closest("[data-cell], [data-text-path]") !== null) {
      return element;
    }
    let value = (0, runtime.editableElementAtPoint)(
      frameElement,
      node,
    );
    if (value !== null) {
      return value;
    } else {
      return element;
    }
  }
  function pointerDragThreshold(pointerType: string): number {
    if (pointerType === "touch") {
      return 9;
    } else {
      if (pointerType === "pen") {
        return 4;
      } else {
        return 1.5;
      }
    }
  }
  function isAdditionalTouchPointer(
    pointers: { readonly size: number; has(pointerId: number): boolean },
    event: Pick<PointerEvent, "pointerType" | "isPrimary" | "pointerId">,
  ): boolean {
    return (
      event.pointerType === "touch" &&
      !event.isPrimary &&
      pointers.size >= 1 &&
      !pointers.has(event.pointerId)
    );
  }
  function isFrameOrResizeTarget(target: ClosestCapableTarget | null): boolean {
    let element = target;
    return (
      element !== null &&
      typeof element.closest === "function" &&
      element.closest("[data-frame-id], [data-resize-handle]") !== null
    );
  }
  function canStartCanvasPinch(context: CanvasPinchContext): boolean {
    if (context.dragActive) {
      return false;
    }
    return !context.editTarget;
  }
  function canStartCanvasRectSelection(context: CanvasRectSelectionContext): boolean {
    return (
      context.pointerType === "mouse" &&
      context.button === 0 &&
      context.surface !== "object" &&
      !context.textEdit
    );
  }
  function rectanglesOverlap(left: SlideRect, right: SlideRect): boolean {
    return (
      left.x <= right.x + right.w &&
      right.x <= left.x + left.w &&
      left.y <= right.y + right.h &&
      right.y <= left.y + left.h
    );
  }
  function collectUnitsIntersectingSelectionRect(
    rect: SlideRect,
    units: readonly SelectionUnitRect[],
    selection: readonly NodeSelection[],
  ): NodeSelection[] {
    let result = [...selection];
    for (let value of units) {
      if (value.rect.w === 0 || value.rect.h === 0) {
        continue;
      }
      if (!rectanglesOverlap(rect, value.rect)) {
        continue;
      }
      if (
        result.some(
          (input) =>
            (0, runtime.selectionsEqual)(input, value.unit),
        )
      ) {
        continue;
      }
      result = result.filter(
        (input) =>
          input.frameId !== value.unit.frameId ||
          !pathsOverlap(
            (0, runtime.selectionNodePath)(input),
            (0, runtime.selectionNodePath)(value.unit),
          ),
      );
      result.push(value.unit);
    }
    return result;
  }
  function pathsOverlap(leftPath: readonly number[], rightPath: readonly number[]): boolean {
    return (
      isStrictPathAncestor(leftPath, rightPath) ||
      isStrictPathAncestor(rightPath, leftPath)
    );
  }
  function getFrameTransformScreenRect(
    slide: Slide,
    frameId: string,
    element: Element,
  ): DOMRect {
    return (
      ((0, runtime.nodeTransform)(
        (0, runtime.frameById)(slide, frameId)?.node,
      ) !== undefined
        ? element.querySelector('[data-node-path=""]')
        : null) ?? element
    ).getBoundingClientRect();
  }
  function resolveSelectionDragHit(context: SelectionDragHitContext): SelectionDragHit | null {
    let {
      selection: selection,
      selRects: selectionRects,
      unit: unit,
      toggle: toggle,
      x: x,
      y: y,
    } = context;
    if (toggle || selection.length === 0) {
      return null;
    }
    if (unit !== null && (0, runtime.selectionContainsNode)(selection, unit)) {
      return null;
    }
    if (
      !selectionRects.some(
        (input) =>
          input !== null && (0, runtime.pointInRotatedRect)(input, x, y),
      )
    ) {
      return null;
    }
    let value = selection[selection.length - 1];
    if (value === undefined) {
      return null;
    }
    return {
      unit: value,
      clickSelect: unit === null ? [] : [unit],
    };
  }
  function preservePinchAnchorCoordinate(
    start: number,
    anchor: number,
    previousScale: number,
    nextScale: number,
  ): number {
    return anchor - ((anchor - start) / previousScale) * nextScale;
  }
  function parseEditorNodePath(path: string | null | undefined): number[] {
    return (path ?? "")
      .split(".")
      .filter((input) => input !== "")
      .map(Number)
      .filter(
        (input) => Number.isInteger(input) && input >= 0,
      );
  }
  function removeNodeFromFrame(frame: Frame, path: readonly number[]): Frame {
    if (path.length === 0) {
      return frame;
    }
    let parentPath = path.slice(0, -1),
      childIndex = path[path.length - 1]!;
    return {
      ...frame,
      node: (0, runtime.updateNodeAtPath)(
        frame.node,
        parentPath,
        (input) => {
          if ((0, runtime.isOverlayNode)(input)) {
            if (childIndex === 0) {
              return input;
            } else {
              return (0, runtime.removeOverlayLayer)(input, childIndex - 1);
            }
          }
          if (!(0, runtime.isFlowContainer)(input)) {
            return input;
          }
          return {
            ...input,
            children: input.children.filter(
              (input2, options) =>
                options !== childIndex,
            ),
          };
        },
      ),
    };
  }
  function ceilMeasuredNodeSize(size: number): number {
    return Math.max(1, Math.ceil(size - 0.0078125));
  }
  function createFreeFrameFromNode(node: SlideNode, rect: SlideRect): Frame {
    let x: Axis = {
        anchor: "leading",
        margin: Math.round(rect.x),
        offset: 0,
        size: ceilMeasuredNodeSize(rect.w),
      },
      y: Axis = {
        anchor: "leading",
        margin: Math.round(rect.y),
        offset: 0,
      },
      freeNode = node;
    if (node.kind !== "text" && node.kind !== "table") {
      y.size = ceilMeasuredNodeSize(rect.h);
      if (
        (node.kind === "img" ||
          node.kind === "icon" ||
          node.kind === "shape") &&
        (node.w !== undefined || node.h !== undefined)
      ) {
        let state = {
          ...node,
        };
        delete state.w;
        delete state.h;
        freeNode = state;
      }
    }
    if (freeNode.place !== undefined) {
      let state = {
        ...freeNode,
      };
      delete state.place;
      freeNode = state;
    }
    return {
      id: (0, runtime.createModelId)(),
      x: x,
      y: y,
      node: freeNode,
    };
  }
  function fillMissingFrameSizes(frame: Frame, rect: Pick<SlideRect, "w" | "h">): Frame {
    let fillAxisSize = (
      input: Axis,
      options: number,
    ) =>
      input.anchor === "fill" || input.size !== undefined
        ? input
        : {
            ...input,
            size: ceilMeasuredNodeSize(options),
          };
    return {
      ...frame,
      x: fillAxisSize(frame.x, rect.w),
      y: fillAxisSize(frame.y, rect.h),
    };
  }
  function setNodeMinimumPlacementSize(
    node: SlideNode,
    rect: Pick<SlideRect, "w" | "h">,
  ): SlideNode {
    let { minWFit: previousMinimumWidthFit, ...placement } =
      node.place ?? {};
    return {
      ...node,
      place: {
        ...placement,
        minW: Math.round(rect.w),
        minH: Math.round(rect.h),
      },
    };
  }
  function findChangedFrameIds(before: Slide, after: Slide): Set<string> {
    return new Set(
      after.frames
        .filter(
          (input) =>
            (0, runtime.frameById)(before, input.id)?.node !== input.node,
        )
        .map((input) => input.id),
    );
  }
  function findSurvivingNodePath(
    before: SlideNode,
    after: SlideNode,
    path: readonly number[],
  ): NodePath | undefined {
    let node = (0, runtime.nodeAtPath)(before, path);
    if (node === undefined) {
      return;
    }
    return [
      [...path],
      ...path.map(
        (input, options) => [
          ...path.slice(0, options),
          ...path.slice(options + 1),
        ],
      ),
    ].find(
      (input) =>
        (0, runtime.nodeAtPath)(after, input) === node,
    );
  }
  function removeNodeAndEmptyAncestors(
    frame: Frame,
    path: readonly number[],
    removedPaths?: NodePath[],
  ): Frame {
    let result = removeNodeFromFrame(frame, path);
    for (
      let value = path.slice(0, -1);
      value.length > 0;
      value = value.slice(0, -1)
    ) {
      let value2 = (0, runtime.nodeAtPath)(result.node, value);
      if (value2 === undefined || !isEmptyUnstyledFlowContainer(value2)) {
        break;
      }
      result = removeNodeFromFrame(result, value);
      removedPaths?.push([...value]);
    }
    return result;
  }
  function extractFlowDragSelection(
    slide: Slide,
    extraction: FlowDragRequest,
  ): FlowDragResult | null {
    let frame = (0, runtime.frameById)(slide, extraction.frameId),
      children = frame
        ? (0, runtime.nodeChildren)(frame.node)
        : undefined;
    if (!frame || children === undefined) {
      return null;
    }
    let keptFrame = extraction.keep
        ? (0, runtime.styleHasVisiblePaint)(frame.node.style)
          ? fillMissingFrameSizes(frame, extraction.keep)
          : frame
        : null,
      value: FlowPromotion | null =
        extraction.keep === undefined
          ? {
              root:
                (0, runtime.isPrimaryLayoutFrame)(slide, frame) &&
                (0, runtime.nodeTransform)(frame.node) === undefined,
              tag: (0, runtime.createModelId)(),
              taken: new Set(
                slide.frames.map((input) => input.id),
              ),
            }
          : null,
      callback = (input: Frame, options: number[]): Frame => {
        let value7 =
          value !== null
            ? (0, runtime.encodePromotedFrameId)(
                extraction.frameId,
                value.root,
                options,
                value.tag,
              )
            : null;
        if (value7 === null || value!.taken.has(value7)) {
          return input;
        }
        value!.taken.add(value7);
        return {
          ...input,
          id: value7,
        };
      },
      value2 = keptFrame
        ? []
        : extraction.children.map(
            (input, options) => {
              let value7 = children[options];
              if (!value7 || value7.kind === "spacer") {
                return null;
              } else {
                return callback(createFreeFrameFromNode(value7, input.rect), [
                  options,
                ]);
              }
            },
          ),
      value3 =
        !keptFrame && extraction.dragIndex !== undefined
          ? (value2[extraction.dragIndex] ?? undefined)
          : undefined;
    if (!keptFrame && extraction.dragIndex !== undefined && !value3) {
      return null;
    }
    let callback2 = (input: readonly number[]): FlowFrameSlot =>
        keptFrame !== null
          ? {
              get: () => keptFrame,
              set: (input2: Frame) => (keptFrame = input2),
              rel: [...input],
            }
          : {
              get: () => value2[input[0]!] ?? null,
              set: (input2: Frame) => (value2[input[0]!] = input2),
              rel: input.slice(1),
            },
      items = [],
      items2 = [],
      values = new Set<number>(),
      callback3 = (input: readonly number[]) =>
        extraction.deep
          .map((input2) => input2.path)
          .filter(
            (input2) => isStrictPathAncestor(input2, input),
          )
          .sort(
            (items3, items4) =>
              items3.length - items4.length,
          )[0],
      value4 = extraction.deep.filter(
        (input) => callback3(input.path) === undefined,
      ),
      value5 =
        extraction.dragPath !== undefined
          ? (callback3(extraction.dragPath) ?? extraction.dragPath)
          : undefined;
    for (let value7 of [...value4].sort(
      (input, options) =>
        (0, runtime.compareNodePaths)(options.path, input.path),
    )) {
      let value8 = callback2(value7.path),
        entry = value8.get(),
        value9 =
          entry && value8.rel.length > 0
            ? (0, runtime.nodeAtPath)(entry.node, value8.rel)
            : undefined;
      if (!entry || !value9 || value9.kind === "spacer") {
        continue;
      }
      let items3: NodePath[] = [],
        value10 = removeNodeAndEmptyAncestors(
          entry,
          value8.rel,
          items3,
        );
      if ((0, runtime.nodeAtPath)(value10.node, value8.rel) === value9) {
        continue;
      }
      value8.set(value10);
      for (let value11 of items3)
        items2.push(keptFrame ? value11 : [value7.path[0]!, ...value11]);
      values.add(keptFrame ? -1 : value7.path[0]!);
      items.push({
        frame: callback(
          createFreeFrameFromNode(value9, value7.rect),
          value7.path,
        ),
        path: value7.path,
      });
    }
    if (value5 !== undefined) {
      value3 = items.find(
        (input) =>
          (0, runtime.nodePathsEqual)(input.path, value5),
      )?.frame;
      if (!value3) {
        return null;
      }
    }
    for (let value7 of (extraction.pins ?? [])) {
      let value8 = callback2(value7.path),
        entry = value8.get(),
        value9 =
          entry && value8.rel.length > 0
            ? (0, runtime.nodeAtPath)(entry.node, value8.rel.slice(0, -1))
            : undefined;
      if (!entry || !value9 || !(0, runtime.isFlowContainer)(value9)) {
        continue;
      }
      value8.set({
        ...entry,
        node: (0, runtime.updateNodeAtPath)(
          entry.node,
          value8.rel,
          (input) => {
            if ((0, runtime.isFlowContainer)(input)) {
              return setNodeMinimumPlacementSize(input, value7);
            }
            if (!(0, runtime.isOverlayNode)(input)) {
              return input;
            }
            if (
              (0, runtime.isFlowContainer)(input.base) &&
              input.base.place !== undefined
            ) {
              return {
                ...input,
                base: setNodeMinimumPlacementSize(input.base, value7),
              };
            } else {
              return setNodeMinimumPlacementSize(input, value7);
            }
          },
        ),
      });
    }
    for (let value7 of values)
      if (
        value7 >= 0 &&
        value2[value7] &&
        isEmptyUnstyledFlowContainer(value2[value7].node)
      ) {
        value2[value7] = null;
      }
    if (keptFrame && isEmptyUnstyledFlowContainer(keptFrame.node)) {
      keptFrame = null;
    }
    items.sort(
      (input, options) =>
        (0, runtime.compareNodePaths)(input.path, options.path),
    );
    let value6 = keptFrame
      ? slide.frames.map(
          (input: Frame) =>
            input.id === extraction.frameId ? keptFrame! : input,
        )
      : slide.frames
          .filter((input) => input.id !== extraction.frameId)
          .concat(value2.filter((input) => input !== null));
    return {
      slide: {
        ...slide,
        frames: value6.concat(
          items.map((input) => input.frame),
        ),
      },
      newFrames: value2,
      plucked: items,
      pruned: items2,
      drag: value3,
    };
  }
  function collectFlowDragChildPaths(drag: FlowDragRequest, paths: SlideRect | undefined): FlowDragRequest {
    let selectedNodes = [
        ...drag.selectedChildren
          .filter(
            (input) =>
              input !== drag.dragIndex || drag.dragPath !== undefined,
          )
          .map(
            (input) => ({
              path: [input],
              rect: drag.children[input]!.rect,
            }),
          ),
        ...drag.deep,
        ...(drag.dragIndex !== undefined && drag.dragPath === undefined
          ? [
              {
                path: [drag.dragIndex],
                rect: drag.children[drag.dragIndex]!.rect,
              },
            ]
          : []),
      ],
      value =
        drag.dragPath ??
        (drag.dragIndex !== undefined ? [drag.dragIndex] : undefined),
      { dragIndex: dragIndex, ...value2 } = drag;
    return {
      ...value2,
      selectedChildren: [],
      deep: selectedNodes,
      keep: paths,
      ...(value
        ? {
            dragPath: value,
          }
        : {}),
    };
  }
  function normalizeFlowDragExtraction(
    drag: FlowDragRequest,
    frame: Frame,
    flow: boolean,
    paths: SlideRect,
  ): FlowDragRequest {
    if (!(0, runtime.isFlowContainer)(frame.node)) {
      return drag;
    }
    if (
      (0, runtime.styleHasVisiblePaint)(frame.node.style) ||
      (!flow && !(0, runtime.nodeTransform)(frame.node))
    ) {
      return collectFlowDragChildPaths(drag, paths);
    } else {
      return drag;
    }
  }
  function createFlowChildIndexRemapper(
    extraction: FlowShed,
    children: readonly SlideNode[],
  ): (index: number) => SlideRect | null {
    let remainingIndices = extraction.kids
        .map((input, options) => options)
        .filter(
          (input) =>
            !extraction.gone.has(input) &&
            !children.includes(extraction.kids[input]!),
        ),
      insertedChildren = children.filter(
        (input) => !extraction.kids.includes(input),
      );
    return (input) => {
      let value = children[input];
      if (value === undefined) {
        return null;
      }
      let value2 = extraction.kids.indexOf(value);
      if (value2 < 0 && remainingIndices.length === insertedChildren.length) {
        value2 = remainingIndices[insertedChildren.indexOf(value)] ?? -1;
      }
      if (value2 >= 0) {
        return extraction.rects[value2] ?? null;
      } else {
        return null;
      }
    };
  }
  function collapseSingleChildFlowFrame(
    slide: Slide,
    frameId: string,
    measure: (index: number) => SlideRect | null | undefined,
  ): CollapsedFlowFrame {
    let frame = (0, runtime.frameById)(slide, frameId);
    if (
      !frame ||
      !(0, runtime.isFlowContainer)(frame.node) ||
      (0, runtime.styleHasVisiblePaint)(frame.node.style) ||
      (0, runtime.nodeTransform)(frame.node)
    ) {
      return {
        slide: slide,
      };
    }
    let remainingChildren = frame.node.children.flatMap(
      (source, options) =>
        source.kind === "spacer"
          ? []
          : [
              {
                c: source,
                i: options,
              },
            ],
    );
    if (remainingChildren.length >= 2) {
      return {
        slide: slide,
      };
    }
    if (remainingChildren.length === 0) {
      return {
        slide: {
          ...slide,
          frames: slide.frames.filter(
            (input) => input.id !== frameId,
          ),
        },
      };
    }
    let value = measure(remainingChildren[0]!.i);
    if (!value) {
      return {
        slide: slide,
      };
    }
    let c = remainingChildren[0]!.c,
      value2 = (0, runtime.isFlowContainer)(c)
        ? removeFrameAxisSizes(createFreeFrameFromNode(c, value), ["y"])
        : createFreeFrameFromNode(c, value);
    return {
      slide: {
        ...slide,
        frames: slide.frames.map(
          (input) => (input.id === frameId ? value2 : input),
        ),
      },
      minted: value2,
      from: remainingChildren[0]!.i,
    };
  }
  function reparentExtractedFlowNode(
    before: SlideNode,
    after: SlideNode,
    dragPath: NodePath,
    extracted: ReadonlyArray<{ path: NodePath }>,
    removedPaths: NodePath[] = [],
  ): FlowReparent | null {
    let items = [
        ...extracted.map((input) => input.path),
        ...removedPaths,
      ],
      value = items.filter(
        (input) =>
          !items.some(
            (input2) => isStrictPathAncestor(input2, input),
          ),
      ),
      value2 =
        removedPaths
          .filter(
            (input) => isStrictPathAncestor(input, dragPath),
          )
          .sort(
            (items2, items3) =>
              items2.length - items3.length,
          )[0] ?? dragPath;
    if (value2.length === 0) {
      return null;
    }
    let value3 = value2.slice(0, -1),
      value4 = value2[value2.length - 1]!,
      value5 = (0, runtime.nodeAtPath)(before, value3);
    if (!value5 || !(0, runtime.isFlowContainer)(value5)) {
      return null;
    }
    let callback = (items2: readonly number[]) =>
        value
          .filter(
            (items3) =>
              items3.length === items2.length + 1 &&
              (0, runtime.nodePathsEqual)(items3.slice(0, -1), items2),
          )
          .map((input) => input[items2.length]!),
      value6 = value3.map(
        (input, options) =>
          input -
          callback(value3.slice(0, options)).filter(
            (input2) => input2 < input,
          ).length,
      ),
      values = new Set(callback(value3)),
      value7 = (0, runtime.nodeAtPath)(after, value6);
    if (
      !value7 ||
      !(0, runtime.isFlowContainer)(value7) ||
      value7.kind !== value5.kind
    ) {
      return null;
    }
    return {
      path: value6,
      index:
        value4 -
        [...values].filter((input) => input < value4).length,
      stay: value5.children
        .map((input, options) => options)
        .filter((input) => !values.has(input)),
      before: value3,
      had: value5.children.length,
    };
  }
  function getRemainingFlowChildRects(drag: FlowDragRequest): SlideRect[] {
    let deepChildren = new Set(
        drag.deep
          .filter((input) => input.path.length === 1)
          .map((input) => input.path[0]),
      ),
      remainingRects = drag.children
        .filter(
          (input, options) =>
            (options !== drag.dragIndex || drag.dragPath !== undefined) &&
            !drag.selectedChildren.includes(options) &&
            !deepChildren.has(options),
        )
        .map((input) => input.rect);
    if (drag.keep) {
      return [drag.keep, ...remainingRects];
    } else {
      return remainingRects;
    }
  }
  function removeFrameAxisSizes(frame: Frame, axes: readonly SlideAxisName[]): Frame {
    let result = frame;
    for (let value of axes) {
      if (result[value].anchor === "fill" || result[value].size === undefined) {
        continue;
      }
      let { size: value2, ...value3 } = result[value];
      result = {
        ...result,
        [value]: value3,
      };
    }
    return result;
  }
  function removeFlowNodePlacement(frame: Frame, rect: SlideNode | undefined): SlideNode {
    let axisSize = (input: Axis, options: number) =>
        input.anchor === "fill" ? options - 2 * input.margin : input.size,
      node = frame.node;
    if (node.place !== undefined) {
      let state2 = {
        ...node,
      };
      delete state2.place;
      node = state2;
    }
    if (node.kind !== "img" && node.kind !== "icon" && node.kind !== "shape") {
      let value3 = axisSize(frame.x, runtime.SLIDE_WIDTH);
      if (rect?.kind === "stack" && rect.dir === "h" && value3 !== undefined) {
        return {
          ...node,
          place: {
            minW: Math.round(value3),
            maxW: Math.round(value3),
          },
        };
      } else {
        return node;
      }
    }
    let state = {
      ...node,
    };
    delete state.w;
    delete state.h;
    let value = axisSize(frame.x, runtime.SLIDE_WIDTH),
      value2 = axisSize(frame.y, runtime.SLIDE_HEIGHT);
    if (value !== undefined) {
      state.w = Math.round(value);
    }
    if (value2 !== undefined) {
      state.h = Math.round(value2);
    }
    return state;
  }
  function calculateNestedOverlayDepth(
    node: SlideNode | undefined,
    path: readonly number[],
  ): number {
    let currentNode = node,
      depth = 0;
    for (let value of path) {
      if (currentNode === undefined) {
        return depth;
      }
      if ((0, runtime.isOverlayNode)(currentNode)) {
        depth =
          value === 0
            ? (0, runtime.overlayBaseDepth)(currentNode, depth)
            : depth + 1;
        currentNode =
          value === 0 ? currentNode.base : currentNode.layers[value - 1]?.node;
      } else {
        depth += 1;
        currentNode = (0, runtime.nodeChildren)(currentNode)?.[value];
      }
    }
    return depth;
  }
  function insertFramesIntoFlowContainer(
    slide: Slide,
    frameIds: readonly string[],
    target: FlowInsertionTarget,
    measure?: ReadonlyMap<string, SlideNode>,
  ): Slide | null {
    let value = (0, runtime.frameById)(slide, target.frameId),
      value2 = value
        ? (0, runtime.nodeAtPath)(value.node, target.path)
        : undefined,
      value3 = frameIds.map(
        (input) => (0, runtime.frameById)(slide, input),
      );
    if (
      !value ||
      !value2 ||
      !(0, runtime.isFlowContainer)(value2) ||
      frameIds.includes(value.id)
    ) {
      return null;
    }
    let callback = (input: Frame | undefined): input is Frame =>
      input !== undefined &&
      input.node.kind !== "html" &&
      !(0, runtime.isEmptyGroupBase)(input.node) &&
      (!(0, runtime.isConnectorNode)(input.node) ||
        measure?.has(input.id) === true);
    if (
      !value3.every(callback) ||
      value2.children.length + value3.length > runtime.maxSlideFrames
    ) {
      return null;
    }
    let value4 =
        calculateNestedOverlayDepth(value.node, target.path) + 1,
      value5 = value3.map(
        (input) =>
          measure?.get(input.id) ?? removeFlowNodePlacement(input, value2),
      );
    if (
      !value5.every(
        (input) =>
          (0, runtime.nodeTreeWithinDepthLimit)(input, value4),
      )
    ) {
      return null;
    }
    let value6 = Math.max(
        0,
        Math.min(target.index, value2.children.length),
      ),
      items = [...value2.children];
    items.splice(value6, 0, ...value5);
    let value7 = removeFrameAxisSizes(
      {
        ...value,
        node: (0, runtime.updateNodeAtPath)(
          value.node,
          target.path,
          (input) =>
            (0, runtime.isFlowContainer)(input)
              ? {
                  ...input,
                  children: items,
                }
              : input,
        ),
      },
      target.release ?? [],
    );
    return {
      ...slide,
      frames: slide.frames
        .filter((input) => !frameIds.includes(input.id))
        .map(
          (input) =>
            input.id === value.id ? value7 : input,
        ),
    };
  }
  function setFlowInsertionSize(
    slide: Slide,
    unit: FlowInsertionTarget,
    size: number,
    axis?: SlideNode,
  ): Slide {
    let value = (0, runtime.frameById)(slide, unit.frameId),
      value2 = value
        ? (0, runtime.nodeAtPath)(value.node, unit.path)
        : undefined;
    if (!value || !value2 || !(0, runtime.isFlowContainer)(value2)) {
      return slide;
    }
    let value3 = Math.max(1, Math.round(size)),
      value4 =
        value2.kind === "stack" && value2.dir === "h"
          ? {
              minW: value3,
              maxW: value3,
              shrink: 0,
            }
          : {
              minH: value3,
              shrink: 0,
            },
      value5: SpacerNode | GhostSpacerNode =
        axis !== undefined && canInsertNodeIntoFlow(axis)
          ? {
              kind: "spacer",
              ghost: axis,
            }
          : {
              kind: "spacer",
              place: value4,
            },
      items: SlideNode[] = [...value2.children];
    items.splice(Math.min(unit.index, items.length), 0, value5);
    let state = {
      ...value,
      node: (0, runtime.updateNodeAtPath)(
        value.node,
        unit.path,
        (input) =>
          (0, runtime.isFlowContainer)(input)
            ? {
                ...input,
                children: items,
              }
            : input,
      ),
    };
    return (0, runtime.updateSlideFrame)(
      slide,
      value.id,
      () => removeFrameAxisSizes(state, unit.release ?? []),
    );
  }
  function findFlowInsertionIndex(
    node: FlowContainerNode,
    rects: readonly SlideRect[],
    x: number,
    y: number,
  ): number {
    if (rects.length === 0) {
      return 0;
    }
    if (node.kind === "grid" || node.wrap) {
      let index = 0,
        value3 = 1 / 0;
      rects.forEach((input, options) => {
        let value5 =
          (x - (input.x + input.w / 2)) ** 2 +
          (y - (input.y + input.h / 2)) ** 2;
        if (value5 < value3) {
          value3 = value5;
          index = options;
        }
      });
      let value4 = rects[index]!;
      if (
        y < value4.y ||
        (y <= value4.y + value4.h && x < value4.x + value4.w / 2)
      ) {
        return index;
      } else {
        return index + 1;
      }
    }
    let value = node.dir === "h",
      value2 = rects.findIndex(
        (input) =>
          value ? x < input.x + input.w / 2 : y < input.y + input.h / 2,
      );
    if (value2 < 0) {
      return rects.length;
    } else {
      return value2;
    }
  }
  function calculateFlowInsertionGuide(
    node: FlowContainerNode,
    rects: readonly SlideRect[],
    index: number,
    gap: number,
  ): SlideRect | null {
    let value = rects[index - 1],
      value2 =
        node.kind !== "grid" &&
        node.dir === "h" &&
        value &&
        rects[index] &&
        rects[index]!.y >= value.y + value.h
          ? undefined
          : rects[index];
    if (!value && !value2) {
      return null;
    }
    let value3 = node.kind === "grid" || node.dir === "h" ? "x" : "y",
      [items, items2] = [value ?? value2!, value2 ?? value!];
    if (value3 === "x") {
      let value6 =
          value && value2
            ? (value.x + value.w + value2.x) / 2
            : value
              ? value.x + value.w + gap
              : value2!.x - gap,
        value7 = Math.min(items.y, items2.y);
      return {
        x: value6 - gap / 2,
        y: value7,
        w: gap,
        h: Math.max(items.y + items.h, items2.y + items2.h) - value7,
      };
    }
    let value4 =
        value && value2
          ? (value.y + value.h + value2.y) / 2
          : value
            ? value.y + value.h + gap
            : value2!.y - gap,
      value5 = Math.min(items.x, items2.x);
    return {
      x: value5,
      y: value4 - gap / 2,
      w: Math.max(items.x + items.w, items2.x + items2.w) - value5,
      h: gap,
    };
  }
  function shouldExtractOversizedNode(
    dragRect: SlideRect,
    containerRect: SlideRect,
    forced: boolean,
  ): boolean {
    if (forced) {
      return true;
    }
    if (dragRect.w <= containerRect.w && dragRect.h <= containerRect.h) {
      return false;
    }
    return dragRect.w * dragRect.h >= 1.1 * containerRect.w * containerRect.h;
  }
  function canFitHorizontalFlowInsertion(
    node: SlideNode,
    containerWidth: number,
    children: readonly FlowChildWidth[],
    dragWidth: number,
  ): boolean {
    if (node.kind !== "stack" || node.dir !== "h" || node.wrap === true) {
      return true;
    }
    let callback = (input: SlideNode | undefined) =>
        input?.kind === "spacer" &&
        !((input.place?.basis ?? 0) > 0) &&
        !((input.place?.minW ?? 0) > 0),
      value =
        children.reduce(
          (input, options) =>
            input + (callback(options.node) ? 0 : options.w),
          0,
        ) +
        node.gap * children.length;
    return dragWidth <= containerWidth - value + 2;
  }
  function pairFlowRectsWithRemainingNodes(
    rects: ReadonlyArray<Pick<SlideRect, "w">>,
    nodes: readonly SlideNode[],
    removedIndex: number,
  ): FlowChildWidth[] {
    return rects.flatMap(
      (input, options) =>
        options === removedIndex
          ? []
          : [
              {
                w: input.w,
                node: nodes[
                  removedIndex >= 0 && options > removedIndex
                    ? options - 1
                    : options
                ],
              },
            ],
    );
  }
  function flowInsertionTargetMatches(
    target: FlowDragOrigin | null,
    frameId: string,
    path: readonly number[],
    dragNodes: readonly string[],
    selectedKeys: ReadonlyMap<string, unknown>,
  ): boolean {
    if (
      target === null ||
      target.frameId !== frameId ||
      !(0, runtime.nodePathsEqual)(target.path, path)
    ) {
      return false;
    }
    return (
      target.had === target.rests.length + dragNodes.length &&
      dragNodes.every((input) => selectedKeys.has(input))
    );
  }
  function collectCollapsibleFlowAncestors(
    node: SlideNode,
    path: readonly number[],
    minimumDepth: number,
  ): CollapsibleFlowAncestors {
    let ancestors = [],
      items = [...path],
      value = minimumDepth;
    while (items.length > minimumDepth) {
      let value2 = items.slice(0, -1),
        value3 = (0, runtime.nodeAtPath)(node, value2);
      if (!value3 || !(0, runtime.isFlowContainer)(value3)) {
        break;
      }
      let value4 = items[items.length - 1]!,
        children = value3.children,
        callback = (source: SlideNode) =>
          source.kind === "spacer" || (source.place?.grow ?? 0) > 0,
        value5 =
          value3.kind === "grid" ||
          (value3.justify !== undefined && value3.justify !== "start"),
        value6 = children.findIndex(
          (input, options) =>
            options < value4 && callback(input),
        ),
        value7 = children.flatMap(
          (source, options) =>
            options !== value4 &&
            source.kind !== "spacer" &&
            (value5 ||
              options > value4 ||
              (value6 >= 0 && options > value6) ||
              callback(source))
              ? [options]
              : [],
        );
      for (let value9 of value7) ancestors.push([...value2, value9]);
      let value8 = children.some(
        (source, options) =>
          options !== value4 &&
          source.kind !== "spacer" &&
          !value7.includes(options),
      );
      value = value2.length;
      if (
        value8 ||
        (0, runtime.styleHasVisiblePaint)(value3.style) ||
        value2.length <= minimumDepth
      ) {
        break;
      }
      items = value2;
    }
    let items2 = [];
    for (
      let value2 = minimumDepth + 1;
      value2 <= value && value2 < path.length;
      value2++
    )
      items2.push(path.slice(0, value2));
    return {
      lift: ancestors,
      pin: items2,
    };
  }
  function flowRectsAligned(
    left: SlideRect,
    right: SlideRect,
    xHandle: ResizeEdge | null,
    yHandle: ResizeEdge | null,
    tolerance: number = 1,
  ): boolean {
    let callback = (
      input: number,
      options: number,
      context: number,
      value: number,
      extra: ResizeEdge | null,
    ) =>
      extra === null ||
      Math.abs(
        extra === "near"
          ? context + value - (input + options)
          : context - input,
      ) <= tolerance;
    return (
      callback(left.x, left.w, right.x, right.w, xHandle) &&
      callback(left.y, left.h, right.y, right.h, yHandle)
    );
  }
  function isStrictPathAncestor(
    ancestor: readonly number[],
    descendant: readonly number[],
  ): boolean {
    return (
      ancestor.length < descendant.length &&
      ancestor.every(
        (input, options) =>
          input === descendant[options],
      )
    );
  }
  function duplicateFrameWithFixedFillPlacement(frame: Frame): Frame {
    let normalizeAxis = (
      input: Axis,
      options: number,
      context: boolean,
    ): Axis =>
      input.anchor !== "fill"
        ? input
        : {
            anchor: "leading",
            margin: input.margin,
            offset: 0,
            ...(context
              ? {}
              : {
                  size: Math.max(1, options - 2 * input.margin),
                }),
          };
    return {
      ...frame,
      id: (0, runtime.createModelId)(),
      x: normalizeAxis(frame.x, runtime.SLIDE_WIDTH, false),
      y: normalizeAxis(
        frame.y,
        runtime.SLIDE_HEIGHT,
        frame.node.kind === "text" || frame.node.kind === "table",
      ),
    };
  }
  function deleteSelectedUnits(
    slide: Slide,
    selection: readonly NodeSelection[],
    options: (unit: NodeSelection) => SlideRect | null | undefined,
  ): SelectionCopy[] {
    let callback = (input: NodeSelection, options2: Frame) =>
        input.child === undefined ||
        (input.child === 0 &&
          input.path === undefined &&
          (0, runtime.isOverlayNode)(options2.node)),
      values = new Set(
        selection
          .filter((input) => {
            let value = (0, runtime.frameById)(slide, input.frameId);
            return value !== undefined && callback(input, value);
          })
          .map((input) => input.frameId),
      ),
      callback2 = (input: NodeSelection) =>
        values.has(input.frameId) ||
        selection.some(
          (input2) =>
            input2.frameId === input.frameId &&
            isStrictPathAncestor(
              (0, runtime.selectionNodePath)(input2),
              (0, runtime.selectionNodePath)(input),
            ),
        ),
      values2 = new Set(),
      items = [];
    for (let value of (0, runtime.sortSelectionsInDocumentOrder)(
      slide,
      selection,
    )) {
      let value2 = (0, runtime.frameById)(slide, value.frameId),
        value3 = (0, runtime.selectedNode)(slide, value);
      if (!value2 || !value3 || value3.kind === "spacer") {
        continue;
      }
      if (callback(value, value2)) {
        if (values2.has(value2.id)) {
          continue;
        }
        values2.add(value2.id);
        items.push({
          unit: value,
          copy: duplicateFrameWithFixedFillPlacement(value2),
        });
        continue;
      }
      if (callback2(value)) {
        continue;
      }
      let value4 = options(value);
      if (value4) {
        items.push({
          unit: value,
          copy: createFreeFrameFromNode(value3, value4),
          rect: value4,
        });
      }
    }
    return items;
  }
  function rotatedRectBounds(rect: RotatedSlideRect | null): BoundsLtrb | null {
    if (rect === null || !(rect.w > 0) || !(rect.h > 0)) {
      return null;
    }
    let rotatedBounds = (0, runtime.rotatedRectBounds_Rn)(rect);
    return {
      l: rotatedBounds.x,
      t: rotatedBounds.y,
      r: rotatedBounds.x + rotatedBounds.w,
      b: rotatedBounds.y + rotatedBounds.h,
    };
  }
  function selectionBoundsForUnits(
    units: readonly NodeSelection[],
    rects: ReadonlyArray<RotatedSlideRect | null | undefined>,
    slide: NodeSelection | null,
    measure: (unit: NodeSelection) => RotatedSlideRect | null,
  ): SelectionBoundsPair | null {
    let bounds = null,
      firstUnit: NodeSelection | undefined;
    for (let index = 0; index < units.length; index++) {
      let value2 = rotatedRectBounds(rects[index] ?? null);
      if (value2 === null) {
        continue;
      }
      firstUnit ??= units[index];
      bounds =
        bounds === null
          ? value2
          : {
              l: Math.min(bounds.l, value2.l),
              t: Math.min(bounds.t, value2.t),
              r: Math.max(bounds.r, value2.r),
              b: Math.max(bounds.b, value2.b),
            };
    }
    if (bounds === null || firstUnit === undefined) {
      return null;
    }
    let value =
      slide !== null && !(0, runtime.selectionContainsNode)(units, slide)
        ? rotatedRectBounds(measure(slide))
        : null;
    for (
      let value2 =
        value === null
          ? (0, runtime.parentNodeSelection)(firstUnit)
          : undefined;
      value2 !== undefined && value === null;
      value2 = (0, runtime.parentNodeSelection)(value2)
    )
      value = rotatedRectBounds(measure(value2));
    return {
      a: bounds,
      b: value ?? {
        l: 0,
        t: 0,
        r: runtime.SLIDE_WIDTH,
        b: runtime.SLIDE_HEIGHT,
      },
    };
  }
  function getSelectedTextStyle(slide: Slide, unit: ObjectContextEditing): boolean {
    let frame = (0, runtime.frameById)(slide, unit.frameId),
      node = frame
        ? (0, runtime.nodeAtPath)(frame.node, unit.path)
        : undefined,
      cell = unit.cell;
    if (!cell) {
      return (0, runtime.isEditableTextNode)(node);
    }
    return (
      (0, runtime.isTableNode)(node) &&
      (0, runtime.tableCellExists)(node, cell.r, cell.c)
    );
  }
  function SlideCanvasEditor({
    slide: slide,
    slideNumber: slideNumber,
    slideName: slideName,
    busy: busy,
    designColors: designColors,
    slideColors: slideColors,
    assets: assets,
    faces: faces,
    facesFull: facesFull,
    fonts: fonts,
    typeStyles: typeStyles,
    deckTypeStyles: deckTypeStyles,
    onReplaceImage: onReplaceImage,
    pickImage: pickImage,
    pending = [],
    covered: covered,
    peerLayer: peerLayer,
    onPointerNorm: onPointerNorm,
    selection: selection,
    onSelectionChange: onSelectionChange,
    onLiveChange: onLiveChange,
    onGestureEnd: onGestureEnd,
    onMenu: onMenu,
    dragLiveRef: dragLiveRef,
    textEdit: textEdit,
    onTextEdit: onTextEdit,
    onDropImage: onDropImage,
    onDropInsert: onDropInsert,
    deckCellCount: deckCellCount,
    withinStyleBudget: withinStyleBudget,
    onOpenInspector: onOpenInspector,
    moreMenu: moreMenu,
    onDeleteSelection: onDeleteSelection,
    selectionMenuHidden = false,
    onChangeSlide: onChangeSlide,
    presenting: presenting,
    commenting = false,
    zoomApiRef: zoomApiRef,
    onScaleChange: onScaleChange,
    bottomInset: bottomInset,
    topInset: topInset,
    sideInset: sideInset,
    readOnly = false,
    stageOverlay: stageOverlay,
    surround: surround,
  }: SlideCanvasEditorProps): ReactElement {
    let stageRef = runtime.reactK_.useRef<HTMLDivElement | null>(null),
      slideSurfaceRef = runtime.reactK_.useRef<HTMLDivElement | null>(null),
      pointInsideSlide = runtime.reactK_.useCallback(
        (input: number, options: number) => {
          let value59 =
            slideSurfaceRef.current?.getBoundingClientRect();
          return (
            value59 !== undefined &&
            input >= value59.left &&
            input <= value59.right &&
            options >= value59.top &&
            options <= value59.bottom
          );
        },
        [],
      ),
      slideRef = runtime.reactK_.useRef(slide);
    slideRef.current = slide;
    let selectionRef = runtime.reactK_.useRef(selection);
    selectionRef.current = selection;
    let readOnlyRef = runtime.reactK_.useRef(readOnly);
    readOnlyRef.current = readOnly;
    let deleteSelectionRef = runtime.reactK_.useRef(onDeleteSelection);
    deleteSelectionRef.current = onDeleteSelection;
    let [stageSize, setStageSize] = runtime.reactK_.useState({
        w: 0,
        h: 0,
      }),
      colorPalette = (0, runtime.useDeckColorChoices)(
        designColors,
        slideColors,
      ),
      [, refreshFontOptions] = runtime.reactK_.useState(0),
      [manualViewport, setManualViewport] =
        runtime.reactK_.useState<EditorViewport | null>(null),
      frameElementsRef = runtime.reactK_.useRef(new Map<string, HTMLElement>()),
      dragSessionRef = runtime.reactK_.useRef<CanvasDragSession | null>(null),
      plainPressRef = runtime.reactK_.useRef(true),
      isPlainPress = runtime.reactK_.useCallback(
        () => plainPressRef.current,
        [],
      ),
      touchPressRef = runtime.reactK_.useRef<CanvasTouchPress | null>(null),
      longPressTimerRef = runtime.reactK_.useRef<ReturnType<typeof setTimeout> | null>(null),
      beginFrameDragRef = runtime.reactK_.useRef<(frameId: string, event: PointerSnapshot) => void>(() => {}),
      releasePointerRef = runtime.reactK_.useRef<(pointerId: number) => void>(() => {}),
      applyTouchLiftRef = runtime.reactK_.useRef<(session: CanvasMoveDrag | CanvasLayerMoveDrag) => void>(() => {}),
      clearTouchLiftRef = runtime.reactK_.useRef(() => {}),
      endViewportGestureRef = runtime.reactK_.useRef(
        () => {},
      ),
      touchLiftActiveRef = runtime.reactK_.useRef(false),
      beginPanRef = runtime.reactK_.useRef<(frameId: string, event: ReactPointerEvent<HTMLDivElement>) => void>(() => {}),
      pendingToggleFrameRef = runtime.reactK_.useRef<string | null>(null),
      togglePendingFrame = () => {
        if (pendingToggleFrameRef.current !== null) {
          (0, runtime.clipControllerByKey)(
            pendingToggleFrameRef.current,
          )?.toggle();
        }
        pendingToggleFrameRef.current = null;
      },
      [selectionRects, setSelectionRects] = runtime.reactK_.useState<(EditorSelectionRect | null)[]>(
        [],
      ),
      [measuredSelectionKey, setMeasuredSelectionKey] =
        runtime.reactK_.useState(""),
      [unitRectCache, setUnitRectCache] = runtime.reactK_.useState(
        () => new Map<string, EditorSelectionRect>(),
      ),
      [snapGuides, setSnapGuides] = runtime.reactK_.useState<SnapCandidate[]>([]),
      [flowDropPreview, setFlowDropPreview] =
        runtime.reactK_.useState<FlowDropPreview | null>(null),
      [dragPreviewSlide, setDragPreviewSlide] =
        runtime.reactK_.useState<Slide | null>(null),
      imageCropController = (0, runtime.useMediaCropSession)({
        slide: slide,
        selection: selection,
        assets: assets,
        editable: !readOnly,
        busy: textEdit !== null || presenting === true,
        frameEl: (input) =>
          frameElementsRef.current.get(input),
        root: () => slideSurfaceRef.current,
        onCommit: onChangeSlide,
      }),
      selectionKey2 = (0, runtime.selectionsKey)(selection);
    runtime.reactK_.useLayoutEffect(() => {
      let element = (document).querySelector<HTMLElement>(
        "[data-slides-strip]",
      );
      if (element !== null) {
        (0, runtime.toolbarScrollableRow)(element).scrollLeft = 0;
      }
    }, [selectionKey2]);
    let resolvedTypeStyles =
        typeStyles ?? runtime.emptyTypographyStyles,
      resolvedDeckTypeStyles =
        deckTypeStyles ?? runtime.emptyTypographyStyles,
      allTypeStyles = runtime.reactK_.useMemo(
        () =>
          resolvedTypeStyles === resolvedDeckTypeStyles
            ? resolvedTypeStyles
            : [...resolvedTypeStyles, ...resolvedDeckTypeStyles],
        [resolvedTypeStyles, resolvedDeckTypeStyles],
      ),
      typeStyleOptions = runtime.reactK_.useMemo(
        () => typeStylesToEditorOptions(resolvedTypeStyles),
        [resolvedTypeStyles],
      ),
      lastSelectedUnit =
        selection.length > 0 ? selection[selection.length - 1] : undefined,
      lastSelectedUnitKey =
        lastSelectedUnit !== undefined
          ? (0, runtime.selectionKey)(lastSelectedUnit)
          : null,
      selectedUnitKeys = runtime.reactK_.useMemo(
        () => new Set(selection.map(runtime.selectionKey)),
        [selectionKey2],
      ),
      keyboardTree = runtime.reactK_.useMemo(
        () => (0, runtime.slideNavigationTree)(slide),
        [slide],
      ),
      keyboardTargets = runtime.reactK_.useMemo(
        () =>
          (0, runtime.visibleNavigationTree)(
            keyboardTree,
            slide,
            lastSelectedUnit,
          ),
        [keyboardTree, lastSelectedUnitKey],
      ),
      keyboardStopOrderRef = runtime.reactK_.useRef({
        slide: "",
        seq: new Map<string, number>(),
      }),
      [keyboardOrderGeneration, refreshKeyboardOrder] =
        runtime.reactK_.useState(0),
      keyboardGroups = runtime.reactK_.useMemo(() => {
        let current = keyboardStopOrderRef.current;
        if (current.slide !== slide.id) {
          current.slide = slide.id;
          current.seq = new Map();
        }
        for (let value59 of keyboardTargets)
          if (!current.seq.has(value59.key)) {
            current.seq.set(value59.key, current.seq.size);
          }
        let callback77 = (input: NavigationTreeEntry) =>
            current.seq.get(input.key) ?? 0,
          entries = new Map();
        for (let value59 of keyboardTargets) {
          let value60 = value59.stop ? (value59.parentKey ?? "") : "*",
            entry = entries.get(value60);
          if (entry === undefined) {
            entries.set(value60, [value59]);
          } else {
            entry.push(value59);
          }
        }
        return [...entries].map(
          ([input, input2]) => ({
            id: input,
            tree: input2,
            stops: [...input2].sort(
              (input3, options) =>
                callback77(input3) - callback77(options),
            ),
          }),
        );
      }, [keyboardTargets, slide.id, keyboardOrderGeneration]),
      slideKeyboardInstructions =
        runtime.reactK_.useMemo(
          () => (0, runtime.slideNavigationSelections)(slide),
          [slide],
        ).length === 0
          ? "This slide has no objects."
          : "Press Enter to go into the slide. Inside, Tab and Shift+Tab move between its objects, Shift+Enter goes up a level, and Escape comes back here.",
      singleTransformTarget = resolveSingleUnitTransformTarget(
        slide,
        selection,
      ),
      singleStyleTarget = readOnly
        ? null
        : resolveSingleUnitStyleTarget(slide, selection),
      lastSelectedRect =
        selection.length > 0
          ? (selectionRects[selection.length - 1] ?? null)
          : null,
      [measurementGeneration, refreshMeasurements] =
        runtime.reactK_.useState(0),
      [rotationPreviewAngle, setRotationPreviewAngle] =
        runtime.reactK_.useState<number | null>(null),
      [endpointSnapPoint, setEndpointSnapPoint] =
        runtime.reactK_.useState<{ x: number; y: number } | null>(null),
      [altPressed, setAltPressed] = runtime.reactK_.useState(false),
      altPressedRef = runtime.reactK_.useRef(false);
    altPressedRef.current = altPressed;
    let lastPointerTargetRef = runtime.reactK_.useRef<Element | null>(null),
      lastPointerSlideRef = runtime.reactK_.useRef<Slide | null>(null),
      [distanceHoverTarget, setDistanceHoverTarget] =
        runtime.reactK_.useState<DistanceHoverTarget | null>(null),
      [hoverTarget, setHoverTarget] = runtime.reactK_.useState<HoverTarget | null>(null),
      [hoverRect, setHoverRect] = runtime.reactK_.useState<EditorSelectionRect | null>(null),
      [textEditRect, setTextEditRect] = runtime.reactK_.useState<EditorSelectionRect | null>(null),
      [distanceMeasurements, setDistanceMeasurements] =
        runtime.reactK_.useState<DistanceMeasurements | null>(null);
    runtime.reactK_.useLayoutEffect(() => {
      let current = stageRef.current;
      if (!current) {
        return;
      }
      let callback77 = () =>
        setStageSize({
          w: current.clientWidth,
          h: current.clientHeight,
        });
      callback77();
      let observer = new ResizeObserver(callback77);
      observer.observe(current);
      return () => observer.disconnect();
    }, []);
    let usableViewport = {
        w: stageSize.w,
        h: Math.max(0, stageSize.h - (topInset ?? 0) - (bottomInset ?? 0)),
        top: topInset ?? 0,
        sidePad: sideInset || EDITOR_VIEWPORT_PADDING / 2,
      },
      fittedViewport = fitSlideEditorViewport(usableViewport),
      ref = runtime.reactK_.useRef<TextZoomState | null>(null),
      ref2 = runtime.reactK_.useRef(-1 / 0),
      ref3 = runtime.reactK_.useRef<ViewportAnimation | null>(null),
      ref4 = runtime.reactK_.useRef<string | null>(null),
      ref5 = runtime.reactK_.useRef(surround);
    ref5.current = surround;
    let callback = runtime.reactK_.useCallback(
        (input: EditorViewport, options: EditorViewportBox) =>
          ref5.current ? input : clampEditorViewport(input, options),
        [],
      ),
      value = manualViewport ?? fittedViewport,
      scale = value.scale,
      ref6 = runtime.reactK_.useRef<EditorViewport | null>(null);
    if (manualViewport === null) {
      ref6.current = value;
    }
    let ref7 = runtime.reactK_.useRef(false);
    ref7.current = manualViewport !== null;
    let ref8 = runtime.reactK_.useRef(value);
    ref8.current = ref6.current ?? value;
    let ref9 = runtime.reactK_.useRef({
        dx: 0,
        dy: 0,
      }),
      ref10 = runtime.reactK_.useRef(0),
      ref11 = runtime.reactK_.useRef(new Map<number, string>()),
      ref12 = runtime.reactK_.useRef(new Set<number>()),
      ref13 = runtime.reactK_.useRef(new Set<number>()),
      ref14 = runtime.reactK_.useRef<StagePress | null>(null),
      ref15 = runtime.reactK_.useRef<RectSelectionDrag | null>(null),
      ref16 = runtime.reactK_.useRef<() => boolean>(() => false),
      [value2, value3] = runtime.reactK_.useState<EditorScreenRect | null>(null),
      ref17 = runtime.reactK_.useRef({
        minScale: 0.01,
        maxScale: 64,
      });
    ref17.current.minScale = surround
      ? Math.min(surround.minScale, fittedViewport.scale)
      : fittedViewport.scale;
    ref17.current.maxScale = surround
      ? surround.maxScale
      : fittedViewport.scale * 16;
    runtime.reactK_.useEffect(() => {
      if (
        manualViewport === null ||
        ref3.current !== null ||
        ref.current !== null
      ) {
        return;
      }
      let current = ref17.current,
        value59 = Math.min(
          current.maxScale,
          Math.max(current.minScale, manualViewport.scale),
        ),
        value60 = manualViewport;
      if (value59 !== manualViewport.scale) {
        value60 = (0, runtime.zoomViewportAt)(
          manualViewport,
          usableViewport.w / 2,
          usableViewport.top + usableViewport.h / 2,
          value59 / manualViewport.scale,
          current,
        );
      }
      value60 = callback(value60, {
        w: usableViewport.w,
        h: usableViewport.h,
        top: usableViewport.top,
      });
      if (value60 !== manualViewport) {
        ref6.current = value60;
        setManualViewport(value60);
      }
    }, [
      manualViewport,
      usableViewport.w,
      usableViewport.h,
      usableViewport.top,
      usableViewport.sidePad,
      callback,
      surround?.minScale,
      surround?.maxScale,
    ]);
    let value4 = surround?.seat;
    runtime.reactK_.useLayoutEffect(() => {
      let current = stageRef.current;
      if (!value4 || !current || !(value4.width > 0)) {
        return;
      }
      let value59 = editorViewportFromScreenRect(
        value4,
        current.getBoundingClientRect(),
      );
      ref7.current = true;
      ref6.current = value59;
      ref8.current = value59;
      setManualViewport(value59);
    }, [value4]);
    let value5 = surround?.pick,
      ref18 = runtime.reactK_.useRef(onSelectionChange);
    ref18.current = onSelectionChange;
    runtime.reactK_.useEffect(() => {
      if (!value5) {
        return;
      }
      let value59 = requestAnimationFrame(() => {
        let current = stageRef.current,
          value60 = current
            ? (document)
                .elementsFromPoint(value5.x, value5.y)
                .find((input) => current.contains(input))
            : undefined,
          value61 = value60
            ?.closest("[data-frame-id]")
            ?.getAttribute("data-frame-id"),
          value62 =
            value61 != null
              ? (0, runtime.frameById)(slideRef.current, value61)
              : undefined,
          value63 =
            value62 && value60
              ? (0, runtime.resolvePointerSelection)(
                  value62.id,
                  value62.node,
                  parseEditorNodePath(
                    value60
                      .closest("[data-node-path]")
                      ?.getAttribute("data-node-path"),
                  ),
                  [],
                  getFrameHitTestOptions(slideRef.current, value62),
                ).tap
              : null;
        if (value63) {
          ref18.current([value63]);
        }
      });
      return () => cancelAnimationFrame(value59);
    }, [value5]);
    let value6 = surround !== undefined;
    runtime.reactK_.useLayoutEffect(() => {
      let current = stageRef.current;
      if (!value6 || manualViewport === null || !current || stageSize.w <= 0) {
        return;
      }
      ref5.current?.onViewChange(value, current.getBoundingClientRect());
    }, [
      value6,
      manualViewport,
      value.x,
      value.y,
      value.scale,
      stageSize.w,
      stageSize.h,
      bottomInset,
      topInset,
    ]);
    let value7 = (0, runtime.useCoarsePointer)(),
      value8 = (0, runtime.useFrameBottomInset)(),
      value9 =
        textEdit !== null &&
        value7 &&
        surround === undefined &&
        Math.min(
          (window).screen.width,
          (window).screen.height,
        ) < EDITOR_TEXT_ZOOM_DURATION_MS
          ? (0, runtime.selectionKey)(
              (0, runtime.createNodeSelection)(textEdit.frameId, textEdit.path),
            )
          : null,
      value10 =
        value9 !== null && value8 > 0
          ? Math.max(
              0,
              (stageRef.current?.getBoundingClientRect().bottom ?? 0) -
                (bottomInset ?? 0) -
                ((window).innerHeight - value8),
            )
          : 0,
      state = {
        ...usableViewport,
        h: Math.max(0, usableViewport.h - value10),
      },
      ref19 = runtime.reactK_.useRef<{ box: EditableCaretRect | null } | null>(null),
      ref20 = runtime.reactK_.useRef<EditableCaretRect | null>(null),
      value11 = textEdit !== null && textEdit.cell === undefined,
      [, value12] = runtime.reactK_.useState(0);
    runtime.reactK_.useEffect(() => {
      if (!value11) {
        return;
      }
      let callback77 = () => {
        let current = ref19.current;
        if (current === null) {
          return;
        }
        let value59 = getEditableCaretClientRect() ?? ref20.current;
        if (
          value59?.top !== current.box?.top ||
          value59?.bottom !== current.box?.bottom
        ) {
          value12((input) => input + 1);
        }
      };
      (document).addEventListener("selectionchange", callback77);
      return () => {
        (document).removeEventListener(
          "selectionchange",
          callback77,
        );
        ref20.current = null;
      };
    }, [value11]);
    let ref21 = runtime.reactK_.useRef<Slide | null>(null);
    runtime.reactK_.useEffect(() => {
      ref21.current = null;
    }, [selectionKey2, slide.id]);
    runtime.reactK_.useEffect(() => {
      ref15.current = null;
      value3(null);
    }, [slide.id]);
    let ref22 = runtime.reactK_.useRef<HTMLInputElement | null>(null),
      ref23 = runtime.reactK_.useRef<{ frameId: string; path: NodePath } | null>(null),
      callback2 = runtime.reactK_.useCallback(() => {
        if (ref3.current !== null) {
          cancelAnimationFrame(ref3.current.raf);
        }
        ref3.current = null;
        if (ref.current !== null) {
          ref.current.kept = true;
        }
      }, []),
      callback3 = runtime.reactK_.useCallback(() => {
        if (ref5.current) {
          return ref5.current.onFit();
        }
        callback2();
        ref6.current = null;
        setManualViewport(null);
      }, [callback2]),
      ref24 = runtime.reactK_.useRef(usableViewport);
    ref24.current = ref.current !== null ? state : usableViewport;
    let callback4 = runtime.reactK_.useCallback(
        (input: number) => {
          let current = ref8.current,
            value59 = callback(
              (0, runtime.zoomViewportAt)(
                current,
                ref24.current.w / 2,
                ref24.current.top + ref24.current.h / 2,
                input,
                ref17.current,
              ),
              ref24.current,
            );
          if (
            value59.x === current.x &&
            value59.y === current.y &&
            value59.scale === current.scale
          ) {
            return;
          }
          callback2();
          ref6.current = value59;
          setManualViewport(value59);
        },
        [callback, callback2],
      ),
      callback5 = runtime.reactK_.useCallback(
        (input: number) => {
          let current = ref8.current;
          if (current.scale <= 0) {
            return;
          }
          callback4(input / current.scale);
        },
        [callback4],
      ),
      scale2 = ref8.current.scale,
      ref25 = runtime.reactK_.useRef(onScaleChange);
    ref25.current = onScaleChange;
    runtime.reactK_.useEffect(() => {
      ref25.current?.(scale2);
    }, [scale2]);
    let ref26 = runtime.reactK_.useRef(textEdit);
    ref26.current = textEdit;
    let ref27 = runtime.reactK_.useRef(presenting);
    ref27.current = presenting;
    let callback6 = runtime.reactK_.useCallback(
        (input: Element | null) => {
          if (input !== null && dragSessionRef.current !== null) {
            return;
          }
          let value59 = null;
          if (input !== null) {
            let value60 = input
                .closest("[data-frame-id]")
                ?.getAttribute("data-frame-id"),
              value61 =
                value60 != null
                  ? (0, runtime.frameById)(slideRef.current, value60)
                  : undefined,
              value62 = parseEditorNodePath(
                input
                  .closest("[data-node-path]")
                  ?.getAttribute("data-node-path"),
              );
            value59 = {
              unit:
                value61 !== undefined
                  ? (0, runtime.resolvePointerSelection)(
                      value61.id,
                      value61.node,
                      value62,
                      selectionRef.current,
                      getFrameHitTestOptions(slideRef.current, value61),
                    ).tap
                  : null,
            };
          }
          setDistanceHoverTarget((input2) => {
            if (input2 === null || value59 === null) {
              if (input2 === value59) {
                return input2;
              } else {
                return value59;
              }
            }
            if (
              input2.unit === null || value59.unit === null
                ? input2.unit === value59.unit
                : (0, runtime.selectionsEqual)(input2.unit, value59.unit)
            ) {
              return input2;
            } else {
              return value59;
            }
          });
        },
        [],
      ),
      callback7 = runtime.reactK_.useCallback(
        (input: Element | null) => {
          let value59 = null;
          if (
            input !== null &&
            dragSessionRef.current === null &&
            ref26.current === null
          ) {
            let value61 = input
                .closest("[data-frame-id]")
                ?.getAttribute("data-frame-id"),
              value62 =
                value61 != null
                  ? (0, runtime.frameById)(slideRef.current, value61)
                  : undefined,
              value63 = parseEditorNodePath(
                input
                  .closest("[data-node-path]")
                  ?.getAttribute("data-node-path"),
              );
            value59 =
              value62 !== undefined
                ? (0, runtime.resolvePointerSelection)(
                    value62.id,
                    value62.node,
                    value63,
                    selectionRef.current,
                    getFrameHitTestOptions(slideRef.current, value62),
                  ).tap
                : null;
            let value64 =
                value62 !== undefined &&
                value59 !== null &&
                (0, runtime.selectionNodePath)(value59).length === 0 &&
                ((0, runtime.isPrimaryLayoutFrame)(slideRef.current, value62) ||
                  (0, runtime.isEmptyBackgroundFrame)(value62)),
              value65 =
                value59 !== null
                  ? (0, runtime.selectedNode)(slideRef.current, value59)
                  : undefined;
            if (
              value64 ||
              (value65 !== undefined &&
                ((0, runtime.isLineShapeNode)(value65) ||
                  (0, runtime.isConnectorNode)(value65)))
            ) {
              value59 = null;
            }
          }
          let value60 = value59,
            [items, items2] = [slideRef.current, ref8.current];
          setHoverTarget(
            (input2) =>
              value60 === null
                ? null
                : input2 !== null &&
                    (0, runtime.selectionsEqual)(input2.unit, value60) &&
                    input2.slide === items &&
                    input2.view.x === items2.x &&
                    input2.view.y === items2.y &&
                    input2.view.scale === items2.scale
                  ? input2
                  : {
                      unit: value60,
                      slide: items,
                      view: items2,
                    },
          );
        },
        [],
      );
    runtime.reactK_.useEffect(() => {
      if (lastPointerSlideRef.current === slideRef.current) {
        callback7(lastPointerTargetRef.current);
      }
    }, [selectionKey2, callback7]);
    runtime.reactK_.useEffect(() => {
      let callback77 = (input: boolean) => {
          setAltPressed(input);
          if (input) {
            callback6(lastPointerTargetRef.current);
          }
        },
        callback78 = (input: KeyboardEvent) => {
          if (input.key === "Alt" && !input.repeat) {
            callback77(input.type === "keydown");
          }
        },
        callback79 = () => {
          if (!(document).hasFocus()) {
            callback77(false);
          }
        };
      (window).addEventListener("keydown", callback78, true);
      (window).addEventListener("keyup", callback78, true);
      (window).addEventListener("blur", callback79);
      return () => {
        (window).removeEventListener("keydown", callback78, true);
        (window).removeEventListener("keyup", callback78, true);
        (window).removeEventListener("blur", callback79);
      };
    }, [callback6]);
    runtime.reactK_.useEffect(() => {
      let callback77 = (event: KeyboardEvent) => {
        if (event.defaultPrevented) {
          return;
        }
        if (ref27.current === true) {
          return;
        }
        if (!(event.metaKey || event.ctrlKey) || event.altKey) {
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
        if (ref26.current) {
          return;
        }
        let target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
        event.preventDefault();
        if (event.key === "0") {
          callback3();
        } else {
          callback4(event.key === "-" ? 0.8 : 1.25);
        }
      };
      (window).addEventListener("keydown", callback77);
      return () =>
        (window).removeEventListener("keydown", callback77);
    }, [callback3, callback4]);
    runtime.reactK_.useEffect(() => {
      if (selection.length === 0) {
        return;
      }
      let callback77 = () =>
        refreshMeasurements((input) => input + 1);
      (window).addEventListener("scroll", callback77, {
        capture: true,
        passive: true,
      });
      (window).addEventListener("resize", callback77);
      return () => {
        (window).removeEventListener("scroll", callback77, {
          capture: true,
        });
        (window).removeEventListener("resize", callback77);
      };
    }, [selectionKey2]);
    let callback8 = runtime.reactK_.useCallback(() => {
        stageRef.current?.focus({
          preventScroll: true,
        });
      }, []),
      value13 = runtime.reactK_.useId(),
      value14 = value13 + "-slide-hint",
      value15 = value13 + "-object-hint",
      value16 = value13 + "-slide-heading",
      ref28 = runtime.reactK_.useRef<Element | null>(null),
      [value17, value18] = runtime.reactK_.useState(false),
      ref29 = runtime.reactK_.useRef(0),
      [value19, value20] = runtime.reactK_.useState(false);
    runtime.reactK_.useEffect(() => {
      if (value17) {
        value20(true);
      }
    }, [value17, selectionKey2]);
    let value21 = value17 && value19,
      [value22, value23] = runtime.reactK_.useState(false),
      ref30 = runtime.reactK_.useRef(new Map<string, HTMLElement>()),
      ref31 = runtime.reactK_.useRef(new Map<string, (element: HTMLElement | null) => void>()),
      callback9 = runtime.reactK_.useCallback(
        (input: string) => {
          let entry = ref31.current.get(input);
          if (entry !== undefined) {
            return entry;
          }
          let value59: HTMLElement | null = null,
            callback77 = (input2: HTMLElement | null) => {
              if (input2 !== null) {
                value59 = input2;
                ref30.current.set(input, input2);
                if (!ref31.current.has(input)) {
                  ref31.current.set(input, callback77);
                }
                return;
              }
              if (ref30.current.get(input) === value59) {
                ref30.current.delete(input);
              }
              if (ref31.current.get(input) === callback77) {
                ref31.current.delete(input);
              }
              value59 = null;
            };
          ref31.current.set(input, callback77);
          return callback77;
        },
        [],
      ),
      callback10 = runtime.reactK_.useCallback(() => {
        let current = selectionRef.current,
          value59 = current[current.length - 1];
        if (value59 === undefined) {
          return null;
        } else {
          return ref30.current.get((0, runtime.selectionKey)(value59)) ?? null;
        }
      }, []),
      ref32 = runtime.reactK_.useRef(false),
      ref33 = runtime.reactK_.useRef(false),
      callback11 = runtime.reactK_.useCallback(
        (input: HTMLElement | null | undefined, options: RefObject<boolean>) => {
          if (
            input === null ||
            input === undefined ||
            input === (document).activeElement
          ) {
            return;
          }
          options.current = true;
          try {
            input.focus({
              preventScroll: true,
            });
          } finally {
            options.current = false;
          }
        },
        [],
      ),
      callback12 = runtime.reactK_.useCallback(() => {
        ref29.current = 0;
        slideSurfaceRef.current?.focus({
          preventScroll: true,
        });
      }, []),
      callback13 = runtime.reactK_.useCallback(
        (input: NodeSelection | undefined) => {
          if (input === undefined) {
            return false;
          }
          value18(true);
          ref29.current = 0;
          callback11(
            ref30.current.get((0, runtime.selectionKey)(input)),
            ref32,
          );
          let current = selectionRef.current;
          if (
            !(
              current.length === 1 &&
              (0, runtime.selectionsEqual)(current[0]!, input)
            )
          ) {
            ref18.current([input]);
          }
          return true;
        },
        [],
      ),
      callback14 = (input: Element | null) =>
        input !== null &&
        input !== slideSurfaceRef.current &&
        slideSurfaceRef.current?.contains(input) === true,
      ref34 = runtime.reactK_.useRef<number | null>(null),
      ref35 = runtime.reactK_.useRef(false),
      ref36 = runtime.reactK_.useRef<Element | "outside" | null>(null),
      ref37 = runtime.reactK_.useRef<string | null>(null),
      ref38 = runtime.reactK_.useRef(new Set<string>()),
      ref39 = runtime.reactK_.useRef(slide),
      [value24, value25] = runtime.reactK_.useState(
        () => new Map<string, number>(),
      ),
      ref40 = runtime.reactK_.useRef(false),
      ref41 = runtime.reactK_.useRef(selectionKey2);
    runtime.reactK_.useLayoutEffect(() => {
      let value59 = ref40.current && textEdit === null;
      ref40.current = textEdit !== null;
      let value60 = ref41.current !== selectionKey2;
      ref41.current = selectionKey2;
      let value61 =
        lastSelectedUnit !== undefined &&
        lastSelectedUnit.child === undefined &&
        lastSelectedUnit.frameId === ref37.current;
      if (value61 || value60) {
        ref37.current = null;
      }
      if (commenting) {
        ref28.current = null;
        if (ref34.current !== null) {
          cancelAnimationFrame(ref34.current);
        }
        ref34.current = null;
        ref35.current = false;
        ref36.current = null;
        return;
      }
      let activeElement = (document).activeElement,
        current = ref28.current,
        value62 =
          lastSelectedUnitKey !== null &&
          ref38.current.has(lastSelectedUnitKey),
        value63 =
          lastSelectedUnit !== undefined &&
          lastSelectedUnitKey !== null &&
          (!value62 ||
            (0, runtime.selectedNode)(ref39.current, lastSelectedUnit) !==
              (0, runtime.selectedNode)(slide, lastSelectedUnit));
      if (value60 && (document).hasFocus()) {
        let value66 =
            activeElement instanceof HTMLElement &&
            ref42.current?.contains(activeElement) === true,
          value67 =
            (activeElement === null ||
              activeElement === (document).body) &&
            current instanceof HTMLElement &&
            current.hasAttribute("data-object-proxy") &&
            !current.isConnected;
        if (
          value66 &&
          activeElement!.getAttribute("data-object-proxy") !==
            lastSelectedUnitKey
        ) {
          if (value63) {
            ref36.current = activeElement;
          } else {
            callback11(
              selection.length === 0 ? slideSurfaceRef.current : callback10(),
              ref33,
            );
          }
        } else if (value67) {
          if (value63) {
            ref36.current = (document).body;
          } else {
            callback11(
              selection.length === 0
                ? slideSurfaceRef.current
                : (callback10() ?? slideSurfaceRef.current),
              ref33,
            );
          }
        } else if (value61 && !value66 && !callback14(activeElement)) {
          ref36.current = "outside";
        }
        if (value63 && value62 && ref36.current !== null) {
          value25(
            (input) =>
              new Map(input).set(
                lastSelectedUnitKey!,
                (input.get(lastSelectedUnitKey!) ?? 0) + 1,
              ),
          );
        }
      }
      ref38.current = new Set(ref30.current.keys());
      ref39.current = slide;
      let activeElement2 = (document).activeElement;
      if (
        activeElement2 !== null &&
        activeElement2 !== (document).body &&
        slideSurfaceRef.current?.contains(activeElement2) !== true &&
        ref42.current?.contains(activeElement2) !== true
      ) {
        ref28.current = null;
      }
      let value64 =
          value59 &&
          selection.length > 0 &&
          (activeElement2 === slideSurfaceRef.current ||
            activeElement2 === stageRef.current),
        value65 =
          current !== null &&
          !current.isConnected &&
          (activeElement2 === null ||
            activeElement2 === (document).body);
      if (value64) {
        ref35.current = true;
      }
      if (
        (!value64 && !value65 && ref36.current === null) ||
        ref34.current !== null
      ) {
        return;
      }
      ref34.current = requestAnimationFrame(() => {
        ref34.current = null;
        let current2 = ref35.current;
        ref35.current = false;
        let current3 = ref36.current;
        ref36.current = null;
        if (ref26.current !== null || !(document).hasFocus()) {
          return;
        }
        let activeElement3 = (document).activeElement;
        if (current3 === "outside") {
          let value66 = callback10();
          if (
            callback14(activeElement3) ||
            (activeElement3 !== null &&
              ref42.current?.contains(activeElement3) === true) ||
            value66 === null
          ) {
            return;
          }
          value18(true);
          callback11(value66, ref33);
          return;
        }
        if (current3 !== null) {
          if (
            activeElement3 === current3 ||
            activeElement3 === null ||
            activeElement3 === (document).body
          ) {
            callback11(callback10() ?? slideSurfaceRef.current, ref33);
          }
          return;
        }
        if (
          current2 &&
          (activeElement3 === slideSurfaceRef.current ||
            activeElement3 === stageRef.current)
        ) {
          callback11(callback10(), ref33);
        } else if (
          activeElement3 === null ||
          activeElement3 === (document).body
        ) {
          callback11(callback10() ?? slideSurfaceRef.current, ref33);
        }
      });
    });
    runtime.reactK_.useEffect(
      () => () => {
        if (ref34.current !== null) {
          cancelAnimationFrame(ref34.current);
        }
        ref34.current = null;
      },
      [],
    );
    let ref42 = runtime.reactK_.useRef<HTMLDivElement | null>(null);
    runtime.reactK_.useLayoutEffect(() => {
      let activeElement = (document).activeElement;
      if (
        activeElement !== null &&
        ref42.current?.contains(activeElement) === true
      ) {
        return;
      }
      if (
        keyboardGroups.every(
          (input) =>
            input.stops.every(
              (input2, options) =>
                input2 === input.tree[options],
            ),
        )
      ) {
        return;
      }
      keyboardStopOrderRef.current.seq = new Map();
      refreshKeyboardOrder((input) => input + 1);
    }, [keyboardGroups]);
    let callback15 = runtime.reactK_.useCallback(() => {
        if (selectionRef.current.length === 0) {
          return callback13(
            (0, runtime.slideNavigationSelections)(slideRef.current)[0],
          );
        }
        let value59 = callback10();
        if (value59 === null) {
          return false;
        }
        value18(true);
        ref29.current = 0;
        callback11(value59, ref32);
        return true;
      }, [callback13, callback10, callback11]),
      callback16 = runtime.reactK_.useCallback(() => {
        if (ref26.current !== null) {
          let value60 =
            slideSurfaceRef.current?.querySelector<HTMLElement>(
              "[data-text-path][contenteditable], [data-cell][contenteditable]",
            ) ?? null;
          if (value60 === null) {
            return false;
          }
          value60.focus({
            preventScroll: true,
          });
          return (document).activeElement === value60;
        }
        if (selectionRef.current.length === 0 || !callback15()) {
          return false;
        }
        let value59 = callback10();
        return (
          value59 !== null && (document).activeElement === value59
        );
      }, [callback15, callback10]),
      memo = runtime.reactK_.useMemo(
        () => ({
          rect: (input: NodeSelection) => {
            let value59 = ref44.current(input);
            if (value59 === null) {
              return undefined;
            } else {
              return {
                x: value59.x,
                y: value59.y,
                w: value59.w,
                h: value59.h,
              };
            }
          },
          shrunk: (input: NodeSelection) => {
            let entry = frameElementsRef.current.get(input.frameId),
              value59 =
                input.child === undefined
                  ? entry
                  : entry?.querySelector<HTMLElement>(
                      '[data-node-path="' +
                        (0, runtime.selectionNodePath)(input).join(".") +
                        '"]',
                    );
            return (
              value59 !== undefined &&
              value59 !== null &&
              (0, runtime.hasTextFitCssVariable)(value59)
            );
          },
        }),
        [],
      ),
      callback17 = () => {
        let value59 = stageRef.current?.getBoundingClientRect(),
          value60 = slideSurfaceRef.current?.getBoundingClientRect();
        if (
          value59 === undefined ||
          value60 === undefined ||
          value60.width <= 0
        ) {
          return null;
        }
        let value61 = value60.width / runtime.SLIDE_WIDTH,
          value62 = (0, runtime.unionSelectionRectangles)(
            selectionRef.current
              .map((input) => ref44.current(input))
              .filter((input) => input !== null),
          ) ?? {
            x: runtime.SLIDE_WIDTH / 2,
            y: runtime.SLIDE_HEIGHT / 2,
            w: 0,
            h: 0,
          };
        return (0, runtime.contextMenuAnchorPoint)(
          {
            left: value60.left + value62.x * value61,
            top: value60.top + value62.y * value61,
            width: value62.w * value61,
            height: value62.h * value61,
          },
          value59,
        );
      },
      ref43 = runtime.reactK_.useRef<CanvasZoomApi | null>(null);
    if (zoomApiRef) {
      ref43.current = zoomApiRef.current = {
        getScale: () => ref8.current.scale,
        getLimits: () => ({
          ...ref17.current,
        }),
        setScaleTo: callback5,
        returnToFit: callback3,
        stepZoom: callback4,
        focusSlide: callback12,
        focusSelection: callback16,
        endTextEdit: () => callback42(),
        landOnCreated: (input: string) => {
          ref37.current = input;
        },
        measureUnit: (input: NodeSelection) => {
          let entry = frameElementsRef.current.get(input.frameId),
            value59 =
              input.child === undefined
                ? entry
                : entry?.querySelector<HTMLElement>(
                    '[data-node-path="' +
                      (0, runtime.selectionNodePath)(input).join(".") +
                      '"]',
                  );
          if (!value59) {
            return;
          }
          let value60 = getComputedStyle(value59),
            value61 = Math.ceil(parseFloat(value60.width)),
            value62 = Math.ceil(parseFloat(value60.height));
          return {
            w: value61 > 0 ? value61 : undefined,
            h: value62 > 0 ? value62 : undefined,
          };
        },
        groupMeasure: memo,
        menuPoint: callback17,
        endCrop: () => imageCropController.end(true),
      };
    }
    runtime.reactK_.useEffect(
      () => () => {
        if (zoomApiRef && zoomApiRef.current === ref43.current) {
          zoomApiRef.current = null;
        }
      },
      [zoomApiRef],
    );
    let callback18 = (event: ReactKeyboardEvent<HTMLElement>) => {
        if (
          event.target !== event.currentTarget ||
          event.defaultPrevented ||
          commenting
        ) {
          return;
        }
        if (
          event.key === "Enter" &&
          !event.repeat &&
          !event.shiftKey &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          if (callback15()) {
            event.preventDefault();
          }
        }
      },
      callback19 = (input: NodeSelection, options: (selection: NodeSelection | undefined) => boolean) => {
        if (
          [
            ...(document).querySelectorAll(
              runtime.OPEN_OVERLAY_SELECTOR +
                ', [data-mc-pick], [role="dialog"]',
            ),
          ].some(
            (input2) =>
              !(0, runtime.isOverlayClosed)(input2),
          )
        ) {
          return false;
        }
        let current = slideRef.current,
          value59 = (0, runtime.selectedNode)(current, input);
        if (value59 === undefined) {
          return false;
        }
        let value60 = (0, runtime.nodeDefaultAction)(value59);
        if (value60 === "enter") {
          options((0, runtime.childNavigationSelections)(current, input)[0]);
        } else if (value60 === "edit-text" && !readOnlyRef.current) {
          onTextEdit({
            frameId: input.frameId,
            path: (0, runtime.selectionNodePath)(input),
            caret: "end",
          });
        } else if (value60 === "edit-cell" && !readOnlyRef.current) {
          onTextEdit({
            frameId: input.frameId,
            path: (0, runtime.selectionNodePath)(input),
            cell: {
              r: 0,
              c: 0,
            },
            caret: "end",
          });
        } else {
          return false;
        }
        return true;
      },
      memo2 = runtime.reactK_.useMemo(
        () =>
          new Map(
            keyboardTargets.map(
              (input) => [input.key, input],
            ),
          ),
        [keyboardTargets],
      ),
      callback20 = (element: Element) =>
        memo2.get(element.getAttribute("data-object-proxy") ?? "")?.unit,
      callback21 = (input: EventTarget | null) =>
        input instanceof Element &&
        (input === slideSurfaceRef.current ||
          input.closest("[data-object-proxy]") !== null),
      callback22 = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (
          event.defaultPrevented ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        ) {
          return;
        }
        let value59 = callback20(event.currentTarget);
        if (value59 === undefined) {
          return;
        }
        let current = slideRef.current;
        if (event.key === "Tab") {
          event.preventDefault();
          callback13(
            (0, runtime.nextNavigationSelection)(
              current,
              value59,
              event.shiftKey ? -1 : 1,
            ),
          );
        } else if (
          (event.key === "Home" || event.key === "End") &&
          !event.shiftKey
        ) {
          event.preventDefault();
          callback13(
            (0, runtime.boundaryNavigationSelection)(
              current,
              value59,
              event.key === "Home" ? "first" : "last",
            ),
          );
        } else if (event.key === "Enter" && !event.repeat) {
          if (event.shiftKey) {
            event.preventDefault();
            let value60 = (0, runtime.navigationParentSelection)(
              current,
              value59,
            );
            if (value60 !== null) {
              callback13(value60);
            } else {
              callback12();
              onSelectionChange([]);
            }
          } else if (selectionRef.current.length > 1) {
            event.preventDefault();
            callback13(value59);
          } else {
            let value60 = (0, runtime.selectedNode)(current, value59);
            if (
              value60 !== undefined &&
              (0, runtime.nodeDefaultAction)(value60) === "enter"
            ) {
              event.preventDefault();
              callback13(
                (0, runtime.childNavigationSelections)(current, value59)[0],
              );
            }
          }
        } else if (
          readOnlyRef.current &&
          (event.key === "ArrowLeft" ||
            event.key === "ArrowRight" ||
            event.key === "PageUp" ||
            event.key === "PageDown")
        ) {
          event.preventDefault();
        }
      },
      callback23 = (input: ReactMouseEvent<HTMLDivElement>) => {
        let value59 = callback20(input.currentTarget);
        if (value59 === undefined) {
          return;
        }
        let current = selectionRef.current;
        if (
          !(
            current.length === 1 &&
            (0, runtime.selectionsEqual)(current[0]!, value59)
          )
        ) {
          callback13(value59);
        }
        if (current.length <= 1) {
          callback19(value59, callback13);
        }
      },
      callback24 = (event: ReactFocusEvent<HTMLDivElement>) => {
        if (
          ref32.current ||
          ref33.current ||
          event.target !== event.currentTarget
        ) {
          return;
        }
        let value59 = callback20(event.currentTarget);
        if (value59 === undefined) {
          return;
        }
        let current = selectionRef.current,
          value60 = current.some(
            (input) =>
              (0, runtime.selectionsEqual)(input, value59),
          );
        if (value60 && ref28.current === event.currentTarget) {
          return;
        }
        value18(true);
        let value61 = current[current.length - 1];
        if (
          value61 !== undefined &&
          (0, runtime.selectionsEqual)(value61, value59)
        ) {
          return;
        }
        if (value60) {
          onSelectionChange([
            ...current.filter(
              (input) =>
                !(0, runtime.selectionsEqual)(input, value59),
            ),
            value59,
          ]);
        } else {
          onSelectionChange([value59]);
        }
      },
      callback25 = runtime.reactK_.useCallback(
        (input: string, options: HTMLDivElement | null) => {
          if (options) {
            frameElementsRef.current.set(input, options);
          } else {
            frameElementsRef.current.delete(input);
          }
        },
        [],
      ),
      callback26 = runtime.reactK_.useCallback(
        (input: string, options?: ReadonlySet<string>) => {
          let entry = frameElementsRef.current.get(input),
            value59 = entry?.offsetParent;
          if (!entry || !value59) {
            return null;
          }
          let bounds = value59.getBoundingClientRect(),
            callback77 = (input2: EditorScreenRect) => ({
              x: (input2.left - bounds.left) / scale,
              y: (input2.top - bounds.top) / scale,
              w: input2.width / scale,
              h: input2.height / scale,
            }),
            value60 = callback77(
              getFrameTransformScreenRect(slideRef.current, input, entry),
            ),
            items = [];
          for (let [value61, value62] of frameElementsRef.current) {
            if (value61 === input || options?.has(value61)) {
              continue;
            }
            items.push(
              callback77(
                getFrameTransformScreenRect(slideRef.current, value61, value62),
              ),
            );
          }
          return {
            startRect: value60,
            layout: callback77(entry.getBoundingClientRect()),
            siblingRects: items,
          };
        },
        [scale],
      ),
      callback27 = runtime.reactK_.useCallback(
        (input: NodeSelection): EditorSelectionRect | null => {
          let entry = frameElementsRef.current.get(input.frameId),
            value59 = entry?.offsetParent;
          if (!entry || !value59) {
            return null;
          }
          let element = entry.querySelector<HTMLElement>(
              '[data-node-path="' +
                (0, runtime.selectionNodePath)(input).join(".") +
                '"]',
            ),
            value60 = input.child === undefined ? entry : element;
          if (!value60) {
            return null;
          }
          let bounds = value59.getBoundingClientRect(),
            value61 = getUnliftedBoundingClientRect(value60),
            value62 = (0, runtime.nodeTransform)(
              (0, runtime.selectedNode)(slide, input),
            ),
            value63 =
              element !== null && typeof element.offsetWidth === "number";
          if (value62 === undefined || element === null) {
            return {
              x: (value61.left - bounds.left) / scale,
              y: (value61.top - bounds.top) / scale,
              w: value61.width / scale,
              h: value61.height / scale,
            };
          }
          let value64 = getUnliftedBoundingClientRect(element),
            value65 = value62.scale ?? 1,
            value66 =
              value63 || input.child === undefined
                ? null
                : getComputedStyle(element),
            value67 =
              (value63
                ? element.offsetWidth
                : value66 !== null
                  ? parseFloat(value66.width) || value64.width / scale
                  : value61.width / scale) * value65,
            value68 =
              (value63
                ? element.offsetHeight
                : value66 !== null
                  ? parseFloat(value66.height) || value64.height / scale
                  : value61.height / scale) * value65;
          return {
            x:
              (value64.left + value64.width / 2 - bounds.left) / scale -
              value67 / 2,
            y:
              (value64.top + value64.height / 2 - bounds.top) / scale -
              value68 / 2,
            w: value67,
            h: value68,
            rotation: ((value62.rotate ?? 0) * Math.PI) / 180,
            nodeScale: value65,
          };
        },
        [slide, scale],
      );
    runtime.reactK_.useLayoutEffect(() => {
      let current = dragSessionRef.current,
        value59 = current?.kind === "move" ? current.drop : null,
        value60 = value59
          ? frameElementsRef.current.get(value59.frameId)
          : undefined,
        value61 = value60?.offsetParent,
        value62 = null;
      if (current?.kind === "move" && value59 && value60 && value61) {
        let k = current.k,
          bounds = value61.getBoundingClientRect(),
          callback77 = (input: NodePath) => {
            let value67 = value60
              .querySelector('[data-node-path="' + input.join(".") + '"]')
              ?.getBoundingClientRect();
            if (value67) {
              return {
                x: (value67.left - bounds.left) / k,
                y: (value67.top - bounds.top) / k,
                w: value67.width / k,
                h: value67.height / k,
              };
            } else {
              return null;
            }
          },
          value63 =
            current.preview?.slide ?? current.last?.slide ?? current.applyBase,
          value64 = (0, runtime.frameById)(value63, value59.frameId),
          value65 = value64
            ? (0, runtime.nodeAtPath)(value64.node, value59.path)
            : undefined,
          value66 = callback77(value59.path);
        if (value66 && value65 && (0, runtime.isFlowContainer)(value65)) {
          let value67 = value65.children.map(
              (input, options) =>
                callback77([...value59.path, options]),
            ),
            value68 = 2 / k,
            value69 = current.preview
              ? value67[value59.index]
              : undefined,
            value70 = value65.kind === "grid" || value65.dir === "v",
            value71 = value69
              ? value70
                ? {
                    x: value69.x,
                    y: value69.y + value69.h / 2 - value68 / 2,
                    w: value69.w,
                    h: value68,
                  }
                : {
                    x: value69.x + value69.w / 2 - value68 / 2,
                    y: value69.y,
                    w: value68,
                    h: value69.h,
                  }
              : value67.every((input) => input !== null)
                ? calculateFlowInsertionGuide(
                    value65,
                    value67,
                    value59.index,
                    value68,
                  )
                : null;
          value62 = {
            box: value66,
            bar: value71,
          };
        }
      }
      setFlowDropPreview(
        (input) =>
          JSON.stringify(input) === JSON.stringify(value62) ? input : value62,
      );
    });
    runtime.reactK_.useLayoutEffect(() => {
      let value59 = null;
      if (
        altPressed &&
        distanceHoverTarget !== null &&
        !textEdit &&
        dragSessionRef.current === null &&
        value2 === null
      ) {
        let value60 = selectionBoundsForUnits(
            selection,
            selectionRects,
            distanceHoverTarget.unit,
            callback27,
          ),
          value61 =
            value60 !== null
              ? (0, runtime.measureDistances)(value60.a, value60.b, 1)
              : null;
        value59 = value61 !== null && value61.lines.length > 0 ? value61 : null;
      }
      setDistanceMeasurements(
        (input) =>
          JSON.stringify(input) === JSON.stringify(value59) ? input : value59,
      );
    });
    let value26 =
      hoverTarget !== null &&
      hoverTarget.slide === slide &&
      hoverTarget.view.x === value.x &&
      hoverTarget.view.y === value.y &&
      hoverTarget.view.scale === scale
        ? hoverTarget.unit
        : null;
    runtime.reactK_.useLayoutEffect(() => {
      let value59 =
        value26 !== null &&
        !value21 &&
        !commenting &&
        !textEdit &&
        dragSessionRef.current === null &&
        value2 === null &&
        imageCropController.session === null &&
        !selection.some(
          (input) =>
            (0, runtime.selectionsEqual)(input, value26),
        )
          ? callback27(value26)
          : null;
      setHoverRect(
        (input) =>
          JSON.stringify(input) === JSON.stringify(value59) ? input : value59,
      );
    });
    runtime.reactK_.useLayoutEffect(() => {
      let value59 =
        textEdit !== null
          ? callback27(
              (0, runtime.createNodeSelection)(textEdit.frameId, textEdit.path),
            )
          : null;
      setTextEditRect(
        (input) =>
          JSON.stringify(input) === JSON.stringify(value59) ? input : value59,
      );
    });
    runtime.reactK_.useLayoutEffect(() => {
      setSelectionRects(selection.map(callback27));
      setMeasuredSelectionKey(selectionKey2);
    }, [selectionKey2, callback27, value.x, value.y, measurementGeneration]);
    let ref44 = runtime.reactK_.useRef(callback27);
    ref44.current = callback27;
    let callback28 = (
      input: EditorViewport,
      options: { x: number; y: number },
      context?: () => void,
    ) => {
      if (ref3.current !== null) {
        cancelAnimationFrame(ref3.current.raf);
      }
      let current = ref8.current,
        callback77 = (input2: EditorViewport) => {
          ref7.current = true;
          ref6.current = input2;
          ref8.current = input2;
          setManualViewport(input2);
        },
        callback78 = () => {
          if (ref3.current !== null) {
            cancelAnimationFrame(ref3.current.raf);
          }
          ref3.current = null;
          callback77(input);
          context?.();
        };
      if (
        (window).matchMedia?.("(prefers-reduced-motion: reduce)")
          .matches
      ) {
        return callback78();
      }
      let value59 = -1,
        callback79 = (input2: number) => {
          if (value59 < 0) {
            value59 = input2;
          }
          let value60 = Math.min(
            1,
            (input2 - value59) / runtime.GRID_ZOOM_ANIMATION_MS,
          );
          if (value60 >= 1) {
            return callback78();
          }
          callback77(
            (0, runtime.interpolateGridViewport)(
              current,
              input,
              options,
              1 - (1 - value60) ** 3,
            ),
          );
          ref3.current = {
            raf: requestAnimationFrame(callback79),
            to: input,
            land: callback78,
          };
        };
      ref3.current = {
        raf: requestAnimationFrame(callback79),
        to: input,
        land: callback78,
      };
    };
    runtime.reactK_.useEffect(() => {
      let current = ref.current,
        callback77 = () => {
          if (current === null) {
            return;
          }
          ref.current = null;
          let value64 = current.kept
            ? callback(ref8.current, usableViewport)
            : current.from !== null
              ? callback(current.from, usableViewport)
              : null;
          if (value64 === null) {
            callback28(fittedViewport, current.anchor, () => {
              ref7.current = false;
              ref6.current = null;
              setManualViewport(null);
            });
          } else if (value64 !== ref8.current) {
            callback28(value64, current.anchor);
          }
        };
      if (value9 === null || textEdit === null) {
        ref4.current = null;
        if (current === null) {
          return;
        }
        if (
          !current.held &&
          !current.kept &&
          performance.now() - ref2.current < 1000
        ) {
          ref.current = {
            ...current,
            held: true,
          };
        } else if (
          !current.held ||
          selection.length === 0 ||
          current.slide !== slide.id
        ) {
          callback77();
        }
        return;
      }
      if (current?.kept === true) {
        let value64 = callback(ref8.current, state);
        if (value64 !== ref8.current) {
          callback28(value64, current.anchor);
        }
        return;
      }
      if (ref4.current === value9) {
        return;
      }
      let value59 = ref44.current(
        (0, runtime.createNodeSelection)(textEdit.frameId, textEdit.path),
      );
      if (value59 === null) {
        return;
      }
      let value60 = (0, runtime.rotatedRectBounds_Rn)(value59),
        value61 = current?.base ?? ref3.current?.to ?? ref8.current,
        value62 = calculateTextEditingZoom(
          value60,
          state,
          value61,
          ref17.current.maxScale,
        );
      if (value62 === null) {
        if (current === null || current.key !== value9) {
          ref4.current = value9;
        }
        if (current !== null && current.key !== value9) {
          callback77();
        }
        return;
      }
      if (current === null) {
        ref3.current?.land();
      }
      let state2 = {
        x: value60.x,
        y: value60.y,
      };
      ref.current =
        current !== null
          ? {
              ...current,
              key: value9,
              anchor: state2,
              held: false,
            }
          : {
              key: value9,
              slide: slide.id,
              from: ref7.current ? ref6.current : null,
              base: value61,
              anchor: state2,
              kept: false,
              held: false,
            };
      let value63 = ref3.current?.to ?? ref8.current;
      if (
        value62.x !== value63.x ||
        value62.y !== value63.y ||
        value62.scale !== value63.scale
      ) {
        callback28(value62, state2);
      }
    }, [
      value9,
      selectionKey2,
      slide.id,
      value10,
      stageSize.w,
      stageSize.h,
      topInset,
      bottomInset,
    ]);
    runtime.reactK_.useEffect(
      () => () => {
        cancelAnimationFrame(ref3.current?.raf ?? 0);
        ref3.current = null;
      },
      [],
    );
    let ref45 = runtime.reactK_.useRef(unitRectCache);
    ref45.current = unitRectCache;
    let ref46 = runtime.reactK_.useRef(keyboardTargets);
    ref46.current = keyboardTargets;
    let ref47 = runtime.reactK_.useRef(lastSelectedUnitKey);
    ref47.current = lastSelectedUnitKey;
    let value27 = textEdit !== null,
      value28 =
        textEdit !== null
          ? (0, runtime.selectionKey)(
              (0, runtime.createNodeSelection)(textEdit.frameId, textEdit.path),
            )
          : null,
      ref48 = runtime.reactK_.useRef(value28);
    ref48.current = value28;
    let memo3 = runtime.reactK_.useMemo(
      () =>
        keyboardTargets.map((input) => input.key).join("|"),
      [keyboardTargets],
    );
    runtime.reactK_.useLayoutEffect(() => {
      if (dragSessionRef.current !== null) {
        return;
      }
      let current = ref45.current,
        entries = new Map(),
        flag = false;
      for (let value59 of ref46.current) {
        let entry = current.get(value59.key),
          value60 =
            value27 &&
            (value59.key !== ref47.current || value59.key === ref48.current) &&
            entry !== undefined
              ? entry
              : (ref44.current(value59.unit) ?? entry);
        if (value60 === undefined) {
          continue;
        }
        entries.set(value59.key, value60);
        if (entry === undefined || !editorRectsEqual(entry, value60)) {
          flag = true;
        }
      }
      if (flag || entries.size !== current.size) {
        setUnitRectCache(entries);
      }
    }, [memo3, slide, measurementGeneration, value27]);
    runtime.reactK_.useEffect(() => {
      let flag = true;
      (document).fonts?.ready.then(() => {
        if (flag) {
          refreshMeasurements((input) => input + 1);
        }
      });
      return () => {
        flag = false;
      };
    }, []);
    let [value29, value30] = runtime.reactK_.useState<EditorSelectionRect | null>(null),
      callback29 = (input: NodeSelection) => {
        let value59 = callback27(input);
        if (value59 === null || !imageCropController.begin(input)) {
          return false;
        }
        (0, runtime.blurCropEditingTarget)();
        value30(value59);
        return true;
      },
      value31 = imageCropController.session?.unit,
      [value32, value33] = runtime.reactK_.useState(0);
    runtime.reactK_.useLayoutEffect(() => {
      let value59 = value31 ? callback27(value31) : null;
      value30(
        (input) =>
          value59 === null ||
          (input !== null &&
            input.x === value59.x &&
            input.y === value59.y &&
            input.w === value59.w &&
            input.h === value59.h)
            ? value31
              ? input
              : null
            : value59,
      );
    }, [
      imageCropController.slide,
      value31,
      callback27,
      value.x,
      value.y,
      value32,
    ]);
    runtime.reactK_.useEffect(() => {
      let value59 = value31
          ? frameElementsRef.current.get(value31.frameId)
          : undefined,
        value60 = value59?.querySelector(
          '[data-img-path="' +
            (value31 ? (0, runtime.selectionNodePath)(value31).join(".") : "") +
            '"]',
        );
      if (!value59 || !value60 || typeof ResizeObserver === "undefined") {
        return;
      }
      let callback77 = () =>
          value33((input) => input + 1),
        observer = new ResizeObserver(callback77);
      observer.observe(value59);
      observer.observe(value60);
      let current = slideSurfaceRef.current,
        fonts2 = value59.ownerDocument.fonts;
      current?.addEventListener("load", callback77, true);
      fonts2?.addEventListener("loadingdone", callback77);
      return () => {
        observer.disconnect();
        current?.removeEventListener("load", callback77, true);
        fonts2?.removeEventListener("loadingdone", callback77);
      };
    }, [value31]);
    let callback30 = runtime.reactK_.useCallback(
        (input: string, options: NodePath) =>
          callback27((0, runtime.createNodeSelection)(input, options)),
        [callback27, measurementGeneration],
      ),
      ref49 = runtime.reactK_.useRef<(session: CanvasDragSession) => void>(() => {}),
      ref50 = runtime.reactK_.useRef<(session: CanvasDragSession) => void>(() => {}),
      ref51 = runtime.reactK_.useRef<Slide | null>(null),
      callback31 = runtime.reactK_.useCallback(
        (input: Slide) => {
          ref51.current = input;
          onLiveChange(input);
        },
        [onLiveChange],
      );
    runtime.reactK_.useEffect(() => {
      let callback77 = (input: CanvasMoveDrag, options: Slide) =>
          [
            input.frameId,
            ...input.extras.map((input2) => input2.frameId),
          ].reduce(
            (input2, options2) =>
              input.autoW.has(options2)
                ? (0, runtime.updateSlideFrame)(
                    input2,
                    options2,
                    (input3) =>
                      removeFrameAxisSizes(input3, ["x"]),
                  )
                : input2,
            options,
          ),
        callback78 = (
          input: CanvasMoveDrag,
          options: number,
          context: number,
        ): FlowDropCandidate | null => {
          let value59: Element | null = null;
          for (let value71 of frameElementsRef.current.values())
            if ((value59 = value71.isConnected ? value71.offsetParent : null)) {
              break;
            }
          if (!value59 || !(input.k > 0)) {
            return null;
          }
          let bounds = value59.getBoundingClientRect(),
            callback88 = (input2: EditorScreenRect) => ({
              x: (input2.left - bounds.left) / input.k,
              y: (input2.top - bounds.top) / input.k,
              w: input2.width / input.k,
              h: input2.height / input.k,
            }),
            value60 = (options - bounds.left) / input.k,
            value61 = (context - bounds.top) / input.k,
            callback89 = (input2: SlideRect) =>
              value60 >= input2.x &&
              value60 <= input2.x + input2.w &&
              value61 >= input2.y &&
              value61 <= input2.y + input2.h,
            value62 = callback77(
              input,
              input.last?.slide ?? input.applyBase,
            ),
            items = [
              input.frameId,
              ...input.extras.map(
                (input2) => input2.frameId,
              ),
            ];
          if (
            items.some(
              (input2) =>
                (0, runtime.isEmptyGroupBase)(
                  (0, runtime.frameById)(value62, input2)?.node ?? {
                    kind: "spacer",
                  },
                ),
            )
          ) {
            return null;
          }
          let value63 = (0, runtime.slidePrimaryLayoutFrame)(
              value62,
            )?.id,
            value64 = items.map((input2) => {
              let value71 = frameElementsRef.current
                .get(input2)
                ?.getBoundingClientRect();
              if (value71 && value71.width > 0) {
                return {
                  w: value71.width / input.k,
                  h: value71.height / input.k,
                };
              }
              if (input2 === input.frameId) {
                return {
                  w: input.startRect.w,
                  h: input.startRect.h,
                };
              } else {
                return {
                  w: 0,
                  h: 0,
                };
              }
            }),
            value65 =
              items.length === 1
                ? (0, runtime.frameById)(value62, input.frameId)
                : undefined,
            callback90 = (
              input2: FlowInsertionTarget | undefined,
              options2: boolean,
            ): FlowDropCandidate | "stale" | null => {
              for (
                let value71 = value62.frames.length - 1;
                value71 >= 0;
                value71--
              ) {
                let value72 = value62.frames[value71]!,
                  entry = frameElementsRef.current.get(value72.id);
                if (
                  !entry ||
                  items.includes(value72.id) ||
                  !(0, runtime.isFlowContainer)(value72.node) ||
                  (0, runtime.isEmptyBackgroundFrame)(value72) ||
                  (0, runtime.nodeTransform)(value72.node)
                ) {
                  continue;
                }
                let callback91 = (input3: NodePath) =>
                    entry.querySelector<HTMLElement>(
                      '[data-node-path="' + input3.join(".") + '"]',
                    ),
                  callback92 = (input3: NodePath) => {
                    let value73 = callback91(input3);
                    if (value73) {
                      return callback88(value73.getBoundingClientRect());
                    } else {
                      return null;
                    }
                  },
                  items2: FlowDropLevel[] = [],
                  items3: NodePath = [],
                  items4: NodePath = [],
                  node: SlideNode = value72.node;
                for (;;) {
                  let value73 = callback92(items4);
                  if (
                    !value73 ||
                    !(0, runtime.isFlowContainer)(node) ||
                    (0, runtime.nodeTransform)(node) ||
                    !callback89(value73)
                  ) {
                    break;
                  }
                  let value74 =
                      input2 &&
                      input2.frameId === value72.id &&
                      (0, runtime.nodePathsEqual)(input2.path, items3)
                        ? input2.index
                        : -1,
                    callback93 = (input3: number) => [
                      ...items4,
                      value74 >= 0 && input3 >= value74 ? input3 + 1 : input3,
                    ];
                  items2.push({
                    path: items3,
                    dom: items4,
                    node: node,
                    rect: value73,
                    gapAt: value74,
                  });
                  let value75 = node.children.findIndex(
                    (input3, options3) => {
                      if (
                        !(0, runtime.isFlowContainer)(input3) ||
                        (0, runtime.nodeTransform)(input3)
                      ) {
                        return false;
                      }
                      let value76 = callback92(callback93(options3));
                      return value76 !== null && callback89(value76);
                    },
                  );
                  if (value75 < 0) {
                    break;
                  }
                  items3 = [...items3, value75];
                  items4 = callback93(value75);
                  node = node.children[value75]!;
                }
                for (
                  let value73 = items2.length - 1;
                  value73 >= 0;
                  value73--
                ) {
                  let {
                      path: value74,
                      dom: value75,
                      node: value76,
                      rect: value77,
                      gapAt: value78,
                    } = items2[value73]!,
                    origin = input.origin,
                    value79 =
                      origin !== null &&
                      origin.frameId === value72.id &&
                      value74.length <= origin.path.length &&
                      value74.every(
                        (input3: number, options3: number) =>
                          input3 === origin.path[options3],
                      );
                  if (
                    value72.id === value63 &&
                    value74.length === 0 &&
                    !(
                      value79 &&
                      (0, runtime.styleHasVisiblePaint)(value76.style)
                    )
                  ) {
                    continue;
                  }
                  let value80 =
                    (origin !== null &&
                    origin.frameId === value72.id &&
                    value74.length === origin.path.length + 1 &&
                    origin.path.every(
                      (input3: number, options3: number) =>
                        input3 === value74[options3],
                    )
                      ? origin.rests?.[value74[value74.length - 1]!]
                      : undefined) ?? value77;
                  if (
                    !shouldExtractOversizedNode(
                      value80,
                      input.startRect,
                      value79,
                    ) ||
                    !value64.every(
                      (input3) =>
                        shouldExtractOversizedNode(
                          value80,
                          {
                            x: 0,
                            y: 0,
                            ...input3,
                          },
                          value79,
                        ),
                    )
                  ) {
                    continue;
                  }
                  let value81 =
                      value76.kind === "stack" ? value76.dir : "grid",
                    entries = new Map(
                      [...input.lifted]
                        .filter(
                          ([, input3]) =>
                            input3.dir === value81,
                        )
                        .map(
                          ([input3, input4]) => [
                            input3,
                            input4.node,
                          ],
                        ),
                    );
                  if (
                    insertFramesIntoFlowContainer(
                      value62,
                      items,
                      {
                        frameId: value72.id,
                        path: value74,
                        index: 0,
                      },
                      entries,
                    ) === null
                  ) {
                    continue;
                  }
                  if (input2 && value78 < 0 && !options2) {
                    return "stale";
                  }
                  let value82 = Array.from<unknown, SlideRect | null>(
                    {
                      length: value76.children.length + (value78 >= 0 ? 1 : 0),
                    },
                    (input3, options3) =>
                      callback92([...value75, options3]),
                  );
                  if (
                    value82.some((input3) => input3 === null)
                  ) {
                    continue;
                  }
                  let value83 = value82 as SlideRect[],
                    value84 = findFlowInsertionIndex(
                      value76,
                      value83,
                      value60,
                      value61,
                    ),
                    value85 =
                      value78 >= 0 && value84 > value78 ? value84 - 1 : value84,
                    value86 =
                      origin !== null && origin.frameId === value72.id
                        ? [...origin.pinned]
                        : [],
                    value87 =
                      value76.kind === "stack" && value76.dir === "v",
                    value88 =
                      value76.kind === "grid" || value76.wrap
                        ? Math.max(
                            0,
                            ...value64.map(
                              (input3) => input3.h,
                            ),
                          )
                        : value64.reduce(
                            (input3, options3) =>
                              input3 + (value87 ? options3.h : options3.w),
                            0,
                          ) +
                          value76.gap * (value64.length - 1),
                    value89: CSSStyleDeclaration | undefined,
                    callback93 = () =>
                      (value89 ??= getComputedStyle(
                        callback91(value75) ?? entry,
                      ));
                  if (
                    (value72.x.anchor === "fill" ||
                      value72.x.size !== undefined) &&
                    !value86.includes("x") &&
                    value76.kind === "stack" &&
                    value76.dir === "h" &&
                    !value76.wrap &&
                    !flowInsertionTargetMatches(
                      origin,
                      value72.id,
                      value74,
                      items,
                      entries,
                    ) &&
                    !(value78 >= 0 && !options2)
                  ) {
                    let value91 = callback93(),
                      value92 =
                        value77.w -
                        parseFloat(value91.paddingLeft) -
                        parseFloat(value91.paddingRight) -
                        parseFloat(value91.borderLeftWidth) -
                        parseFloat(value91.borderRightWidth),
                      value93 = value64.every(
                        (input3) => input3.w > 0,
                      )
                        ? value88
                        : 1 / 0;
                    if (
                      !canFitHorizontalFlowInsertion(
                        value76,
                        value92,
                        pairFlowRectsWithRemainingNodes(
                          value83,
                          value76.children,
                          value78,
                        ),
                        value93,
                      )
                    ) {
                      continue;
                    }
                  }
                  if (
                    value72.y.anchor !== "fill" &&
                    value72.y.size !== undefined &&
                    !value86.includes("y")
                  ) {
                    if (value78 >= 0) {
                      if (input2!.release?.includes("y")) {
                        value86.push("y");
                      }
                    } else {
                      let value91 = callback93(),
                        value92 =
                          value77.h -
                          parseFloat(value91.paddingTop) -
                          parseFloat(value91.paddingBottom) -
                          parseFloat(value91.borderTopWidth) -
                          parseFloat(value91.borderBottomWidth),
                        value93 = value83.filter(
                          (input3, options3) =>
                            value76.children[options3]?.kind !== "spacer",
                        );
                      if (
                        (value87
                          ? value93.reduce(
                              (input3, options3) =>
                                input3 + options3.h,
                              0,
                            ) +
                            value76.gap * value93.length +
                            value88
                          : Math.max(
                              0,
                              ...value64.map(
                                (input3) => input3.h,
                              ),
                            )) >
                        value92 + 1
                      ) {
                        value86.push("y");
                      }
                    }
                  }
                  let state2: FlowInsertionTarget = {
                      frameId: value72.id,
                      path: value74,
                      index: value85,
                      ...(value86.length > 0
                        ? {
                            release: value86,
                          }
                        : {}),
                    },
                    value90 = value65
                      ? (entries.get(value65.id) ??
                        removeFlowNodePlacement(value65, value76))
                      : undefined;
                  return {
                    target: state2,
                    extent: value88,
                    ...(entries.size > 0
                      ? {
                          originals: entries,
                        }
                      : {}),
                    ...(value90
                      ? {
                          ghost: value90,
                        }
                      : {}),
                  };
                }
              }
              return null;
            },
            value66 = callback79(input, value62),
            value67 = input.preview?.target,
            value68 = callback90(
              value67,
              value67 !== undefined &&
                value66 !== null &&
                ((input2, options2) =>
                  input2.frameId === options2.frameId &&
                  (0, runtime.nodePathsEqual)(input2.path, options2.path) &&
                  input2.index === options2.index &&
                  (input2.release ?? []).join() ===
                    (options2.release ?? []).join())(value67, value66.target),
            );
          if (value68 !== "stale") {
            return value68;
          }
          input.preview = value66
            ? {
                slide: setFlowInsertionSize(
                  value62,
                  value66.target,
                  value66.extent,
                  value66.ghost,
                ),
                target: value66.target,
              }
            : null;
          let value69 = input.preview?.slide ?? null;
          runtime.FrameViewportReactDom.flushSync(
            () => setDragPreviewSlide(value69),
          );
          let value70 = callback90(value66?.target, true);
          if (value70 === "stale") {
            return null;
          } else {
            return value70;
          }
        },
        callback79 = (input: CanvasMoveDrag, options: Slide): FlowDropCandidate | null => {
          let origin = input.origin,
            value59 = origin
              ? (0, runtime.frameById)(options, origin.frameId)
              : undefined,
            value60 =
              value59 && origin
                ? (0, runtime.nodeAtPath)(value59.node, origin.path)
                : undefined;
          if (!origin || !value60 || !(0, runtime.isFlowContainer)(value60)) {
            return null;
          }
          let value61 =
              value60.kind === "stack" && value60.dir === "h" && !value60.wrap
                ? input.startRect.w
                : input.startRect.h,
            value62 =
              input.extras.length === 0
                ? input.lifted.get(input.frameId)?.node
                : undefined;
          return {
            target: {
              frameId: origin.frameId,
              path: origin.path,
              index: origin.index,
              ...(origin.pinned.length > 0
                ? {
                    release: [...origin.pinned],
                  }
                : {}),
            },
            extent: value61,
            ...(value62
              ? {
                  ghost: value62,
                }
              : {}),
          };
        },
        callback80 = (
          input: CanvasMoveDrag,
          options: Slide,
          context?: FlowDropWidthOverride,
        ): { slide: Slide; into?: Frame } => {
          let value59 = options,
            value60: Frame | undefined;
          for (let value61 of input.sheds) {
            if (
              input.drop !== null &&
              input.drop.frameId === value61.frameId &&
              input.drop.path.length === 0
            ) {
              continue;
            }
            let value62 = (0, runtime.frameById)(
              value59,
              value61.frameId,
            );
            if (!value62 || !(0, runtime.isFlowContainer)(value62.node)) {
              continue;
            }
            let value63 = createFlowChildIndexRemapper(
                value61,
                value62.node.children,
              ),
              callback88 = (input2: number) => {
                let value65 =
                  value63(input2) ??
                  callback39(value61.frameId, [input2], input.k);
                if (
                  value65 &&
                  context &&
                  context.frameId === value61.frameId &&
                  context.index === input2
                ) {
                  return {
                    ...value65,
                    w: context.w,
                  };
                } else {
                  return value65;
                }
              },
              value64 = collapseSingleChildFlowFrame(
                value59,
                value61.frameId,
                callback88,
              );
            value59 = value64.slide;
            if (
              value64.minted &&
              input.drop !== null &&
              input.drop.frameId === value61.frameId &&
              input.drop.path[0] === value64.from
            ) {
              value60 = value64.minted;
            }
          }
          return {
            slide: value59,
            ...(value60
              ? {
                  into: value60,
                }
              : {}),
          };
        },
        callback81 = (
          input: CanvasMoveDrag,
          options?: FlowDropCandidate | null,
          context = false,
        ) => {
          let last = input.last;
          if (last === null) {
            return;
          }
          input.drop = options?.target ?? null;
          input.restore = options?.originals ?? null;
          let value59 =
            options ?? (context ? null : callback79(input, last.slide));
          input.preview =
            value59 && (value59.ghost !== undefined || value59.extent > 0)
              ? {
                  slide: setFlowInsertionSize(
                    last.slide,
                    value59.target,
                    value59.extent,
                    value59.ghost,
                  ),
                  target: value59.target,
                }
              : null;
          let value60 = input.preview?.slide ?? null;
          runtime.FrameViewportReactDom.flushSync(() => {
            callback31(last.slide);
            setDragPreviewSlide(value60);
          });
        },
        callback82 = (
          source: CanvasDragSession,
          options: boolean,
        ) => {
          (0, runtime.clearGestureCursor)();
          clearTouchLiftRef.current();
          if (dragLiveRef) {
            dragLiveRef.current = false;
          }
          setRotationPreviewAngle(null);
          setEndpointSnapPoint(null);
          if (source.moved) {
            refreshMeasurements((input) => input + 1);
          }
          if (!source.moved) {
            if (
              (source.kind === "move" || source.kind === "layer-move") &&
              !options &&
              source.clickSelect !== null
            ) {
              onSelectionChange(source.clickSelect);
            }
            if (
              (source.kind === "move" || source.kind === "layer-move") &&
              !options
            ) {
              togglePendingFrame();
            }
            pendingToggleFrameRef.current = null;
            return;
          }
          pendingToggleFrameRef.current = null;
          if (source.kind === "layer-move") {
            if (!options) {
              let value59 =
                  source.layerRect.x + source.lastDx + source.layerRect.w / 2,
                value60 =
                  source.layerRect.y + source.lastDy + source.layerRect.h / 2,
                state2 = {
                  x: source.layerRect.x + source.lastDx,
                  y: source.layerRect.y + source.lastDy,
                  w: source.layerRect.w,
                  h: source.layerRect.h,
                },
                entry = frameElementsRef.current.get(source.frameId),
                value61 = entry?.offsetParent,
                value62 = entry?.querySelector<HTMLElement>(
                  '[data-overlay-layer="' +
                    String(source.layerIndex + 1) +
                    '"]',
                ),
                scale3 = ref8.current.scale;
              if (value61 && value62 && scale3 > 0) {
                let bounds = value61.getBoundingClientRect(),
                  bounds2 = value62.getBoundingClientRect();
                state2 = {
                  x: (bounds2.left - bounds.left) / scale3,
                  y: (bounds2.top - bounds.top) / scale3,
                  w: bounds2.width / scale3,
                  h: bounds2.height / scale3,
                };
              }
              let wrapperRect = source.wrapperRect;
              if (
                !(
                  value59 >= wrapperRect.x &&
                  value59 <= wrapperRect.x + wrapperRect.w &&
                  value60 >= wrapperRect.y &&
                  value60 <= wrapperRect.y + wrapperRect.h
                ) &&
                source.memberSizes === undefined
              ) {
                let current = slideRef.current,
                  value63 = (0, runtime.frameById)(
                    current,
                    source.frameId,
                  );
                if (current.frames.length >= runtime.maxSlideFrames) {
                  (0, runtime.showToast)(
                    "This slide is full — remove a frame first.",
                  );
                } else if (
                  value63 &&
                  (0, runtime.isOverlayNode)(value63.node)
                ) {
                  let value64 = value63.node.layers[source.layerIndex];
                  if (value64) {
                    let value65 = (0,
                      runtime.normalizeNegativeFrameMargins)(
                        createFreeFrameFromNode(value64.node, state2),
                        state2,
                      ),
                      state3 = {
                        ...current,
                        frames: current.frames
                          .map(
                            (input) =>
                              input.id === source.frameId &&
                              (0, runtime.isOverlayNode)(input.node)
                                ? {
                                    ...input,
                                    node: (0, runtime.removeOverlayLayer)(
                                      input.node,
                                      source.layerIndex,
                                    ),
                                  }
                                : input,
                          )
                          .concat([value65]),
                      },
                      callback88 = (input: NodeSelection) =>
                        memo.rect(
                          input.child !== undefined &&
                            input.child > source.layerIndex
                            ? (0, runtime.createNodeSelection)(input.frameId, [
                                input.child + 1,
                              ])
                            : input,
                        );
                    callback31(
                      (0, runtime.rewriteNestedOverlayPlacements)(
                        state3,
                        new Set([source.frameId]),
                        {
                          ...memo,
                          rect: callback88,
                        },
                      ),
                    );
                    onSelectionChange([
                      {
                        frameId: value65.id,
                      },
                    ]);
                  }
                }
              }
            }
            onGestureEnd(source.before);
            return;
          }
          if (
            !options &&
            source.kind === "move" &&
            source.last !== null &&
            source.drop !== null
          ) {
            let drop = source.drop,
              value59 = (0, runtime.frameById)(
                source.last.slide,
                drop.frameId,
              ),
              value60 = value59
                ? (0, runtime.nodeAtPath)(value59.node, drop.path)
                : undefined,
              callback88 = (input: string): [number, number] => {
                let value63 = frameElementsRef.current
                  .get(input)
                  ?.getBoundingClientRect();
                if (!value63) {
                  return [0, 0];
                }
                if (value60?.kind === "grid") {
                  return [value63.top, value63.left];
                }
                if (value60?.kind === "stack" && value60.dir === "v") {
                  return [value63.top, 0];
                } else {
                  return [value63.left, 0];
                }
              },
              value61 = [
                source.frameId,
                ...source.extras.map(
                  (input: DragExtraFrame) => input.frameId,
                ),
              ].sort((input, options2) => {
                let [value63, value64] = callback88(input),
                  [value65, value66] = callback88(options2);
                return value63 - value65 || value64 - value66;
              }),
              value62 = insertFramesIntoFlowContainer(
                callback77(source, source.last.slide),
                value61,
                drop,
                source.restore ?? undefined,
              );
            if (value62) {
              let origin = source.origin,
                value63 = source.sheds.find(
                  (input: FlowShed) =>
                    input.frameId === drop.frameId && drop.path.length > 0,
                ),
                value64 =
                  value63 &&
                  origin &&
                  !(
                    origin.frameId === drop.frameId &&
                    (0, runtime.nodePathsEqual)(origin.path, drop.path)
                  )
                    ? callback79(source, value62)
                    : null,
                value65: FlowDropWidthOverride | undefined;
              if (value63 && value64) {
                runtime.FrameViewportReactDom.flushSync(() => {
                  setDragPreviewSlide(
                    setFlowInsertionSize(
                      value62,
                      value64.target,
                      value64.extent,
                      value64.ghost,
                    ),
                  );
                  callback31(value62);
                });
                let value76 = drop.path[0]!,
                  value77 =
                    origin!.frameId === value63.frameId &&
                    origin!.path.length === 0 &&
                    value64.target.index <= value76
                      ? value76 + 1
                      : value76,
                  value78 = callback39(
                    value63.frameId,
                    [value77],
                    source.k,
                  );
                if (value78) {
                  value65 = {
                    frameId: value63.frameId,
                    index: value76,
                    w: value78.w,
                  };
                }
              }
              runtime.FrameViewportReactDom.flushSync(() => {
                setDragPreviewSlide(null);
                callback31(value62);
              });
              let value66 = value62,
                value67 = frameElementsRef.current
                  .get(drop.frameId)
                  ?.querySelector('[data-node-path=""]');
              if (value67 && value67.scrollHeight > value67.clientHeight + 1) {
                value66 = (0, runtime.updateSlideFrame)(
                  value66,
                  drop.frameId,
                  (input) =>
                    removeFrameAxisSizes(input, ["y"]),
                );
              }
              let value68 = callback80(source, value66, value65);
              value66 = value68.slide;
              let value69 = value68.into
                  ? {
                      id: value68.into.id,
                      path: drop.path.slice(1),
                    }
                  : {
                      id: drop.frameId,
                      path: drop.path,
                    },
                value70: NodePath[] = value61.map(
                  (input, options2) => [
                    ...value69.path,
                    drop.index + options2,
                  ],
                ),
                value71 = (0, runtime.frameById)(value66, value69.id),
                value72 = (0, runtime.rewriteNestedOverlayPlacements)(
                  value66,
                  findChangedFrameIds(source.before, value66),
                  memo,
                ),
                value73 = (0, runtime.frameById)(value72, value69.id),
                value74 = value70.map(
                  (input: NodePath) =>
                    value71 && value73
                      ? findSurvivingNodePath(value71.node, value73.node, input)
                      : undefined,
                );
              if (
                value74.every((input): input is NodePath => input !== undefined)
              ) {
                value66 = value72;
                value70 = value74;
              }
              if (value66 !== value62) {
                callback31(value66);
              }
              let value75 = value61.map(
                (input, options2) => ({
                  id: input,
                  unit: (0, runtime.createNodeSelection)(
                    value69.id,
                    value70[options2]!,
                  ),
                }),
              );
              onSelectionChange(
                [
                  ...value75.filter(
                    (input) => input.id !== source.frameId,
                  ),
                  ...value75.filter(
                    (input) => input.id === source.frameId,
                  ),
                ].map((input) => input.unit),
              );
            } else {
              runtime.FrameViewportReactDom.flushSync(
                () => setDragPreviewSlide(null),
              );
              (0, runtime.showToast)(
                "That group can’t take it (full, or nested too deep) — it stays where you dropped it.",
              );
              let slide2 = callback80(source, source.last.slide).slide;
              if (slide2 !== source.last.slide) {
                callback31(slide2);
              }
            }
            onGestureEnd(source.before);
            return;
          }
          if (source.kind === "move" && source.preview !== null) {
            runtime.FrameViewportReactDom.flushSync(
              () => setDragPreviewSlide(null),
            );
          }
          if (!options && source.kind === "move" && source.last !== null) {
            let slide2 = source.last.slide,
              value59 = (0, runtime.applyFrameSnapAnchors)(
                source.last.frame,
                source.lastSnaps,
              );
            if (value59 !== source.last.frame) {
              let value60 = (0, runtime.preserveImplicitAxisSize)(
                source.xSpec,
                value59.x,
                source.autoW.get(source.frameId),
                runtime.SLIDE_WIDTH,
              );
              value59 = {
                ...value59,
                x: value60,
              };
              slide2 = (0, runtime.updateSlideFrame)(
                source.last.slide,
                source.frameId,
                () => value59,
              );
            }
            slide2 = callback80(source, slide2).slide;
            slide2 = (0, runtime.rewriteNestedOverlayPlacements)(
              slide2,
              findChangedFrameIds(source.before, slide2),
              memo,
            );
            if (slide2 !== source.last.slide) {
              callback31(slide2);
            }
          }
          if (
            options &&
            source.kind === "move" &&
            source.moved &&
            slideRef.current.id === source.before.id
          ) {
            let current = slideRef.current,
              value59 =
                source.sheds.length > 0
                  ? callback80(
                      {
                        ...source,
                        drop: null,
                      },
                      current,
                    ).slide
                  : current,
              value60 = (0, runtime.rewriteNestedOverlayPlacements)(
                value59,
                findChangedFrameIds(source.before, value59),
                memo,
              );
            if (value60 !== current) {
              callback31(value60);
            }
          }
          onGestureEnd(source.before);
        };
      ref49.current = (input: CanvasDragSession) => {
        setSnapGuides([]);
        callback82(input, true);
      };
      ref50.current = (input: CanvasDragSession) => {
        clearTouchLiftRef.current();
        if (dragLiveRef) {
          dragLiveRef.current = false;
        }
        setSnapGuides([]);
        setDragPreviewSlide(null);
        (0, runtime.clearGestureCursor)();
        setRotationPreviewAngle(null);
        setEndpointSnapPoint(null);
        callback31(input.before);
        onGestureEnd(input.before);
        let value59 = (0, runtime.filterValidSelections)(
          input.before,
          selectionRef.current,
        );
        if (value59.length !== selectionRef.current.length) {
          onSelectionChange(value59);
        }
      };
      let callback83 = (input: CanvasTouchPress) => {
          let current = slideRef.current,
            value59 = (0, runtime.frameById)(current, input.frameId);
          if (!value59) {
            return;
          }
          let target = input.press.target as Element | null,
            value60 = (0, runtime.resolvePaintedSelection)(
              input.frameId,
              value59.node,
              parseEditorNodePath(
                target
                  ?.closest?.("[data-node-path]")
                  ?.getAttribute("data-node-path"),
              ),
            ),
            current2 = selectionRef.current;
          if (
            !readOnlyRef.current &&
            value60 !== null &&
            current2.length === 1 &&
            (0, runtime.selectionContainsNode)(current2, value60)
          ) {
            let value61 = (0, runtime.selectedNode)(current, value60),
              value62 = target?.closest?.("[data-cell]") ?? null;
            if ((0, runtime.isTableNode)(value61) && value62 !== null) {
              let [value63, value64] = (
                  value62.getAttribute("data-cell") ?? ""
                ).split("."),
                value65 = Number(value63),
                value66 = Number(value64);
              if ((0, runtime.tableCellExists)(value61, value65, value66)) {
                onTextEdit({
                  frameId: value60.frameId,
                  path: (0, runtime.selectionNodePath)(value60),
                  cell: {
                    r: value65,
                    c: value66,
                  },
                });
                return;
              }
            }
            if ((0, runtime.isEditableTextNode)(value61)) {
              onTextEdit({
                frameId: value60.frameId,
                path: (0, runtime.selectionNodePath)(value60),
              });
              return;
            }
          }
          beginFrameDragRef.current(input.frameId, input.press);
          let current3 = dragSessionRef.current;
          if (current3 !== null && current3.pointerId === input.pointerId) {
            dragSessionRef.current = null;
            callback82(current3, false);
          }
        },
        callback84 = (
          input: CanvasEndpointDrag,
          options: number,
          context: number,
          value59: boolean,
          extra: boolean,
        ) => {
          let value60 = (0, runtime.snapLineEndpoint)(
            [
              input.fixed[0] + input.origin[0],
              input.fixed[1] + input.origin[1],
            ],
            [input.start[0] + options, input.start[1] + context],
            value59 ? [] : input.sites,
            8 / input.k,
            extra,
          );
          setEndpointSnapPoint(
            value60.site
              ? {
                  x: value60.site.x,
                  y: value60.site.y,
                }
              : null,
          );
          let value61 =
              input.bar !== null
                ? 0
                : (0, runtime.connectorArrowInset)(input.strokeWidth),
            callback88 = (input2: number) =>
              input.bar !== null ? input2 : Math.round(input2),
            items: ConnectorPoint = [
              Math.max(value61, callback88(value60.point[0] - input.origin[0])),
              Math.max(value61, callback88(value60.point[1] - input.origin[1])),
            ];
          if (input.bar !== null) {
            callback31(
              (0, runtime.updatePinnedNodeRect)(
                input.before,
                input.frameId,
                input.path,
                (0, runtime.lineShapeFromEndpoints)(
                  input.fixed,
                  items,
                  input.bar.thickness,
                  input.which,
                ),
                input.bar.span,
              ),
            );
          } else {
            let value62 =
              input.which === 0
                ? (0, runtime.connectorBoundsFromEndpoints)(
                    items,
                    input.fixed,
                    input.strokeWidth,
                  )
                : (0, runtime.connectorBoundsFromEndpoints)(
                    input.fixed,
                    items,
                    input.strokeWidth,
                  );
            callback31(
              (0, runtime.pinNodeToRect)(
                input.before,
                input.frameId,
                input.path,
                value62,
              ),
            );
          }
          refreshMeasurements((input2) => input2 + 1);
        },
        callback85 = (input: PointerEvent) => {
          let current = touchPressRef.current;
          if (
            current !== null &&
            current.pointerId === input.pointerId &&
            input.isTrusted
          ) {
            let value69 = (0, runtime.reduceTouchLongPress)(
              current,
              {
                kind: "move",
                clientX: input.clientX,
                clientY: input.clientY,
              },
              pointerDragThreshold("touch"),
            );
            touchPressRef.current = value69.press;
            if (value69.outcome === "pan" || value69.outcome === "drag") {
              plainPressRef.current = false;
            }
            if (value69.outcome === "drag" && !readOnlyRef.current) {
              releasePointerRef.current(current.pointerId);
              beginFrameDragRef.current(current.frameId, current.press);
            }
            if (value69.outcome === "pan" || value69.outcome === "drag") {
              callback50();
            }
          }
          let current2 = dragSessionRef.current;
          if (!current2 || input.pointerId !== current2.pointerId) {
            return;
          }
          if (input.buttons === 0) {
            dragSessionRef.current = null;
            setSnapGuides([]);
            callback82(current2, true);
            return;
          }
          let scale3 = ref8.current.scale;
          if (scale3 !== current2.k && scale3 > 0) {
            current2.startX = preservePinchAnchorCoordinate(
              current2.startX,
              input.clientX,
              current2.k,
              scale3,
            );
            current2.startY = preservePinchAnchorCoordinate(
              current2.startY,
              input.clientY,
              current2.k,
              scale3,
            );
            current2.k = scale3;
          }
          let value59 = (input.clientX - current2.startX) / current2.k,
            value60 = (input.clientY - current2.startY) / current2.k,
            value61 =
              current2.kind === "move" || current2.kind === "layer-move"
                ? current2.slop
                : undefined,
            value62 = input.clientX - current2.downX,
            value63 = input.clientY - current2.downY;
          if (
            !current2.moved &&
            (value61 !== undefined
              ? Math.hypot(value62, value63) <= value61
              : Math.abs(value62) + Math.abs(value63) <
                pointerDragThreshold(current2.type))
          ) {
            return;
          }
          let value64 = !current2.moved;
          current2.moved = true;
          plainPressRef.current = false;
          if (dragLiveRef) {
            dragLiveRef.current = true;
          }
          if (current2.kind === "rotate") {
            let value69 = frameElementsRef.current.get(
              current2.frameId,
            )?.offsetParent;
            if (!value69) {
              return;
            }
            let bounds = value69.getBoundingClientRect(),
              value70 = (0, runtime.angleBetweenPoints)(
                bounds.left + current2.cx * current2.k,
                bounds.top + current2.cy * current2.k,
                input.clientX,
                input.clientY,
              ),
              value71 = (0, runtime.snapRotation)(
                current2.startDeg,
                value70 - current2.startBearing,
                input.shiftKey,
              );
            if (value71 === current2.lastDeg) {
              return;
            }
            current2.lastDeg = value71;
            callback31(
              (0, runtime.updateSelectedNode)(
                current2.before,
                (0, runtime.createNodeSelection)(
                  current2.frameId,
                  current2.path,
                ),
                (input2) =>
                  (0, runtime.setNodeRotation)(input2, value71),
              ),
            );
            setRotationPreviewAngle(value71);
            if (current2.type !== "touch") {
              (0, runtime.setGestureCursor)(
                (0, runtime.rotatedGrabCursor)(
                  current2.corner,
                  (value71 * Math.PI) / 180,
                ),
              );
            }
            refreshMeasurements((input2) => input2 + 1);
            return;
          }
          if (current2.kind === "endpoint") {
            current2.last = {
              dx: value59,
              dy: value60,
            };
            callback84(
              current2,
              value59,
              value60,
              input.metaKey || input.ctrlKey,
              input.shiftKey,
            );
            return;
          }
          if (current2.kind === "layer-move") {
            if (current2.type === "touch") {
              applyTouchLiftRef.current(current2);
            }
            current2.lastDx = value59;
            current2.lastDy = value60;
            let memberSizes = current2.memberSizes;
            callback31(
              (0, runtime.updateSlideFrame)(
                current2.before,
                current2.frameId,
                (input2) => {
                  let value69 =
                    memberSizes !== undefined
                      ? (0, runtime.moveLeadingGroupLayer)(
                          input2,
                          current2.layerIndex,
                          value59,
                          value60,
                          memberSizes,
                        )
                      : undefined;
                  if (value69 !== undefined) {
                    return value69;
                  }
                  if (!(0, runtime.isOverlayNode)(input2.node)) {
                    return input2;
                  }
                  let value70 =
                    input2.node.layers[current2.layerIndex];
                  if (!value70) {
                    return input2;
                  }
                  let items = [...input2.node.layers];
                  items[current2.layerIndex] = {
                    ...value70,
                    x: (0, runtime.moveAxisSpecPreservingSize)(
                      current2.xSpec,
                      value59,
                      current2.autoW,
                      current2.roomW,
                    ),
                    y: (0, runtime.moveAxisSpec)(current2.ySpec, value60),
                  };
                  return {
                    ...input2,
                    node: {
                      ...input2.node,
                      layers: items,
                    },
                  };
                },
              ),
            );
            return;
          }
          if (
            current2.kind === "move" &&
            value64 &&
            current2.pendingBreakouts.length > 0
          ) {
            let pendingBreakouts = current2.pendingBreakouts;
            current2.pendingBreakouts = [];
            let applyBase2 = current2.applyBase,
              flag = false;
            for (let value69 of pendingBreakouts) {
              let value70 = extractFlowDragSelection(
                applyBase2,
                value69,
              );
              if (!value70) {
                continue;
              }
              if (value70.slide.frames.length > runtime.maxSlideFrames) {
                (0, runtime.showToast)(
                  "This slide is full — remove a frame first.",
                );
                continue;
              }
              let { newFrames: value71, drag: value72 } = value70,
                value73 = (0, runtime.frameById)(
                  applyBase2,
                  value69.frameId,
                );
              applyBase2 = value70.slide;
              flag = true;
              if (value73) {
                let callback88 = (
                  input2: string,
                  options: NodePath,
                  context: SlideNode,
                ) => {
                  let value74 = (0, runtime.nodeAtPath)(
                      value73.node,
                      options,
                    ),
                    value75 = (0, runtime.nodeAtPath)(
                      value73.node,
                      options.slice(0, -1),
                    );
                  if (
                    !value74 ||
                    !value75 ||
                    !(0, runtime.isFlowContainer)(value75)
                  ) {
                    return;
                  }
                  let value76 = !value70.plucked.some(
                    (input3) =>
                      isStrictPathAncestor(options, input3.path),
                  )
                    ? value74
                    : value74.place !== undefined
                      ? {
                          ...context,
                          place: value74.place,
                        }
                      : context;
                  current2.lifted.set(input2, {
                    node: value76,
                    dir: value75.kind === "stack" ? value75.dir : "grid",
                  });
                };
                for (let value74 of value70.plucked)
                  callback88(
                    value74.frame.id,
                    value74.path,
                    value74.frame.node,
                  );
                value71.forEach(
                  (input2, options) =>
                    input2 && callback88(input2.id, [options], input2.node),
                );
              }
              for (let value74 of value70.plucked) {
                if (value74.frame === value72) {
                  continue;
                }
                current2.extras.push({
                  frameId: value74.frame.id,
                  xSpec: value74.frame.x,
                  ySpec: value74.frame.y,
                });
              }
              for (let value74 of value69.selectedChildren) {
                if (value74 === value69.dragIndex) {
                  continue;
                }
                let value75 = value71[value74];
                if (value75) {
                  current2.extras.push({
                    frameId: value75.id,
                    xSpec: value75.x,
                    ySpec: value75.y,
                  });
                }
              }
              if (value72) {
                current2.frameId = value72.id;
                current2.baseFrame = value72;
                current2.xSpec = value72.x;
                current2.ySpec = value72.y;
                let value74 = value70.plucked.find(
                    (input2) => input2.frame === value72,
                  )?.path ??
                    value69.dragPath ?? [value69.dragIndex!],
                  value75 =
                    value69.deep.find(
                      (input2) =>
                        (0, runtime.nodePathsEqual)(input2.path, value74),
                    ) ??
                    (value74.length === 1
                      ? value69.children[value74[0]!]
                      : undefined);
                if (value75) {
                  current2.startRect = value75.rect;
                }
                let value76 = value71[value74[0]!],
                  value77 = (["x", "y"] as const).filter(
                    (input2) =>
                      value73 &&
                      (0, runtime.styleHasVisiblePaint)(value73.node.style) &&
                      value73[input2].anchor !== "fill" &&
                      value73[input2].size === undefined,
                  ),
                  value78 = value69.keep
                    ? (0, runtime.frameById)(applyBase2, value69.frameId)
                    : undefined,
                  value79 =
                    value73 && value74.length > 1
                      ? (0, runtime.nodeAtPath)(value73.node, [value74[0]!])
                      : undefined,
                  callback88 = (input2: NodePath[]) =>
                    input2
                      .filter(
                        (input3) => input3[0] === value74[0],
                      )
                      .map((input3) => input3.slice(1)),
                  value80 =
                    value73 && value78
                      ? reparentExtractedFlowNode(
                          value73.node,
                          value78.node,
                          value74,
                          value70.plucked,
                          value70.pruned,
                        )
                      : value79 && value76
                        ? reparentExtractedFlowNode(
                            value79,
                            value76.node,
                            value74.slice(1),
                            callback88(
                              value70.plucked.map(
                                (input2) => input2.path,
                              ),
                            ).map(
                              (input2) => ({
                                path: input2,
                              }),
                            ),
                            callback88(value70.pruned),
                          )
                        : null;
                if (value80) {
                  let value81 = value78 ? [] : [value74[0]!],
                    value82 = (0, runtime.nodeAtPath)(
                      value78 ? value73!.node : value79!,
                      value80.before,
                    ),
                    value83: "h" | "v" | "grid" =
                      value82?.kind === "stack" ? value82.dir : "grid",
                    value84 = value80.stay.map(
                      (input2) =>
                        callback39(
                          value69.frameId,
                          [...value81, ...value80.before, input2],
                          current2.k,
                        ),
                    );
                  current2.origin = {
                    frameId: value78 ? value69.frameId : value76!.id,
                    path: value80.path,
                    index: value80.index,
                    dir: value83,
                    pinned: value78 ? value77 : [],
                    rests: value84,
                    had: value80.had,
                  };
                }
              }
              if (value73) {
                let value74 =
                    (0, runtime.nodeChildren)(value73.node) ?? [],
                  items = [
                    ...value70.plucked.map(
                      (input2) => input2.path,
                    ),
                    ...value70.pruned,
                  ],
                  callback88 = (items2: readonly number[]) =>
                    new Set(
                      items
                        .filter(
                          (items3) =>
                            items3.length === items2.length + 1 &&
                            (0, runtime.nodePathsEqual)(
                              items3.slice(0, -1),
                              items2,
                            ),
                        )
                        .map(
                          (input2) => input2[items2.length]!,
                        ),
                    );
                if (
                  value69.keep &&
                  !(0, runtime.styleHasVisiblePaint)(value73.node.style)
                ) {
                  current2.sheds.push({
                    frameId: value69.frameId,
                    kids: value74,
                    gone: callback88([]),
                    rects: value69.children.map(
                      (input2) => input2.rect,
                    ),
                  });
                }
                for (let value75 of new Set(
                  value70.plucked.map(
                    (input2) => input2.path[0]!,
                  ),
                )) {
                  let value76 = value71[value75],
                    value77 = value74[value75];
                  if (
                    !value76 ||
                    !value77 ||
                    !(0, runtime.isFlowContainer)(value77) ||
                    (0, runtime.styleHasVisiblePaint)(value77.style)
                  ) {
                    continue;
                  }
                  current2.sheds.push({
                    frameId: value76.id,
                    kids: value77.children,
                    gone: callback88([value75]),
                    rects: value77.children.map(
                      (input2, options) =>
                        callback39(
                          value69.frameId,
                          [value75, options],
                          current2.k,
                        ),
                    ),
                  });
                }
              }
              current2.siblingRects = current2.siblingRects.concat(
                getRemainingFlowChildRects(value69),
              );
            }
            if (flag) {
              current2.applyBase = applyBase2;
              current2.candidates = (0, runtime.buildSiblingSnapCandidates)(
                current2.siblingRects,
              );
              let value69 = callback79(current2, applyBase2);
              current2.preview = value69
                ? {
                    slide: setFlowInsertionSize(
                      applyBase2,
                      value69.target,
                      value69.extent,
                      value69.ghost,
                    ),
                    target: value69.target,
                  }
                : null;
              let value70 = current2.preview?.slide ?? null;
              runtime.FrameViewportReactDom.flushSync(() => {
                callback31(applyBase2);
                setDragPreviewSlide(value70);
              });
              onSelectionChange([
                ...current2.extras.map(
                  (input2: DragExtraFrame) => ({
                    frameId: input2.frameId,
                  }),
                ),
                {
                  frameId: current2.frameId,
                },
              ]);
              current2.clickSelect = null;
            }
          }
          if (current2.kind === "flow-resize") {
            let value69 = value59,
              value70 = value60;
            if (current2.rotation !== 0 || current2.nodeScale !== 1) {
              ({ dx: value69, dy: value70 } = (0,
              runtime.screenDeltaToLocalDelta)(
                value59,
                value60,
                current2.rotation,
                current2.nodeScale,
              ));
            }
            let state2 = {
              xEdge: current2.xEdge,
              yEdge: current2.yEdge,
              dx: value69,
              dy: value70,
              w: current2.w,
              h: current2.h,
              mainAxis: current2.mainAxis,
            };
            if (input.shiftKey && current2.xEdge && current2.yEdge) {
              state2 = {
                ...state2,
                ...(0, runtime.aspectRatioResizeDeltas)(
                  state2,
                  Math.min(current2.minW, current2.minH),
                ),
              };
            }
            let value71 = (0, runtime.updateSelectedNode)(
                current2.before,
                (0, runtime.createNodeSelection)(
                  current2.frameId,
                  current2.path,
                ),
                (input2) =>
                  (0, runtime.resizeNodeFromEdges)(
                    input2,
                    state2,
                    current2.minW,
                    current2.minH,
                  ),
              ),
              breakout = current2.breakout;
            if (breakout === null) {
              callback31(value71);
              refreshMeasurements((input2) => input2 + 1);
              return;
            }
            runtime.FrameViewportReactDom.flushSync(
              () => callback31(value71),
            );
            let value72 = callback39(
              current2.frameId,
              current2.path,
              current2.k,
            );
            if (
              value72 === null ||
              flowRectsAligned(
                breakout.rect,
                value72,
                current2.xEdge,
                current2.yEdge,
              )
            ) {
              refreshMeasurements((input2) => input2 + 1);
              return;
            }
            let value73 = extractFlowDragSelection(
              current2.before,
              breakout.record,
            );
            if (
              !value73?.drag ||
              value73.slide.frames.length > runtime.maxSlideFrames
            ) {
              if (value73?.drag) {
                (0, runtime.showToast)(
                  "This slide is full — remove a frame first.",
                );
              }
              current2.breakout = null;
              refreshMeasurements((input2) => input2 + 1);
              return;
            }
            dragSessionRef.current = {
              kind: "resize",
              frameId: value73.drag.id,
              pointerId: current2.pointerId,
              type: current2.type,
              k: current2.k,
              downX: current2.downX,
              downY: current2.downY,
              startX: current2.startX,
              startY: current2.startY,
              before: current2.before,
              applyBase: value73.slide,
              xSpec: value73.drag.x,
              ySpec: value73.drag.y,
              xEdge: current2.xEdge,
              yEdge: current2.yEdge,
              w: breakout.rect.w,
              h: breakout.rect.h,
              rotation: 0,
              nodeScale: 1,
              moved: true,
              startRect: breakout.rect,
              candidates: (0, runtime.buildSiblingSnapCandidates)(
                breakout.siblingRects,
              ),
            };
            onSelectionChange([
              {
                frameId: value73.drag.id,
              },
            ]);
            callback85(input);
            return;
          }
          let applyBase = current2.applyBase,
            value65 =
              (0, runtime.frameById)(applyBase, current2.frameId) ??
              (current2.kind === "move" ? current2.baseFrame : undefined);
          if (!value65) {
            return;
          }
          let value66 = input.metaKey || input.ctrlKey,
            value67 = 8 / current2.k,
            value68: Frame;
          if (current2.kind === "move") {
            if (current2.type === "touch") {
              applyTouchLiftRef.current(current2);
            }
            current2.at = {
              x: input.clientX,
              y: input.clientY,
            };
            let value69 = value66
              ? null
              : callback78(current2, input.clientX, input.clientY);
            if (value66 || value69) {
              current2.lastSnaps = {};
              setSnapGuides([]);
            } else {
              let value71 = (0, runtime.snapMovingRectangle)(
                current2.startRect,
                value59,
                value60,
                current2.candidates,
                value67,
                {
                  x: current2.xSpec.anchor !== "fill",
                  y: current2.ySpec.anchor !== "fill",
                },
              );
              value59 = value71.dx;
              value60 = value71.dy;
              current2.lastSnaps =
                (0, runtime.nodeTransform)(value65.node) === undefined
                  ? value71.snaps
                  : {};
              setSnapGuides(value71.guides);
            }
            value68 = {
              ...value65,
              x: (0, runtime.moveAxisSpecPreservingSize)(
                current2.xSpec,
                value59,
                current2.autoW.get(current2.frameId),
                runtime.SLIDE_WIDTH,
              ),
              y: (0, runtime.moveAxisSpec)(current2.ySpec, value60),
            };
            let value70 = (0, runtime.updateSlideFrame)(
              current2.applyBase,
              current2.frameId,
              () => value68,
            );
            for (let value71 of current2.extras)
              value70 = (0, runtime.updateSlideFrame)(
                value70,
                value71.frameId,
                (input2) => ({
                  ...input2,
                  x: (0, runtime.moveAxisSpecPreservingSize)(
                    value71.xSpec,
                    value59,
                    current2.autoW.get(value71.frameId),
                    runtime.SLIDE_WIDTH,
                  ),
                  y: (0, runtime.moveAxisSpec)(value71.ySpec, value60),
                }),
              );
            current2.last = {
              slide: value70,
              frame: value68,
            };
            callback81(current2, value69, value66);
            if (value64 && current2.altDup) {
              onSelectionChange([
                ...current2.extras.map(
                  (input2: DragExtraFrame) => ({
                    frameId: input2.frameId,
                  }),
                ),
                {
                  frameId: current2.frameId,
                },
              ]);
            }
          } else {
            let value69 =
              current2.rotation === 0 && current2.nodeScale === 1;
            if (!value69) {
              ({ dx: value59, dy: value60 } = (0,
              runtime.screenDeltaToLocalDelta)(
                value59,
                value60,
                current2.rotation,
                current2.nodeScale,
              ));
            }
            let items: SnapCandidate[] = [];
            if (!value66 && value69) {
              let value71 = (0, runtime.snapResizingRectangle)(
                current2.startRect,
                current2.xEdge,
                current2.yEdge,
                value59,
                value60,
                current2.candidates,
                value67,
              );
              value59 = value71.dx;
              value60 = value71.dy;
              items = value71.guides;
            }
            let value70 = runtime.GROUP_RESIZING_ENABLED
              ? (0, runtime.measureOverlayGroupLayout)(value65)
              : undefined;
            if (input.shiftKey && current2.xEdge && current2.yEdge) {
              let value71 = (0, runtime.aspectRatioAxisResizeDeltas)(
                {
                  spec: current2.xSpec,
                  edge: current2.xEdge,
                  delta: value59,
                  currentSize: current2.w,
                  designSize: runtime.SLIDE_WIDTH,
                },
                {
                  spec: current2.ySpec,
                  edge: current2.yEdge,
                  delta: value60,
                  currentSize: current2.h,
                  designSize: runtime.SLIDE_HEIGHT,
                },
                Math.max(
                  value70?.w ?? 0,
                  value70?.h ?? 0,
                  Math.min(
                    (0, runtime.minimumNodeResizeSize)(
                      value65.node,
                      current2.w,
                    ),
                    (0, runtime.minimumNodeResizeSize)(
                      value65.node,
                      current2.h,
                    ),
                  ),
                ),
              );
              items = items.filter(
                (input2: SnapCandidate) =>
                  Math.abs(
                    input2.axis === "x"
                      ? value71.dx - value59
                      : value71.dy - value60,
                  ) < 0.5,
              );
              value59 = value71.dx;
              value60 = value71.dy;
            }
            setSnapGuides(items);
            value68 = {
              ...value65,
              x: current2.xEdge
                ? (0, runtime.resizeAxisSpec)(
                    current2.xSpec,
                    current2.xEdge,
                    value59,
                    current2.w,
                    runtime.SLIDE_WIDTH,
                    Math.max(
                      value70?.w ?? 0,
                      (0, runtime.minimumNodeResizeSize)(
                        value65.node,
                        current2.w,
                      ),
                    ),
                  )
                : current2.xSpec,
              y: current2.yEdge
                ? (0, runtime.resizeAxisSpec)(
                    current2.ySpec,
                    current2.yEdge,
                    value60,
                    current2.h,
                    runtime.SLIDE_HEIGHT,
                    Math.max(
                      value70?.h ?? 0,
                      (0, runtime.minimumNodeResizeSize)(
                        value65.node,
                        current2.h,
                      ),
                    ),
                  )
                : current2.ySpec,
            };
            if (!value69) {
              let value71 = (0, runtime.transformPositionCompensation)(
                (0, runtime.axisSpecCenter)(
                  value68.x,
                  runtime.SLIDE_WIDTH,
                  current2.w,
                ) -
                  (0, runtime.axisSpecCenter)(
                    current2.xSpec,
                    runtime.SLIDE_WIDTH,
                    current2.w,
                  ),
                (0, runtime.axisSpecCenter)(
                  value68.y,
                  runtime.SLIDE_HEIGHT,
                  current2.h,
                ) -
                  (0, runtime.axisSpecCenter)(
                    current2.ySpec,
                    runtime.SLIDE_HEIGHT,
                    current2.h,
                  ),
                current2.rotation,
                current2.nodeScale,
              );
              value68 = {
                ...value68,
                x: (0, runtime.moveFillAxisAsPinned)(
                  value68.x,
                  value71.dx,
                  runtime.SLIDE_WIDTH,
                ),
                y: (0, runtime.moveFillAxisAsPinned)(
                  value68.y,
                  value71.dy,
                  runtime.SLIDE_HEIGHT,
                ),
              };
            }
            if (runtime.GROUP_RESIZING_ENABLED) {
              value68 =
                (0, runtime.scaleLeadingOverlayGroup)(value65, value68) ??
                value68;
            }
            callback31(
              (0, runtime.updateSlideFrame)(
                current2.applyBase,
                current2.frameId,
                () => value68,
              ),
            );
          }
          refreshMeasurements((input2) => input2 + 1);
        },
        callback86 = (input: PointerEvent) => {
          let current = touchPressRef.current;
          if (
            current !== null &&
            current.pointerId === input.pointerId &&
            input.isTrusted
          ) {
            let value59 = (0, runtime.reduceTouchLongPress)(
              current,
              {
                kind: input.type === "pointercancel" ? "cancel" : "up",
              },
              pointerDragThreshold("touch"),
            );
            callback50();
            if (value59.outcome === "tap") {
              callback83(current);
            }
          }
          let current2 = dragSessionRef.current;
          if (!current2 || input.pointerId !== current2.pointerId) {
            return;
          }
          dragSessionRef.current = null;
          setSnapGuides([]);
          if (
            input.type === "pointercancel" &&
            (current2.kind === "move" || current2.kind === "layer-move")
          ) {
            current2.clickSelect = null;
            if (current2.kind === "move") {
              current2.drop = null;
            }
          }
          callback82(current2, false);
        },
        callback87 = (input: KeyboardEvent) => {
          let current = dragSessionRef.current;
          if (
            current?.kind === "endpoint" &&
            current.moved &&
            current.last !== null &&
            (input.key === "Meta" ||
              input.key === "Control" ||
              input.key === "Shift")
          ) {
            callback84(
              current,
              current.last.dx,
              current.last.dy,
              input.metaKey || input.ctrlKey,
              input.shiftKey,
            );
            return;
          }
          if (
            current?.kind !== "move" ||
            !current.moved ||
            current.at === null ||
            (input.key !== "Meta" && input.key !== "Control")
          ) {
            return;
          }
          let value59 =
            input.type === "keydown" || input.metaKey || input.ctrlKey;
          if (value59 && current.drop === null && current.preview === null) {
            return;
          }
          callback81(
            current,
            value59 ? null : callback78(current, current.at.x, current.at.y),
            value59,
          );
          refreshMeasurements((input2) => input2 + 1);
        };
      (window).addEventListener("pointermove", callback85);
      (window).addEventListener("pointerup", callback86);
      (window).addEventListener("pointercancel", callback86);
      (window).addEventListener("keydown", callback87);
      (window).addEventListener("keyup", callback87);
      return () => {
        (window).removeEventListener("keydown", callback87);
        (window).removeEventListener("keyup", callback87);
        (window).removeEventListener("pointermove", callback85);
        (window).removeEventListener("pointerup", callback86);
        (window).removeEventListener("pointercancel", callback86);
      };
    }, [callback31, onGestureEnd, onSelectionChange, onTextEdit, dragLiveRef]);
    runtime.reactK_.useEffect(() => runtime.clearGestureCursor, []);
    runtime.reactK_.useEffect(() => {
      let current = stageRef.current;
      if (current === null) {
        return;
      }
      let flag = false,
        value59 = (0, runtime.attachViewportGestures)({
          element: current,
          getView: () => ref8.current,
          setView: (input: EditorViewport) => {
            if (input === ref8.current) {
              return;
            }
            let current2 = ref8.current;
            if (current2.scale <= 0) {
              return;
            }
            if (
              touchPressRef.current?.selected === true &&
              !touchPressRef.current.popped &&
              input.scale === current2.scale
            ) {
              return;
            }
            if (
              (!ref7.current ||
                ref3.current !== null ||
                ref.current?.kept === false) &&
              input.scale === current2.scale
            ) {
              let value60 = Date.now();
              if (ref11.current.size === 0 && value60 - ref10.current > 400) {
                ref9.current = {
                  dx: 0,
                  dy: 0,
                };
              }
              ref10.current = value60;
              ref9.current.dx += (input.x - current2.x) * current2.scale;
              ref9.current.dy += (input.y - current2.y) * current2.scale;
              let value61 =
                  Math.abs(ref9.current.dx) + Math.abs(ref9.current.dy),
                text = "mouse";
              for (let value62 of ref11.current.values())
                text = value62;
              if (value61 < pointerDragThreshold(text)) {
                return;
              }
              input = {
                x: current2.x + ref9.current.dx / current2.scale,
                y: current2.y + ref9.current.dy / current2.scale,
                scale: current2.scale,
              };
            }
            input = callback(input, ref24.current);
            if (
              input.x === current2.x &&
              input.y === current2.y &&
              input.scale === current2.scale
            ) {
              ref9.current = {
                dx: 0,
                dy: 0,
              };
              return;
            }
            ref9.current = {
              dx: 0,
              dy: 0,
            };
            callback2();
            ref7.current = true;
            ref6.current = input;
            ref8.current = input;
            setManualViewport(input);
          },
          onGestureEnd: () => {
            ref11.current.clear();
            ref9.current = {
              dx: 0,
              dy: 0,
            };
            if (flag) {
              flag = false;
              (0, runtime.clearGestureCursor)();
            }
          },
          limits: ref17.current,
          shouldPan: (event: PointerEvent) => {
            if (callback21(event.target)) {
              return false;
            }
            let current2 = dragSessionRef.current;
            if (current2?.moved === true) {
              if (!(event.pointerType !== current2.type || event.isPrimary)) {
                return false;
              }
            }
            if (isAdditionalTouchPointer(ref12.current, event)) {
              ref11.current.set(event.pointerId, event.pointerType);
              return true;
            }
            let value60 =
              (event.target as Element | null)?.closest?.("[data-mc-chrome]") != null;
            if (event.button === 1 && !value60) {
              ref11.current.set(event.pointerId, event.pointerType);
              flag = true;
              (0, runtime.setGestureCursor)("grabbing");
              return true;
            }
            let value61 =
              isFrameOrResizeTarget(event.target as Element | null) || value60;
            if (
              !(
                ref5.current && !pointInsideSlide(event.clientX, event.clientY)
              ) &&
              canStartCanvasRectSelection({
                pointerType: event.pointerType,
                button: event.button,
                surface: value61 ? "object" : "empty",
                textEdit: ref26.current !== null,
              })
            ) {
              return false;
            }
            if (
              (0, runtime.canEditAfterTouchLongPress)({
                pointerType: event.pointerType,
                editTarget: value61,
                onHandle:
                  (event.target as Element | null)?.closest?.("[data-resize-handle]") != null,
                textEdit: ref26.current !== null,
              })
            ) {
              ref11.current.set(event.pointerId, event.pointerType);
              return true;
            }
            let value62 = canStartCanvasPinch({
              dragActive: false,
              editTarget: value61,
            });
            if (value62) {
              ref11.current.set(event.pointerId, event.pointerType);
            }
            return value62;
          },
        }),
        callback77 = (input: PointerEvent) => {
          let flag2 = false;
          if (input.pointerType === "touch") {
            if (input.isPrimary) {
              ref12.current.clear();
              ref13.current.clear();
              for (let [value60, value61] of ref11.current)
                if (value60 !== input.pointerId && value61 === "touch") {
                  ref11.current.delete(value60);
                }
            }
            if (isAdditionalTouchPointer(ref12.current, input)) {
              flag2 = true;
              ref13.current.add(input.pointerId);
              ref14.current = null;
              callback50();
              let current3 = dragSessionRef.current;
              if (
                current3 !== null &&
                (current3.kind === "move" || current3.kind === "layer-move")
              ) {
                current3.clickSelect = null;
              }
            }
            ref12.current.add(input.pointerId);
          }
          let current2 = dragSessionRef.current;
          if (
            !flag2 &&
            current2 !== null &&
            (input.isPrimary || input.pointerType !== current2.type)
          ) {
            dragSessionRef.current = null;
            ref49.current(current2);
          }
          if (dragSessionRef.current === null) {
            endViewportGestureRef.current();
          }
          if (
            ![...ref11.current.keys()].some(
              (input2) => input2 !== input.pointerId,
            )
          ) {
            ref9.current = {
              dx: 0,
              dy: 0,
            };
          }
        },
        callback78 = (input: PointerEvent) => {
          if (!input.isTrusted) {
            return;
          }
          ref12.current.delete(input.pointerId);
          ref13.current.delete(input.pointerId);
        };
      current.addEventListener("pointerdown", callback77);
      (window).addEventListener("pointerup", callback78);
      (window).addEventListener("pointercancel", callback78);
      return () => {
        current.removeEventListener("pointerdown", callback77);
        (window).removeEventListener("pointerup", callback78);
        (window).removeEventListener("pointercancel", callback78);
        value59.destroy();
      };
    }, []);
    runtime.reactK_.useEffect(() => {
      let callback77 = () => {
          let current = dragSessionRef.current;
          dragSessionRef.current = null;
          callback50();
          ref12.current.clear();
          ref13.current.clear();
          ref11.current.clear();
          ref14.current = null;
          ref9.current = {
            dx: 0,
            dy: 0,
          };
          ref15.current = null;
          value3(null);
          setSnapGuides([]);
          if (current === null) {
            return;
          }
          ref49.current(current);
        },
        callback78 = () => {
          if ((document).visibilityState === "hidden") {
            callback77();
          }
        },
        callback79 = (event: KeyboardEvent) => {
          if (event.key === "Escape" && ref16.current()) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          let current = dragSessionRef.current;
          if (event.key !== "Escape" || current === null || !current.moved) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          dragSessionRef.current = null;
          if (slideRef.current === ref51.current) {
            ref50.current(current);
          } else {
            ref49.current(current);
          }
        };
      (window).addEventListener("blur", callback77);
      (document).addEventListener("visibilitychange", callback78);
      (window).addEventListener("keydown", callback79, true);
      return () => {
        (window).removeEventListener("blur", callback77);
        (document).removeEventListener(
          "visibilitychange",
          callback78,
        );
        (window).removeEventListener("keydown", callback79, true);
      };
    }, []);
    runtime.reactK_.useEffect(() => {
      if (!readOnly) {
        return;
      }
      let current = dragSessionRef.current;
      if (current === null) {
        return;
      }
      dragSessionRef.current = null;
      clearTouchLiftRef.current();
      if (dragLiveRef) {
        dragLiveRef.current = false;
      }
      setSnapGuides([]);
      setDragPreviewSlide(null);
      (0, runtime.clearGestureCursor)();
      setRotationPreviewAngle(null);
      setEndpointSnapPoint(null);
      onLiveChange(current.before);
    }, [readOnly, onLiveChange, dragLiveRef]);
    let callback32 = (input: number) => {
        if (input <= 0) {
          return null;
        }
        let value59 = (0, runtime.countSlideTableCells)(slide);
        if (value59 + input > runtime.maxSlideTableCells) {
          return "This slide can't hold more table cells — remove some first.";
        }
        if (
          (deckCellCount !== undefined && Number.isFinite(deckCellCount)
            ? deckCellCount
            : value59) +
            input >
          runtime.maxDeckTableCells
        ) {
          return "This presentation can't hold more table cells — remove some first.";
        }
        return null;
      },
      callback33 = (input: number) => {
        let value59 = (0, runtime.countSlideTableCells)(slide),
          value60 =
            deckCellCount !== undefined && Number.isFinite(deckCellCount)
              ? deckCellCount
              : value59,
          value61 = Math.min(
            runtime.maxSlideTableCells - value59,
            runtime.maxDeckTableCells - value60,
          );
        return Math.max(0, Math.floor(value61 / Math.max(1, input)));
      },
      callback34 = (
        input: Slide,
        options: string,
        context: NodePath,
        value59: (table: TableNode) => TableNode,
      ) => {
        let value60 = frameElementsRef.current
            .get(options)
            ?.getBoundingClientRect(),
          value61 = slideSurfaceRef.current?.getBoundingClientRect(),
          value62 = (0, runtime.updateSlideFrame)(
            input,
            options,
            (input2) => ({
              ...input2,
              node: (0, runtime.updateNodeAtPath)(
                input2.node,
                context,
                (source) =>
                  source.kind === "table" ? value59(source) : source,
              ),
            }),
          );
        runtime.FrameViewportReactDom.flushSync(
          () => onLiveChange(value62),
        );
        let value63 = frameElementsRef.current
            .get(options)
            ?.getBoundingClientRect(),
          value64 = (0, runtime.frameById)(value62, options);
        if (value60 && value63 && value61 && value64 && scale > 0) {
          let callback77 = (
              input2: Axis,
              options2: number,
              context2: number,
              value67: boolean,
              extra: number,
              detail: number,
            ): Axis => {
              let value68 =
                  context2 >= 0 && context2 + extra <= detail,
                value69 = Math.floor(detail - extra);
              if (input2.anchor === "fill") {
                return input2;
              }
              if (input2.anchor === "leading") {
                if (value68 || !value67) {
                  return input2;
                } else {
                  return {
                    ...input2,
                    margin: Math.max(0, value69),
                  };
                }
              }
              if (Math.abs(options2) < 0.5) {
                return input2;
              }
              if (input2.anchor === "trailing" && !value68) {
                return input2;
              }
              let value70 = Math.max(
                0,
                value67 ? Math.min(context2, value69) : context2,
              );
              return {
                ...input2,
                anchor: "leading",
                margin: value70,
                offset: 0,
              };
            },
            value65 = callback77(
              value64.x,
              value60.left - value63.left,
              Math.round((value60.left - value61.left) / scale),
              value63.width > value60.width + 0.5,
              value63.width / scale,
              runtime.SLIDE_WIDTH,
            ),
            value66 = callback77(
              value64.y,
              value60.top - value63.top,
              Math.round((value60.top - value61.top) / scale),
              value63.height > value60.height + 0.5,
              value63.height / scale,
              runtime.SLIDE_HEIGHT,
            );
          if (value65 !== value64.x || value66 !== value64.y) {
            onLiveChange(
              (0, runtime.updateSlideFrame)(
                value62,
                options,
                (input2) => ({
                  ...input2,
                  x: value65,
                  y: value66,
                }),
              ),
            );
          }
        }
        onGestureEnd(input);
      },
      callback35 = (items: SlideNode[]) => {
        if (slide.frames.length + items.length > runtime.maxSlideFrames) {
          return "This slide is full — remove an element first.";
        }
        let value59 = items.reduce(
          (input: number, options: SlideNode) =>
            input + (0, runtime.countNodeEmbeds)(options),
          0,
        );
        if (
          value59 > 0 &&
          (0, runtime.countSlideEmbeds)(slide) + value59 >
            runtime.maxSlideHtmlEmbeds
        ) {
          return (
            "This slide can’t hold more web embeds (" +
            String(runtime.maxSlideHtmlEmbeds) +
            " max) — remove one first."
          );
        }
        return callback32(
          items.reduce(
            (input: number, options: SlideNode) =>
              input + (0, runtime.countNodeTableCells)(options),
            0,
          ),
        );
      },
      callback36 = (input: string) => {
        let entry = frameElementsRef.current.get(input),
          value59 = (0, runtime.frameById)(slide, input),
          value60 =
            value59 !== undefined
              ? (0, runtime.nodeChildren)(value59.node)
              : undefined;
        if (!entry || !value59 || value60 === undefined) {
          return null;
        }
        let value61 = entry.offsetParent?.getBoundingClientRect();
        if (!value61) {
          return null;
        }
        let items: Array<{ rect: SlideRect }> = [];
        for (let index = 0; index < value60.length; index++) {
          let element = entry.querySelector<HTMLElement>(
            '[data-node-path="' + String(index) + '"]',
          );
          if (!element) {
            return null;
          }
          let bounds = element.getBoundingClientRect();
          items.push({
            rect: {
              x: (bounds.left - value61.left) / scale,
              y: (bounds.top - value61.top) / scale,
              w: bounds.width / scale,
              h: bounds.height / scale,
            },
          });
        }
        return items;
      },
      callback37 = (input: HTMLElement | undefined) => {
        let value59 = input
          ? parseFloat(getComputedStyle(input).width)
          : NaN;
        if (value59 > 0) {
          return value59;
        } else {
          return undefined;
        }
      },
      callback38 = (
        input: readonly Frame[],
        options: (frame: Frame) => string = (input2) => input2.id,
      ) => {
        let entries = new Map<string, number>();
        for (let value59 of input) {
          let value60 =
            !(0, runtime.isTextNode)(value59.node) ||
            value59.x.anchor === "fill" ||
            value59.x.size !== undefined
              ? undefined
              : callback37(frameElementsRef.current.get(options(value59)));
          if (value60 !== undefined) {
            entries.set(value59.id, value60);
          }
        }
        return entries;
      },
      callback39 = (
        input: string,
        options: NodePath,
        context = scale,
      ) => {
        let entry = frameElementsRef.current.get(input),
          value59 = entry?.offsetParent,
          value60 = entry?.querySelector<HTMLElement>(
            '[data-node-path="' + options.join(".") + '"]',
          );
        if (!entry || !value59 || !value60 || !(context > 0)) {
          return null;
        }
        let bounds = value59.getBoundingClientRect(),
          value61 = getUnliftedBoundingClientRect(value60);
        return {
          x: (value61.left - bounds.left) / context,
          y: (value61.top - bounds.top) / context,
          w: value61.width / context,
          h: value61.height / context,
        };
      },
      callback40 = (
        input: PointerSnapshot,
        options: HTMLElement,
        context: NodeSelection[],
        value59: NodeSelection[] | null,
      ) => {
        let current = stageRef.current;
        if (!current) {
          return;
        }
        callback8();
        let bounds = current.getBoundingClientRect();
        ref15.current = {
          pointerId: input.pointerId,
          sx: input.clientX,
          sy: input.clientY,
          ox: bounds.left,
          oy: bounds.top,
          live: false,
          lastKey: null,
          base: context,
          prev: [...selection],
          clickSelect: value59,
        };
        options.setPointerCapture(input.pointerId);
      };
    ref16.current = () => {
      let current = ref15.current;
      if (current === null || !current.live) {
        return false;
      }
      ref15.current = null;
      if (ref14.current?.pointerId === current.pointerId) {
        ref14.current = null;
      }
      value3(null);
      onSelectionChange(current.prev);
      return true;
    };
    let callback41 = () => {
        let items: SelectionUnitRect[] = [],
          value59 = (0, runtime.slidePrimaryLayoutFrame)(slide)?.id,
          callback77 = (input: EditorScreenRect) => ({
            x: input.left,
            y: input.top,
            w: input.width,
            h: input.height,
          });
        for (let value60 of slide.frames) {
          let id = value60.id,
            entry = frameElementsRef.current.get(id);
          if (
            entry === undefined ||
            (0, runtime.isEmptyBackgroundFrame)(value60)
          ) {
            continue;
          }
          if (id !== value59) {
            items.push({
              unit: {
                frameId: id,
              },
              rect: callback77(getFrameTransformScreenRect(slide, id, entry)),
            });
            continue;
          }
          for (let value61 of (0, runtime.collectMarqueeSelection)(
            id,
            value60.node,
          )) {
            let element = entry.querySelector<HTMLElement>(
              '[data-node-path="' +
                (0, runtime.selectionNodePath)(value61).join(".") +
                '"]',
            );
            if (element) {
              items.push({
                unit: value61,
                rect: callback77(element.getBoundingClientRect()),
              });
            }
          }
        }
        return items;
      },
      callback42 = () => {
        if (ref26.current === null) {
          return true;
        }
        let value59 =
          slideSurfaceRef.current?.querySelector<HTMLElement>(
            "[data-text-path][contenteditable], [data-cell][contenteditable]",
          ) ?? null;
        if (value59 === null) {
          runtime.FrameViewportReactDom.flushSync(
            () => onTextEdit(null),
          );
          return ref26.current === null;
        }
        if ((document).activeElement !== value59) {
          runtime.FrameViewportReactDom.flushSync(
            () =>
              value59.focus({
                preventScroll: true,
              }),
          );
        }
        runtime.FrameViewportReactDom.flushSync(() => value59.blur());
        return ref26.current === null;
      },
      callback43 = (input: string, event: ReactPointerEvent<HTMLDivElement>) => {
        if (ref13.current.has(event.pointerId)) {
          return;
        }
        plainPressRef.current = !(
          event.shiftKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        );
        if (textEdit) {
          if (event.pointerType === "touch") {
            let value60 = (0, runtime.frameById)(slide, input),
              value61 =
                value60 !== undefined &&
                !(0, runtime.isEmptyBackgroundFrame)(value60)
                  ? (0, runtime.resolvePaintedSelection)(
                      input,
                      value60.node,
                      parseEditorNodePath(
                        (event.target as Element | null)
                          ?.closest?.("[data-node-path]")
                          ?.getAttribute("data-node-path"),
                      ),
                    )
                  : null;
            if (
              value61 !== null &&
              (0, runtime.selectionKey)(value61) !==
                (0, runtime.selectionKey)(
                  (0, runtime.createNodeSelection)(
                    textEdit.frameId,
                    textEdit.path,
                  ),
                )
            ) {
              ref2.current = performance.now();
            }
          }
          if (
            event.pointerType === "touch" ||
            event.button !== 0 ||
            (0, runtime.isMacControlClick)(event) ||
            !callback42()
          ) {
            return;
          }
          beginPanRef.current(input, event);
          return;
        }
        event.stopPropagation();
        let value59 = (0, runtime.snapshotPointerEvent)(event);
        if ((0, runtime.canStartTouchLongPress)(value59)) {
          callback57(input, value59);
          return;
        }
        if (
          (0, runtime.isMacControlClick)(event) ||
          !(0, runtime.startCanvasDrag)(event)
        ) {
          return;
        }
        callback47(input, value59);
      },
      callback44 = (input: Frame, event: PointerSnapshot) => {
        let value59 = parseEditorNodePath(
            (event.target as Element | null)
              ?.closest?.("[data-node-path]")
              ?.getAttribute("data-node-path"),
          ),
          value60 = (0, runtime.resolvePointerSelection)(
            input.id,
            input.node,
            value59,
            selection,
            getFrameHitTestOptions(slide, input),
          ),
          value61 = event.shiftKey || event.ctrlKey || event.metaKey,
          value62 = slideSurfaceRef.current?.getBoundingClientRect(),
          value63 =
            value62 !== undefined
              ? resolveSelectionDragHit({
                  selection: selection,
                  selRects: selectionRects,
                  unit: value60.grab,
                  toggle: value61,
                  x: (event.clientX - value62.left) / scale,
                  y: (event.clientY - value62.top) / scale,
                })
              : null;
        return {
          pressed: value60,
          toggle: value61,
          redirect: value63,
        };
      },
      callback45 = (input: NodeSelection) => {
        let value59 = (0, runtime.frameById)(slide, input.frameId),
          value60 = (0, runtime.selectionNodePath)(input);
        if (value59 === undefined || value60.length > 1) {
          return false;
        }
        if (value60.length === 0) {
          return value59.x.anchor === "fill" && value59.y.anchor === "fill";
        }
        let value61 = (0, runtime.isOverlayNode)(value59.node)
          ? value59.node.layers[(value60[0] ?? 0) - 1]
          : undefined;
        return (
          value61 !== undefined &&
          value61.x.anchor === "fill" &&
          value61.y.anchor === "fill"
        );
      },
      callback46 = (input: string, options: PointerSnapshot) => {
        let value59 = (0, runtime.frameById)(slide, input);
        if (!value59) {
          return false;
        }
        let {
          pressed: value60,
          toggle: value61,
          redirect: value62,
        } = callback44(value59, options);
        return (
          !value61 &&
          (value62 !== null ||
            (value60.grab !== null &&
              (0, runtime.selectionContainsNode)(selection, value60.grab))) &&
          !selection.every(callback45)
        );
      },
      callback47 = (input: string, event: PointerSnapshot) => {
        pendingToggleFrameRef.current = null;
        callback8();
        let value59 = (0, runtime.frameById)(slide, input);
        if (!value59) {
          return;
        }
        let value60 =
            (event.target as Element).closest("a[data-drag-surface]") !== null
              ? Math.max(
                  pointerDragThreshold(event.pointerType),
                  runtime.pointerClickMovementTolerance,
                )
              : undefined,
          {
            pressed: value61,
            toggle: value62,
            redirect: value63,
          } = callback44(value59, event),
          grab = value61.grab,
          value64 =
            value63 !== null
              ? (0, runtime.frameById)(slide, value63.unit.frameId)
              : undefined,
          entry = frameElementsRef.current.get(input);
        if (
          !(value63 !== null && value64 !== undefined) &&
          (grab === null
            ? (0, runtime.isPrimaryLayoutFrame)(slide, value59)
            : (0, runtime.isEmptyBackgroundFrame)(value59)) &&
          entry !== undefined &&
          canStartCanvasRectSelection({
            pointerType: event.pointerType,
            button: event.button,
            surface: "slide",
            textEdit: ref26.current !== null,
          })
        ) {
          callback40(
            event,
            entry,
            value62 ? [...selection] : [],
            grab === null
              ? value62
                ? null
                : []
              : value62
                ? (0, runtime.toggleNodeSelection)(selection, grab)
                : [grab],
          );
          return;
        }
        let value65 = grab,
          value66 = input,
          value67 = value59,
          value68: NodeSelection[],
          value69: NodeSelection[] | null = null;
        if (value63 !== null && value64 !== undefined) {
          value65 = value63.unit;
          value66 = value64.id;
          value67 = value64;
          value68 = [...selection];
          value69 = value63.clickSelect;
        } else if (grab === null) {
          value68 = [];
          value69 = value62 ? null : [];
        } else if (
          value62 &&
          (0, runtime.togglePointerSelection)(selection, value61) !== null
        ) {
          onSelectionChange(
            (0, runtime.togglePointerSelection)(selection, value61) ?? [],
          );
          return;
        } else if (value62) {
          if ((0, runtime.selectionContainsNode)(selection, grab)) {
            onSelectionChange(
              selection.filter(
                (input2) =>
                  !(0, runtime.selectionsEqual)(input2, grab),
              ),
            );
            return;
          }
          value68 = [...selection, grab];
          onSelectionChange(value68);
        } else if ((0, runtime.selectionContainsNode)(selection, grab)) {
          value68 = [
            ...selection.filter(
              (input2) =>
                !(0, runtime.selectionsEqual)(input2, grab),
            ),
            grab,
          ];
          if (selection.length > 1) {
            value69 = [grab];
          }
          let value71 = (0, runtime.selectedNode)(slide, grab);
          if (
            selection.length === 1 &&
            value71?.kind === "img" &&
            value71.video !== undefined
          ) {
            pendingToggleFrameRef.current = (0, runtime.clipRegistryKey)(
              grab.frameId,
              (0, runtime.selectionNodePath)(grab).join("."),
            );
          }
          onSelectionChange(value68);
        } else {
          value68 = [grab];
          onSelectionChange(value68);
        }
        if (
          !value62 &&
          value61.tap !== null &&
          grab !== null &&
          !(0, runtime.selectionsEqual)(value61.tap, grab)
        ) {
          value69 = [value61.tap];
        }
        if (readOnly) {
          if (value69 !== null) {
            onSelectionChange(value69);
          }
          togglePendingFrame();
          return;
        }
        if (event.altKey && value65 !== null) {
          let value71 = value65,
            value72 = callback26(value66);
          if (!value72) {
            return;
          }
          let value73 = deleteSelectedUnits(
              slide,
              value68,
              (input2) =>
                callback39(
                  input2.frameId,
                  (0, runtime.selectionNodePath)(input2),
                ),
            ),
            value74 =
              value73.find(
                (input2) =>
                  (0, runtime.selectionsEqual)(input2.unit, value71),
              ) ??
              value73.find(
                (input2) =>
                  input2.unit.frameId === value66 &&
                  (input2.rect === undefined ||
                    isStrictPathAncestor(
                      (0, runtime.selectionNodePath)(input2.unit),
                      (0, runtime.selectionNodePath)(value71),
                    )),
              ),
            value75 = value73.map(
              (input2) => input2.copy.node,
            ),
            value76 = value74 ? callback35(value75) : null;
          if (value76 !== null) {
            (0, runtime.showToast)(value76);
          }
          if (
            !value74 ||
            value76 !== null ||
            withinStyleBudget?.(value75) === false
          ) {
            if (value69 !== null) {
              onSelectionChange(value69);
            }
            return;
          }
          let value77 = value73.map(
              (input2) => input2.copy,
            ),
            value78 = value77.filter(
              (input2) => input2 !== value74.copy,
            );
          if (event.pointerType !== "touch") {
            (0, runtime.setGestureCursor)("copy");
          }
          let items3 = [
            ...value72.siblingRects,
            value72.startRect,
            ...(value71.child !== undefined
              ? (callback36(value66) ?? []).map(
                  (input2) => input2.rect,
                )
              : []),
            ...value73.flatMap(
              (input2) => (input2.rect ? [input2.rect] : []),
            ),
          ];
          dragSessionRef.current = {
            kind: "move",
            frameId: value74.copy.id,
            pointerId: event.pointerId,
            type: event.pointerType,
            slop: value60,
            k: ref8.current.scale,
            downX: event.clientX,
            downY: event.clientY,
            startX: event.clientX,
            startY: event.clientY,
            before: slide,
            applyBase: {
              ...slide,
              frames: [...slide.frames, ...value77],
            },
            baseFrame: value74.copy,
            xSpec: value74.copy.x,
            ySpec: value74.copy.y,
            autoW: callback38(
              value77,
              (input2) =>
                value73.find(
                  (input3) => input3.copy === input2,
                )?.unit.frameId ?? input2.id,
            ),
            moved: false,
            altDup: true,
            pendingBreakouts: [],
            extras: value78.map(
              (input2) => ({
                frameId: input2.id,
                xSpec: input2.x,
                ySpec: input2.y,
              }),
            ),
            clickSelect: value69,
            startRect:
              value74.rect ??
              (value74.copy.node.kind === "text" &&
              value74.copy.y.size === undefined
                ? callback39(value66, [])
                : null) ??
              value72.startRect,
            siblingRects: items3,
            candidates: (0, runtime.buildSiblingSnapCandidates)(items3),
            lastSnaps: {},
            last: null,
            origin: null,
            lifted: new Map(),
            sheds: [],
            drop: null,
            preview: null,
            restore: null,
            at: null,
          };
          return;
        }
        if (
          value65 !== null &&
          value65.child !== undefined &&
          value65.child >= 1 &&
          (0, runtime.isOverlayNode)(value67.node) &&
          value65.child - 1 < value67.node.layers.length
        ) {
          let entry2 = frameElementsRef.current.get(value66),
            value71 = entry2?.offsetParent,
            value72 = entry2?.querySelector<HTMLElement>(
              '[data-overlay-layer="' + String(value65.child) + '"]',
            );
          if (entry2 && value71 && value72) {
            let bounds = value71.getBoundingClientRect(),
              bounds2 = entry2.getBoundingClientRect(),
              bounds3 = value72.getBoundingClientRect(),
              value73 = value67.node.layers[value65.child - 1]!;
            dragSessionRef.current = {
              kind: "layer-move",
              frameId: value66,
              layerIndex: value65.child - 1,
              pointerId: event.pointerId,
              type: event.pointerType,
              slop: value60,
              k: ref8.current.scale,
              downX: event.clientX,
              downY: event.clientY,
              startX: event.clientX,
              startY: event.clientY,
              lastDx: 0,
              lastDy: 0,
              clickSelect: value69,
              before: slide,
              xSpec: value73.x,
              ySpec: value73.y,
              autoW: (0, runtime.isTextNode)(value73.node)
                ? callback37(value72)
                : undefined,
              roomW: value72.offsetParent?.clientWidth ?? bounds2.width / scale,
              wrapperRect: {
                x: (bounds2.left - bounds.left) / scale,
                y: (bounds2.top - bounds.top) / scale,
                w: bounds2.width / scale,
                h: bounds2.height / scale,
              },
              layerRect: {
                x: (bounds3.left - bounds.left) / scale,
                y: (bounds3.top - bounds.top) / scale,
                w: bounds3.width / scale,
                h: bounds3.height / scale,
              },
              ...(!runtime.GROUP_MEMBER_SIZES_FROM_MODEL &&
              (0, runtime.isLeadingOverlayGroup)(value67)
                ? {
                    memberSizes: value67.node.layers.map(
                      (input2, options) =>
                        memo.rect(
                          (0, runtime.createNodeSelection)(value66, [
                            options + 1,
                          ]),
                        ),
                    ),
                  }
                : {}),
              moved: false,
            };
            return;
          }
        }
        let entries = new Map<string, number[]>(),
          entries2 = new Map<string, NodePath[]>();
        for (let value71 of value68) {
          if (value71.child === undefined) {
            continue;
          }
          if (value71.path !== undefined) {
            let value74 = entries2.get(value71.frameId) ?? [];
            value74.push(value71.path);
            entries2.set(value71.frameId, value74);
            continue;
          }
          let value72 = (0, runtime.frameById)(slide, value71.frameId);
          if (
            value72 !== undefined &&
            (0, runtime.isOverlayNode)(value72.node) &&
            !(value71.frameId === value66 && value65?.child === 0)
          ) {
            continue;
          }
          let value73 = entries.get(value71.frameId) ?? [];
          value73.push(value71.child);
          entries.set(value71.frameId, value73);
        }
        let values = new Set(
          value68
            .filter(
              (input2) =>
                input2.child === undefined && input2.frameId !== value66,
            )
            .map((input2) => input2.frameId),
        );
        for (let value71 of entries2.keys())
          if (!entries.has(value71)) {
            entries.set(value71, []);
          }
        let values2 = new Set([...values, ...entries.keys()]),
          value70 = callback26(value66, values2);
        if (!value70) {
          return;
        }
        let items: FlowDragRequest[] = [];
        for (let [value71, value72] of entries) {
          let value73 = callback36(value71);
          if (!value73) {
            continue;
          }
          let state2: FlowDragRequest = {
            frameId: value71,
            children: value73,
            selectedChildren: value72.filter(
              (input2) => input2 < value73.length,
            ),
            deep: (entries2.get(value71) ?? [])
              .map((input2) => {
                let value75 = callback39(value71, input2);
                if (value75) {
                  return {
                    path: input2,
                    rect: value75,
                  };
                } else {
                  return null;
                }
              })
              .filter((input2): input2 is FlowDragDeepEntry => input2 !== null),
          };
          if (
            value65 !== null &&
            value65.child !== undefined &&
            value71 === value66 &&
            value65.child < value73.length
          ) {
            state2.dragIndex = value65.child;
            if (value65.path !== undefined) {
              state2.dragPath = value65.path;
            }
          }
          let value74 = (0, runtime.frameById)(slide, value71),
            entry2 = frameElementsRef.current.get(value71);
          if (value74 && entry2) {
            let bounds = entry2.getBoundingClientRect(),
              value75 =
                entry2.offsetParent?.getBoundingClientRect() ?? bounds,
              state3 = {
                x: (bounds.left - value75.left) / scale,
                y: (bounds.top - value75.top) / scale,
                w: bounds.width / scale,
                h: bounds.height / scale,
              };
            items.push(
              normalizeFlowDragExtraction(
                state2,
                value74,
                (0, runtime.isPrimaryLayoutFrame)(slide, value74),
                state3,
              ),
            );
          } else {
            items.push(state2);
          }
        }
        let items2: DragExtraFrame[] = [];
        for (let value71 of values) {
          let value72 = (0, runtime.frameById)(slide, value71);
          if (value72) {
            items2.push({
              frameId: value71,
              xSpec: value72.x,
              ySpec: value72.y,
            });
          }
        }
        dragSessionRef.current = {
          kind: "move",
          frameId: value66,
          pointerId: event.pointerId,
          type: event.pointerType,
          slop: value60,
          k: ref8.current.scale,
          downX: event.clientX,
          downY: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
          before: slide,
          applyBase: slide,
          baseFrame: value67,
          xSpec: value67.x,
          ySpec: value67.y,
          autoW: callback38([
            value67,
            ...items2.flatMap(
              (input2) =>
                (0, runtime.frameById)(slide, input2.frameId) ?? [],
            ),
          ]),
          moved: false,
          altDup: false,
          pendingBreakouts: items,
          extras: items2,
          clickSelect: value69,
          startRect: value70.startRect,
          siblingRects: value70.siblingRects,
          candidates: (0, runtime.buildSiblingSnapCandidates)(
            value70.siblingRects,
          ),
          lastSnaps: {},
          last: null,
          origin: null,
          lifted: new Map(),
          sheds: [],
          drop: null,
          preview: null,
          restore: null,
          at: null,
        };
      };
    beginFrameDragRef.current = callback47;
    beginPanRef.current = callback43;
    let callback48 = (input: number) => {
      ref11.current.delete(input);
      (window).dispatchEvent(
        new PointerEvent("pointercancel", {
          pointerId: input,
          pointerType: "touch",
        }),
      );
    };
    releasePointerRef.current = callback48;
    let callback49 = (input: boolean) => {
        let value59 = slideSurfaceRef.current?.style;
        for (let value60 of [
          "user-select",
          "-webkit-user-select",
          "-webkit-touch-callout",
        ])
          if (input) {
            value59?.setProperty(value60, "none");
          } else {
            value59?.removeProperty(value60);
          }
      },
      callback50 = () => {
        if (longPressTimerRef.current !== null) {
          clearTimeout(longPressTimerRef.current);
        }
        longPressTimerRef.current = null;
        touchPressRef.current = null;
        if (dragSessionRef.current?.type !== "touch") {
          callback49(false);
        }
      },
      callback51 = (
        element: Element | null | undefined,
        options = false,
      ) => {
        if (
          (!(element instanceof HTMLElement) &&
            !(element instanceof SVGElement)) ||
          !element.isConnected
        ) {
          return;
        }
        if (
          element.hasAttribute(SLIDE_LIFT_SCALE_ATTRIBUTE) &&
          element.classList.contains("slides-lift")
        ) {
          return;
        }
        let value59 = getComputedStyle(element),
          [value60, value61] = element.hasAttribute(
            SLIDE_LIFT_SCALE_ATTRIBUTE,
          )
            ? parseCssScaleFactors(
                element.getAttribute(SLIDE_LIFT_SCALE_ATTRIBUTE) ?? "",
              )
            : parseCssScaleFactors(value59.scale),
          value62 = parseFloat(
            element.hasAttribute(SLIDE_LIFT_SCALE_ATTRIBUTE)
              ? element.style.getPropertyValue("--slides-lift-own")
              : value59.opacity,
          ),
          value63 = Number.isNaN(value62) ? 1 : value62;
        element.setAttribute(
          SLIDE_LIFT_SCALE_ATTRIBUTE,
          String(value60) + " " + String(value61),
        );
        element.style.setProperty("--slides-lift-own", String(value63));
        element.style.setProperty("--slides-lift-fade", String(value63 * 0.75));
        element.classList.remove("slides-lift-out");
        element.classList.toggle("slides-lift-held", options);
        element.classList.add("slides-lift");
      },
      callback52 = (input: Element | null | undefined) => {
        if (!(input instanceof HTMLElement) && !(input instanceof SVGElement)) {
          return;
        }
        input.classList.remove(
          "slides-lift",
          "slides-lift-out",
          "slides-lift-held",
        );
        input.removeAttribute(SLIDE_LIFT_SCALE_ATTRIBUTE);
        for (let value59 of [
          "--slides-lift-own",
          "--slides-lift-fade",
        ])
          input.style.removeProperty(value59);
        refreshMeasurements((input2) => input2 + 1);
      },
      callback53 = () => {
        touchLiftActiveRef.current = false;
        callback49(false);
        for (let value59 of (document).querySelectorAll(
          "[" + SLIDE_LIFT_SCALE_ATTRIBUTE + "]",
        )) {
          if (!value59.classList.contains("slides-lift")) {
            continue;
          }
          value59.classList.remove("slides-lift", "slides-lift-held");
          value59.classList.add("slides-lift-out");
          if (getComputedStyle(value59).animationName !== "slides-lift-out") {
            callback52(value59);
            continue;
          }
          let callback77 = () => {
              value59.removeEventListener("animationend", callback78);
              value59.removeEventListener("animationcancel", callback78);
              if (
                value59.hasAttribute(SLIDE_LIFT_SCALE_ATTRIBUTE) &&
                !value59.classList.contains("slides-lift")
              ) {
                callback52(value59);
              }
            },
            callback78 = (event: Event) => {
              if (
                event.target === value59 &&
                "animationName" in event &&
                event.animationName === "slides-lift-out"
              ) {
                callback77();
              }
            };
          value59.addEventListener("animationend", callback78);
          value59.addEventListener("animationcancel", callback78);
          setTimeout(callback77, 400);
        }
      },
      callback54 = () => {
        touchLiftActiveRef.current = false;
        callback49(false);
        for (let value59 of (document).querySelectorAll(
          "[" + SLIDE_LIFT_SCALE_ATTRIBUTE + "]",
        ))
          callback52(value59);
      },
      callback55 = (source: CanvasMoveDrag | CanvasLayerMoveDrag) => {
        let items: Array<Element | null | undefined> = [];
        if (source.kind === "layer-move") {
          items.push(
            frameElementsRef.current
              .get(source.frameId)
              ?.querySelector(
                '[data-overlay-layer="' + String(source.layerIndex + 1) + '"]',
              )?.firstElementChild,
          );
        } else {
          for (let value59 of source.pendingBreakouts) {
            let value60 =
                value59.dragPath ??
                (value59.dragIndex !== undefined
                  ? [value59.dragIndex]
                  : undefined),
              items2 = [
                ...(value60 ? [value60] : []),
                ...value59.selectedChildren.map(
                  (input: number) => [input],
                ),
                ...value59.deep.map((input: FlowDragDeepEntry) => input.path),
              ];
            for (let value61 of items2) {
              if (
                items2.some(
                  (items3) =>
                    items3.length < value61.length &&
                    items3.every(
                      (input: number, options: number) =>
                        input === value61[options],
                    ),
                )
              ) {
                continue;
              }
              items.push(
                frameElementsRef.current
                  .get(value59.frameId)
                  ?.querySelector(
                    '[data-node-path="' + value61.join(".") + '"]',
                  ),
              );
            }
          }
          for (let value59 of [
            source.frameId,
            ...source.extras.map((input: DragExtraFrame) => input.frameId),
          ]) {
            let value60 = (0, runtime.frameById)(
              slideRef.current,
              value59,
            );
            if (
              source.pendingBreakouts.some(
                (input: FlowDragRequest) => input.frameId === value59,
              ) ||
              (value60 !== undefined &&
                ((0, runtime.isPrimaryLayoutFrame)(slideRef.current, value60) ||
                  (0, runtime.isEmptyBackgroundFrame)(value60)))
            ) {
              continue;
            }
            items.push(
              frameElementsRef.current.get(value59)?.firstElementChild,
            );
          }
        }
        if (!items.some((input) => input != null)) {
          return;
        }
        for (let value59 of (document).querySelectorAll(
          "[" + SLIDE_LIFT_SCALE_ATTRIBUTE + "]",
        ))
          if (!items.includes(value59)) {
            callback52(value59);
          }
        for (let value59 of items)
          callback51(value59, touchLiftActiveRef.current);
        touchLiftActiveRef.current = true;
      };
    applyTouchLiftRef.current = callback55;
    clearTouchLiftRef.current = callback53;
    endViewportGestureRef.current = callback54;
    let callback56 = (input: string, options: EventTarget | null) => {
        queueMicrotask(() => {
          let current = dragSessionRef.current;
          if (
            current !== null &&
            current.type === "touch" &&
            (current.kind === "move" || current.kind === "layer-move")
          ) {
            callback55(current);
          }
        });
        try {
          navigator.vibrate?.(10);
        } catch {}
      },
      callback57 = (input: string, event: PointerSnapshot) => {
        callback54();
        callback50();
        touchPressRef.current = {
          pointerId: event.pointerId,
          frameId: input,
          press: event,
          popped: false,
          selected: !readOnlyRef.current && callback46(input, event),
        };
        callback49(!readOnlyRef.current);
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          let current = touchPressRef.current;
          if (current === null || current.pointerId !== event.pointerId) {
            return;
          }
          if (readOnlyRef.current) {
            return;
          }
          let value59 = (0, runtime.reduceTouchLongPress)(
            current,
            {
              kind: "hold",
            },
            pointerDragThreshold("touch"),
          );
          touchPressRef.current = value59.press;
          if (value59.outcome !== "pop") {
            return;
          }
          if (ref12.current.size > 1) {
            callback50();
            return;
          }
          callback48(event.pointerId);
          plainPressRef.current = false;
          callback56(input, event.target);
          beginFrameDragRef.current(input, event);
        }, runtime.TOUCH_LONG_PRESS_MS);
      },
      callback58 = (input: ResizeEdge | null, options: ResizeEdge | null) => {
        if (!singleTransformTarget || !onChangeSlide) {
          return;
        }
        if (singleTransformTarget.flow) {
          let unit = singleTransformTarget.unit,
            value62 = (0, runtime.selectedNode)(slide, unit),
            value63 = (0, runtime.frameById)(
              slide,
              unit.frameId,
            )?.node,
            value64 =
              value63 &&
              (0, runtime.nodeAtPath)(
                value63,
                (0, runtime.selectionNodePath)(unit).slice(0, -1),
              );
          if (
            !value62 ||
            !(0, runtime.nodeSupportsIntrinsicSizing)(value62) ||
            !value64 ||
            !(0, runtime.isFlowContainer)(value64)
          ) {
            return;
          }
          let value65 =
              input !== null &&
              (0, runtime.nodeExplicitAxisSize)(value62, "x") !== undefined &&
              (0, runtime.childAxisFills)(value62, value64, "x"),
            value66 =
              options !== null &&
              (0, runtime.nodeExplicitAxisSize)(value62, "y") !== undefined &&
              (0, runtime.childAxisFills)(value62, value64, "y");
          if (!value65 && !value66) {
            return;
          }
          onChangeSlide(
            (0, runtime.updateSelectedNode)(
              slide,
              unit,
              (input2) => {
                let value67 = input2;
                if (value65) {
                  value67 = (0, runtime.setNodeAxisSize)(
                    value67,
                    "x",
                    undefined,
                    singleTransformTarget.mainAxis,
                  );
                }
                if (value66) {
                  value67 = (0, runtime.setNodeAxisSize)(
                    value67,
                    "y",
                    undefined,
                    singleTransformTarget.mainAxis,
                  );
                }
                return value67;
              },
            ),
          );
          return;
        }
        let value59 = (0, runtime.frameById)(
          slide,
          singleTransformTarget.unit.frameId,
        );
        if (!value59) {
          return;
        }
        let callback77 = (
            input2: Axis,
            options2: boolean,
          ) => {
            if (
              !options2 ||
              input2.anchor === "fill" ||
              input2.size === undefined
            ) {
              return input2;
            }
            let state2 = {
              ...input2,
            };
            delete state2.size;
            return state2;
          },
          value60 = callback77(
            value59.x,
            input !== null &&
              (0, runtime.nodeHasIntrinsicSize)(value59.node, "x"),
          ),
          value61 = callback77(
            value59.y,
            options !== null &&
              (0, runtime.nodeHasIntrinsicSize)(value59.node, "y"),
          );
        if (value60 === value59.x && value61 === value59.y) {
          return;
        }
        onChangeSlide(
          (0, runtime.updateSlideFrame)(
            slide,
            value59.id,
            (input2) => ({
              ...input2,
              x: value60,
              y: value61,
              node: (0, runtime.resetImageDimensions)(
                input2.node,
                value60 !== value59.x,
                value61 !== value59.y,
                assets,
              ),
            }),
          ),
        );
      },
      callback59 = (
        input: SelectionGrip,
        options: ReactPointerEvent<HTMLDivElement>,
        context?: { inFlow?: boolean },
      ) => {
        if (readOnly || !singleTransformTarget || !lastSelectedRect) {
          return;
        }
        options.stopPropagation();
        if (ref13.current.has(options.pointerId)) {
          return;
        }
        if (
          (0, runtime.isMacControlClick)(options) ||
          !(0, runtime.startCanvasDrag)(options)
        ) {
          return;
        }
        callback8();
        let value59 = placementSideToSnapLine(input.x),
          value60 = placementSideToSnapLine(input.y),
          value61 = lastSelectedRect.rotation ?? 0;
        if (singleTransformTarget.flow) {
          let unit = singleTransformTarget.unit,
            value64 = (0, runtime.selectedNode)(slide, unit),
            value65 = (0, runtime.frameById)(
              slide,
              unit.frameId,
            )?.node;
          if (!value64 || !value65) {
            return;
          }
          let value66 = (0, runtime.selectionNodePath)(unit),
            value67 = frameElementsRef.current
              .get(unit.frameId)
              ?.querySelector('[data-node-path="' + value66.join(".") + '"]'),
            value68 =
              value67 && !(value67 instanceof HTMLElement)
                ? getComputedStyle(value67)
                : null,
            value69 =
              value67 instanceof HTMLElement
                ? {
                    w: value67.offsetWidth,
                    h: value67.offsetHeight,
                  }
                : value68 &&
                    parseFloat(value68.width) > 0 &&
                    parseFloat(value68.height) > 0
                  ? {
                      w: parseFloat(value68.width),
                      h: parseFloat(value68.height),
                    }
                  : {
                      w: lastSelectedRect.w,
                      h: lastSelectedRect.h,
                    },
            value70: CanvasFlowResizeDrag["breakout"] = null,
            value71 =
              (0, runtime.isFlowContainer)(value65) &&
              (0, runtime.styleHasVisiblePaint)(value65.style),
            value72 =
              value61 === 0 &&
              (lastSelectedRect.nodeScale ?? 1) === 1 &&
              context?.inFlow !== true
                ? callback36(unit.frameId)
                : null,
            value73 = value72
              ? callback39(unit.frameId, value66)
              : null,
            value74 = value73 ? callback26(unit.frameId) : null;
          if (value72 && value73 && value74) {
            let { lift: value75, pin: value76 } =
                collectCollapsibleFlowAncestors(
                  value65,
                  value66,
                  value71 ? 0 : 1,
                ),
              value77 =
                value71 || value66.length > 1
                  ? [[...value66], ...value75]
                  : value75,
              value78 = [
                ...value66.map(
                  (input2, options2) =>
                    value66.slice(0, options2),
                ),
                ...(value71
                  ? []
                  : ((0, runtime.nodeChildren)(value65) ?? []).map(
                      (input2, options2) => [
                        options2,
                      ],
                    )),
                ...value77,
              ].every((input2) => {
                let value82 = (0, runtime.nodeAtPath)(value65, input2);
                return (
                  value82 === undefined ||
                  (0, runtime.nodeTransform)(value82) === undefined
                );
              }),
              value79 = value77.flatMap(
                (input2) => {
                  let value82 = (0, runtime.nodePathsEqual)(
                    input2,
                    value66,
                  )
                    ? value73
                    : callback39(unit.frameId, input2);
                  if (value82) {
                    return [
                      {
                        path: input2,
                        rect: value82,
                      },
                    ];
                  } else {
                    return [];
                  }
                },
              ),
              value80 = value76.flatMap(
                (input2) => {
                  let value82 = callback39(unit.frameId, input2);
                  if (value82) {
                    return [
                      {
                        path: input2,
                        w: value82.w,
                        h: value82.h,
                      },
                    ];
                  } else {
                    return [];
                  }
                },
              ),
              state2: FlowDragRequest = {
                frameId: unit.frameId,
                children: value72,
                selectedChildren: [],
                deep: value79,
                pins: value80,
              };
            if (value71) {
              state2.keep = value74.layout;
            } else {
              state2.dragIndex = value66[0];
            }
            if (value71 || value66.length > 1) {
              state2.dragPath = [...value66];
            }
            let value81 = value71
              ? [value74.startRect]
              : value72
                  .filter(
                    (input2, options2) =>
                      options2 !== value66[0] || value66.length > 1,
                  )
                  .map((input2) => input2.rect);
            if (value78) {
              value70 = {
                rect: value73,
                record: state2,
                siblingRects: value74.siblingRects.concat(
                  value81,
                  value79
                    .filter(
                      (input2) =>
                        !(0, runtime.nodePathsEqual)(input2.path, value66),
                    )
                    .map((input2) => input2.rect),
                ),
              };
            }
          }
          dragSessionRef.current = {
            kind: "flow-resize",
            frameId: unit.frameId,
            path: value66,
            pointerId: options.pointerId,
            type: options.pointerType,
            k: ref8.current.scale,
            downX: options.clientX,
            downY: options.clientY,
            startX: options.clientX,
            startY: options.clientY,
            before: slide,
            xEdge: value59,
            yEdge: value60,
            w: value69.w,
            h: value69.h,
            rotation: value61,
            nodeScale: lastSelectedRect.nodeScale ?? 1,
            mainAxis: singleTransformTarget.mainAxis,
            minW: (0, runtime.minimumNodeResizeSize)(value64, value69.w),
            minH: (0, runtime.minimumNodeResizeSize)(value64, value69.h),
            moved: false,
            breakout: value70,
          };
          if (options.pointerType !== "touch") {
            copySelectedUnitsToClipboard(input, value61);
          }
          return;
        }
        let value62 = (0, runtime.frameById)(
          slide,
          singleTransformTarget.unit.frameId,
        );
        if (!value62) {
          return;
        }
        let value63 = callback26(value62.id);
        if (!value63) {
          return;
        }
        dragSessionRef.current = {
          kind: "resize",
          frameId: value62.id,
          pointerId: options.pointerId,
          type: options.pointerType,
          k: ref8.current.scale,
          downX: options.clientX,
          downY: options.clientY,
          startX: options.clientX,
          startY: options.clientY,
          before: slide,
          xSpec: value62.x,
          ySpec: value62.y,
          xEdge: value59,
          yEdge: value60,
          w: value63.layout.w,
          h: value63.layout.h,
          rotation: value61,
          nodeScale: lastSelectedRect.nodeScale ?? 1,
          moved: false,
          applyBase: slide,
          startRect: value63.startRect,
          candidates: (0, runtime.buildSiblingSnapCandidates)(
            value63.siblingRects,
          ),
        };
        if (options.pointerType !== "touch") {
          copySelectedUnitsToClipboard(input, value61);
        }
      },
      callback60 = (input: HTMLElement | null) => {
        let items: RectangleAttachmentPoint[] = [];
        for (let [value59, value60] of frameElementsRef.current) {
          let value61 = (0, runtime.frameById)(slide, value59);
          if (!value61 || !value60.isConnected) {
            continue;
          }
          for (let value62 of value60.querySelectorAll<HTMLElement>(
            "[data-node-path]",
          )) {
            if (value62 === input) {
              continue;
            }
            let value63 = parseEditorNodePath(
                value62.getAttribute("data-node-path"),
              ),
              value64 = callback39(value59, value63);
            if (!value64 || value64.w <= 0 || value64.h <= 0) {
              continue;
            }
            let value65 = (0, runtime.nodeAtPath)(
              value61.node,
              value63,
            );
            if (value65?.kind === "spacer") {
              continue;
            }
            if (
              value65 !== undefined &&
              (0, runtime.isConnectorNode)(value65)
            ) {
              for (let [value66, value67] of (0,
              runtime.absoluteConnectorEndpoints)(
                value64,
                value65.from,
                value65.strokeWidth,
              ))
                items.push({
                  x: value66,
                  y: value67,
                  box: value64,
                });
            } else if (
              value65 !== undefined &&
              (0, runtime.isLineShapeNode)(value65)
            ) {
              let value66 = value62.offsetWidth || value64.w,
                value67 = value62.offsetHeight || value64.h,
                state2 = {
                  x: value64.x + (value64.w - value66) / 2,
                  y: value64.y + (value64.h - value67) / 2,
                  w: value66,
                  h: value67,
                };
              for (let [value68, value69] of (0, runtime.lineShapeEndpoints)(
                state2,
                value65.rotate,
              ))
                items.push({
                  x: value68,
                  y: value69,
                  box: value64,
                });
              items.push({
                x: state2.x + state2.w / 2,
                y: state2.y + state2.h / 2,
                box: value64,
              });
            } else {
              items.push(...(0, runtime.rectangleAttachmentPoints)([value64]));
            }
          }
        }
        return items;
      },
      callback61 = (input: 0 | 1, options: ReactPointerEvent<HTMLDivElement>) => {
        if (readOnly || selection.length !== 1 || !lastSelectedRect) {
          return;
        }
        options.stopPropagation();
        if (ref13.current.has(options.pointerId)) {
          return;
        }
        let value59 = selection[0]!,
          value60 = (0, runtime.frameById)(slide, value59.frameId),
          value61 = (0, runtime.selectedNode)(slide, value59);
        if (
          !value60 ||
          value61 === undefined ||
          !(
            (0, runtime.isConnectorNode)(value61) ||
            (0, runtime.isLineShapeNode)(value61)
          )
        ) {
          return;
        }
        let value62 = (0, runtime.isLineShapeNode)(value61),
          value63 = (0, runtime.selectionNodePath)(value59),
          value64 =
            value63.length > 0
              ? (0, runtime.nodeAtPath)(value60.node, value63.slice(0, -1))
              : undefined,
          value65 = value62
            ? (0, runtime.lineShapeEndpoints)(lastSelectedRect, value61.rotate)
            : (0, runtime.absoluteConnectorEndpoints)(
                lastSelectedRect,
                value61.from,
                value61.strokeWidth,
              );
        if (value64 !== undefined && (0, runtime.isFlowContainer)(value64)) {
          let value72 =
              2 * (0, runtime.connectorArrowInset)(value61.strokeWidth) + 0.5,
            value73 = value65[input === 0 ? 0 : 1];
          callback59(
            value62
              ? lastSelectedRect.w >= lastSelectedRect.h
                ? {
                    x: input === 0 ? "left" : "right",
                    y: null,
                  }
                : {
                    x: null,
                    y: input === 0 ? "top" : "bottom",
                  }
              : {
                  x:
                    lastSelectedRect.w <= value72
                      ? null
                      : value73[0] < lastSelectedRect.x + lastSelectedRect.w / 2
                        ? "left"
                        : "right",
                  y:
                    lastSelectedRect.h <= value72
                      ? null
                      : value73[1] < lastSelectedRect.y + lastSelectedRect.h / 2
                        ? "top"
                        : "bottom",
                },
            options,
            {
              inFlow: true,
            },
          );
          return;
        }
        let value66 =
          value64 !== undefined && (0, runtime.isOverlayNode)(value64)
            ? value64.layers[value63[value63.length - 1]! - 1]
            : undefined;
        if (value63.length > 0 && value66 === undefined) {
          return;
        }
        if (
          (0, runtime.isMacControlClick)(options) ||
          !(0, runtime.startCanvasDrag)(options)
        ) {
          return;
        }
        callback8();
        let items: [number, number] = [0, 0],
          items2: [number, number] = [runtime.SLIDE_WIDTH, runtime.SLIDE_HEIGHT],
          value67 = (0, runtime.frameBounds)(
            value60.x,
            value60.y,
            lastSelectedRect.w,
            lastSelectedRect.h,
          ),
          entry = frameElementsRef.current.get(value59.frameId);
        if (value66 !== undefined) {
          let value72 = entry?.querySelector<HTMLElement>(
              '[data-node-path="' + value63.slice(0, -1).join(".") + '"]',
            ),
            value73 = callback39(
              value59.frameId,
              value63.slice(0, -1),
            );
          if (!value72 || !value73) {
            return;
          }
          items = [
            value73.x + value72.clientLeft,
            value73.y + value72.clientTop,
          ];
          items2 = [value72.clientWidth, value72.clientHeight];
          let value74 = (0, runtime.resolveAxisSpec)(
              value66.x,
              items2[0],
              lastSelectedRect.w,
            ),
            value75 = (0, runtime.resolveAxisSpec)(
              value66.y,
              items2[1],
              lastSelectedRect.h,
            );
          value67 = {
            x: value74.start,
            y: value75.start,
            w: value74.size,
            h: value75.size,
          };
        }
        let value68 = value62
            ? (0, runtime.lineShapeEndpoints)(value67, value61.rotate)
            : (0, runtime.absoluteConnectorEndpoints)(
                value67,
                value61.from,
                value61.strokeWidth,
              ),
          value69 =
            entry?.querySelector<HTMLElement>(
              '[data-node-path="' + value63.join(".") + '"]',
            ) ?? null,
          value70 = value62
            ? 0
            : (0, runtime.connectorArrowInset)(value61.strokeWidth),
          value71 = callback60(value69).filter(
            (input2) =>
              input2.x >= items[0] + value70 - 0.5 &&
              input2.y >= items[1] + value70 - 0.5,
          );
        dragSessionRef.current = {
          kind: "endpoint",
          frameId: value59.frameId,
          path: value63,
          which: input === 0 ? 0 : 1,
          pointerId: options.pointerId,
          type: options.pointerType,
          k: ref8.current.scale,
          downX: options.clientX,
          downY: options.clientY,
          startX: options.clientX,
          startY: options.clientY,
          before: slide,
          strokeWidth: value61.strokeWidth,
          bar: value62
            ? {
                thickness: Math.min(value67.w, value67.h),
                span: items2,
              }
            : null,
          start: [
            value68[input === 0 ? 0 : 1][0] + items[0],
            value68[input === 0 ? 0 : 1][1] + items[1],
          ],
          fixed: value68[input === 0 ? 1 : 0],
          origin: items,
          sites: value71,
          last: null,
          moved: false,
        };
        if (options.pointerType !== "touch") {
          (0, runtime.setGestureCursor)("move");
        }
      },
      callback62 = (input: RotateCorner, options: ReactPointerEvent<HTMLDivElement>) => {
        if (readOnly || !singleStyleTarget) {
          return;
        }
        options.stopPropagation();
        if (ref13.current.has(options.pointerId)) {
          return;
        }
        if (
          (0, runtime.isMacControlClick)(options) ||
          !(0, runtime.startCanvasDrag)(options)
        ) {
          return;
        }
        callback8();
        let value59 = singleStyleTarget,
          value60 = (0, runtime.selectedNode)(slide, value59),
          entry = frameElementsRef.current.get(value59.frameId),
          value61 = entry?.offsetParent,
          value62 = entry?.querySelector<HTMLElement>(
            '[data-node-path="' +
              (0, runtime.selectionNodePath)(value59).join(".") +
              '"]',
          );
        if (!value60 || !value61 || !value62) {
          return;
        }
        let bounds = value61.getBoundingClientRect(),
          bounds2 = value62.getBoundingClientRect(),
          scale3 = ref8.current.scale,
          value63 = bounds2.left + bounds2.width / 2,
          value64 = bounds2.top + bounds2.height / 2,
          value65 = (0, runtime.nodeTransform)(value60)?.rotate ?? 0;
        dragSessionRef.current = {
          kind: "rotate",
          frameId: value59.frameId,
          path: (0, runtime.selectionNodePath)(value59),
          pointerId: options.pointerId,
          type: options.pointerType,
          k: scale3,
          downX: options.clientX,
          downY: options.clientY,
          startX: options.clientX,
          startY: options.clientY,
          before: slide,
          corner: input,
          cx: (value63 - bounds.left) / scale3,
          cy: (value64 - bounds.top) / scale3,
          startBearing: (0, runtime.angleBetweenPoints)(
            value63,
            value64,
            options.clientX,
            options.clientY,
          ),
          startDeg: value65,
          lastDeg: null,
          moved: false,
        };
        if (options.pointerType !== "touch") {
          (0, runtime.setGestureCursor)(
            (0, runtime.rotatedGrabCursor)(input, (value65 * Math.PI) / 180),
          );
        }
      },
      callback63 = (event: ReactMouseEvent<HTMLDivElement>) => {
        if (readOnly) {
          return;
        }
        let value59 = chooseTextEditingTarget(
            event.target as Element,
            event.clientX,
            event.clientY,
          ),
          callback77 = (input: string | null) =>
            (input ?? "")
              .split(".")
              .filter((input2) => input2 !== "")
              .map(Number),
          ancestor = value59.closest("[data-cell]");
        if (ancestor) {
          let ancestor5 = ancestor.closest("[data-node-path]"),
            ancestor6 = ancestor.closest("[data-frame-id]");
          if (!ancestor5 || !ancestor6) {
            return;
          }
          let attribute2 = ancestor6.getAttribute("data-frame-id")!,
            value63 = callback77(
              ancestor5.getAttribute("data-node-path"),
            ),
            value64 = (0, runtime.frameById)(slide, attribute2),
            value65 = value64
              ? (0, runtime.nodeAtPath)(value64.node, value63)
              : undefined;
          if (!(0, runtime.isTableNode)(value65)) {
            return;
          }
          let [value66, value67] = (
              ancestor.getAttribute("data-cell") ?? ""
            ).split("."),
            value68 = Number(value66),
            value69 = Number(value67);
          if (!(0, runtime.tableCellExists)(value65, value68, value69)) {
            return;
          }
          onSelectionChange([
            (0, runtime.createNodeSelection)(attribute2, value63),
          ]);
          onTextEdit({
            frameId: attribute2,
            path: value63,
            cell: {
              r: value68,
              c: value69,
            },
          });
          return;
        }
        let ancestor2 = value59.closest("[data-img-path]"),
          value60 = ancestor2
            ?.closest("[data-frame-id]")
            ?.getAttribute("data-frame-id");
        if (ancestor2 && value60 != null) {
          let value63 = (0, runtime.createNodeSelection)(
            value60,
            callback77(ancestor2.getAttribute("data-img-path")),
          );
          if (callback29(value63)) {
            onSelectionChange([value63]);
          }
          return;
        }
        let ancestor3 = value59.closest("[data-text-path]"),
          ancestor4 = value59.closest("[data-frame-id]");
        if (!ancestor3 && ancestor4) {
          let value63 = (0, runtime.frameById)(
              slide,
              ancestor4.getAttribute("data-frame-id")!,
            ),
            value64 = value63
              ? (0, runtime.pointerSelectsGroup)(
                  value63.id,
                  value63.node,
                  callback77(
                    value59
                      .closest("[data-node-path]")
                      ?.getAttribute("data-node-path") ?? null,
                  ),
                  selection,
                  getFrameHitTestOptions(slide, value63),
                )
              : null;
          if (value64 !== null) {
            onSelectionChange([value64]);
          }
          return;
        }
        if (!ancestor3 || !ancestor4) {
          return;
        }
        let attribute = ancestor4.getAttribute("data-frame-id")!,
          value61 = callback77(
            ancestor3.getAttribute("data-text-path"),
          ),
          value62 = (0, runtime.frameById)(slide, attribute);
        if (!value62) {
          return;
        }
        if (
          (0, runtime.isEditableTextNode)(
            (0, runtime.nodeAtPath)(value62.node, value61),
          )
        ) {
          onSelectionChange([
            (0, runtime.createNodeSelection)(attribute, value61),
          ]);
          onTextEdit({
            frameId: attribute,
            path: value61,
          });
        }
      },
      ref52 = runtime.reactK_.useRef<TextEditDraft | null>(null),
      ref53 = runtime.reactK_.useRef(false),
      [value34, value35] = runtime.reactK_.useState<TextLinkDraft | null>(null),
      ref54 = runtime.reactK_.useRef<string | null>(null),
      value36: string | null = textEdit
        ? textEdit.frameId +
          ":" +
          textEdit.path.join(".") +
          (textEdit.cell
            ? ":" + String(textEdit.cell.r) + "." + String(textEdit.cell.c)
            : "")
        : null;
    if (value34 !== null && ref54.current !== value36) {
      value35(null);
    }
    if (value36 === null) {
      ref52.current = null;
    } else if (ref52.current?.key !== value36) {
      let value59 = (0, runtime.frameById)(slide, textEdit!.frameId),
        value60 = value59
          ? (0, runtime.nodeAtPath)(value59.node, textEdit!.path)
          : undefined,
        cell = textEdit!.cell;
      ref52.current = {
        key: value36,
        ...((0, runtime.slideGeneration)(slide) !== undefined
          ? {
              gen: (0, runtime.slideGeneration)(slide),
            }
          : {}),
        text: cell
          ? (0, runtime.isTableNode)(value60)
            ? (value60.rows[cell.r]?.[cell.c] ?? "")
            : ""
          : (0, runtime.isEditableTextNode)(value60)
            ? value60.text
            : "",
        ...(cell === undefined && (0, runtime.isEditableTextNode)(value60)
          ? {
              marks: value60.marks,
              list: value60.list,
            }
          : {}),
      };
    }
    let value37 = (() => {
        let current = ref52.current;
        if (
          textEdit !== null &&
          current !== null &&
          current.key === value36 &&
          (0, runtime.isSlideGenerationStale)(current.gen, slide)
        ) {
          if (current.dirty === true) {
            ref53.current = true;
          }
          current.dirty = false;
          return true;
        }
        if (
          textEdit === null ||
          current === null ||
          current.key !== value36 ||
          current.dirty === true
        ) {
          return false;
        }
        let value59 = (0, runtime.frameById)(slide, textEdit.frameId),
          value60 = value59
            ? (0, runtime.nodeAtPath)(value59.node, textEdit.path)
            : undefined;
        if (
          (textEdit.cell
            ? (0, runtime.isTableNode)(value60)
              ? (value60.rows[textEdit.cell.r]?.[textEdit.cell.c] ?? "")
              : ""
            : (0, runtime.isEditableTextNode)(value60)
              ? value60.text
              : "") !== current.text
        ) {
          return true;
        }
        if (textEdit.cell || !(0, runtime.isEditableTextNode)(value60)) {
          return false;
        }
        return (
          JSON.stringify([value60.marks ?? [], value60.list ?? null]) !==
          JSON.stringify([current.marks ?? [], current.list ?? null])
        );
      })(),
      value38 =
        textEdit !== null &&
        (!getSelectedTextStyle(slide, textEdit) || value37);
    runtime.reactK_.useEffect(() => {
      if (!value38) {
        return;
      }
      onTextEdit(null);
      if (ref53.current) {
        ref53.current = false;
        onGestureEnd(slide);
      }
    }, [value38, onTextEdit, onGestureEnd, slide]);
    let callback64 = runtime.reactK_.useCallback(
        (input: CanvasTextEdit, options: string) =>
          (0, runtime.updateSlideFrame)(
            slide,
            input.frameId,
            (input2) => ({
              ...input2,
              node: (0, runtime.updateNodeAtPath)(
                input2.node,
                input.path,
                (source) =>
                  source.kind === "text"
                    ? {
                        ...source,
                        text: options,
                      }
                    : source,
              ),
            }),
          ),
        [slide],
      ),
      callback65 = runtime.reactK_.useCallback(
        (input: CanvasTextEdit, options: TextEditContent) =>
          (0, runtime.updateSlideFrame)(
            slide,
            input.frameId,
            (input2) => ({
              ...input2,
              node: (0, runtime.updateNodeAtPath)(
                input2.node,
                input.path,
                (source) => {
                  if (source.kind !== "text") {
                    return source;
                  }
                  let state2 = {
                    ...source,
                    text: options.text,
                  };
                  if (options.marks !== undefined && options.marks.length > 0) {
                    state2.marks = options.marks;
                  } else {
                    delete state2.marks;
                  }
                  if (options.list !== undefined) {
                    state2.list = options.list;
                  } else {
                    delete state2.list;
                  }
                  return state2;
                },
              ),
            }),
          ),
        [slide],
      ),
      callback66 = runtime.reactK_.useCallback(
        (input: CanvasTextEdit, options: string) => {
          let cell = input.cell;
          if (!cell) {
            return slide;
          }
          return (0, runtime.updateSlideFrame)(
            slide,
            input.frameId,
            (input2) => ({
              ...input2,
              node: (0, runtime.updateNodeAtPath)(
                input2.node,
                input.path,
                (source) =>
                  source.kind === "table"
                    ? (0, runtime.setTableCellText)(
                        source,
                        cell.r,
                        cell.c,
                        options,
                      )
                    : source,
              ),
            }),
          );
        },
        [slide],
      ),
      ref55 = runtime.reactK_.useRef<string | null>(null);
    runtime.reactK_.useEffect(() => {
      if (!readOnly) {
        ref55.current = null;
        return;
      }
      let current = ref26.current,
        current2 = ref52.current;
      if (
        current === null ||
        current2 === null ||
        current2.dirty !== true ||
        ref55.current === current2.key
      ) {
        return;
      }
      ref55.current = current2.key;
      onLiveChange(
        current.cell
          ? callback66(current, current2.text)
          : callback65(current, {
              text: current2.text,
              marks: current2.marks,
              list: current2.list,
            }),
      );
    }, [readOnly, onLiveChange, callback66, callback65]);
    let callback67 = (
        input: CanvasTextEdit,
        options: number,
        context: number,
      ): CanvasTextEdit | null => {
        let cell = input.cell,
          value59 = (0, runtime.frameById)(slide, input.frameId),
          value60 = value59
            ? (0, runtime.nodeAtPath)(value59.node, input.path)
            : undefined;
        if (!cell || !(0, runtime.isTableNode)(value60)) {
          return null;
        }
        let value61 = cell.r + options,
          value62 = cell.c + context;
        if (value62 >= value60.cols) {
          value62 = 0;
          value61 += 1;
        } else if (value62 < 0) {
          value62 = value60.cols - 1;
          value61 -= 1;
        }
        if (value61 < 0 || value61 >= value60.rows.length) {
          return null;
        }
        return {
          frameId: input.frameId,
          path: input.path,
          cell: {
            r: value61,
            c: value62,
          },
        };
      },
      value39: SlideEditSession | null = null,
      callback68 = () => slide,
      callback69 = (input: RichTextFormatName) => {
        return;
      };
    if (textEdit && ref52.current && !value38) {
      let text = ref52.current.text,
        value59 = textEdit,
        callback77 = (input: string) =>
          value59.cell
            ? callback66(value59, input)
            : callback64(value59, input),
        callback78 = (input: string) =>
          value59.cell ? trimTrailingTextNewlines(input) : input,
        current = ref52.current,
        callback79 = () =>
          ref26.current !== value59 || current.closed === true,
        callback80 = (input: Slide) => {
          if (current.dirty !== true) {
            return;
          }
          onLiveChange(input);
          onGestureEnd(input);
        },
        callback81 = (input: string) => {
          if (current.dirty !== true) {
            return;
          }
          if (input === text) {
            callback80(callback77(text));
            return;
          }
          onLiveChange(callback77(input));
          onGestureEnd(callback77(text));
        },
        callback82 = () => ({
          text: current.text,
          marks: current.marks,
          list: current.list,
        }),
        callback83 = (input: TextMark, options: TextMark) =>
          input.start === options.start &&
          input.end === options.end &&
          input.bold === options.bold &&
          input.italic === options.italic &&
          input.underline === options.underline &&
          input.color === options.color &&
          input.href === options.href,
        callback84 = (input: EditableRichText) => {
          let value60 = callback82(),
            value61 = input.marks ?? [],
            value62 = value60.marks ?? [];
          return (
            input.text === value60.text &&
            value61.length === value62.length &&
            value61.every(
              (input2, options) =>
                callback83(input2, value62[options]!),
            ) &&
            (input.list ?? null) === (value60.list ?? null)
          );
        },
        callback85 = (input: EditableRichText) => {
          if (current.dirty !== true) {
            return;
          }
          if (callback84(input)) {
            callback80(callback65(value59, callback82()));
            return;
          }
          onLiveChange(callback65(value59, input));
          onGestureEnd(callback65(value59, callback82()));
        };
      if (!value59.cell) {
        callback68 = () => {
          if (current.dirty !== true || callback79()) {
            return slide;
          }
          let element = (document).querySelector(
            "[data-text-path][contenteditable]",
          );
          if (element === null) {
            return slide;
          }
          let value60 = (0, runtime.readEditableRichText)(element),
            value61 = callback65(value59, callback82()),
            value62 = callback65(value59, value60);
          onLiveChange(value62);
          onGestureEnd(value61);
          current.text = value60.text;
          current.marks =
            value60.marks !== undefined && value60.marks.length > 0
              ? value60.marks
              : undefined;
          current.list = value60.list;
          current.dirty = false;
          return value62;
        };
      }
      value39 = {
        frameId: value59.frameId,
        path: value59.path.join("."),
        ...(value59.cell
          ? {
              cell: value59.cell,
            }
          : {}),
        ...(value59.caret
          ? {
              caret: value59.caret,
            }
          : {}),
        ...(value9 !== null
          ? {
              reselect: true,
            }
          : {}),
        initialText: text,
        onInput: (input: string) => {
          if (callback79()) {
            return;
          }
          current.dirty = true;
          onLiveChange(callback77(input));
        },
        onCommit: (input: string) => {
          if (callback79()) {
            return;
          }
          current.closed = true;
          onTextEdit(null);
          callback81(callback78(input));
        },
        ...(value59.cell
          ? {}
          : {
              onRichInput: (input: EditableRichText) => {
                if (callback79()) {
                  return;
                }
                current.dirty = true;
                onLiveChange(callback65(value59, input));
              },
              onRichCommit: (input: EditableRichText) => {
                if (callback79()) {
                  return;
                }
                current.closed = true;
                onTextEdit(null);
                callback85(input);
              },
              onFormat: (input: RichTextFormatName) => {
                if (!callback79()) {
                  callback69(input);
                }
              },
            }),
        onCommitMove: (
          input: string,
          options: number,
          context: number,
        ) => {
          if (callback79()) {
            return;
          }
          let value60 = callback78(input),
            value61 = callback67(value59, options, context);
          if (value61 === null && context > 0 && value59.cell !== undefined) {
            let value62 = (0, runtime.frameById)(
                slide,
                value59.frameId,
              ),
              value63 = value62
                ? (0, runtime.nodeAtPath)(value62.node, value59.path)
                : undefined;
            if (
              (0, runtime.isTableNode)(value63) &&
              value63.rows.length < runtime.maxTableRows &&
              callback32(value63.cols) === null
            ) {
              callback81(value60);
              let value64 =
                current.dirty === true ? callback77(value60) : slide;
              callback34(
                value64,
                value59.frameId,
                value59.path,
                (input2) =>
                  (0, runtime.insertTableRow)(input2, input2.rows.length),
              );
              runtime.FrameViewportReactDom.flushSync(
                () => onTextEdit(null),
              );
              onTextEdit({
                frameId: value59.frameId,
                path: value59.path,
                cell: {
                  r: value63.rows.length,
                  c: 0,
                },
              });
              return;
            }
          }
          if (value61 === null) {
            current.closed = true;
          }
          callback81(value60);
          onTextEdit(value61);
        },
      };
    }
    let callback70 = (input: { clientX: number; clientY: number }) => {
        let value59 = slideSurfaceRef.current?.getBoundingClientRect();
        if (!value59) {
          return {
            x: runtime.SLIDE_WIDTH / 2,
            y: runtime.SLIDE_HEIGHT / 2,
          };
        }
        return {
          x: Math.min(
            runtime.SLIDE_WIDTH,
            Math.max(0, (input.clientX - value59.left) / scale),
          ),
          y: Math.min(
            runtime.SLIDE_HEIGHT,
            Math.max(0, (input.clientY - value59.top) / scale),
          ),
        };
      },
      callback71 = (event: ReactDragEvent<HTMLDivElement>) => {
        let types = event.dataTransfer.types;
        if (
          types.includes("Files") ||
          types.includes("application/x-slides-insert")
        ) {
          event.preventDefault();
          event.dataTransfer.dropEffect = readOnly ? "none" : "copy";
        }
      },
      callback72 = (event: ReactDragEvent<HTMLDivElement>) => {
        if (readOnly) {
          event.preventDefault();
          return;
        }
        let value59 = event.dataTransfer.getData(
            "application/x-slides-insert",
          ),
          value60 = callback70(event);
        if (value59 !== "") {
          event.preventDefault();
          onDropInsert?.(value59, value60.x, value60.y);
          return;
        }
        let items = [...event.dataTransfer.files],
          value61 =
            items.find(runtime.isImageFile) ?? items.find(runtime.isVideoFile);
        if (value61) {
          event.preventDefault();
          onDropImage?.(value61, value60.x, value60.y);
        } else if (items.length > 0) {
          event.preventDefault();
          (0, runtime.showToast)(
            "Only image and video files (.mp4, .mov, .webm) can be dropped on a slide.",
          );
        }
      },
      value40 = null;
    ref19.current = null;
    let value41 =
        onOpenInspector ??
        onChangeSlide ??
        ((0, runtime.commentsAvailable)() ? true : undefined),
      value42 =
        !readOnly && value41 !== undefined && !selectionMenuHidden,
      value43 =
        textEdit !== null &&
        textEdit.cell === undefined &&
        value39?.onRichInput !== undefined &&
        lastSelectedUnit !== undefined &&
        lastSelectedUnit.frameId === textEdit.frameId &&
        (0, runtime.nodePathsEqual)(
          (0, runtime.selectionNodePath)(lastSelectedUnit),
          textEdit.path,
        ),
      value44 = (0, runtime.commonSelectedNodeKind)(slide, selection),
      value45 = lastSelectedUnit
        ? (0, runtime.selectedNode)(slide, lastSelectedUnit)
        : undefined,
      value46 = EDITOR_FORMATTING_LABELS[value44 ?? "mixed"],
      value47 = (0, runtime.createRovingKeyHandler)(callback16),
      value48 =
        onChangeSlide !== undefined &&
        value44 === "text" &&
        value45?.kind === "text"
          ? value45
          : null,
      callback73 = (input: (node: TextNode) => SlideNode) => {
        if (onChangeSlide === undefined) {
          return;
        }
        let value59 = value43 ? callback68() : slide;
        onChangeSlide(
          selection.reduce(
            (input2, options) =>
              (0, runtime.updateSelectedNode)(
                input2,
                options,
                (source) =>
                  source.kind === "text" ? input(source) : source,
              ),
            value59,
          ),
        );
      },
      value49 = (0, runtime.getRenderingTheme)(),
      value50 =
        value48 !== null && (0, runtime.nodeIsBold)(value48, value49),
      value51 = value48 !== null && (0, runtime.nodeIsItalic)(value48),
      callback74 = () =>
        callback73(
          (input) =>
            (0, runtime.nodeIsBold)(input, value49) === value50
              ? (0, runtime.toggleNodeBold)(
                  input,
                  value49,
                  (0, runtime.resolveTypographyEmphasisVariant)(
                    input,
                    resolvedTypeStyles,
                    resolvedDeckTypeStyles,
                    value49,
                  ),
                )
              : input,
        ),
      callback75 = () =>
        callback73(
          (input) =>
            (0, runtime.nodeIsItalic)(input) === value51
              ? (0, runtime.toggleNodeItalic)(input)
              : input,
        ),
      value52 =
        value48 === null
          ? []
          : selection
              .map(
                (input) =>
                  (0, runtime.selectedNode)(slide, input),
              )
              .filter(runtime.isEditableTextNode),
      value53 =
        value48 !== null &&
        (0, runtime.nodeIsUnderlined)(
          value52.find(
            (input) =>
              input.style?.textDecorationLine !== "line-through",
          ) ?? value48,
        ),
      callback76 = () =>
        callback73(
          (input) =>
            (0, runtime.nodeIsUnderlined)(input) === value53
              ? (0, runtime.toggleNodeUnderline)(input)
              : input,
        ),
      value54 =
        value48 !== null
          ? ((0, runtime.findTypographyStyle)(
              value48,
              resolvedTypeStyles,
              value49,
            ) ??
            (0, runtime.findTypographyStyle)(
              value48,
              resolvedDeckTypeStyles,
              value49,
            ))
          : null,
      value55 =
        value50 || (value54 !== null && value54.fontWeight >= 600),
      value56 = value51 || value54?.italic === true;
    if (value43 && value48 !== null && !readOnly) {
      callback69 = (input) => {
        let element = (document).querySelector(
            "[data-text-path][contenteditable]",
          ),
          value59 =
            element !== null
              ? (0, runtime.readRichTextSelection)(
                  element,
                  runtime.resolveSlideColor,
                )
              : null,
          [value60, value61, value62] =
            input === "bold"
              ? [value50, value55, callback74]
              : input === "italic"
                ? [value51, value56, callback75]
                : [value53, value53, callback76];
        if (
          input === "underline" &&
          !value60 &&
          (value48.style?.textDecorationLine === "line-through" ||
            value59?.touchesLink === true)
        ) {
          return;
        }
        if (value60 || (value61 && value59?.[input] !== true)) {
          value62();
        } else {
          (0, runtime.executeRichTextCommand)(input);
        }
      };
    }
    if (
      lastSelectedRect !== null &&
      (textEdit === null || value43) &&
      dragSessionRef.current?.moved !== true &&
      value2 === null &&
      value41 !== undefined &&
      !selectionMenuHidden &&
      !readOnly
    ) {
      let value59 = slideSurfaceRef.current?.getBoundingClientRect();
      if (value59) {
        let callback77 = function (input: SlideNodeUpdate) {
            let value102 =
              ref21.current ?? (value43 ? callback68() : slide);
            ref21.current = value102;
            onLiveChange(
              selection.reduce(
                (input2, options) =>
                  (0, runtime.updateSelectedNode)(input2, options, input),
                value102,
              ),
            );
          },
          value60 =
            onChangeSlide !== undefined &&
            selection.length === 1 &&
            value45?.kind === "table"
              ? value45
              : null,
          { style: value61, mixed: value62 } =
            value48 !== null
              ? (0, runtime.matchingTypographyNodes)(
                  value48,
                  value52,
                  resolvedTypeStyles,
                  value49,
                )
              : {
                  style: null,
                  mixed: false,
                },
          value63 =
            value48 !== null &&
            value52.some(
              (input) => input.color !== value48.color,
            ),
          value64 =
            value48 !== null &&
            value52.some(
              (input) =>
                (input.align ?? "start") !== (value48.align ?? "start"),
            ),
          value65 =
            value48 !== null &&
            value52.some(
              (input) => input.list !== value48.list,
            ),
          value66: NodeColorEditor | null = (() => {
            if (
              value45 === undefined ||
              onChangeSlide === undefined ||
              value44 === undefined
            ) {
              return null;
            }
            let value102 = value45;
            if (value102.kind === "shape" && value102.shape === "connector") {
              let value103 =
                (0, runtime.resolveSlideColor)(value102.stroke ?? "clay") ??
                "#D97757";
              return {
                title: "Line color",
                current: value102.stroke ?? "clay",
                seed: value103,
                paint: value103,
                unset: false,
                contrast: undefined,
                apply: (source: SlideNode, options: string) =>
                  source.kind === "shape" && source.shape === "connector"
                    ? {
                        ...source,
                        stroke: options,
                      }
                    : source,
              };
            }
            if (value102.kind === "shape" && value102.shape === "line") {
              let value103 = value102.style?.backgroundColor;
              return {
                title: "Fill color",
                current: value103,
                seed: value103 ?? (0, runtime.themeAccentColor)(),
                paint: value103,
                unset: value103 === undefined,
                contrast: undefined,
                apply: (source: SlideNode, options: string) =>
                  source.kind === "shape" && source.shape === "line"
                    ? (0, runtime.patchNodeStyle)(source, {
                        backgroundColor: options.toLowerCase(),
                      })
                    : source,
              };
            }
            if (value102.kind === "icon") {
              let value103 =
                  (0, runtime.resolveSlideColor)(value102.color) ??
                  (0, runtime.slideTextColor)(slide.bg),
                value104 = selection.some(
                  (input) => {
                    let value105 = (0, runtime.selectedNode)(
                      slide,
                      input,
                    );
                    return (
                      value105?.kind === "icon" &&
                      (value105.color ?? null) !== (value102.color ?? null)
                    );
                  },
                )
                  ? undefined
                  : (0, runtime.selectionContrastBackground)(
                      slide,
                      selection,
                      value49,
                      runtime.ICON_CONTRAST_NODE_KINDS,
                    );
              return {
                title: "Icon color",
                current: value102.color,
                seed: value103,
                paint: value103,
                unset: value102.color === undefined,
                contrast: value104,
                apply: (source: SlideNode, options: string) =>
                  source.kind === "icon"
                    ? {
                        ...source,
                        color: options,
                      }
                    : source,
              };
            }
            return null;
          })(),
          callback78 = (input: string) => {
            if (value66 === null) {
              return;
            }
            let value102 = (0, runtime.slideColorOrUndefined)(input);
            if (value102 !== undefined) {
              callback77(
                (input2) => value66.apply(input2, value102),
              );
            }
          },
          callback79 = () => {
            let current = ref21.current;
            ref21.current = null;
            if (current !== null) {
              onGestureEnd(current);
            }
          },
          callback80 = (
            input: SlideNodeUpdate,
            options?: DeckFontFace,
          ) => {
            if (onChangeSlide === undefined) {
              return;
            }
            let value102 = value43 ? callback68() : slide;
            onChangeSlide(
              selection.reduce(
                (input2, options2) =>
                  (0, runtime.updateSelectedNode)(input2, options2, input),
                value102,
              ),
              options,
            );
          },
          value67: BoxStyleBinding | null =
            value45 !== undefined &&
            value44 !== undefined &&
            (0, runtime.nodeStyleKind)(value45) !== undefined &&
            onChangeSlide !== undefined
              ? {
                  bag:
                    (0, runtime.textListGutter)(value45, slide.lists) !==
                      undefined && value45.style?.paddingLeft === undefined
                      ? {
                          ...value45.style,
                          paddingLeft: runtime.defaultListGutter,
                        }
                      : value45.style,
                  kind: (0, runtime.nodeStyleKind)(value45),
                  fillMixed: selection.some((input) => {
                    let value102 = (0, runtime.selectedNode)(
                      slide,
                      input,
                    )?.style;
                    return (
                      JSON.stringify([
                        value102?.backgroundColor ?? null,
                        value102?.backgroundGradient ?? null,
                      ]) !==
                      JSON.stringify([
                        value45.style?.backgroundColor ?? null,
                        value45.style?.backgroundGradient ?? null,
                      ])
                    );
                  }),
                  commit: (input) =>
                    callback80(
                      (source) =>
                        source.kind === value44 &&
                        (0, runtime.nodeStyleKind)(source) !== undefined
                          ? (0, runtime.updateNodeShapeStyle)(source, input)
                          : source,
                    ),
                  update: (input) =>
                    callback80(
                      (source) =>
                        source.kind === value44 &&
                        (0, runtime.nodeStyleKind)(source) !== undefined
                          ? (0, runtime.updateNodeShapeStyle)(
                              source,
                              input(source.style),
                            )
                          : source,
                    ),
                  live: (input) =>
                    callback77(
                      (source) =>
                        source.kind === value44 &&
                        (0, runtime.nodeStyleKind)(source) !== undefined
                          ? (0, runtime.updateNodeShapeStyle)(source, input)
                          : source,
                    ),
                  liveWith: (input) =>
                    callback77(
                      (source) =>
                        source.kind === value44 &&
                        (0, runtime.nodeStyleKind)(source) !== undefined
                          ? (0, runtime.updateNodeShapeStyle)(
                              source,
                              input(source.style),
                            )
                          : source,
                    ),
                  settle: () => callback79(),
                }
              : null,
          value68 =
            value48 !== null &&
            selection.length === 1 &&
            NODE_BACKGROUND_AND_PADDING_PROPERTIES.some(
              (input) =>
                value48.style?.[input] !== undefined,
            ),
          value69 =
            value67 !== null &&
            (value44 === "stack" || value44 === "grid" || value44 === "overlay")
              ? value45
              : undefined,
          value70 =
            value67 !== null &&
            selection.length === 1 &&
            value45?.kind === "img"
              ? value45
              : null,
          value71 =
            value67 !== null &&
            value44 === "shape" &&
            value45?.kind === "shape" &&
            value45.shape !== "connector" &&
            value45.shape !== "line"
              ? value45
              : null,
          value72 =
            value71 !== null &&
            !selection.some((input) => {
              let value102 = (0, runtime.selectedNode)(slide, input);
              return (
                value102?.kind === "shape" &&
                value102.shape !== "connector" &&
                (0, runtime.shapeHasOutline)(value102.style)
              );
            })
              ? runtime.BORDER_REQUIRED_REASON
              : undefined,
          value73 = value48?.align ?? "start",
          value74 = value7,
          value75 = getEditorViewportBounds(
            stageRef.current,
            topInset,
          ),
          value76 = value75.right - value75.left - 16,
          value77 = value48 !== null && value34 !== null,
          value78 = value48
            ? value77
              ? value7
                ? 320
                : 360
              : (value7 ? 370 : 300) + (value7 ? 125 : 105)
            : 0,
          value79 = value7 ? 44 : 32,
          value80 = value66 !== null ? (value7 ? 52 : 46) : 0,
          value81 =
            (value69 !== undefined || value68
              ? (value7 ? 52 : 46) + value79 * 3 + 16
              : 0) +
            (value71 !== null ? (value7 ? 52 : 46) + value79 + 8 : 0) +
            (value70 !== null
              ? value79 *
                  (value70.video !== undefined ||
                  value70.videoLink !== undefined
                    ? 4
                    : 3) +
                8
              : 0) +
            (value60 !== null ? (value7 ? 200 : 150) : 0),
          value82 =
            ((0, runtime.commentsAvailable)() ? 1 : 0) +
            (value7 && onDeleteSelection !== undefined ? 1 : 0) +
            (onOpenInspector !== undefined ? 1 : 0),
          value83 = value7 ? 0 : 8,
          value84 =
            (value48 && !value77 ? 12 + value83 : 0) +
            (value69 !== undefined || value68 ? 4 + value83 : 0) +
            (value71 !== null ? 2 : 0) +
            (value70 !== null ? 2 : 0) +
            Math.max(0, value82 - 1) * 2 +
            (value82 > 0 && value60 === null ? value83 : 0) +
            value83,
          value85 =
            value78 + value80 + value81 + value82 * value79 + 16 - value84,
          value86 = !value74 && value85 > value76,
          value87 = Math.min(value85, value76),
          value88 = value7 ? 44 : 34,
          value89 =
            !value74 && value87 >= value76 ? value88 * 2 : value88,
          value90 = (0, runtime.rotatedRectBounds_Rn)(
            lastSelectedRect,
          ),
          value91 = null,
          {
            top: value92,
            placed: value93,
            overlaps: value94,
          } = placeFloatingEditorToolbar({
            selTop: value59.top + value90.y * scale,
            selBottom: value59.top + (value90.y + value90.h) * scale,
            menuH: value89,
            bandTop: value75.top,
            bandBottom: constrainEditorBandBottom(
              value75.bottom - (bottomInset ?? 0),
              (window).innerHeight,
              value8,
            ),
            caret: value43
              ? () =>
                  (value91 = ref20.current =
                    getEditableCaretClientRect() ?? ref20.current)
              : () => null,
          });
        ref19.current =
          value94 && value43
            ? {
                box: value91,
              }
            : null;
        let value95 = Math.max(
            value75.left + 8,
            Math.min(
              value59.left + value90.x * scale,
              value75.right - value87 - 8,
            ),
          ),
          value96 =
            lastSelectedUnit != null && (0, runtime.commentsAvailable)()
              ? (input: HTMLElement) => {
                  let bounds = input.getBoundingClientRect();
                  if (value43) {
                    runtime.FrameViewportReactDom.flushSync(
                      () => callback8(),
                    );
                  } else {
                    callback8();
                  }
                  let entry = frameElementsRef.current.get(
                      lastSelectedUnit.frameId,
                    ),
                    value102 =
                      lastSelectedUnit.child === undefined
                        ? entry
                        : entry?.querySelector(
                            '[data-node-path="' +
                              (0, runtime.selectionNodePath)(
                                lastSelectedUnit,
                              ).join(".") +
                              '"]',
                          );
                  if (!value102) {
                    return;
                  }
                  let value103 =
                    lastSelectedUnit.child === undefined
                      ? []
                      : (0, runtime.selectionNodePath)(lastSelectedUnit);
                  if ((0, runtime.getCommentAnchorController)()) {
                    (0, runtime.composeFrameComment)(
                      {
                        kind: "frame",
                        slideId: slide.id,
                        frameId: lastSelectedUnit.frameId,
                        path: value103,
                      },
                      value102,
                      {
                        x: bounds.left + bounds.width / 2,
                        y: bounds.bottom,
                      },
                      (input2) =>
                        (0, runtime.describeFrameCommentAnchor)(
                          slideNumber,
                          slide,
                          input2,
                          allTypeStyles,
                        ),
                    );
                  } else {
                    (0, runtime.openCommentComposer)(value102);
                  }
                }
              : null,
          value97 = (() => {
            if (value48 === null || value67 === null) {
              return null;
            }
            let style = value48.style,
              value102 = style?.fontFamily,
              value103 = (0, runtime.fontFamilyChoiceValue)(
                value102,
                faces,
              ),
              value104 = value49 === "neutral",
              callback81 = (input: TextNode) =>
                (0, runtime.resolveNodeTypographyStyle)(
                  input,
                  resolvedTypeStyles,
                  resolvedDeckTypeStyles,
                  value49,
                ),
              value105 = (0, runtime.nodeTypographyCombo)(
                value48,
                value49,
              ),
              callback82 = (
                input: TypographyScalarProperty,
                options: number,
                context: number,
                value106?: number,
              ) => ({
                value: style?.[input],
                placeholder: String(value105[input]),
                min: options,
                max: context,
                step: value106,
                onValue: (input2: number | undefined) =>
                  input2 === undefined
                    ? callback73((input3) => {
                        let value107 = callback81(input3)?.[input],
                          value108 =
                            input === "letterSpacing"
                              ? 0
                              : (0, runtime.typeScaleForRole)(
                                  input3.role,
                                  value49,
                                )[input];
                        return (0, runtime.patchNodeStyle)(input3, {
                          [input]:
                            value107 === undefined || value107 === value108
                              ? undefined
                              : value107,
                        });
                      })
                    : value67.commit({
                        [input]: input2,
                      }),
                onScrub: (input2: number) =>
                  value67.live({
                    [input]: input2,
                  }),
                onScrubEnd: value67.settle,
              });
            return {
              family: {
                value: value103,
                options: [
                  ...(!value104
                    ? [
                        {
                          value: "",
                          label: "Style default",
                        },
                      ]
                    : value103 === ""
                      ? [
                          {
                            value: "",
                            label: "System font",
                          },
                        ]
                      : []),
                  ...(0, runtime.fontFamilyOptions)(faces, value102, facesFull),
                ],
                searchable: true,
                onOpenChange: (input: boolean) =>
                  input &&
                  (0, runtime.ensureGoogleFonts)(runtime.fontFamilyChoices),
                onChange: (input: string) => {
                  let value106 = (0,
                  runtime.fontFamilyPatchFromChoice)(input, faces, value102);
                  callback80(
                    (source: SlideNode) =>
                      source.kind === value44
                        ? (0, runtime.patchNodeStyle)(source, {
                            fontFamily: value106.fontFamily,
                          })
                        : source,
                    value106.face,
                  );
                },
              },
              face: {
                weight: value105.fontWeight,
                italic: value105.italic,
                faces: (0, runtime.resolvedFontVariants)(
                  value102,
                  value48.role,
                  fonts,
                ),
                onOpenChange: (input: boolean) =>
                  input &&
                  refreshFontOptions((input2) => input2 + 1),
                onChange: (input: number, options: boolean) =>
                  callback80(
                    (source: SlideNode) =>
                      source.kind === "text"
                        ? (0, runtime.patchNodeStyle)(source, {
                            fontWeight:
                              input ===
                              Math.round(
                                (0, runtime.renderingTypeScaleForRole)(
                                  source.role,
                                ).fontWeight / 100,
                              ) *
                                100
                                ? undefined
                                : input,
                            fontStyle: options ? "italic" : undefined,
                          })
                        : source,
                  ),
              },
              size: callback82("fontSize", 8, 400),
              lineHeight: callback82("lineHeight", 0.5, 4, 0.05),
              letterSpacing: callback82("letterSpacing", -24, 32, 0.5),
            };
          })(),
          value98 =
            value70 !== null && lastSelectedUnit != null
              ? lastSelectedUnit
              : null,
          value99 =
            onDeleteSelection === undefined
              ? undefined
              : () => {
                  if (!callback42()) {
                    return;
                  }
                  callback8();
                  deleteSelectionRef.current?.();
                },
          value100 =
            selection.length > 1 ? "Delete these elements" : undefined,
          value101 =
            value98 !== null && imageCropController.session === null
              ? imageCropController.reason(value98)
              : undefined;
        value40 = runtime.FrameViewportReactDom.createPortal(
          CanvasEditorJsx.jsx(runtime.ToolbarStrip, {
            "data-mc-chrome": "",
            "data-slides-strip": "",
            surface: "popover",
            "aria-label": value46,
            onKeyDown: value47,
            ...(value43
              ? {
                  "data-session-strip": "",
                }
              : {}),
            placed: value93,
            coversSelection: value94,
            wrap: !value74,
            style: {
              position: "fixed",
              left: value95,
              top: value92,
              maxWidth: value76,
            },
            children:
              value48 !== null && value97 !== null
                ? CanvasEditorJsx.jsx(TextFormattingToolbar, {
                    selKey: selectionKey2,
                    compact: value86,
                    oneRow: value74,
                    styleValue: value62 || value61 === null ? null : value61.id,
                    styleChip: value62
                      ? "Mixed"
                      : value61 === null
                        ? (0, runtime.nodeTypographyLabel)(value48, value49)
                        : undefined,
                    styleOptions: typeStyleOptions,
                    onStyle: (input: string) => {
                      let value102 = resolvedTypeStyles.find(
                        (input2) => input2.id === input,
                      );
                      if (value102 !== undefined) {
                        callback73(
                          (input2) =>
                            (0, runtime.applyTypographyStyle)(
                              input2,
                              value102,
                              value49,
                            ),
                        );
                      }
                    },
                    custom: value97,
                    color: {
                      value:
                        value63 ||
                        value48.fill !== undefined ||
                        value48.color === undefined
                          ? null
                          : (0, runtime.selectedSwatchName)(
                              colorPalette.quick,
                              value48.color,
                            ),
                      paint: value63
                        ? undefined
                        : ((value48.fill?.kind === "gradient"
                            ? (0, runtime.textFillCssImage)(value48.fill)
                            : undefined) ??
                          (0, runtime.resolveSlideColor)(value48.color) ??
                          (0, runtime.slideTextColor)(slide.bg)),
                      swatches: colorPalette.quick,
                      onChange: (input: string) => {
                        let value102 = (0, runtime.namedSwatchColor)(
                          colorPalette.quick,
                          input,
                        );
                        if (value102 !== undefined) {
                          callback73(
                            (input2) => ({
                              ...(0, runtime.setTextFill)(input2, undefined),
                              color: value102,
                            }),
                          );
                        }
                      },
                      custom: {
                        seed:
                          (0, runtime.resolveSlideColor)(value48.color) ??
                          (0, runtime.slideTextColor)(slide.bg),
                        onChange: (input: string) => {
                          let value102 = (0,
                          runtime.slideColorOrUndefined)(input);
                          if (value102 !== undefined) {
                            callback77(
                              (source: SlideNode) =>
                                source.kind === "text"
                                  ? {
                                      ...(0, runtime.setTextFill)(
                                        source,
                                        undefined,
                                      ),
                                      color: value102,
                                    }
                                  : source,
                            );
                          }
                        },
                        onPickEnd: () => callback79(),
                        contrast:
                          !value63 &&
                          value52.every(
                            (input) =>
                              input.fill === undefined,
                          )
                            ? (0, runtime.selectionContrastBackground)(
                                slide,
                                selection,
                                value49,
                                runtime.TEXT_CONTRAST_NODE_KINDS,
                              )
                            : undefined,
                      },
                      runContrast:
                        value48.fill === undefined
                          ? (0, runtime.selectionContrastBackground)(
                              slide,
                              selection,
                              value49,
                              runtime.TEXT_CONTRAST_NODE_KINDS,
                              {
                                runs: true,
                              },
                            )
                          : undefined,
                      fill: {
                        node: value48,
                        slideBg: slide.bg,
                        swatches: colorPalette.rows,
                        fillMixed: value52.some(
                          (input) =>
                            JSON.stringify(input.fill ?? null) !==
                            JSON.stringify(value48.fill ?? null),
                        ),
                        updateNodes: callback80,
                        liveUpdateNodes: callback77,
                        end: callback79,
                        pickImage: pickImage,
                      },
                    },
                    bold: value50,
                    onBold: callback74,
                    wholeBold: value55,
                    italic: value51,
                    onItalic: callback75,
                    wholeItalic: value56,
                    underline: value53,
                    underlineDead:
                      value48 !== null &&
                      value52.length > 0 &&
                      value52.every(
                        (input) =>
                          input.style?.textDecorationLine === "line-through",
                      )
                        ? (value52.length > 1
                            ? "These texts are"
                            : "This text is") +
                          " struck through (the decoration is set in Properties › Advanced)"
                        : null,
                    onUnderline: callback76,
                    align: value73,
                    alignMixed: value64,
                    onAlign: (input: TextAlignment) =>
                      callback73((input2) => {
                        let state2 = {
                          ...input2,
                        };
                        if (input === "start") {
                          delete state2.align;
                        } else {
                          state2.align = input;
                        }
                        return state2;
                      }),
                    list: value48.list,
                    listMixed: value65,
                    onList: (input: TextNode["list"]) =>
                      callback73(
                        (input2) =>
                          (0, runtime.setNodeList)(input2, input),
                      ),
                    elementLink:
                      value48 !== null
                        ? (0, runtime.nodeUniformLink)(value48)
                        : undefined,
                    onElementLink: (input: string | undefined) =>
                      callback73(
                        (input2) =>
                          input === undefined &&
                          (0, runtime.nodeUniformLink)(input2) === undefined
                            ? input2
                            : (0, runtime.setNodeLink)(input2, input),
                      ),
                    session: value43
                      ? {
                          linkDraft: value34,
                          setLinkDraft: value35,
                          onLinkClick: () => {
                            let value102 = (
                                window
                              ).getSelection(),
                              element = (
                                document
                              ).querySelector<HTMLElement>(
                                "[data-text-path][contenteditable]",
                              );
                            if (
                              !value102 ||
                              value102.rangeCount === 0 ||
                              value102.isCollapsed ||
                              element === null ||
                              !element.contains(value102.anchorNode)
                            ) {
                              return;
                            }
                            ref54.current = value36;
                            value35({
                              range: value102.getRangeAt(0),
                              url: "",
                              editable: element,
                            });
                          },
                          commitFromEditable: (input: Element) => {
                            (0, runtime.clearRichTextUndoState)(input);
                            if (value39?.onRichCommit) {
                              let value102 = (0,
                              runtime.readEditableRichText)(input);
                              value39.onRichCommit({
                                text: value102.text,
                                marks: value102.marks,
                                list: value102.list,
                              });
                            }
                          },
                        }
                      : null,
                    extra:
                      value68 && value67 !== null
                        ? CanvasEditorJsx.jsx(runtime.BoxStyleToolbar, {
                            compact: value86,
                            wrap: !value74,
                            swatches: colorPalette.quick,
                            io: value67,
                            padding: true,
                            corner: (0, runtime.cornerStyleBindings)(value67),
                          })
                        : null,
                    onDelete: value99,
                    deleteTitle: value100,
                    onComment: value96,
                    onOpenInspector: onOpenInspector,
                    moreMenu: moreMenu,
                  })
                : CanvasEditorJsx.jsxs(CanvasEditorJsx.Fragment, {
                    children: [
                      value66 !== null &&
                        CanvasEditorJsx.jsxs(CanvasEditorJsx.Fragment, {
                          children: [
                            CanvasEditorJsx.jsx(runtime.ToolbarGroup, {
                              wrap: !value74,
                              children: CanvasEditorJsx.jsx(
                                runtime.SessionColorPopover,
                                {
                                  testid: "frame-color",
                                  editsAreUndoSteps: true,
                                  title: value66.title,
                                  paint: value66.paint,
                                  swatches: colorPalette.quick,
                                  value:
                                    value66.current !== undefined
                                      ? (0, runtime.selectedSwatchName)(
                                          colorPalette.quick,
                                          value66.current,
                                        )
                                      : null,
                                  onSwatch: (input: string) => {
                                    let value102 = (0,
                                    runtime.namedSwatchColor)(
                                      colorPalette.quick,
                                      input,
                                    );
                                    if (value102 !== undefined) {
                                      callback80(
                                        (input2: SlideNode) =>
                                          value66.apply(input2, value102),
                                      );
                                    }
                                  },
                                  custom: {
                                    seed: value66.seed,
                                    unset: value66.unset,
                                    onChange: callback78,
                                    onPickEnd: callback79,
                                    contrast: value66.contrast,
                                  },
                                },
                                selectionKey2,
                              ),
                            }),
                            value86
                              ? null
                              : CanvasEditorJsx.jsx(runtime.ToolbarDivider, {}),
                          ],
                        }),
                      value69 !== undefined && value67 !== null
                        ? CanvasEditorJsx.jsx(
                            runtime.BoxStyleToolbar,
                            {
                              compact: value86,
                              wrap: !value74,
                              swatches: colorPalette.quick,
                              io: value67,
                              padding: true,
                              corner: (0, runtime.cornerStyleBindings)(value67),
                            },
                            selectionKey2,
                          )
                        : null,
                      value71 !== null && value67 !== null
                        ? CanvasEditorJsx.jsx(
                            runtime.BoxStyleToolbar,
                            {
                              compact: value86,
                              wrap: !value74,
                              swatches: colorPalette.quick,
                              io: value67,
                              padding: false,
                              border: {
                                sides: runtime.SHAPE_BORDER_SIDES_REASON,
                                widthMax: runtime.maxShapeStrokeWidth,
                              },
                              noneReason: value72,
                            },
                            selectionKey2,
                          )
                        : null,
                      value70 !== null && value98 !== null && value67 !== null
                        ? CanvasEditorJsx.jsxs(CanvasEditorJsx.Fragment, {
                            children: [
                              CanvasEditorJsx.jsxs(runtime.ToolbarGroup, {
                                wrap: !value74,
                                children: [
                                  value70.video !== undefined ||
                                  value70.videoLink !== undefined
                                    ? CanvasEditorJsx.jsx(
                                        runtime.VideoPlaybackActions,
                                        {
                                          at: (0, runtime.clipRegistryKey)(
                                            value98.frameId,
                                            (0, runtime.selectionNodePath)(
                                              value98,
                                            ).join("."),
                                          ),
                                          player:
                                            value70.videoLink !== undefined,
                                        },
                                      )
                                    : null,
                                  CanvasEditorJsx.jsx(
                                    runtime.SessionImageReplaceButton,
                                    {
                                      src:
                                        value70.asset !== undefined
                                          ? assets.get(value70.asset)
                                          : value70.src,
                                      title:
                                        onReplaceImage === undefined
                                          ? "Replacing images isn’t available here"
                                          : value70.video !== undefined
                                            ? "Replace the video…"
                                            : value70.videoLink !== undefined
                                              ? (0, runtime.imageHasPoster)(
                                                  value70,
                                                )
                                                ? "Replace the video’s picture…"
                                                : "Add a picture for the video…"
                                              : (0, runtime.imageHasPoster)(
                                                    value70,
                                                  )
                                                ? "Replace the image…"
                                                : "Add image…",
                                      disabled: onReplaceImage === undefined,
                                      onClick: () => {
                                        ref23.current = {
                                          frameId: value98.frameId,
                                          path: (0, runtime.selectionNodePath)(
                                            value98,
                                          ),
                                        };
                                        ref22.current?.click();
                                      },
                                    },
                                  ),
                                  CanvasEditorJsx.jsx(
                                    runtime.ToolbarStripButton,
                                    {
                                      "data-testid": "frame-image-crop",
                                      "data-media-crop-keep": "",
                                      icon: CanvasEditorJsx.jsx(
                                        runtime.PropertyIcon,
                                        {
                                          icon: runtime.CROP_ICON,
                                        },
                                      ),
                                      title:
                                        value101 ??
                                        (imageCropController.session !== null
                                          ? "Done cropping (or press Enter)"
                                          : value70.video !== undefined ||
                                              value70.videoLink !== undefined
                                            ? "Crop (or double-click the video)"
                                            : "Crop (or double-click the picture)"),
                                      "aria-label": "Crop",
                                      "aria-pressed":
                                        imageCropController.session !== null,
                                      disabled: value101 !== undefined,
                                      onClick: () =>
                                        imageCropController.session !== null
                                          ? imageCropController.end(true)
                                          : callback29(value98),
                                    },
                                  ),
                                  CanvasEditorJsx.jsx(
                                    runtime.CornerStylePopover,
                                    {
                                      ...(0, runtime.cornerStyleBindings)(
                                        value67,
                                      ),
                                    },
                                    selectionKey2,
                                  ),
                                ],
                              }),
                              value86
                                ? null
                                : CanvasEditorJsx.jsx(
                                    runtime.ToolbarDivider,
                                    {},
                                  ),
                            ],
                          })
                        : null,
                      value60 !== null &&
                        lastSelectedUnit != null &&
                        CanvasEditorJsx.jsx(CanvasEditorJsx.Fragment, {
                          children: CanvasEditorJsx.jsxs(runtime.ToolbarGroup, {
                            wrap: !value74,
                            fields: true,
                            children: [
                              CanvasEditorJsx.jsx(
                                runtime.SessionNumberField,
                                {
                                  testid: "frame-table-rows",
                                  title: "Rows",
                                  label: "Rows",
                                  icon: runtime.TABLE_ROWS_ICON,
                                  value: value60.rows.length,
                                  min: 1,
                                  max: Math.min(
                                    runtime.maxTableRows,
                                    value60.rows.length +
                                      callback33(value60.cols),
                                  ),
                                  maxReason:
                                    value60.rows.length >= runtime.maxTableRows
                                      ? "This table has reached the most rows a table can hold."
                                      : (callback32(value60.cols) ?? undefined),
                                  hint: "Fewer rows drop the bottom rows’ text (undoable)",
                                  onValue: (input: number) =>
                                    callback34(
                                      slide,
                                      lastSelectedUnit.frameId,
                                      (0, runtime.selectionNodePath)(
                                        lastSelectedUnit,
                                      ),
                                      (input2) =>
                                        (0, runtime.resizeTable)(
                                          input2,
                                          input,
                                          input2.cols,
                                        ),
                                    ),
                                },
                                "r:" + selectionKey2,
                              ),
                              CanvasEditorJsx.jsx(
                                runtime.SessionNumberField,
                                {
                                  testid: "frame-table-cols",
                                  title: "Columns",
                                  label: "Columns",
                                  icon: runtime.TABLE_COLUMNS_ICON,
                                  value: value60.cols,
                                  min: 1,
                                  max: Math.min(
                                    runtime.maxTableColumns,
                                    value60.cols +
                                      callback33(
                                        Math.max(1, value60.rows.length),
                                      ),
                                  ),
                                  maxReason:
                                    value60.cols >= runtime.maxTableColumns
                                      ? "This table has reached the most columns a table can hold."
                                      : (callback32(
                                          Math.max(1, value60.rows.length),
                                        ) ?? undefined),
                                  hint: "Fewer columns drop the rightmost columns’ text (undoable)",
                                  onValue: (input: number) =>
                                    callback34(
                                      slide,
                                      lastSelectedUnit.frameId,
                                      (0, runtime.selectionNodePath)(
                                        lastSelectedUnit,
                                      ),
                                      (input2) =>
                                        (0, runtime.resizeTable)(
                                          input2,
                                          input2.rows.length,
                                          input,
                                        ),
                                    ),
                                },
                                "c:" + selectionKey2,
                              ),
                            ],
                          }),
                        }),
                      CanvasEditorJsx.jsx(runtime.SelectionActionButtons, {
                        onComment: value96,
                        onDelete: value99,
                        deleteTitle: value100,
                        onOpenInspector: onOpenInspector,
                        moreMenu: moreMenu,
                      }),
                    ],
                  }),
          }),
          (document).body,
        );
      }
    }
    let value57 = null;
    if (
      textEdit !== null &&
      textEdit.cell !== undefined &&
      value39 !== null &&
      onChangeSlide !== undefined &&
      !selectionMenuHidden
    ) {
      let value59 = textEdit,
        { r: cell, c: cell2 } = textEdit.cell!,
        value60 = (0, runtime.frameById)(slide, value59.frameId),
        value61 = value60
          ? (0, runtime.nodeAtPath)(value60.node, value59.path)
          : undefined,
        entry = frameElementsRef.current.get(value59.frameId),
        value62 =
          value59.path.length === 0
            ? entry
            : entry?.querySelector<HTMLElement>(
                '[data-node-path="' + value59.path.join(".") + '"]',
              ),
        value63 = (value62 ?? entry)?.getBoundingClientRect(),
        value64 = value39;
      if ((0, runtime.isTableNode)(value61) && value63) {
        let callback77 = (
            input: (table: TableNode) => TableNode,
            options: TableCellAddress,
          ) => {
            let element = (value62 ?? document).querySelector<HTMLElement>(
                '[data-cell="' +
                  String(cell) +
                  "." +
                  String(cell2) +
                  '"][contenteditable]',
              ),
              value73 = trimTrailingTextNewlines(
                element?.innerText ?? value61.rows[cell]?.[cell2] ?? "",
              );
            value64.onCommit(value73);
            callback34(
              callback66(value59, value73),
              value59.frameId,
              value59.path,
              input,
            );
            runtime.FrameViewportReactDom.flushSync(
              () => onTextEdit(null),
            );
            onTextEdit({
              frameId: value59.frameId,
              path: value59.path,
              cell: options,
            });
          },
          value65 = value7 ? 440 : 340,
          value66 = value7 ? 44 : 34,
          value67 =
            value62
              ?.querySelector(
                '[data-cell="' + String(cell) + "." + String(cell2) + '"]',
              )
              ?.getBoundingClientRect() ?? value63,
          value68 = getEditorViewportBounds(
            stageRef.current,
            topInset,
          ),
          value69 = value67.top - value66 - 8,
          value70 = value69 >= value68.top + 8,
          value71 = value70
            ? value69
            : Math.min(value68.bottom - value66 - 8, value67.bottom + 8),
          value72 = Math.max(
            value68.left + 8,
            Math.min(value67.left, value68.right - value65 - 8),
          );
        value57 = runtime.FrameViewportReactDom.createPortal(
          CanvasEditorJsx.jsxs(FloatingTableCellToolbar, {
            left: value72,
            top: value71,
            placed: value70 ? "above" : "below",
            children: [
              (() => {
                let state2 = {
                    r: cell,
                    c: cell2,
                  },
                  value73 =
                    value61.cellStyles?.[String(cell) + "." + String(cell2)]
                      ?.color,
                  value74 = value61.colAligns?.[cell2] ?? "start";
                return CanvasEditorJsx.jsxs(runtime.ToolbarGroup, {
                  children: [
                    CanvasEditorJsx.jsx(
                      runtime.SessionColorPopover,
                      {
                        testid: "cell-text-color",
                        title: "Text color",
                        value:
                          value73 === undefined
                            ? "default"
                            : (0, runtime.selectedSwatchName)(
                                colorPalette.quick,
                                value73,
                              ),
                        paint:
                          (0, runtime.resolveSlideColor)(value73) ??
                          (0, runtime.slideTextColor)(slide.bg),
                        swatches: [
                          {
                            name: "default",
                            label: "Theme default",
                            color: (0, runtime.slideTextColor)(slide.bg),
                          },
                          ...colorPalette.quick,
                        ],
                        onSwatch: (input: string) => {
                          let value75 =
                            input === "default"
                              ? undefined
                              : (0, runtime.namedSwatchColor)(
                                  colorPalette.quick,
                                  input,
                                );
                          if (input === "default" || value75 !== undefined) {
                            callback77(
                              (input2) =>
                                (0, runtime.setTableCellColor)(
                                  input2,
                                  cell,
                                  cell2,
                                  value75,
                                ),
                              state2,
                            );
                          }
                        },
                      },
                      "cc:" + String(cell) + "." + String(cell2),
                    ),
                    CanvasEditorJsx.jsx(
                      runtime.SessionChoicePopover,
                      {
                        testid: "cell-text-align",
                        title:
                          "Column alignment: " + TEXT_ALIGNMENT_LABELS[value74],
                        face: TEXT_ALIGNMENT_ICONS[value74],
                        value: value74,
                        options: TABLE_TEXT_ALIGNMENT_OPTIONS,
                        onChange: (input: TextAlignment) => {
                          if (input !== "justify") {
                            callback77(
                              (input2) =>
                                (0, runtime.setTableColumnAlignment)(
                                  input2,
                                  cell2,
                                  input,
                                ),
                              state2,
                            );
                          }
                        },
                      },
                      "ca:" + String(cell2),
                    ),
                  ],
                });
              })(),
              CanvasEditorJsx.jsx(runtime.ToolbarDivider, {}),
              CanvasEditorJsx.jsx(runtime.SelectionActionButtons, {
                onComment:
                  (0, runtime.commentsAvailable)() && value62
                    ? (input: HTMLElement) => {
                        let bounds = input.getBoundingClientRect(),
                          value73 = Math.min(8, value67.width / 2),
                          value74 = Math.min(8, value67.height / 2),
                          state2 = {
                            x: Math.min(
                              value67.right - value73,
                              Math.max(
                                value67.left + value73,
                                bounds.left + bounds.width / 2,
                              ),
                            ),
                            y: Math.min(
                              value67.bottom - value74,
                              Math.max(value67.top + value74, bounds.bottom),
                            ),
                          };
                        runtime.FrameViewportReactDom.flushSync(
                          () => callback8(),
                        );
                        if ((0, runtime.getCommentAnchorController)()) {
                          (0, runtime.composeFrameComment)(
                            {
                              kind: "frame",
                              slideId: slide.id,
                              frameId: value59.frameId,
                              path: [...value59.path],
                            },
                            value62,
                            state2,
                            (input2) =>
                              (0, runtime.describeFrameCommentAnchor)(
                                slideNumber,
                                slide,
                                {
                                  ...input2,
                                  cell: {
                                    r: cell,
                                    c: cell2,
                                  },
                                },
                                allTypeStyles,
                              ),
                          );
                        } else {
                          (0, runtime.openCommentComposer)(value62);
                        }
                      }
                    : null,
                onOpenInspector: onOpenInspector,
                moreMenu: moreMenu,
              }),
            ],
          }),
          (document).body,
        );
      }
    }
    let value58 = CanvasEditorJsx.jsxs("div", {
      ref: stageRef,
      "data-slides-ground": "",
      role: "group",
      "aria-labelledby": value16,
      tabIndex: -1,
      className: (0, runtime.joinClassNames)(
        "relative h-full w-full overflow-hidden outline-none",
        surround ? "bg-transparent" : "bg-editor-canvas",
      ),
      onPointerDownCapture: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!callback21(event.target)) {
          value18(false);
        }
      },
      onKeyDownCapture: () => {
        ref29.current = 0;
      },
      onPointerDown: (event: ElementTargetEvent<ReactPointerEvent<HTMLDivElement>>) => {
        if (
          ref13.current.has(event.pointerId) ||
          callback21(event.target) ||
          (0, runtime.isMacControlClick)(event)
        ) {
          return;
        }
        let value59 = textEdit !== null;
        if (
          value59 &&
          (event.pointerType === "touch" || event.button !== 0 || !callback42())
        ) {
          return;
        }
        let value60 =
          !value59 &&
          event.button === 0 &&
          !pointInsideSlide(event.clientX, event.clientY);
        ref14.current = {
          pointerId: event.pointerId,
          sx: event.clientX,
          sy: event.clientY,
          outside: value60,
        };
        let value61 =
          isFrameOrResizeTarget(event.target) ||
          event.target?.closest?.("[data-mc-chrome]") != null;
        if (
          !value59 &&
          !(surround && value60) &&
          canStartCanvasRectSelection({
            pointerType: event.pointerType,
            button: event.button,
            surface: value61 ? "object" : "empty",
            textEdit: false,
          })
        ) {
          let value62 =
            event.shiftKey || event.ctrlKey || event.metaKey;
          callback40(
            event,
            event.currentTarget,
            value62 ? [...selection] : [],
            null,
          );
        }
      },
      onPointerMove: (input: ReactPointerEvent<HTMLDivElement>) => {
        let current = ref15.current;
        if (current === null || current.pointerId !== input.pointerId) {
          return;
        }
        if (input.buttons === 0) {
          ref15.current = null;
          value3(null);
          return;
        }
        if (
          !current.live &&
          Math.abs(input.clientX - current.sx) +
            Math.abs(input.clientY - current.sy) <
            pointerDragThreshold(input.pointerType)
        ) {
          return;
        }
        current.live = true;
        let state2 = {
          x: Math.min(current.sx, input.clientX),
          y: Math.min(current.sy, input.clientY),
          w: Math.abs(input.clientX - current.sx),
          h: Math.abs(input.clientY - current.sy),
        };
        value3({
          left: state2.x - current.ox,
          top: state2.y - current.oy,
          width: state2.w,
          height: state2.h,
        });
        let value59 = collectUnitsIntersectingSelectionRect(
            state2,
            callback41(),
            current.base,
          ),
          value60 = (0, runtime.selectionsKey)(value59);
        if (value60 !== current.lastKey) {
          current.lastKey = value60;
          onSelectionChange(value59);
        }
      },
      onPointerUp: (input: ReactPointerEvent<HTMLDivElement>) => {
        let current = ref15.current;
        if (current !== null && current.pointerId === input.pointerId) {
          ref15.current = null;
          value3(null);
          if (!current.live && current.clickSelect !== null) {
            onSelectionChange(current.clickSelect);
          }
        }
        let current2 = ref14.current;
        if (current2 === null || current2.pointerId !== input.pointerId) {
          return;
        }
        ref14.current = null;
        if (
          Math.abs(input.clientX - current2.sx) +
            Math.abs(input.clientY - current2.sy) <
          pointerDragThreshold(input.pointerType)
        ) {
          onSelectionChange([]);
          if (current2.outside) {
            surround?.onOutsideClick(input.clientX, input.clientY);
          }
        }
      },
      onPointerCancel: (input: ReactPointerEvent<HTMLDivElement>) => {
        let current = ref15.current;
        if (current !== null && current.pointerId === input.pointerId) {
          ref15.current = null;
          value3(null);
        }
        let current2 = ref14.current;
        if (current2 !== null && current2.pointerId === input.pointerId) {
          ref14.current = null;
        }
      },
      onDoubleClick: (event: ElementTargetEvent<ReactMouseEvent<HTMLDivElement>>) => {
        if (textEdit) {
          return;
        }
        if (isFrameOrResizeTarget(event.target)) {
          return;
        }
        if (event.target?.closest?.("[data-mc-chrome]") != null) {
          return;
        }
        if (surround) {
          return;
        }
        callback2();
        ref6.current = null;
        setManualViewport(null);
      },
      onContextMenu: (event: ElementTargetEvent<ReactMouseEvent<HTMLDivElement, PointerEvent>>) => {
        let target = event.target;
        if (
          (event.nativeEvent.pointerType === "touch" ||
            touchPressRef.current !== null ||
            dragSessionRef.current?.type === "touch") &&
          textEdit === null &&
          !readOnly &&
          slideSurfaceRef.current?.contains(target)
        ) {
          event.preventDefault();
        }
        let value59 =
            event.nativeEvent.pointerType === "touch" ||
            dragSessionRef.current !== null ||
            touchPressRef.current !== null ||
            commenting === true,
          value60 = (0, runtime.isPlainMousePointer)(
            event.nativeEvent,
          ),
          value61 =
            textEdit !== null ||
            (0, runtime.isContextMenuEditingTarget)(target) ||
            !event.currentTarget.contains(target) ||
            target.closest("[data-mc-chrome]") !== null ||
            (surround !== undefined &&
              !value60 &&
              !pointInsideSlide(event.clientX, event.clientY));
        if (onMenu === undefined || readOnly || value59 || value61) {
          return;
        }
        event.preventDefault();
        if (ref15.current?.live === true) {
          return;
        }
        if (value60) {
          let value67 = callback17();
          if (value67 === null) {
            return undefined;
          } else {
            return onMenu(
              {
                ...value67,
                from: "key",
              },
              [...selection],
            );
          }
        }
        let state2: CanvasMenuAnchor = {
            x: event.clientX,
            y: event.clientY,
            from: "right-click",
          },
          value62 = (0, runtime.frameById)(
            slide,
            target.closest("[data-frame-id]")?.getAttribute("data-frame-id") ??
              "",
          ),
          value63 = value62
            ? (0, runtime.resolvePointerSelection)(
                value62.id,
                value62.node,
                parseEditorNodePath(
                  target
                    .closest("[data-node-path]")
                    ?.getAttribute("data-node-path"),
                ),
                selection,
                getFrameHitTestOptions(slide, value62),
              )
            : null,
          value64 = value63?.grab ?? null;
        ref14.current = null;
        if (value64 === null) {
          let value67 =
            selection.length > 0 &&
            target.closest("[data-resize-handle]") !== null;
          if (!value67) {
            onSelectionChange([]);
          }
          return onMenu(state2, value67 ? [...selection] : []);
        }
        let value65 = selection.some(
            (input) =>
              input.frameId === value64.frameId &&
              isStrictPathAncestor(
                (0, runtime.selectionNodePath)(input),
                (0, runtime.selectionNodePath)(value64),
              ),
          ),
          value66 =
            (0, runtime.selectionContainsNode)(selection, value64) ||
            value65 ||
            (value63?.add != null &&
              (0, runtime.selectionContainsNode)(selection, value63.add));
        if (!value66) {
          onSelectionChange([value64]);
        }
        onMenu(state2, value66 ? [...selection] : [value64]);
      },
      onDragOver: callback71,
      onDrop: callback72,
      children: [
        CanvasEditorJsx.jsx("span", {
          id: value14,
          hidden: true,
          children: slideKeyboardInstructions,
        }),
        Object.keys(EDITOR_ENTER_KEY_HINTS).map(
          (input) =>
            CanvasEditorJsx.jsx(
              "span",
              {
                id: value15 + "-" + input,
                hidden: true,
                children: EDITOR_ENTER_KEY_HINTS[input as keyof typeof EDITOR_ENTER_KEY_HINTS],
              },
              input,
            ),
        ),
        CanvasEditorJsx.jsx("span", {
          id: value15 + "-toolbar",
          hidden: true,
          children:
            "Press " +
            (0, runtime.formatCommandShortcut)("F6") +
            " to move to its formatting toolbar.",
        }),
        CanvasEditorJsx.jsxs("div", {
          ref: slideSurfaceRef,
          "data-slide-surface": "",
          tabIndex: commenting ? -1 : 0,
          role: "group",
          "aria-label": slideName,
          "aria-busy": busy ? true : undefined,
          "aria-describedby": commenting ? undefined : value14,
          onKeyDown: callback18,
          onClick: (event: ReactMouseEvent<HTMLDivElement>) => {
            if (
              event.target === event.currentTarget &&
              (0, runtime.isKeyboardOrPrimaryActivation)(event) &&
              !commenting
            ) {
              callback15();
            }
          },
          onPointerDownCapture: (input: ReactPointerEvent<HTMLDivElement>) => {
            ref29.current = performance.now();
            if (input.pointerType === "touch") {
              callback7(null);
            }
          },
          onPointerUpCapture: () => {
            ref29.current = performance.now();
          },
          onBlur: (event: ReactFocusEvent<HTMLDivElement>) => {
            let relatedTarget = event.relatedTarget;
            if (
              relatedTarget instanceof Node &&
              !event.currentTarget.contains(relatedTarget) &&
              ref42.current?.contains(relatedTarget) !== true
            ) {
              ref28.current = null;
            }
            if (event.target === event.currentTarget) {
              value23(false);
            }
          },
          onFocus: (event: ReactFocusEvent<HTMLDivElement>) => {
            ref28.current = event.target;
            if (event.target !== event.currentTarget) {
              return;
            }
            if (performance.now() - ref29.current < 500) {
              callback8();
            } else {
              value23(event.currentTarget.matches(":focus-visible"));
            }
          },
          className:
            "absolute shadow-lg touch-none outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-app-accent",
          style: {
            left: -value.x * scale,
            top: -value.y * scale,
            width: runtime.SLIDE_WIDTH * scale,
            height: runtime.SLIDE_HEIGHT * scale,
          },
          onDoubleClick: callback63,
          onPointerMove: (event: ElementTargetEvent<ReactPointerEvent<HTMLDivElement>>) => {
            lastPointerTargetRef.current = event.target;
            lastPointerSlideRef.current = slideRef.current;
            if (event.altKey !== altPressedRef.current) {
              setAltPressed(event.altKey);
            }
            if (event.altKey) {
              callback6(lastPointerTargetRef.current);
            }
            if (event.pointerType !== "touch") {
              callback7(lastPointerTargetRef.current);
              value20(false);
            }
            if (!onPointerNorm) {
              return;
            }
            let bounds = event.currentTarget.getBoundingClientRect();
            if (bounds.width <= 0 || bounds.height <= 0) {
              return;
            }
            let value59 = (event.clientX - bounds.left) / bounds.width,
              value60 = (event.clientY - bounds.top) / bounds.height;
            if (value59 >= 0 && value59 <= 1 && value60 >= 0 && value60 <= 1) {
              onPointerNorm(value59, value60);
            }
          },
          onPointerLeave: () => {
            lastPointerTargetRef.current = null;
            callback6(null);
            callback7(null);
          },
          children: [
            CanvasEditorJsx.jsx("div", {
              className: "h-full",
              children: CanvasEditorJsx.jsx(runtime.SlideCanvas, {
                slide: imageCropController.slide ?? dragPreviewSlide ?? slide,
                assets: assets,
                width: runtime.SLIDE_WIDTH * scale,
                editorChrome: !readOnly,
                links: readOnly ? "view" : "edit",
                clips: covered === true ? "none" : "selected",
                interactive: {
                  registerFrame: callback25,
                  onFramePointerDown: callback43,
                  editing: value39,
                  plainPress: isPlainPress,
                  selectedFrameIds: selection.map(
                    (input) => input.frameId,
                  ),
                },
              }),
            }),
            CanvasEditorJsx.jsxs("div", {
              style: {
                position: "absolute",
                top: 0,
                left: 0,
                width: runtime.SLIDE_WIDTH,
                height: runtime.SLIDE_HEIGHT,
                transform: "scale(" + String(scale) + ")",
                transformOrigin: "top left",
                pointerEvents: "none",
              },
              children: [
                CanvasEditorJsx.jsxs("div", {
                  className: "absolute inset-0 overflow-hidden",
                  children: [
                    CanvasEditorJsx.jsx("span", {
                      className: "sr-only",
                      role: "status",
                      children:
                        pending.length > 0
                          ? "Uploading " + (pending[0]?.what ?? "image")
                          : "",
                    }),
                    pending.map(
                      (input) =>
                        CanvasEditorJsx.jsxs(
                          "div",
                          {
                            className: "absolute overflow-hidden",
                            style: {
                              left: input.rect.x,
                              top: input.rect.y,
                              width: input.rect.w,
                              height: input.rect.h,
                            },
                            children: [
                              CanvasEditorJsx.jsx("img", {
                                src: input.url,
                                alt: "",
                                draggable: false,
                                className:
                                  "block h-full w-full object-cover opacity-50 blur-[1.5px] saturate-50",
                              }),
                              CanvasEditorJsx.jsx("span", {
                                className:
                                  "absolute top-1/2 left-1/2 flex rounded-full bg-black/40 p-1.5 text-white",
                                style: {
                                  transform:
                                    "translate(-50%, -50%) scale(" +
                                    String(1 / scale) +
                                    ")",
                                },
                                children: CanvasEditorJsx.jsx(runtime.Spinner, {
                                  size: "lg",
                                  inheritColor: true,
                                }),
                              }),
                            ],
                          },
                          input.id,
                        ),
                    ),
                  ],
                }),
                CanvasEditorJsx.jsx(runtime.AlignmentGuides, {
                  guides: snapGuides,
                  scale: scale,
                }),
                endpointSnapPoint !== null
                  ? CanvasEditorJsx.jsx("div", {
                      "data-testid": "endpoint-site",
                      style: {
                        position: "absolute",
                        left: endpointSnapPoint.x - 7 / scale,
                        top: endpointSnapPoint.y - 7 / scale,
                        width: 14 / scale,
                        height: 14 / scale,
                        boxSizing: "border-box",
                        borderWidth: 1.5 / scale,
                        borderStyle: "solid",
                        borderColor: "var(--t-app-accent)",
                        borderRadius: "50%",
                        pointerEvents: "none",
                      },
                    })
                  : null,
                peerLayer?.(1 / scale, callback30),
                flowDropPreview !== null
                  ? CanvasEditorJsx.jsxs(CanvasEditorJsx.Fragment, {
                      children: [
                        CanvasEditorJsx.jsx(runtime.SelectionRing, {
                          "data-testid": "drop-target",
                          frame: flowDropPreview.box,
                          scale: scale,
                          state: "hover",
                        }),
                        flowDropPreview.bar !== null
                          ? CanvasEditorJsx.jsx("div", {
                              "data-testid": "drop-slot",
                              style: {
                                position: "absolute",
                                left: flowDropPreview.bar.x,
                                top: flowDropPreview.bar.y,
                                width: flowDropPreview.bar.w,
                                height: flowDropPreview.bar.h,
                                borderRadius: 1 / scale,
                                backgroundColor:
                                  "color-mix(in srgb, var(--t-app-accent) 55%, transparent)",
                              },
                            })
                          : null,
                      ],
                    })
                  : null,
                hoverRect !== null
                  ? CanvasEditorJsx.jsx(runtime.SelectionRing, {
                      "data-testid": "hover-ring",
                      frame: hoverRect,
                      scale: scale,
                      rotation: hoverRect.rotation,
                      state: "hover",
                    })
                  : null,
                !textEdit
                  ? selection.map(
                      (input, options) => {
                        let value59 = selectionRects[options];
                        if (!value59 || imageCropController.session !== null) {
                          return null;
                        }
                        let value60 =
                            !readOnly &&
                            singleTransformTarget !== null &&
                            (0, runtime.selectionsEqual)(
                              input,
                              singleTransformTarget.unit,
                            ),
                          value61 =
                            value60 && !singleTransformTarget?.flow
                              ? (0, runtime.selectedNode)(slide, input)?.kind
                              : undefined,
                          value62 =
                            value61 === "table" ||
                            (value59.rotation !== undefined &&
                              value61 === "text"),
                          value63 =
                            singleStyleTarget !== null &&
                            (0, runtime.selectionsEqual)(
                              input,
                              singleStyleTarget,
                            ),
                          value64 =
                            selection.length === 1
                              ? (0, runtime.selectedNode)(slide, input)
                              : undefined,
                          value65 =
                            value64 !== undefined &&
                            (0, runtime.isConnectorNode)(value64);
                        if (
                          value64 !== undefined &&
                          ((0, runtime.isConnectorNode)(value64) ||
                            (0, runtime.isLineShapeNode)(value64))
                        ) {
                          let [value66, value67] = (0,
                            runtime.isLineShapeNode)(value64)
                              ? (0, runtime.lineShapeEndpoints)(
                                  value59,
                                  value64.rotate,
                                )
                              : (0, runtime.absoluteConnectorEndpoints)(
                                  value59,
                                  value64.from,
                                  value64.strokeWidth,
                                ),
                            value68 = (0, runtime.isLineShapeNode)(
                              value64,
                            )
                              ? [
                                  {
                                    x: value66[0],
                                    y: value66[1],
                                  },
                                  {
                                    x: value67[0],
                                    y: value67[1],
                                  },
                                ]
                              : (0, runtime.connectorGeometry)(
                                  value59.w,
                                  value59.h,
                                  value64,
                                ).points.map(
                                  ([input2, input3]) => ({
                                    x: value59.x + input2,
                                    y: value59.y + input3,
                                  }),
                                ),
                            value69 = (0, runtime.selectionNodePath)(
                              input,
                            ),
                            value70 =
                              (0, runtime.frameById)(slide, input.frameId)
                                ?.node ?? value64,
                            value71 =
                              value69.length > 0
                                ? (0, runtime.nodeAtPath)(
                                    value70,
                                    value69.slice(0, -1),
                                  )
                                : undefined,
                            value72 =
                              value71 !== undefined &&
                              (0, runtime.isFlowContainer)(value71),
                            value73 =
                              value69.every(
                                (
                                  input2: number,
                                  options2: number,
                                ) => {
                                  let value75 = (0,
                                  runtime.nodeAtPath)(
                                    value70,
                                    value69.slice(0, options2),
                                  );
                                  return (
                                    value75 === undefined ||
                                    (0, runtime.nodeTransform)(value75) ===
                                      undefined
                                  );
                                },
                              ) &&
                              (value69.length === 0 ||
                                value72 ||
                                (value71 !== undefined &&
                                  (0, runtime.isOverlayNode)(value71) &&
                                  value69[value69.length - 1]! >= 1)),
                            value74 = (0, runtime.isLineShapeNode)(
                              value64,
                            )
                              ? Math.min(value59.w, value59.h) + 0.5
                              : 2 *
                                  (0, runtime.connectorArrowInset)(
                                    value64.strokeWidth,
                                  ) +
                                0.5;
                          if (value73) {
                            return CanvasEditorJsx.jsx(
                              runtime.SelectionPoints,
                              {
                                points: [
                                  {
                                    x: value66[0],
                                    y: value66[1],
                                  },
                                  {
                                    x: value67[0],
                                    y: value67[1],
                                  },
                                ],
                                shaft: value68,
                                scale: scale,
                                cursor: !value72
                                  ? "move"
                                  : value59.h <= value74
                                    ? "ew-resize"
                                    : value59.w <= value74
                                      ? "ns-resize"
                                      : value64.from === "tr" ||
                                          value64.from === "bl"
                                        ? "nesw-resize"
                                        : "nwse-resize",
                                onPointDragStart: readOnly
                                  ? undefined
                                  : callback61,
                              },
                              (0, runtime.selectionKey)(input),
                            );
                          }
                        }
                        return CanvasEditorJsx.jsx(
                          runtime.SelectionRing,
                          {
                            frame: value59,
                            scale: scale,
                            rotation: value59.rotation,
                            grips:
                              !value60 || value65
                                ? "none"
                                : value62
                                  ? HORIZONTAL_GROUP_RESIZE_HANDLES
                                  : undefined,
                            onResizeStart: callback59,
                            onGripDoubleClick: (input2: SelectionHandle) =>
                              callback58(
                                placementSideToSnapLine(input2.x),
                                placementSideToSnapLine(input2.y),
                              ),
                            onRotateStart: value63 ? callback62 : undefined,
                            angleLabel:
                              value63 && rotationPreviewAngle !== null
                                ? String(rotationPreviewAngle) + "°"
                                : undefined,
                          },
                          (0, runtime.selectionKey)(input),
                        );
                      },
                    )
                  : null,
                textEdit !== null &&
                textEditRect !== null &&
                imageCropController.session === null
                  ? CanvasEditorJsx.jsx(runtime.SelectionRing, {
                      "data-testid": "text-edit-ring",
                      frame: textEditRect,
                      scale: scale,
                      rotation: textEditRect.rotation,
                      grips: "none",
                    })
                  : null,
                distanceMeasurements !== null
                  ? CanvasEditorJsx.jsx(runtime.MeasureOverlay, {
                      m: distanceMeasurements,
                      scale: scale,
                    })
                  : null,
                imageCropController.session !== null && value29 !== null
                  ? ((
                      input,
                      options,
                      context,
                      value59,
                    ) => {
                      return CanvasEditorJsx.jsx("div", {
                        "data-mc-chrome": "",
                        "data-testid": "slides-crop",
                        style: {
                          position: "absolute",
                          left: options.x,
                          top: options.y,
                          width: options.w,
                          height: options.h,
                          transform: options.rotation
                            ? "rotate(" + String(options.rotation) + "rad)"
                            : undefined,
                        },
                        children: CanvasEditorJsx.jsx("div", {
                          style: {
                            position: "absolute",
                            left: input.frame.x * context,
                            top: input.frame.y * context,
                            width: input.local.w,
                            height: input.local.h,
                            transform:
                              context !== 1
                                ? "scale(" + String(context) + ")"
                                : undefined,
                            transformOrigin: "0 0",
                          },
                          children: CanvasEditorJsx.jsx(
                            runtime.MediaCropOverlay,
                            {
                              frame: input.local,
                              natural: input.natural,
                              crop: input.live,
                              scale: scale * context,
                              rotation: options.rotation,
                              src:
                                value59?.kind === "img"
                                  ? ((0, runtime.cropImageSource)(
                                      value59,
                                      assets,
                                    ) ?? null)
                                  : null,
                              onLive: imageCropController.setLive,
                              minFrame: value59
                                ? (0, runtime.minimumNodeResizeSize)(value59)
                                : undefined,
                              ...(imageCropController.handlesOff !== false
                                ? {
                                    onFrame: imageCropController.setFrame,
                                    frameHandleOff:
                                      imageCropController.handlesOff,
                                  }
                                : null),
                              onDone: imageCropController.end,
                            },
                          ),
                        }),
                      });
                    })(
                      imageCropController.session,
                      value29,
                      value29.nodeScale ?? 1,
                      (0, runtime.selectedNode)(
                        slide,
                        imageCropController.session.unit,
                      ),
                    )
                  : null,
              ],
            }),
          ],
        }),
        CanvasEditorJsx.jsx("div", {
          style: {
            position: "absolute",
            left: -value.x * scale,
            top: -value.y * scale,
            width: runtime.SLIDE_WIDTH * scale,
            height: runtime.SLIDE_HEIGHT * scale,
            pointerEvents: "none",
          },
          onFocus: (event: ReactFocusEvent<HTMLDivElement>) => {
            ref28.current = event.target;
          },
          onBlur: (input: ReactFocusEvent<HTMLDivElement>) => {
            let relatedTarget = input.relatedTarget;
            if (
              relatedTarget instanceof Node &&
              !input.currentTarget.contains(relatedTarget) &&
              slideSurfaceRef.current?.contains(relatedTarget) !== true
            ) {
              ref28.current = null;
            }
          },
          children: CanvasEditorJsx.jsx("div", {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: runtime.SLIDE_WIDTH,
              height: runtime.SLIDE_HEIGHT,
              transform: "scale(" + String(scale) + ")",
              transformOrigin: "top left",
              pointerEvents: "none",
            },
            children: !commenting
              ? CanvasEditorJsx.jsx("div", {
                  ref: ref42,
                  "data-object-proxies": "",
                  style: {
                    ["--ring-w"]: String(Math.ceil(2 / scale)) + "px",
                    ["--ring-off"]: String(3 / scale) + "px",
                  },
                  children: keyboardGroups.map(
                    (input) =>
                      CanvasEditorJsx.jsx(
                        "div",
                        {
                          "data-object-level": input.id,
                          children: input.stops.map(
                            (input2) => {
                              if (input2.key === value28) {
                                return null;
                              }
                              let value59 =
                                  input2.key === lastSelectedUnitKey,
                                value60 =
                                  (value59 &&
                                  measuredSelectionKey === selectionKey2 &&
                                  lastSelectedRect !== null
                                    ? lastSelectedRect
                                    : unitRectCache.get(input2.key)) ?? null,
                                value61 =
                                  selection.length > 1 &&
                                  selectedUnitKeys.has(input2.key)
                                    ? "multi"
                                    : input2.opens === "enter"
                                      ? "enter"
                                      : readOnly
                                        ? null
                                        : input2.opens === "edit-text"
                                          ? "text"
                                          : input2.opens === "edit-cell"
                                            ? "cell"
                                            : null,
                                value62 = [
                                  value61 !== null
                                    ? value15 + "-" + value61
                                    : "",
                                  value42 ? value15 + "-toolbar" : "",
                                ]
                                  .filter(
                                    (input3) =>
                                      input3 !== "",
                                  )
                                  .join(" ");
                              return CanvasEditorJsx.jsx(
                                "div",
                                {
                                  ref: callback9(input2.key),
                                  "data-object-proxy": input2.key,
                                  "data-testid": value59
                                    ? "object-cursor"
                                    : undefined,
                                  "data-object-cursor": value59
                                    ? value17
                                      ? "keys"
                                      : "pointer"
                                    : undefined,
                                  tabIndex: -1,
                                  role: "group",
                                  "aria-roledescription": "object",
                                  "aria-label":
                                    (value59 && selection.length > 1
                                      ? String(selection.length) +
                                        " objects selected; "
                                      : "") + input2.name,
                                  "aria-describedby":
                                    value62 === "" ? undefined : value62,
                                  onKeyDown: callback22,
                                  onClick: callback23,
                                  onFocus: callback24,
                                  className: (0, runtime.joinClassNames)(
                                    value59 && !value27
                                      ? "outline-hidden"
                                      : "outline-none",
                                    "focus-visible:outline-solid focus-visible:outline-app-accent",
                                  ),
                                  style: {
                                    position: "absolute",
                                    left: value60?.x ?? 0,
                                    top: value60?.y ?? 0,
                                    width: value60?.w ?? 0,
                                    height: value60?.h ?? 0,
                                    outlineWidth:
                                      value60 === null ? 0 : "var(--ring-w)",
                                    outlineOffset: "var(--ring-off)",
                                    transform:
                                      value60?.rotation !== undefined &&
                                      value60.rotation !== 0
                                        ? "rotate(" +
                                          String(value60.rotation) +
                                          "rad)"
                                        : undefined,
                                    pointerEvents: "none",
                                  },
                                },
                                slide.id +
                                  "/" +
                                  input2.key +
                                  "#" +
                                  String(value24.get(input2.key) ?? 0),
                              );
                            },
                          ),
                        },
                        input.id,
                      ),
                  ),
                })
              : null,
          }),
        }),
        value22 &&
        (value.x > 0 ||
          value.y > 0 ||
          (runtime.SLIDE_WIDTH - value.x) * scale > stageSize.w ||
          (runtime.SLIDE_HEIGHT - value.y) * scale > stageSize.h)
          ? CanvasEditorJsx.jsx("div", {
              "aria-hidden": "true",
              className:
                "pointer-events-none absolute inset-0 z-30 outline-2 -outline-offset-2 outline-app-accent outline-solid",
            })
          : null,
        value2 !== null
          ? CanvasEditorJsx.jsx("div", {
              "data-slides-marquee": "",
              "aria-hidden": "true",
              className:
                "pointer-events-none absolute z-30 bg-accent-muted outline-1 -outline-offset-1 outline-fill-accent",
              style: {
                left: value2.left,
                top: value2.top,
                width: value2.width,
                height: value2.height,
              },
            })
          : null,
        value40,
        onReplaceImage !== undefined
          ? CanvasEditorJsx.jsx("input", {
              ref: ref22,
              "data-testid": "frame-image-file",
              type: "file",
              accept:
                value45?.kind === "img" && value45.video !== undefined
                  ? "image/*," + runtime.videoFileAccept
                  : "image/*",
              className: "hidden",
              onChange: (input: ReactChangeEvent<HTMLInputElement>) => {
                let value59 = input.currentTarget.files?.[0],
                  current = ref23.current;
                input.currentTarget.value = "";
                if (value59 && current) {
                  onReplaceImage(current.frameId, current.path, value59);
                }
              },
            })
          : null,
        value57,
        stageOverlay,
      ],
    });
    return CanvasEditorJsx.jsxs(CanvasEditorJsx.Fragment, {
      children: [
        CanvasEditorJsx.jsx("h2", {
          id: value16,
          className: "sr-only",
          "data-slide-heading": "",
          children: slideName,
        }),
        value58,
      ],
    });
  }
  function textFormattingSnapshotsEqual(
    left: RichTextSelectionFormat | null,
    right: RichTextSelectionFormat | null,
  ): boolean {
    if (left === null || right === null) {
      return left === right;
    }
    return (
      left.bold === right.bold &&
      left.italic === right.italic &&
      left.underline === right.underline &&
      left.color === right.color &&
      left.href === right.href &&
      left.touchesLink === right.touchesLink &&
      left.list === right.list
    );
  }
  function trimTrailingTextNewlines(text: string): string {
    return text.replace(/\n+$/, "");
  }
  function FloatingTableCellToolbar({
    left: left,
    top: top,
    placed: placed,
    children: children,
  }: FloatingTableCellToolbarProps): ReactElement {
    return CanvasEditorJsx.jsx(runtime.ToolbarStrip, {
      "data-mc-chrome": "",
      "data-cell-strip": "",
      surface: "popover",
      "aria-label": EDITOR_FORMATTING_LABELS.cell,
      placed: placed,
      style: {
        position: "fixed",
        left: left,
        top: top,
      },
      onMouseDown: (event: ReactMouseEvent) => event.preventDefault(),
      children: children,
    });
  }
  function TextColorControl({ color: color }: TextColorControlProps): ReactElement {
    let value = (0, runtime.useFillEditor)(color.fill);
    return CanvasEditorJsx.jsx(runtime.SessionColorPopover, {
      testid: "frame-text-color",
      title: "Text color",
      paint: color.paint,
      swatches: color.swatches,
      value: color.value,
      onSwatch: color.onChange,
      custom: color.custom,
      editsAreUndoSteps: true,
      ...value,
    });
  }
  function TextFormattingToolbar({
    selKey: selKey,
    compact: compact,
    oneRow = false,
    styleValue: styleValue,
    styleChip: styleChip,
    styleOptions: styleOptions,
    onStyle: onStyle,
    custom: custom,
    color: color,
    bold: bold,
    onBold: onBold,
    italic: italic,
    onItalic: onItalic,
    underline: underline,
    onUnderline: onUnderline,
    underlineDead = null,
    elementLink: elementLink,
    onElementLink: onElementLink,
    align: align,
    alignMixed = false,
    onAlign: onAlign,
    list: list,
    listMixed = false,
    onList: onList,
    wholeBold = bold,
    wholeItalic = italic,
    session: session,
    extra: extra,
    onComment: onComment,
    onDelete: onDelete,
    deleteTitle: deleteTitle,
    onOpenInspector: onOpenInspector,
    moreMenu: moreMenu,
  }: TextFormattingToolbarProps): ReactElement {
    let value = session !== null,
      [value2, value3] = runtime.reactK_.useState<RichTextSelectionFormat | null>(null),
      [value4, value5] = runtime.reactK_.useState<string | undefined>(undefined),
      [value6, value7] = runtime.reactK_.useState(false),
      [value8, value9] = runtime.reactK_.useState(0),
      ref = runtime.reactK_.useRef<Range | null>(null),
      callback = runtime.reactK_.useCallback(() => {
        let element = document.querySelector<HTMLElement>(
            "[data-text-path][contenteditable]",
          ),
          value30 =
            element !== null
              ? (0, runtime.readRichTextSelection)(
                  element,
                  runtime.resolveSlideColor,
                )
              : null;
        value3(
          (input) =>
            textFormattingSnapshotsEqual(input, value30) ? input : value30,
        );
        value5(element !== null ? getComputedStyle(element).color : undefined);
        let value31 = window.getSelection(),
          value32 =
            element !== null &&
            value31 !== null &&
            value31.rangeCount > 0 &&
            element.contains(value31.anchorNode);
        if (value32) {
          ref.current = value31!.getRangeAt(0).cloneRange();
        }
        value7(value32 && !value31!.isCollapsed);
      }, []),
      callback2 = () => {
        let element = document.querySelector<HTMLElement>(
            "[data-text-path][contenteditable]",
          ),
          value30 = window.getSelection();
        if (element === null || value30 === null) {
          return element;
        }
        if (
          (document).activeElement !== element &&
          ref.current !== null
        ) {
          element.focus({
            preventScroll: true,
          });
          value30.removeAllRanges();
          value30.addRange(ref.current);
        }
        return element;
      },
      ref2 = runtime.reactK_.useRef<TextFormattingSession | null>(session);
    ref2.current = session;
    runtime.reactK_.useEffect(() => {
      if (!value) {
        return;
      }
      let callback8 = (event: Event) => {
          let target = event.target;
          if (
            target instanceof Element &&
            target.closest("[data-text-path][contenteditable]")
          ) {
            value9((input) => input + 1);
          }
        },
        callback9 = (event: FocusEvent) => {
          let target = event.target;
          if (!(target instanceof Element)) {
            return;
          }
          let value30 =
              target.closest(
                "[data-mc-popover] [data-session-strip], " +
                  runtime.SESSION_POPUP_SELECTOR,
              ) !== null,
            value31 =
              target instanceof HTMLInputElement &&
              target.closest("[data-link-mode]") !== null,
            value32 =
              !value30 &&
              !value31 &&
              target.closest("[data-mc-strip][data-session-strip]") !== null;
          if (!value30 && !value32) {
            return;
          }
          let element = document.querySelector<HTMLElement>(
            "[data-text-path][contenteditable]",
          );
          if (element === null) {
            return;
          }
          let relatedTarget = event.relatedTarget;
          if (
            relatedTarget instanceof Element &&
            (element.contains(relatedTarget) ||
              relatedTarget.closest("[data-session-strip]") !== null)
          ) {
            return;
          }
          if (relatedTarget === null && value30) {
            callback2();
          } else {
            ref2.current?.commitFromEditable(element);
          }
        };
      (document).addEventListener("pointerdown", callback8, true);
      (document).addEventListener("focusout", callback9);
      callback();
      (document).addEventListener("selectionchange", callback);
      return () => {
        (document).removeEventListener(
          "pointerdown",
          callback8,
          true,
        );
        (document).removeEventListener("focusout", callback9);
        (document).removeEventListener("selectionchange", callback);
      };
    }, [value, callback]);
    let callback3 = (input: string, options?: string) => {
        callback2();
        (0, runtime.executeRichTextCommand)(input, options);
        callback();
      },
      value10 = selKey + ":" + String(value8),
      value11 = color.swatches.filter(
        (input) => input.color.length === 7,
      ),
      callback4 = (input: string) =>
        ((0, runtime.resolveSlideColor)(input) ?? input).toLowerCase(),
      value12 = value ? value2?.color : undefined,
      value13 =
        value12 !== undefined
          ? ((input) =>
              input === undefined ? null : (input.picks ?? input.name))(
              value11.find(
                (input) =>
                  input.color === callback4(value12),
              ),
            )
          : null,
      value14 =
        value12 !== undefined
          ? ((0, runtime.resolveSlideColor)(value12) ?? value12)
          : undefined,
      value15 = bold || (value && value2?.bold === true),
      value16 = italic || (value && value2?.italic === true),
      value17 = underline || (value && value2?.underline === true),
      value18 = value ? value2?.list : list,
      value19 = session?.linkDraft ?? null,
      value20 = styleOptions ?? EMPTY_EDITOR_TOOL_OPTIONS,
      value21 =
        styleChip ??
        value20.find((input) => input.value === styleValue)
          ?.text ??
        "",
      callback5 = () => {
        let element = (document).querySelector(
            "[data-text-path][contenteditable]",
          ),
          value30 = (window).getSelection();
        if (element === null || value30 === null || value30.rangeCount === 0) {
          return;
        }
        let value31 = value30.getRangeAt(0);
        if (
          !element.contains(value31.startContainer) ||
          !element.contains(value31.endContainer)
        ) {
          return;
        }
        let value32 = (0, runtime.selectionAnchorElements)(
          element,
          value31,
        );
        if (value32 === null) {
          return;
        }
        value30.removeAllRanges();
        value30.addRange(value32.range);
        (0, runtime.executeRichTextCommand)("unlink");
        (0, runtime.unwrapAnchorElements)(value32.anchors);
        callback();
      },
      value22 = value && value2?.href !== undefined,
      [value23, value24] = runtime.reactK_.useState<string | null>(null),
      [value25, value26] = runtime.reactK_.useState(false),
      value27 =
        value22 || value19 !== null || !value
          ? null
          : !value6
            ? "Select some text first"
            : null,
      value28 =
        underlineDead ??
        (value && value2?.touchesLink === true && !underline
          ? "A link is already underlined"
          : null),
      callback6 = (input?: string) => {
        if (!value) {
          return onList(input);
        }
        let value30 = input ?? value18;
        if (value30 !== undefined) {
          callback3(
            value30 === "bullet" ? "insertUnorderedList" : "insertOrderedList",
          );
        }
      },
      callback7 = () => {
        value26(false);
        if (value && value19 !== null) {
          value19.editable?.focus();
          session!.setLinkDraft(null);
        } else {
          value24(null);
        }
      },
      value29 =
        (!value && value23 !== null) || (value && value19 !== null);
    runtime.reactK_.useEffect(() => {
      if (!value29) {
        value26(false);
      }
    }, [value29]);
    if (!value && value23 !== null) {
      return CanvasEditorJsx.jsx(runtime.LinkEditor, {
        value: value23,
        invalid: value25,
        onChange: (input: string) => {
          value26(false);
          value24(input);
        },
        onBlur: () => value24(null),
        onCancel: callback7,
        onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Escape") {
            event.preventDefault();
            value24(null);
          }
          if (event.key === "Enter") {
            event.preventDefault();
            let value30 = (0, runtime.normalizeExternalLink)(value23);
            if (value30 === null) {
              return value26(true);
            }
            onElementLink(value30);
            value24(null);
          }
        },
      });
    }
    if (value && value19 !== null) {
      return CanvasEditorJsx.jsx(runtime.LinkEditor, {
        value: value19.url,
        invalid: value25,
        onChange: (input: string) => {
          value26(false);
          session!.setLinkDraft({
            ...value19,
            url: input,
          });
        },
        onBlur: (input: ReactFocusEvent<HTMLInputElement>) => {
          let relatedTarget = input.relatedTarget,
            value30 =
              relatedTarget instanceof Element &&
              relatedTarget.closest("[data-session-strip]") !== null,
            value31 =
              relatedTarget !== null && relatedTarget === value19.editable;
          if (value30 || value31) {
            return;
          }
          let editable = value19.editable;
          session!.setLinkDraft(null);
          if (editable !== null) {
            session!.commitFromEditable(editable);
          }
        },
        onCancel: callback7,
        onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Escape") {
            event.preventDefault();
            value19.editable?.focus();
            session!.setLinkDraft(null);
          }
          if (event.key === "Enter") {
            event.preventDefault();
            let value30 = (0, runtime.normalizeExternalLink)(
              value19.url,
            );
            if (value30 === null) {
              return value26(true);
            }
            value19.editable?.focus();
            let value31 = (window).getSelection();
            value31?.removeAllRanges();
            value31?.addRange(value19.range);
            callback3("createLink", value30);
            session!.setLinkDraft(null);
          }
        },
      });
    }
    if (!value && extra != null) {
      return CanvasEditorJsx.jsxs(CanvasEditorJsx.Fragment, {
        children: [
          CanvasEditorJsx.jsxs(runtime.ToolbarGroup, {
            wrap: !oneRow,
            children: [
              CanvasEditorJsx.jsx(
                runtime.SessionTextStylePopover,
                {
                  testid: "frame-text-style",
                  value: styleValue,
                  chipText: value21,
                  options: value20,
                  onChange: onStyle,
                  custom: custom,
                },
                "ts:" + value10,
              ),
              CanvasEditorJsx.jsx(
                TextColorControl,
                {
                  color: color,
                },
                "tc:" + value10,
              ),
            ],
          }),
          compact ? null : CanvasEditorJsx.jsx(runtime.ToolbarDivider, {}),
          CanvasEditorJsx.jsx(
            runtime.reactK_.Fragment,
            {
              children: extra,
            },
            "x:" + value10,
          ),
          CanvasEditorJsx.jsx(runtime.SelectionActionButtons, {
            onComment: onComment,
            onDelete: onDelete,
            deleteTitle: deleteTitle,
            onOpenInspector: onOpenInspector,
            moreMenu: moreMenu,
          }),
        ],
      });
    }
    return CanvasEditorJsx.jsxs(CanvasEditorJsx.Fragment, {
      children: [
        CanvasEditorJsx.jsxs(runtime.ToolbarGroup, {
          wrap: !oneRow,
          children: [
            CanvasEditorJsx.jsx(
              runtime.SessionTextStylePopover,
              {
                testid: "frame-text-style",
                value: styleValue,
                chipText: value21,
                options: value20,
                onChange: onStyle,
                custom: custom,
              },
              "ts:" + value10,
            ),
            value
              ? CanvasEditorJsx.jsx(
                  runtime.SessionColorPopover,
                  {
                    testid: "slides-text-color",
                    title: "Color the selected text",
                    paint: value14 ?? value4,
                    swatches: value11,
                    value: value13,
                    onSwatch: (input: string) => {
                      let value30 = value11.find(
                        (input2) => input2.name === input,
                      )?.color;
                      if (value30 !== undefined) {
                        callback3("foreColor", value30);
                      }
                    },
                    custom: {
                      seed: value14 ?? value4 ?? "#141413",
                      opaque: true,
                      onChange: () => {
                        return;
                      },
                      onPickEnd: (input: string) =>
                        callback3("foreColor", input),
                      contrast: color.runContrast,
                    },
                  },
                  "c:" + value10,
                )
              : CanvasEditorJsx.jsx(
                  TextColorControl,
                  {
                    color: color,
                  },
                  "tc:" + value10,
                ),
            CanvasEditorJsx.jsx(runtime.ToolbarStripButton, {
              title: "Bold (" + (0, runtime.formatCommandShortcut)("B") + ")",
              "aria-label": "Bold",
              "aria-pressed": value15,
              icon: "TextBold",
              onClick: () =>
                value && !bold && (value2?.bold === true || !wholeBold)
                  ? callback3("bold")
                  : onBold(),
            }),
            CanvasEditorJsx.jsx(runtime.ToolbarStripButton, {
              title: "Italic (" + (0, runtime.formatCommandShortcut)("I") + ")",
              "aria-label": "Italic",
              "aria-pressed": value16,
              icon: "TextItalics",
              onClick: () =>
                value && !italic && (value2?.italic === true || !wholeItalic)
                  ? callback3("italic")
                  : onItalic(),
            }),
            CanvasEditorJsx.jsx(runtime.ToolbarStripButton, {
              icon: "TextUnderline",
              title:
                value28 ??
                "Underline (" + (0, runtime.formatCommandShortcut)("U") + ")",
              "aria-label": "Underline",
              "aria-pressed": value28 !== null ? undefined : value17,
              disabled: value28 !== null,
              onClick: () =>
                value && !underline ? callback3("underline") : onUnderline(),
            }),
            CanvasEditorJsx.jsx(runtime.ToolbarStripButton, {
              icon: "Link",
              title: value
                ? value22
                  ? "Remove the link from the text under the cursor"
                  : (value27 ?? "Link the selected text (http/https only)")
                : elementLink !== undefined
                  ? "Remove the link (" + elementLink + ")"
                  : "Link the whole text (http/https only)",
              "aria-label": "Link",
              "aria-pressed": value
                ? value22
                : elementLink !== undefined || value23 !== null,
              disabled: value27 !== null,
              onClick: () => {
                if (value) {
                  if (value22) {
                    return callback5();
                  } else {
                    return session?.onLinkClick();
                  }
                }
                if (elementLink !== undefined) {
                  onElementLink(undefined);
                } else {
                  value24(
                    (input) => (input === null ? "" : null),
                  );
                }
              },
            }),
          ],
        }),
        compact ? null : CanvasEditorJsx.jsx(runtime.ToolbarDivider, {}),
        CanvasEditorJsx.jsxs(runtime.ToolbarGroup, {
          wrap: !oneRow,
          children: [
            CanvasEditorJsx.jsx(
              runtime.SessionChoicePopover,
              {
                testid: "frame-text-list",
                title:
                  "List: " +
                  (listMixed && !value
                    ? "mixed"
                    : runtime.TEXT_LIST_LABELS[value18 ?? "none"]),
                face: value18 === "number" ? "ListNumbered" : "ListBullet",
                value: listMixed && !value ? null : (value18 ?? "none"),
                options: runtime.TEXT_LIST_OPTIONS,
                onChange: (input: string) =>
                  callback6(input === "none" ? undefined : input),
              },
              "li:" + value10,
            ),
            CanvasEditorJsx.jsx(
              runtime.SessionChoicePopover,
              {
                testid: "frame-text-align",
                title:
                  "Alignment: " +
                  (alignMixed ? "mixed" : TEXT_ALIGNMENT_LABELS[align]),
                face: TEXT_ALIGNMENT_ICONS[align],
                value: alignMixed ? null : align,
                options: TEXT_ALIGNMENT_OPTIONS,
                onChange: onAlign,
              },
              "al:" + value10,
            ),
          ],
        }),
        compact ? null : CanvasEditorJsx.jsx(runtime.ToolbarDivider, {}),
        CanvasEditorJsx.jsx(runtime.SelectionActionButtons, {
          onComment: onComment,
          onDelete: onDelete,
          deleteTitle: deleteTitle,
          onOpenInspector: onOpenInspector,
          moreMenu: moreMenu,
        }),
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "CanvasEditorJsx",
    () => CanvasEditorJsx,
    (value) => {
      CanvasEditorJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_EDITOR_TOOL_OPTIONS",
    () => EMPTY_EDITOR_TOOL_OPTIONS,
    (value) => {
      EMPTY_EDITOR_TOOL_OPTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "typeStylesToEditorOptions",
    () => typeStylesToEditorOptions,
  );
  bindRuntimeValue(
    runtime,
    "resolveSingleUnitTransformTarget",
    () => resolveSingleUnitTransformTarget,
  );
  bindRuntimeValue(
    runtime,
    "resolveSingleUnitStyleTarget",
    () => resolveSingleUnitStyleTarget,
  );
  bindRuntimeValue(
    runtime,
    "placementSideToSnapLine",
    () => placementSideToSnapLine,
    (value) => {
      placementSideToSnapLine = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HORIZONTAL_GROUP_RESIZE_HANDLES",
    () => HORIZONTAL_GROUP_RESIZE_HANDLES,
    (value) => {
      HORIZONTAL_GROUP_RESIZE_HANDLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "copySelectedUnitsToClipboard",
    () => copySelectedUnitsToClipboard,
  );
  bindRuntimeValue(
    runtime,
    "EDITOR_ENTER_KEY_HINTS",
    () => EDITOR_ENTER_KEY_HINTS,
    (value) => {
      EDITOR_ENTER_KEY_HINTS = value;
    },
  );
  bindRuntimeValue(runtime, "editorRectsEqual", () => editorRectsEqual);
  bindRuntimeValue(
    runtime,
    "EDITOR_VIEWPORT_PADDING",
    () => EDITOR_VIEWPORT_PADDING,
    (value) => {
      EDITOR_VIEWPORT_PADDING = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EDITOR_MIN_STAGE_HEIGHT",
    () => EDITOR_MIN_STAGE_HEIGHT,
    (value) => {
      EDITOR_MIN_STAGE_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EDITOR_STAGE_PADDING_FRACTION",
    () => EDITOR_STAGE_PADDING_FRACTION,
    (value) => {
      EDITOR_STAGE_PADDING_FRACTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EDITOR_FALLBACK_STAGE_WIDTH",
    () => EDITOR_FALLBACK_STAGE_WIDTH,
    (value) => {
      EDITOR_FALLBACK_STAGE_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EDITOR_FORMATTING_LABELS",
    () => EDITOR_FORMATTING_LABELS,
    (value) => {
      EDITOR_FORMATTING_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "centerViewportAxis",
    () => centerViewportAxis,
    (value) => {
      centerViewportAxis = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fitSlideEditorViewport",
    () => fitSlideEditorViewport,
  );
  bindRuntimeValue(
    runtime,
    "editorViewportFromScreenRect",
    () => editorViewportFromScreenRect,
  );
  bindRuntimeValue(runtime, "clampEditorViewport", () => clampEditorViewport);
  bindRuntimeValue(
    runtime,
    "EDITOR_TEXT_ZOOM_DURATION_MS",
    () => EDITOR_TEXT_ZOOM_DURATION_MS,
    (value) => {
      EDITOR_TEXT_ZOOM_DURATION_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EDITOR_TEXT_ZOOM_SIDE_PADDING",
    () => EDITOR_TEXT_ZOOM_SIDE_PADDING,
    (value) => {
      EDITOR_TEXT_ZOOM_SIDE_PADDING = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EDITOR_TEXT_ZOOM_TOP_PADDING",
    () => EDITOR_TEXT_ZOOM_TOP_PADDING,
    (value) => {
      EDITOR_TEXT_ZOOM_TOP_PADDING = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "calculateTextEditingZoom",
    () => calculateTextEditingZoom,
  );
  bindRuntimeValue(
    runtime,
    "getEditorViewportBounds",
    () => getEditorViewportBounds,
  );
  bindRuntimeValue(
    runtime,
    "constrainEditorBandBottom",
    () => constrainEditorBandBottom,
  );
  bindRuntimeValue(
    runtime,
    "unscaleEditorScreenRect",
    () => unscaleEditorScreenRect,
  );
  bindRuntimeValue(runtime, "parseCssScaleFactors", () => parseCssScaleFactors);
  bindRuntimeValue(
    runtime,
    "SLIDE_LIFT_SCALE_ATTRIBUTE",
    () => SLIDE_LIFT_SCALE_ATTRIBUTE,
    (value) => {
      SLIDE_LIFT_SCALE_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getUnliftedBoundingClientRect",
    () => getUnliftedBoundingClientRect,
  );
  bindRuntimeValue(
    runtime,
    "placeFloatingEditorToolbar",
    () => placeFloatingEditorToolbar,
  );
  bindRuntimeValue(
    runtime,
    "getEditableCaretClientRect",
    () => getEditableCaretClientRect,
  );
  bindRuntimeValue(
    runtime,
    "chooseTextEditingTarget",
    () => chooseTextEditingTarget,
  );
  bindRuntimeValue(runtime, "pointerDragThreshold", () => pointerDragThreshold);
  bindRuntimeValue(
    runtime,
    "isAdditionalTouchPointer",
    () => isAdditionalTouchPointer,
  );
  bindRuntimeValue(
    runtime,
    "isFrameOrResizeTarget",
    () => isFrameOrResizeTarget,
  );
  bindRuntimeValue(runtime, "canStartCanvasPinch", () => canStartCanvasPinch);
  bindRuntimeValue(
    runtime,
    "canStartCanvasRectSelection",
    () => canStartCanvasRectSelection,
  );
  bindRuntimeValue(runtime, "rectanglesOverlap", () => rectanglesOverlap);
  bindRuntimeValue(
    runtime,
    "collectUnitsIntersectingSelectionRect",
    () => collectUnitsIntersectingSelectionRect,
  );
  bindRuntimeValue(runtime, "pathsOverlap", () => pathsOverlap);
  bindRuntimeValue(
    runtime,
    "getFrameHitTestOptions",
    () => getFrameHitTestOptions,
    (value) => {
      getFrameHitTestOptions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getFrameTransformScreenRect",
    () => getFrameTransformScreenRect,
  );
  bindRuntimeValue(
    runtime,
    "resolveSelectionDragHit",
    () => resolveSelectionDragHit,
  );
  bindRuntimeValue(
    runtime,
    "preservePinchAnchorCoordinate",
    () => preservePinchAnchorCoordinate,
  );
  bindRuntimeValue(runtime, "parseEditorNodePath", () => parseEditorNodePath);
  bindRuntimeValue(runtime, "removeNodeFromFrame", () => removeNodeFromFrame);
  bindRuntimeValue(runtime, "ceilMeasuredNodeSize", () => ceilMeasuredNodeSize);
  bindRuntimeValue(
    runtime,
    "createFreeFrameFromNode",
    () => createFreeFrameFromNode,
  );
  bindRuntimeValue(
    runtime,
    "fillMissingFrameSizes",
    () => fillMissingFrameSizes,
  );
  bindRuntimeValue(
    runtime,
    "isEmptyUnstyledFlowContainer",
    () => isEmptyUnstyledFlowContainer,
    (value) => {
      isEmptyUnstyledFlowContainer = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setNodeMinimumPlacementSize",
    () => setNodeMinimumPlacementSize,
  );
  bindRuntimeValue(runtime, "findChangedFrameIds", () => findChangedFrameIds);
  bindRuntimeValue(
    runtime,
    "findSurvivingNodePath",
    () => findSurvivingNodePath,
  );
  bindRuntimeValue(
    runtime,
    "removeNodeAndEmptyAncestors",
    () => removeNodeAndEmptyAncestors,
  );
  bindRuntimeValue(
    runtime,
    "extractFlowDragSelection",
    () => extractFlowDragSelection,
  );
  bindRuntimeValue(
    runtime,
    "collectFlowDragChildPaths",
    () => collectFlowDragChildPaths,
  );
  bindRuntimeValue(
    runtime,
    "normalizeFlowDragExtraction",
    () => normalizeFlowDragExtraction,
  );
  bindRuntimeValue(
    runtime,
    "createFlowChildIndexRemapper",
    () => createFlowChildIndexRemapper,
  );
  bindRuntimeValue(
    runtime,
    "collapseSingleChildFlowFrame",
    () => collapseSingleChildFlowFrame,
  );
  bindRuntimeValue(
    runtime,
    "reparentExtractedFlowNode",
    () => reparentExtractedFlowNode,
  );
  bindRuntimeValue(
    runtime,
    "getRemainingFlowChildRects",
    () => getRemainingFlowChildRects,
  );
  bindRuntimeValue(runtime, "removeFrameAxisSizes", () => removeFrameAxisSizes);
  bindRuntimeValue(
    runtime,
    "removeFlowNodePlacement",
    () => removeFlowNodePlacement,
  );
  bindRuntimeValue(
    runtime,
    "calculateNestedOverlayDepth",
    () => calculateNestedOverlayDepth,
  );
  bindRuntimeValue(
    runtime,
    "insertFramesIntoFlowContainer",
    () => insertFramesIntoFlowContainer,
  );
  bindRuntimeValue(
    runtime,
    "canInsertNodeIntoFlow",
    () => canInsertNodeIntoFlow,
    (value) => {
      canInsertNodeIntoFlow = value;
    },
  );
  bindRuntimeValue(runtime, "setFlowInsertionSize", () => setFlowInsertionSize);
  bindRuntimeValue(
    runtime,
    "findFlowInsertionIndex",
    () => findFlowInsertionIndex,
  );
  bindRuntimeValue(
    runtime,
    "calculateFlowInsertionGuide",
    () => calculateFlowInsertionGuide,
  );
  bindRuntimeValue(
    runtime,
    "shouldExtractOversizedNode",
    () => shouldExtractOversizedNode,
  );
  bindRuntimeValue(
    runtime,
    "canFitHorizontalFlowInsertion",
    () => canFitHorizontalFlowInsertion,
  );
  bindRuntimeValue(
    runtime,
    "pairFlowRectsWithRemainingNodes",
    () => pairFlowRectsWithRemainingNodes,
  );
  bindRuntimeValue(
    runtime,
    "flowInsertionTargetMatches",
    () => flowInsertionTargetMatches,
  );
  bindRuntimeValue(
    runtime,
    "collectCollapsibleFlowAncestors",
    () => collectCollapsibleFlowAncestors,
  );
  bindRuntimeValue(runtime, "flowRectsAligned", () => flowRectsAligned);
  bindRuntimeValue(runtime, "isStrictPathAncestor", () => isStrictPathAncestor);
  bindRuntimeValue(
    runtime,
    "duplicateFrameWithFixedFillPlacement",
    () => duplicateFrameWithFixedFillPlacement,
  );
  bindRuntimeValue(runtime, "deleteSelectedUnits", () => deleteSelectedUnits);
  bindRuntimeValue(runtime, "rotatedRectBounds", () => rotatedRectBounds);
  bindRuntimeValue(
    runtime,
    "selectionBoundsForUnits",
    () => selectionBoundsForUnits,
  );
  bindRuntimeValue(runtime, "getSelectedTextStyle", () => getSelectedTextStyle);
  bindRuntimeValue(runtime, "SlideCanvasEditor", () => SlideCanvasEditor);
  bindRuntimeValue(
    runtime,
    "textFormattingSnapshotsEqual",
    () => textFormattingSnapshotsEqual,
  );
  bindRuntimeValue(
    runtime,
    "trimTrailingTextNewlines",
    () => trimTrailingTextNewlines,
  );
  bindRuntimeValue(
    runtime,
    "FloatingTableCellToolbar",
    () => FloatingTableCellToolbar,
  );
  bindRuntimeValue(runtime, "TextColorControl", () => TextColorControl);
  bindRuntimeValue(
    runtime,
    "TextFormattingToolbar",
    () => TextFormattingToolbar,
  );
  bindRuntimeValue(
    runtime,
    "NODE_BACKGROUND_AND_PADDING_PROPERTIES",
    () => NODE_BACKGROUND_AND_PADDING_PROPERTIES,
    (value) => {
      NODE_BACKGROUND_AND_PADDING_PROPERTIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_ALIGNMENT_LABELS",
    () => TEXT_ALIGNMENT_LABELS,
    (value) => {
      TEXT_ALIGNMENT_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_ALIGNMENT_ICONS",
    () => TEXT_ALIGNMENT_ICONS,
    (value) => {
      TEXT_ALIGNMENT_ICONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TABLE_TEXT_ALIGNMENT_OPTIONS",
    () => TABLE_TEXT_ALIGNMENT_OPTIONS,
    (value) => {
      TABLE_TEXT_ALIGNMENT_OPTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_ALIGNMENT_OPTIONS",
    () => TEXT_ALIGNMENT_OPTIONS,
    (value) => {
      TEXT_ALIGNMENT_OPTIONS = value;
    },
  );
  return () => {
    CanvasEditorJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    EMPTY_EDITOR_TOOL_OPTIONS = [];
    placementSideToSnapLine = (side) =>
      side === "left" || side === "top" ? "near" : side === null ? null : "far";
    HORIZONTAL_GROUP_RESIZE_HANDLES = [
      {
        x: "left",
        y: null,
      },
      {
        x: "right",
        y: null,
      },
    ];
    EDITOR_ENTER_KEY_HINTS = {
      multi: "Press Enter to keep only this object selected.",
      enter: "Press Enter to go into this group; Shift+Enter comes back up.",
      text: "Press Enter to edit this text; Escape or Tab ends the edit and keeps your change.",
      cell: "Press Enter to edit the table; inside it Tab and Enter move between cells; Escape finishes and keeps your change, as does Ctrl or Command with Enter.",
    };
    EDITOR_VIEWPORT_PADDING = 48;
    EDITOR_MIN_STAGE_HEIGHT = 200;
    EDITOR_STAGE_PADDING_FRACTION = 0.1;
    EDITOR_FALLBACK_STAGE_WIDTH = 320;
    EDITOR_FORMATTING_LABELS = {
      text: "Text formatting",
      img: "Image formatting",
      icon: "Icon formatting",
      shape: "Shape formatting",
      stack: "Group formatting",
      grid: "Grid formatting",
      table: "Table formatting",
      html: "Embed formatting",
      spacer: "Spacer formatting",
      overlay: "Overlay formatting",
      mixed: "Formatting",
      cell: "Table cell formatting",
    };
    centerViewportAxis = (
      input,
      options,
      context,
      value,
    ) =>
      -(input - options * context) / (2 * context) - value / context;
    EDITOR_TEXT_ZOOM_DURATION_MS = 600;
    EDITOR_TEXT_ZOOM_SIDE_PADDING = 16;
    EDITOR_TEXT_ZOOM_TOP_PADDING = 76;
    SLIDE_LIFT_SCALE_ATTRIBUTE = "data-slides-lift";
    getFrameHitTestOptions = (slide, frame) => ({
      groupFirst: runtime.GROUP_COMMAND === "group",
      textTap: runtime.GROUP_TEXT_TAP_ENABLED,
      flow: (0, runtime.isPrimaryLayoutFrame)(slide, frame),
    });
    isEmptyUnstyledFlowContainer = (node) =>
      (0, runtime.isFlowContainer)(node) &&
      !(0, runtime.styleHasVisiblePaint)(node.style) &&
      node.children.every(
        (source) => source.kind === "spacer",
      );
    canInsertNodeIntoFlow = (node) =>
      node.kind !== "html" &&
      ((0, runtime.nodeChildren)(node) ?? []).every(canInsertNodeIntoFlow);
    NODE_BACKGROUND_AND_PADDING_PROPERTIES = [
      "backgroundColor",
      "backgroundGradient",
      "borderStyle",
      "borderWidth",
      "borderRadius",
      "borderTopLeftRadius",
      "borderTopRightRadius",
      "borderBottomRightRadius",
      "borderBottomLeftRadius",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
    ];
    TEXT_ALIGNMENT_LABELS = {
      start: "Left",
      center: "Center",
      end: "Right",
      justify: "Justify",
    };
    TEXT_ALIGNMENT_ICONS = {
      start: runtime.TEXT_ALIGN_LEFT_ICON,
      center: runtime.TEXT_ALIGN_CENTER_ICON,
      end: runtime.TEXT_ALIGN_RIGHT_ICON,
      justify: runtime.TEXT_ALIGN_JUSTIFY_ICON,
    };
    TABLE_TEXT_ALIGNMENT_OPTIONS = [
      {
        value: "start",
        label: "Left",
        icon: runtime.TEXT_ALIGN_LEFT_ICON,
      },
      {
        value: "center",
        label: "Center",
        icon: runtime.TEXT_ALIGN_CENTER_ICON,
      },
      {
        value: "end",
        label: "Right",
        icon: runtime.TEXT_ALIGN_RIGHT_ICON,
      },
      {
        value: "justify",
        label: "Justify",
        icon: runtime.TEXT_ALIGN_JUSTIFY_ICON,
        disabledReason: "Table columns align left, center or right",
      },
    ];
    TEXT_ALIGNMENT_OPTIONS = [
      {
        value: "start",
        label: TEXT_ALIGNMENT_LABELS.start,
        icon: runtime.TEXT_ALIGN_LEFT_ICON,
      },
      {
        value: "center",
        label: TEXT_ALIGNMENT_LABELS.center,
        icon: runtime.TEXT_ALIGN_CENTER_ICON,
      },
      {
        value: "end",
        label: TEXT_ALIGNMENT_LABELS.end,
        icon: runtime.TEXT_ALIGN_RIGHT_ICON,
      },
      {
        value: "justify",
        label: TEXT_ALIGNMENT_LABELS.justify,
        icon: runtime.TEXT_ALIGN_JUSTIFY_ICON,
      },
    ];
  };
}
