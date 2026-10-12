/** Restored application module; prepare first, initialize in original order. */
import type {
  ClipboardEvent as ReactClipboardEvent,
  Context,
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  FormEvent as ReactFormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
  RefObject,
  SyntheticEvent,
} from "react";
import {
  bindRuntimeValue,
  type CssVariableStyle,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  Alignment,
  ContainerAlignment,
  Frame,
  GridNode as GridNodeData,
  HtmlNode as HtmlNodeData,
  IconNode as IconNodeData,
  ImageNode as ImageNodeData,
  GridTrack,
  Justification,
  ListRenderingMode,
  OverlayLayer,
  OverlayNode as OverlayNodeData,
  ShadowValue,
  ShapeNode as ShapeNodeData,
  ShapeVariant,
  Slide,
  SlideNode as SlideNodeData,
  SpacerNode as SpacerNodeData,
  StackNode as StackNodeData,
  StyleBag,
  TableNode as TableNodeData,
  TextFit,
  TextNode as TextNodeData,
} from "../deck-contracts";
import type { EmbedFrameHostHandle } from "../embeds/frame-host";
import type { ExternalLinkOptions } from "../environment/links";
import type {
  VideoController,
  VideoControllerListener,
  VideoControllerState,
} from "../media/video-controller";
import type { VideoLink } from "../media/video-links";
import type {
  ConnectorArrowHead,
  ConnectorPoint,
  ShapeOutline,
} from "../model/deck";
import type { EditableRichText, TextRun } from "../model/rich-text-dom";
import type { CssDeclarations, StyleNodeKind } from "../model/style-schema";

/** Slide assets by name: stored name to the URL the renderer loads it from. */
export type SlideAssets = ReadonlyMap<string, string>;
/** How links in rendered text behave: opened on click (`open`), opened with a modifier (`view`), or selectable first (`edit`). */
export type SlideLinkMode = "open" | "view" | "edit";
/** Which video clips play: all of them, only those of the selected frame, or none. */
export type ClipPlaybackMode = "all" | "selected" | "none";
/** Direction of a stack. */
export type StackDirection = StackNodeData["dir"];
/** What a fitted text box is measured against: its own height or its parent's. */
export type TextFitBox = "self" | "parent";
/** How a container child fills the host box: grow along a flow, or fill the overlay layer. */
export type ContainerFitBox = "grow" | "fill";
/** A spacer that can hold an invisible copy of a node (keeps the layout while it is dragged away). */
export interface RenderedSpacerNode extends SpacerNodeData {
  ghost?: RenderedNode;
}
/** A slide node as the renderer accepts it. */
export type RenderedNode =
  | Exclude<SlideNodeData, SpacerNodeData>
  | RenderedSpacerNode;
/** Explicit size of the frame a node is rendered in; a missing side is unconstrained. */
export interface FrameSize {
  w?: number;
  h?: number;
}
/** A table cell address. */
export interface TableCellPosition {
  r: number;
  c: number;
}
/** Inline formatting commands the editor shortcuts map to. */
export type RichTextFormatName = "bold" | "italic" | "underline";
/** The open edit of a text node or table cell on the canvas. */
export interface SlideEditSession {
  frameId: string;
  path: string;
  cell?: TableCellPosition;
  /** Put the caret at the end of the text instead of selecting it. */
  caret?: "end";
  /** Re-select the contents when the edit was started by a double press. */
  reselect?: true;
  initialText: string;
  onInput(text: string): void;
  onCommit(text: string): void;
  onRichInput?(change: EditableRichText): void;
  onRichCommit?(change: EditableRichText): void;
  onFormat?(format: RichTextFormatName): void;
  onCommitMove?(text: string, rowDelta: number, columnDelta: number): void;
}
/** Hooks the editor passes to render frames it can select, drag and edit. */
export interface SlideInteractive {
  registerFrame(frameId: string, element: HTMLDivElement | null): void;
  onFramePointerDown(
    frameId: string,
    event: ReactPointerEvent<HTMLDivElement>,
  ): void;
  editing?: SlideEditSession | null;
  /** Whether the pointer press that is in progress carries no modifier. */
  plainPress?: () => boolean;
  selectedFrameIds?: readonly string[];
}
/** Link behaviour of the slide being rendered, provided to nested text. */
export interface SlideLinkState {
  links?: SlideLinkMode;
  onLinkOpen?: () => void;
  plainPress?: () => boolean;
}
/** Configuration the embed guard and the embed frame share. */
export interface SlideEmbedGuardConfig {
  markerAttr: string;
  disabledEvent: string;
}
/** A viewport position of a pointer press. */
export interface PointerPosition {
  x: number;
  y: number;
}
/** Limits how many videos play at once. */
export interface ClipCapacity {
  take(): boolean;
  give(): void;
  onFree(listener: () => void): () => void;
}
/** The linked (streamed) clip that currently plays, and how to change it. */
export interface ActiveLinkedClip {
  at: string | undefined;
  set(at: string | undefined): void;
}
/** The fields of a keyboard event that tell input-method composition apart. */
export interface ImeGuardEvent {
  key: string;
  keyCode: number;
  nativeEvent: { isComposing: boolean };
}
/** Tracks input-method composition so composing keys do not trigger shortcuts. */
export interface ImeGuard {
  onCompositionEnd(): void;
  fromIme(event: ImeGuardEvent): boolean;
}
/** What `useTextFit` needs to scale a text box down until it fits. */
export interface TextFitOptions {
  node: RenderedNode;
  fit: TextFit;
  /** Unscaled font size in px; fitting only applies when it is known. */
  base: number | undefined;
  box: TextFitBox | undefined;
  /** Pin the flex basis while measuring (vertical stacks). */
  pinBasis: boolean;
}
/** One rendered frame with its explicit stacking order, if any. */
export interface OrderedFrame {
  f: Frame;
  zIndex: number | undefined;
}
/** Props shared by every node renderer that lays out its own box. */
export interface NodeRenderProps {
  slideBg: string;
  assets: SlideAssets;
  path?: string;
  editing?: SlideEditSession | null;
  animate?: boolean;
  frameSelected?: boolean;
}
/** Props of the dashed placeholder shown instead of media that cannot play. */
export interface MediaPlaceholderProps {
  path: string;
  label: string;
}
/** Props of the sandboxed web embed node. */
export interface HtmlEmbedNodeProps {
  node: HtmlNodeData;
  path: string;
  animate?: boolean;
  selected?: boolean;
}
/** Props of the icon node. */
export interface IconNodeProps {
  node: IconNodeData;
  slideBg: string;
  inStack: boolean;
  path: string;
  animate?: boolean;
}
/** Props of the shape node (rectangles, ellipses, lines, connectors and polygons). */
export interface ShapeNodeProps {
  node: ShapeNodeData;
  inStack: boolean;
  parentDir?: StackDirection;
  path: string;
  frameSize?: FrameSize;
  animate?: boolean;
}

/** Content-box size of an element in px, as a ResizeObserver reports it. */
export interface ContentSize {
  w: number;
  h: number;
}
/** Props of the connector (a routed polyline with arrow heads). */
export interface ConnectorShapeProps {
  node: ShapeNodeData;
  style: CSSProperties;
  path: string;
  /** Size to draw at before the element has been measured. */
  nominal: FrameSize;
}
/** Props of the polygon shapes (diamond and arrows). */
export interface PolygonShapeProps {
  variant: ShapeVariant;
  fill?: string;
  stroke?: string;
  strokeW: number;
  /** SVG dash array of the outline. */
  dash?: string;
  style: CSSProperties;
  path: string;
  nominal: FrameSize;
  /** Extra attributes for the svg element. */
  marker?: Record<string, string>;
}
/** Props of the image node. */
export interface ImageNodeProps {
  node: ImageNodeData;
  assets: SlideAssets;
  /** The box is sized by its host instead of by the image. */
  hostSized: boolean;
  inStack: boolean;
  parentAlign?: ContainerAlignment;
  parentJustify?: Alignment | "stretch";
  path: string;
  animate?: boolean;
  selected?: boolean;
}
/** Props of the provider that scopes video playback to one slide. */
export interface ClipPlaybackProviderProps {
  clips?: ClipPlaybackMode;
  slideId: string;
  children?: ReactNode;
}
/** The linked clip that plays, with the slide it belongs to. */
interface ActiveClipRecord {
  at: string;
  slideId: string;
}
/** What the video holder reports about its place in the playback capacity. */
export type ClipHeldState = "failed" | "waiting" | undefined;
/** Props shared by the stored and the linked video renderers. */
export interface VideoNodeBaseProps {
  node: ImageNodeData;
  src?: string;
  path: string;
  /** Extra attributes for the outer element. */
  marker?: Record<string, string>;
  style: CSSProperties;
  selected: boolean;
  /** The box keeps the media's aspect ratio. */
  boxed: boolean;
}
/** Props of a hosted (linked) video. */
export interface LinkedVideoNodeProps extends VideoNodeBaseProps {
  link: VideoLink;
}
/** Props of a stored video clip. */
export interface StoredVideoNodeProps extends VideoNodeBaseProps {
  clip: string;
}
/** Props of the video that waits for a free playback slot. */
export interface VideoWithCapacityProps {
  clip: string;
  sound: boolean;
  label: string;
  style: CSSProperties;
  path: string;
  onController: (controller: VideoController | undefined) => void;
  onHeld: (state: ClipHeldState) => void;
  onKnown: () => void;
}
/** Props of the table node (the original bundle calls this component `TextNode`). */
export interface TableNodeProps {
  node: TableNodeData;
  slideBg: string;
  path: string;
  editing: SlideEditSession | null;
  inStack: boolean;
  parentAlign?: ContainerAlignment;
  parentJustify?: Alignment | "stretch";
  parentDir?: StackDirection;
  fitBox?: TextFitBox;
}
/** Props of the runs of formatted text (links, bold, italic, underline, colour). */
export interface RichTextRunsProps {
  runs: TextRun[];
  /** The runs are shown inside an open edit. */
  editing?: boolean;
}
/** Props of the formatted contents of a text node. */
export interface RichTextContentProps {
  node: TextNodeData;
}
/** Props of a text node that is only displayed. */
export interface ReadOnlyTextNodeProps {
  node: TextNodeData;
  slideBg: string;
  path: string;
  inStack: boolean;
  parentDir?: StackDirection;
  animate?: boolean;
  fitBox?: TextFitBox;
}
/** Props of a text node under edit. */
export interface EditableTextNodeProps {
  node: TextNodeData;
  slideBg: string;
  path: string;
  session: SlideEditSession;
  inStack?: boolean;
  parentDir?: StackDirection;
  fitBox?: TextFitBox;
}
/** Props of the table cell under edit. */
export interface EditableTableCellProps {
  /** `"row.column"` key of the cell. */
  cellKey: string;
  /** Accessible label of the cell. */
  name: string;
  style: CSSProperties;
  session: SlideEditSession;
}
/** Props of a spacer, which only shows a hatch while its frame is selected. */
export interface SpacerNodeProps {
  node: RenderedSpacerNode;
  path: string;
  showHatch: boolean;
}
/** Props of a grid node. */
export interface GridNodeProps extends NodeRenderProps {
  node: GridNodeData;
  box?: ContainerFitBox;
}
/**
 * Props of the renderer the original bundle names `StackNode`; it renders overlay nodes (a base plus positioned layers).
 */
export interface StackNodeProps extends NodeRenderProps {
  node: OverlayNodeData;
  inStack?: boolean;
  parentAlign?: ContainerAlignment;
  parentJustify?: Alignment | "stretch";
}
/**
 * Props of the renderer the original bundle names `OverlayNode`; it renders stacks (flex rows and columns).
 */
export interface OverlayNodeProps extends NodeRenderProps {
  node: StackNodeData;
  box?: ContainerFitBox;
}
/** Props of the dispatcher that renders any slide node. */
export interface SlideNodeProps extends NodeRenderProps {
  node: RenderedNode;
  inStack?: boolean;
  parentAlign?: ContainerAlignment;
  parentJustify?: Alignment | "stretch";
  parentDir?: StackDirection;
  box?: ContainerFitBox;
  frameSize?: FrameSize;
  /** The frame has an explicit size on both axes. */
  hostSized?: boolean;
}
/** Props of one positioned frame of a slide. */
export interface SlideFrameProps {
  frame: Frame;
  zIndex: number | undefined;
  slideBg: string;
  assets: SlideAssets;
  interactive: SlideInteractive | undefined;
  animate: boolean;
}
/** Props of a slide scaled into a fixed width, optionally with the editor's interaction layer. */
export interface SlideCanvasProps {
  slide: Slide;
  assets: SlideAssets;
  /** Rendered width in pixels; the height follows the slide's aspect ratio. */
  width: number;
  animate?: boolean;
  editorChrome?: boolean;
  structure?: boolean;
  links?: SlideLinkMode;
  onLinkOpen?: () => void;
  clips?: ClipPlaybackMode;
  interactive?: SlideInteractive;
}
/** Props of a slide drawn at its natural size. */
export interface SlideSurfaceProps {
  slide: Slide;
  assets: SlideAssets;
  animate?: boolean;
  editorChrome?: boolean;
  structure?: boolean;
  links?: SlideLinkMode;
  onLinkOpen?: () => void;
  clips?: ClipPlaybackMode;
  /** Replaces the slide's own background colour. */
  bgOverride?: string;
  /** Content drawn beneath the slide's frames. */
  underlay?: ReactNode;
}
/** Props of the video element itself. */
export interface VideoElementProps {
  clip: string;
  sound: boolean;
  label: string;
  style: CSSProperties;
  path: string;
  onController: (controller: VideoController | undefined) => void;
  onKnown: () => void;
  onError: () => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    SlideRendererReact: ReactNamespace;
    SlideRendererJsx: JsxNamespace;
    textFitScaleVariable: `--${string}`;
    textFitFontSizeVariable: `--${string}`;
    textFitClipVariable: `--${string}`;
    slideEditorChromeContext: Context<boolean>;
    slideStructureEnabledContext: Context<boolean>;
    linkModifierKeyLabel: () => string;
    linkModifierPressHint: () => string;
    richTextDoubleTapWindowMs: number;
    renderedLinkOptions: ExternalLinkOptions;
    pointerClickMovementTolerance: number;
    pointerPositionForMouse: (event: {
      pointerType: string;
      clientX: number;
      clientY: number;
    }) => PointerPosition | null;
    pointerClickMoved: (
      start: PointerPosition | null,
      event: { detail: number; clientX: number; clientY: number },
    ) => boolean;
    pointerHasLinkModifier: (event: {
      metaKey: boolean;
      ctrlKey: boolean;
    }) => boolean;
    slideLinkContext: Context<SlideLinkState>;
    richTextEditingContext: Context<boolean>;
    listRenderingContext: Context<ListRenderingMode | undefined>;
    mediaPlaceholderLabelCss: CSSProperties;
    transparencyCheckerboardGradient: string;
    allowEmbedScripts: boolean;
    htmlEmbedMarkerAttribute: string;
    embedsDisabledEventName: string;
    slideEmbedGuardConfig: SlideEmbedGuardConfig;
    slideEmbedContentSecurityPolicy: string;
    shapeStyleElementId: string;
    shapeStylesCss: string;
    shapeClipPaths: Record<string, string>;
    liveClipCapacity: number;
    clipSlideIdContext: Context<string>;
    clipCapacityContext: Context<ClipCapacity>;
    clipPlaybackModeContext: Context<ClipPlaybackMode>;
    activeLinkedClipContext: Context<ActiveLinkedClip>;
    supportsPlaintextContentEditable: boolean;
    linkDoublePressTimeoutMs: number;
    plaintextPasteFallback:
      | ((event: ReactClipboardEvent<HTMLElement>) => void)
      | undefined;
    preventDefaultInput: (event: SyntheticEvent) => void;
    pasteRichTextPlaintext: (event: ReactClipboardEvent<HTMLElement>) => void;
    editableFocusTimeoutMs: number;
    initializeSlideRenderer: () => void;
    nodeInlineStyleCss: (
      style?: StyleBag,
      nodeKind?: StyleNodeKind,
    ) => CssDeclarations;
    dynamicStyleAttributes: (
      style?: StyleBag,
      animate?: boolean,
    ) => Record<string, string>;
    flexAlignmentCss: (alignment?: ContainerAlignment) => string;
    flexJustificationCss: (justify?: Justification) => string;
    hasTextFitCssVariable: (element: HTMLElement) => boolean;
    applyTextFitCssVariable: (css: CSSProperties) => void;
    positiveFontSizePx: (fontSize?: string | number) => number | undefined;
    shouldPinShrinkBasis: (
      node: RenderedNode,
      fit?: TextFitBox,
      parentDirection?: StackDirection,
    ) => boolean;
    useTextFit: (
      ref: RefObject<HTMLElement | null>,
      options: TextFitOptions,
    ) => void;
    textFitContainerCss: (
      node: RenderedNode,
      hostSized?: boolean,
      fit?: ContainerFitBox,
    ) => CSSProperties;
    nodePlacementCss: (
      node: RenderedNode,
      parentAlign?: ContainerAlignment,
      parentJustify?: Alignment | "stretch",
    ) => CSSProperties;
    resolveImageUrl: (
      node: ImageNodeData,
      assets: SlideAssets,
    ) => string | undefined;
    classifyRenderedLink: (
      href: string,
    ) => ReturnType<RuntimeBindings["classifyExternalLink"]>;
    headingLevelForTextNode: (node: TextNodeData) => 1 | 2 | 3 | undefined;
    MediaPlaceholder: (props: MediaPlaceholderProps) => ReactElement;
    HtmlEmbedNode: (props: HtmlEmbedNodeProps) => ReactElement;
    ensureShapeStyles: () => void;
    IconNode: (props: IconNodeProps) => ReactElement;
    shadowDropFilter: (style?: StyleBag) => string | undefined;
    strokeDashArray: (
      line: ShapeOutline["line"],
      width: number,
    ) => string | undefined;
    ShapeNode: (props: ShapeNodeProps) => ReactElement;
    useElementContentSize: (ref: RefObject<Element | null>) => ContentSize | null;
    ConnectorShape: (props: ConnectorShapeProps) => ReactElement;
    PolygonShape: (props: PolygonShapeProps) => ReactElement;
    ImageNode: (props: ImageNodeProps) => ReactElement;
    createClipCapacity: () => ClipCapacity;
    ClipPlaybackProvider: (props: ClipPlaybackProviderProps) => ReactElement;
    LinkedVideoNode: (props: LinkedVideoNodeProps) => ReactElement;
    prefersReducedMotion: () => boolean;
    StoredVideoNode: (props: StoredVideoNodeProps) => ReactElement;
    useVideoDelay: (delay: number, key: string) => boolean;
    VideoWithCapacity: (props: VideoWithCapacityProps) => ReactElement | null;
    VideoElement: (props: VideoElementProps) => ReactElement;
    hexColorRgba: (color: string, alpha: number) => string;
    /** Renders table nodes (the original bundle calls the table renderer `TextNode`). */
    TextNode: (props: TableNodeProps) => ReactElement;
    useRichTextFormatInput: (
      ref: RefObject<HTMLElement | null>,
      onStyle?: (format: RichTextFormatName) => void,
    ) => void;
    useEditableTextFocus: (
      caret?: "end",
      reselect?: true,
    ) => RefObject<HTMLDivElement | null>;
    linkUrlFromTitle: (element: Element) => string;
    useEditableLinkPress: (ref: RefObject<HTMLElement | null>) => void;
    RichTextRuns: (props: RichTextRunsProps) => ReactElement;
    RichTextContent: (props: RichTextContentProps) => ReactElement;
    renderedTextCss: (
      node: TextNodeData,
      background: string | undefined,
      inStack: boolean,
      parentDirection: StackDirection | undefined,
      fitBox: TextFitBox | undefined,
      listMode: ListRenderingMode | undefined,
    ) => CSSProperties;
    ReadOnlyTextNode: (props: ReadOnlyTextNodeProps) => ReactElement;
    useImeGuard: () => ImeGuard;
    EditableTextNode: (props: EditableTextNodeProps) => ReactElement;
    EditableTableCell: (props: EditableTableCellProps) => ReactElement;
    SpacerNode: (props: SpacerNodeProps) => ReactElement;
    gridTrackCss: (track: GridTrack) => string;
    normalizeGridAlignmentCss: (
      alignment: ContainerAlignment,
    ) => ContainerAlignment;
    GridNode: (props: GridNodeProps) => ReactElement;
    /** Renders overlay nodes (the original bundle swapped the names `StackNode` and `OverlayNode`). */
    StackNode: (props: StackNodeProps) => ReactElement;
    /** Renders stack nodes (see `StackNode`). */
    OverlayNode: (props: OverlayNodeProps) => ReactElement;
    SlideNode: (props: SlideNodeProps) => ReactElement;
    SlideFrame: (props: SlideFrameProps) => ReactElement;
    orderedRenderedFrames: (
      slide: Slide,
      containsEmbeds: boolean,
    ) => OrderedFrame[];
    SlideCanvas: (props: SlideCanvasProps) => ReactElement;
    SlideSurface: (props: SlideSurfaceProps) => ReactElement;
  }
}

export function installRenderingSlides(runtime: RuntimeBindings): () => void {
  var SlideRendererReact: ReactNamespace;
  var SlideRendererJsx: JsxNamespace;
  var textFitScaleVariable: RuntimeBindings["textFitScaleVariable"];
  var textFitFontSizeVariable: RuntimeBindings["textFitFontSizeVariable"];
  var textFitClipVariable: RuntimeBindings["textFitClipVariable"];
  var slideEditorChromeContext: RuntimeBindings["slideEditorChromeContext"];
  var slideStructureEnabledContext: RuntimeBindings["slideStructureEnabledContext"];
  var linkModifierKeyLabel: RuntimeBindings["linkModifierKeyLabel"];
  var linkModifierPressHint: RuntimeBindings["linkModifierPressHint"];
  var richTextDoubleTapWindowMs: RuntimeBindings["richTextDoubleTapWindowMs"];
  var renderedLinkOptions: RuntimeBindings["renderedLinkOptions"];
  var pointerClickMovementTolerance: RuntimeBindings["pointerClickMovementTolerance"];
  var pointerPositionForMouse: RuntimeBindings["pointerPositionForMouse"];
  var pointerClickMoved: RuntimeBindings["pointerClickMoved"];
  var pointerHasLinkModifier: RuntimeBindings["pointerHasLinkModifier"];
  var slideLinkContext: RuntimeBindings["slideLinkContext"];
  var richTextEditingContext: RuntimeBindings["richTextEditingContext"];
  var listRenderingContext: RuntimeBindings["listRenderingContext"];
  var mediaPlaceholderLabelCss: RuntimeBindings["mediaPlaceholderLabelCss"];
  var transparencyCheckerboardGradient: RuntimeBindings["transparencyCheckerboardGradient"];
  var allowEmbedScripts: RuntimeBindings["allowEmbedScripts"];
  var htmlEmbedMarkerAttribute: RuntimeBindings["htmlEmbedMarkerAttribute"];
  var embedsDisabledEventName: RuntimeBindings["embedsDisabledEventName"];
  var slideEmbedGuardConfig: RuntimeBindings["slideEmbedGuardConfig"];
  var slideEmbedContentSecurityPolicy: RuntimeBindings["slideEmbedContentSecurityPolicy"];
  var shapeStyleElementId: RuntimeBindings["shapeStyleElementId"];
  var shapeStylesCss: RuntimeBindings["shapeStylesCss"];
  var shapeClipPaths: RuntimeBindings["shapeClipPaths"];
  var liveClipCapacity: RuntimeBindings["liveClipCapacity"];
  var clipSlideIdContext: RuntimeBindings["clipSlideIdContext"];
  var clipCapacityContext: RuntimeBindings["clipCapacityContext"];
  var clipPlaybackModeContext: RuntimeBindings["clipPlaybackModeContext"];
  var activeLinkedClipContext: RuntimeBindings["activeLinkedClipContext"];
  var supportsPlaintextContentEditable: RuntimeBindings["supportsPlaintextContentEditable"];
  var linkDoublePressTimeoutMs: RuntimeBindings["linkDoublePressTimeoutMs"];
  var plaintextPasteFallback: RuntimeBindings["plaintextPasteFallback"];
  var preventDefaultInput: RuntimeBindings["preventDefaultInput"];
  var pasteRichTextPlaintext: RuntimeBindings["pasteRichTextPlaintext"];
  var editableFocusTimeoutMs: RuntimeBindings["editableFocusTimeoutMs"];
  var initializeSlideRenderer: RuntimeBindings["initializeSlideRenderer"];
  function nodeInlineStyleCss(
    style?: StyleBag,
    nodeKind?: StyleNodeKind,
  ): CssDeclarations {
    if (!style) {
      return {};
    }
    return (0, runtime.styleBagToCss)(style, nodeKind);
  }
  function dynamicStyleAttributes(
    style?: StyleBag,
    animate?: boolean,
  ): Record<string, string> {
    if (!animate || !style) {
      return {};
    }
    if (style.hover === undefined && style.animation === undefined) {
      return {};
    }
    return {
      [runtime.dynamicStyleAttribute]: "",
    };
  }
  function flexAlignmentCss(alignment?: ContainerAlignment): string {
    if (alignment === "start") {
      return "flex-start";
    } else {
      if (alignment === "end") {
        return "flex-end";
      } else {
        if (alignment === "center" || alignment === "baseline") {
          return alignment;
        } else {
          return "stretch";
        }
      }
    }
  }
  function flexJustificationCss(justify?: Justification): string {
    if (justify === "start") {
      return "flex-start";
    } else {
      if (justify === "end") {
        return "flex-end";
      } else {
        if (justify === "center") {
          return "center";
        } else {
          return "space-" + justify;
        }
      }
    }
  }
  function hasTextFitCssVariable(element: HTMLElement): boolean {
    return [element, ...element.querySelectorAll<HTMLElement>("*")].some(
      (input: HTMLElement): boolean =>
        input.style.getPropertyValue(textFitScaleVariable) !== "",
    );
  }
  function applyTextFitCssVariable(css: CSSProperties): void {
    let value = positiveFontSizePx(css.fontSize);
    if (value === undefined) {
      return;
    }
    (css as CssVariableStyle)[textFitFontSizeVariable] =
      "calc(" + String(value) + "px * var(" + textFitScaleVariable + ", 1))";
    css.fontSize = "var(" + textFitFontSizeVariable + ")";
  }
  function positiveFontSizePx(fontSize?: string | number): number | undefined {
    let value =
      typeof fontSize === "number"
        ? fontSize
        : typeof fontSize === "string" && /^\d+(\.\d+)?px$/.test(fontSize)
          ? parseFloat(fontSize)
          : undefined;
    if (value !== undefined && Number.isFinite(value) && value > 0) {
      return value;
    } else {
      return undefined;
    }
  }
  function shouldPinShrinkBasis(
    node: RenderedNode,
    fit?: TextFitBox,
    parentDirection?: StackDirection,
  ): boolean {
    return (
      fit === "self" &&
      parentDirection === "v" &&
      node.place?.basis === undefined
    );
  }
  function useTextFit(
    ref: RefObject<HTMLElement | null>,
    options: TextFitOptions,
  ): void {
    let {
        node: value,
        fit: value2,
        base: value3,
        box: value4,
        pinBasis: value5,
      }: TextFitOptions = options,
      value6: boolean =
        value2 === "shrink" && value3 !== undefined && value4 !== undefined,
      ref2 = SlideRendererReact.useRef<string | null>(null),
      ref3 = SlideRendererReact.useRef((): void => {
        return;
      });
    ref3.current = (): void => {
      let current = ref.current;
      if (!current) {
        return;
      }
      if (ref2.current !== null) {
        if (current.style.flexBasis === ref2.current) {
          current.style.flexBasis = "";
        }
        ref2.current = null;
      }
      current.style.removeProperty(textFitClipVariable);
      if (!value6) {
        current.style.removeProperty(textFitScaleVariable);
        return;
      }
      let value7 = value4 === "parent" ? current.parentElement : current;
      if (!value7) {
        return;
      }
      let state = {
          flexGrow: current.style.flexGrow,
          flexShrink: current.style.flexShrink,
          flexBasis: current.style.flexBasis,
          height: current.style.height,
          minHeight: current.style.minHeight,
          maxHeight: current.style.maxHeight,
        },
        text = "",
        callback = (input: number): number => {
          if (input === 1) {
            current.style.removeProperty(textFitScaleVariable);
          } else {
            current.style.setProperty(textFitScaleVariable, String(input));
          }
          Object.assign(
            current.style,
            value4 === "parent"
              ? {
                  height: "auto",
                  minHeight: "0",
                  maxHeight: "none",
                }
              : {
                  flexGrow: "0",
                  flexShrink: "0",
                  flexBasis: "auto",
                  height: "auto",
                  minHeight: "0",
                  maxHeight: "none",
                },
          );
          let offsetHeight = current.offsetHeight;
          if (input === 1) {
            text = getComputedStyle(current).height;
          }
          Object.assign(current.style, state);
          return offsetHeight;
        },
        callback2 = (): number =>
          value4 === "self" ? current.offsetHeight : value7.clientHeight;
      if (callback(1) <= callback2() + 0.5) {
        return;
      }
      if (value5) {
        current.style.flexBasis = text;
        state.flexBasis = text;
        ref2.current = text;
      }
      let value8 = callback2(),
        value9 = Math.min(
          1,
          Math.max(
            runtime.textFitMinimumScale,
            runtime.minimumTextFontSize / value3!,
          ),
        );
      if (callback(value9) > value8 + 0.5) {
        current.style.setProperty(textFitScaleVariable, String(value9));
        if (value8 >= value3! * value9) {
          current.style.setProperty(textFitClipVariable, "clip");
        }
        return;
      }
      let value10 = value9,
        count = 1;
      for (let index = 0; index < 7; index++) {
        let value11 = (value10 + count) / 2;
        if (callback(value11) <= value8 + 0.5) {
          value10 = value11;
        } else {
          count = value11;
        }
      }
      current.style.setProperty(textFitScaleVariable, String(value10));
    };
    SlideRendererReact.useLayoutEffect((): void => {
      ref3.current();
    }, [value, value2, value3, value4, value5]);
    SlideRendererReact.useEffect((): (() => void) | undefined => {
      let current = ref.current;
      if (!current || !value6) {
        return;
      }
      let value7 = value4 === "parent" ? current.parentElement : current;
      if (!value7) {
        return;
      }
      let value8 =
          value4 === "self" ? current.offsetHeight : value7.clientHeight,
        offsetWidth = current.offsetWidth,
        value9 =
          typeof ResizeObserver !== "undefined"
            ? new ResizeObserver((): void => {
                let value10 =
                    value4 === "self"
                      ? current.offsetHeight
                      : value7.clientHeight,
                  offsetWidth2 = current.offsetWidth;
                if (
                  Math.abs(value10 - value8) > 0.5 ||
                  Math.abs(offsetWidth2 - offsetWidth) > 0.5
                ) {
                  value8 = value10;
                  offsetWidth = offsetWidth2;
                  ref3.current();
                  value8 =
                    value4 === "self"
                      ? current.offsetHeight
                      : value7.clientHeight;
                }
              })
            : undefined;
      value9?.observe(value7);
      if (value7 !== current) {
        value9?.observe(current);
      }
      let fonts = current.ownerDocument.fonts,
        callback = (): void => ref3.current();
      fonts?.addEventListener("loadingdone", callback);
      let flag = true;
      if (fonts !== undefined && fonts.status !== "loaded") {
        fonts.ready.then((): void => {
          if (flag) {
            callback();
          }
        });
      }
      return (): void => {
        flag = false;
        value9?.disconnect();
        fonts?.removeEventListener("loadingdone", callback);
      };
    }, [ref, value6, value4]);
  }
  function textFitContainerCss(
    node: RenderedNode,
    hostSized?: boolean,
    fit?: ContainerFitBox,
  ): CSSProperties {
    if (hostSized || fit === "fill") {
      return {
        width: "100%",
        height: "100%",
      };
    }
    if (fit === "grow") {
      return {
        flex: "1 1 auto",
        alignSelf: "stretch",
        ...nodePlacementCss(node),
      };
    }
    return nodePlacementCss(node);
  }
  function nodePlacementCss(
    node: RenderedNode,
    parentAlign?: ContainerAlignment,
    parentJustify?: Alignment | "stretch",
  ): CSSProperties {
    let state: CSSProperties = {
      minWidth: 0,
      minHeight: 0,
    };
    if (
      parentAlign === "stretch" &&
      !(0, runtime.nodeSupportsSelfAlignment)(node, "alignSelf")
    ) {
      state.alignSelf = "flex-start";
    }
    if (
      parentJustify === "stretch" &&
      !(0, runtime.nodeSupportsSelfAlignment)(node, "justifySelf")
    ) {
      state.justifySelf = "start";
    }
    let place = node.place;
    if (!place) {
      return state;
    }
    if (place.grow !== undefined) {
      state.flexGrow = place.grow;
    }
    if (place.shrink !== undefined) {
      state.flexShrink = place.shrink;
    }
    if (place.basis !== undefined) {
      state.flexBasis = place.basis === 0 ? "0%" : place.basis;
    }
    if (place.alignSelf !== undefined) {
      state.alignSelf = flexAlignmentCss(place.alignSelf);
    }
    if (place.minW !== undefined) {
      state.minWidth = place.minW;
    }
    if (place.minWFit !== undefined) {
      if (place.minW !== undefined && place.minW === place.maxW) {
        state.width = place.minW;
      }
      state.minWidth = place.minWFit;
    }
    if (place.maxW !== undefined) {
      state.maxWidth = place.maxW;
    }
    if (node.kind !== "table") {
      if (place.minH !== undefined) {
        state.minHeight = place.minH;
      }
      if (place.maxH !== undefined) {
        state.maxHeight = place.maxH;
      }
      if (place.minH !== undefined && place.minH === place.maxH) {
        state.height = place.minH;
      }
      if (place.aspect !== undefined) {
        state.aspectRatio = String(place.aspect);
      }
    }
    if (place.colSpan !== undefined) {
      state.gridColumn = "span " + String(place.colSpan);
    }
    if (place.rowSpan !== undefined) {
      state.gridRow = "span " + String(place.rowSpan);
    }
    if (place.justifySelf !== undefined) {
      state.justifySelf = place.justifySelf;
    }
    return state;
  }
  function resolveImageUrl(
    node: ImageNodeData,
    assets: SlideAssets,
  ): string | undefined {
    if (node.asset !== undefined) {
      return assets.get(node.asset);
    }
    return node.src;
  }
  function classifyRenderedLink(
    href: string,
  ): ReturnType<RuntimeBindings["classifyExternalLink"]> {
    return (0, runtime.classifyExternalLink)(
      href.replace(/^https?:/i, (input: string): string => input.toLowerCase()),
      renderedLinkOptions,
    );
  }
  function headingLevelForTextNode(node: TextNodeData): 1 | 2 | 3 | undefined {
    if (node.list !== undefined || node.text.trim() === "") {
      return;
    }
    switch (node.role) {
      case "display":
      case "h1":
        return 1;
      case "h2":
        return 2;
      case "h3":
        return 3;
      default:
        return;
    }
  }
  function MediaPlaceholder({
    path: path,
    label: label,
  }: MediaPlaceholderProps): ReactElement {
    return SlideRendererJsx.jsx("div", {
      "data-node-path": path,
      style: {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        background: "rgba(115,114,108,0.12)",
        border: "2px dashed rgba(115,114,108,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        color: "#73726C",
        fontSize: 24,
        fontFamily: "system-ui, sans-serif",
        pointerEvents: "none",
      },
      children: label,
    });
  }
  function HtmlEmbedNode({
    node: node,
    path: path,
    animate: animate,
    selected: selected,
  }: HtmlEmbedNodeProps): ReactElement {
    if (animate) {
      (0, runtime.installEmbedRuntimeGuard)(slideEmbedGuardConfig);
    }
    let value = SlideRendererReact.useSyncExternalStore(
        (input: () => void): (() => void) =>
          (0, runtime.subscribeEmbedsDisabled)(slideEmbedGuardConfig, input),
        (): boolean => (0, runtime.embedsDisabled)(slideEmbedGuardConfig),
        (): boolean => false,
      ),
      [value2, value3] = SlideRendererReact.useState(false),
      ref = SlideRendererReact.useRef<EmbedFrameHostHandle | null>(null),
      ref2 = SlideRendererReact.useRef(node.html);
    if (ref2.current !== node.html) {
      ref2.current = node.html;
      if (value2) {
        value3(false);
      }
    }
    let [value4, value5] = SlideRendererReact.useState(0);
    SlideRendererReact.useEffect((): (() => void) => {
      function value7(input: PageTransitionEvent): void {
        if (input.persisted) {
          value3(false);
          value5((input2: number): number => input2 + 1);
        }
      }
      window.addEventListener("pageshow", value7);
      return (): void => window.removeEventListener("pageshow", value7);
    }, []);
    SlideRendererReact.useEffect((): void => {
      ref.current?.update({
        t: 0,
        playing: false,
        selected: selected === true,
        props: {},
      });
    }, [selected]);
    let value6 = (0, runtime.usePlayerHasFocus)();
    if (!animate) {
      return SlideRendererJsx.jsx(MediaPlaceholder, {
        path: path,
        label: "web embed",
      });
    }
    if (value6 && !value) {
      return SlideRendererJsx.jsx(MediaPlaceholder, {
        path: path,
        label: "web embed off while a video player is open",
      });
    }
    if (value) {
      return SlideRendererJsx.jsx(MediaPlaceholder, {
        path: path,
        label: "web embed disabled — it tried to take keyboard focus",
      });
    }
    if (value2) {
      return SlideRendererJsx.jsx(MediaPlaceholder, {
        path: path,
        label: "web embed disabled — it navigated away from its content",
      });
    }
    return SlideRendererJsx.jsx("div", {
      "data-node-path": path,
      style: {
        width: "100%",
        height: "100%",
        overflow: "hidden",
        pointerEvents: "none",
      },
      children: SlideRendererJsx.jsx(
        runtime.EmbedFrame,
        {
          html: node.html,
          allowScripts: allowEmbedScripts,
          markerAttr: htmlEmbedMarkerAttribute,
          title: "Embedded web content (sandboxed)",
          onNavigated: (): void => value3(true),
          onHost: (input: EmbedFrameHostHandle | null): void => {
            ref.current = input;
            input?.update({
              t: 0,
              playing: false,
              selected: selected === true,
              props: {},
            });
          },
        },
        value4,
      ),
    });
  }
  function ensureShapeStyles(): void {
    if (typeof document === "undefined") {
      return;
    }
    if (document.getElementById(shapeStyleElementId)) {
      return;
    }
    let value = document.createElement("style");
    value.id = shapeStyleElementId;
    value.textContent = shapeStylesCss;
    document.head.appendChild(value);
  }
  function IconNode({
    node: node,
    slideBg: slideBg,
    inStack: inStack,
    path: path,
    animate: animate,
  }: IconNodeProps): ReactElement {
    ensureShapeStyles();
    let value =
        (0, runtime.resolveSlideColor)(node.color) ??
        (0, runtime.slideTextColor)(slideBg),
      value2: CSSProperties = inStack
        ? {
            width: node.w ?? 160,
            height: node.h ?? 160,
            ...nodePlacementCss(node),
          }
        : {
            width: "100%",
            height: "100%",
          };
    value2.display = "block";
    return SlideRendererJsx.jsx("svg", {
      "data-icon-path": path,
      "data-node-path": path,
      ...dynamicStyleAttributes(node.style, animate),
      viewBox: "0 0 100 100",
      preserveAspectRatio: "xMidYMid meet",
      style: {
        ...value2,
        ...nodeInlineStyleCss(node.style, "slides-icon"),
      },
      children: SlideRendererJsx.jsx("text", {
        x: "50",
        y: "54",
        textAnchor: "middle",
        dominantBaseline: "central",
        fontFamily: "mc-anthropicons",
        fontSize: "90",
        fill: value,
        children: runtime.iconFontGlyphs[node.icon],
      }),
    });
  }
  function shadowDropFilter(style?: StyleBag): string | undefined {
    let value = (style?.boxShadow ?? []).filter(
      (input: ShadowValue): boolean => input.inset !== true,
    );
    if (value.length === 0) {
      return;
    }
    return value
      .map(
        (input: ShadowValue): string =>
          "drop-shadow(" +
          String(input.x) +
          "px " +
          String(input.y) +
          "px " +
          String(input.blur) +
          "px " +
          input.color +
          ")",
      )
      .join(" ");
  }
  function strokeDashArray(
    line: ShapeOutline["line"],
    width: number,
  ): string | undefined {
    if (line === "dashed") {
      return String(width * 3) + " " + String(width * 2);
    } else {
      if (line === "dotted") {
        return "0 " + String(width * 2);
      } else {
        return undefined;
      }
    }
  }
  function ShapeNode({
    node: node,
    inStack: inStack,
    parentDir: parentDir,
    path: path,
    frameSize: frameSize,
    animate: animate,
  }: ShapeNodeProps): ReactElement {
    let shape = node.shape,
      value = 2 * (0, runtime.connectorArrowInset)(node.strokeWidth),
      value2 =
        (node.place?.grow ?? 0) > 0 && shape === "connector"
          ? (parentDir ?? "h")
          : node.w !== undefined && node.h === undefined
            ? "h"
            : node.h !== undefined && node.w === undefined
              ? "v"
              : undefined,
      value3: FrameSize = inStack
        ? shape === "connector"
          ? {
              w: node.w ?? (value2 === "v" ? value : runtime.defaultMediaSize),
              h: node.h ?? (value2 === "v" ? runtime.defaultMediaSize : value),
            }
          : {
              w: node.w,
              h: node.h,
            }
        : {
            w: frameSize?.w ?? node.w,
            h: frameSize?.h ?? node.h,
          },
      value4: CSSProperties = inStack
        ? {
            width:
              node.w ??
              (shape === "line"
                ? undefined
                : shape === "connector" && value2 === "v"
                  ? value
                  : runtime.defaultMediaSize),
            height:
              node.h ??
              (shape === "connector" ? value : runtime.defaultMediaSize),
            ...nodePlacementCss(node),
          }
        : {
            width: "100%",
            height: "100%",
          };
    if (shape === "connector") {
      return SlideRendererJsx.jsx(ConnectorShape, {
        node: node,
        style: {
          ...value4,
          display: "block",
        },
        path: path,
        nominal: value3,
      });
    }
    if (node.rotate !== undefined && node.rotate !== 0) {
      value4.transform = "rotate(" + String(node.rotate) + "deg)";
    }
    let value5 = nodeInlineStyleCss(node.style, "slides-shape"),
      value6 = dynamicStyleAttributes(node.style, animate);
    if (
      shape === "rect" ||
      shape === "rounded" ||
      shape === "ellipse" ||
      shape === "line"
    ) {
      let state2 = {
        ...value4,
        boxSizing: "border-box",
        display: "block",
        ...value5,
      };
      if (shape === "ellipse") {
        state2.borderRadius = "50%";
      }
      return SlideRendererJsx.jsx("div", {
        "data-node-path": path,
        "data-shape": shape,
        ...value6,
        style: state2,
      });
    }
    let {
        background: value7,
        backgroundColor: value8,
        border: value9,
        borderWidth: value10,
        borderStyle: value11,
        borderColor: value12,
        borderRadius: value13,
        boxShadow: value14,
        backdropFilter: value15,
        WebkitBackdropFilter: value16,
        filter: value17,
        ...value18
      }: CssDeclarations = value5,
      value19 = shadowDropFilter(node.style),
      value20 = [value17, value19]
        .filter(
          (input: string | number | undefined): boolean =>
            typeof input === "string" && input !== "",
        )
        .join(" "),
      state = {
        ...value4,
        display: "block",
        ...value18,
        ...(value20 !== ""
          ? {
              filter: value20,
            }
          : {}),
      },
      value21 = (0, runtime.shapeOutline)(node.style);
    return SlideRendererJsx.jsx(PolygonShape, {
      variant: shape,
      fill: node.style?.backgroundColor,
      stroke: value21?.color,
      strokeW: value21?.width ?? 0,
      dash:
        value21 !== undefined
          ? strokeDashArray(value21.line, value21.width)
          : undefined,
      style: state,
      path: path,
      nominal: value3,
      marker: value6,
    });
  }
  function useElementContentSize(
    ref: RefObject<Element | null>,
  ): ContentSize | null {
    let [value, value2] = SlideRendererReact.useState<ContentSize | null>(null);
    SlideRendererReact.useLayoutEffect((): (() => void) | undefined => {
      let current = ref.current;
      if (!current || typeof ResizeObserver === "undefined") {
        return;
      }
      let observer = new ResizeObserver(
        (input: ResizeObserverEntry[]): void => {
        for (let value3 of input) {
          let contentRect = value3.contentRect;
          if (contentRect.width > 0 && contentRect.height > 0) {
            value2(
              (input2: ContentSize | null): ContentSize =>
                input2 &&
                input2.w === contentRect.width &&
                input2.h === contentRect.height
                  ? input2
                  : {
                      w: contentRect.width,
                      h: contentRect.height,
                    },
            );
          }
        }
      });
      observer.observe(current);
      return (): void => observer.disconnect();
    }, [ref]);
    return value;
  }
  function ConnectorShape({
    node: node,
    style: style,
    path: path,
    nominal: nominal,
  }: ConnectorShapeProps): ReactElement {
    let ref = SlideRendererReact.useRef<SVGSVGElement>(null),
      value = useElementContentSize(ref),
      value2 = node.strokeWidth ?? runtime.defaultShapeStrokeWidth,
      value3 = value?.w ?? nominal.w ?? 240,
      value4 =
        value?.h ??
        nominal.h ??
        (nominal.w !== undefined
          ? 240
          : 2 * (0, runtime.connectorArrowInset)(value2)),
      value5 = (0, runtime.connectorGeometry)(value3, value4, node),
      callback = (input: ConnectorPoint[]): string =>
        input
          .map(
            ([input2, input3]: ConnectorPoint, options: number): string =>
              (options === 0 ? "M" : "L") +
              input2.toFixed(2) +
              " " +
              input3.toFixed(2),
          )
          .join(" "),
      value6 = (0, runtime.resolveSlideColor)(node.stroke) ?? "#000000",
      value7 = (0, runtime.cssColorOpacity)(value6),
      value8 = value7 < 1 ? (0, runtime.stripHexAlpha)(value6) : value6;
    return SlideRendererJsx.jsxs("svg", {
      ref: ref,
      "data-node-path": path,
      "data-shape": "connector",
      viewBox: "0 0 " + String(value3) + " " + String(value4),
      preserveAspectRatio: "none",
      style: {
        ...style,
        overflow: "visible",
      },
      children: [
        SlideRendererJsx.jsx("path", {
          d: callback(value5.points),
          fill: "none",
          stroke: "transparent",
          strokeWidth: Math.max(12, value2 + 8),
        }),
        SlideRendererJsx.jsxs("g", {
          fill: "none",
          opacity: value7 < 1 ? value7 : undefined,
          children: [
            SlideRendererJsx.jsx("path", {
              d: callback(
                (0, runtime.shortenConnectorShaftForHeads)(value5, value2),
              ),
              fill: "none",
              stroke: value8,
              strokeWidth: value2,
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeDasharray:
                node.dashed === true
                  ? String(value2 * 3) + " " + String(value2 * 2)
                  : undefined,
            }),
            value5.heads.map((source: ConnectorArrowHead, options: number): ReactElement => {
              let [value9, value10] = (0, runtime.connectorArrowHeadWings)(
                  source,
                  value2,
                ),
                value11 = callback([value9, source.tip, value10]);
              if (source.kind === "open") {
                return SlideRendererJsx.jsx(
                  "path",
                  {
                    d: value11,
                    fill: "none",
                    stroke: value8,
                    strokeWidth: value2,
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                  },
                  options,
                );
              } else {
                return SlideRendererJsx.jsx(
                  "path",
                  {
                    d: value11 + " Z",
                    fill: value8,
                  },
                  options,
                );
              }
            }),
          ],
        }),
      ],
    });
  }
  function PolygonShape({
    variant: variant,
    fill: fill,
    stroke: stroke,
    strokeW: strokeW,
    dash: dash,
    style: style,
    path: path,
    nominal: nominal,
    marker: marker,
  }: PolygonShapeProps): ReactElement {
    let ref = SlideRendererReact.useRef<SVGSVGElement>(null),
      value = useElementContentSize(ref),
      value2 = value?.w ?? nominal.w ?? 240,
      value3 = value?.h ?? nominal.h ?? 240,
      value4 = (shapeClipPaths[variant] ?? "")
        .split(" ")
        .map((input: string): string => {
          let [value5, value6] = input.split(",").map(Number);
          return (
            String((((value5 ?? 0) / 100) * value2).toFixed(2)) +
            "," +
            String((((value6 ?? 0) / 100) * value3).toFixed(2))
          );
        })
        .join(" ");
    return SlideRendererJsx.jsx("svg", {
      ref: ref,
      "data-node-path": path,
      "data-shape": variant,
      viewBox: "0 0 " + String(value2) + " " + String(value3),
      preserveAspectRatio: "none",
      ...marker,
      style: style,
      children: SlideRendererJsx.jsx("polygon", {
        points: value4,
        fill: fill ?? "none",
        stroke: strokeW > 0 ? stroke : undefined,
        strokeWidth: strokeW > 0 ? strokeW : undefined,
        strokeDasharray: strokeW > 0 ? dash : undefined,
        strokeLinecap: dash !== undefined ? "round" : undefined,
        strokeLinejoin: "round",
      }),
    });
  }
  function ImageNode({
    node: node,
    assets: assets,
    hostSized: hostSized,
    inStack: inStack,
    parentAlign: parentAlign,
    parentJustify: parentJustify,
    path: path,
    animate: animate,
    selected = false,
  }: ImageNodeProps): ReactElement {
    let value = resolveImageUrl(node, assets),
      value2: CSSProperties = inStack
        ? {
            width: node.w !== undefined ? node.w : undefined,
            height: node.h !== undefined ? node.h : undefined,
            maxWidth: runtime.SLIDE_WIDTH,
            maxHeight: runtime.SLIDE_HEIGHT,
            ...nodePlacementCss(node, parentAlign, parentJustify),
          }
        : {
            width: "100%",
            height: "100%",
          };
    value2.display = "block";
    let value3 = nodeInlineStyleCss(node.style, "slides-img"),
      value4 = dynamicStyleAttributes(node.style, animate),
      [value5, value6] = SlideRendererReact.useState<string | undefined>(
        undefined,
      ),
      value7 = SlideRendererReact.useContext(slideEditorChromeContext);
    if (node.video !== undefined && animate) {
      return SlideRendererJsx.jsx(StoredVideoNode, {
        node: node,
        clip: node.video,
        src: value,
        path: path,
        marker: value4,
        style: {
          ...value2,
          ...value3,
        },
        selected: selected,
        boxed: (0, runtime.shouldPreserveMediaAspect)(node, hostSized, inStack),
      });
    }
    if (node.videoLink !== undefined && animate) {
      return SlideRendererJsx.jsx(LinkedVideoNode, {
        node: node,
        link: node.videoLink,
        src: value,
        path: path,
        marker: value4,
        style: {
          ...value2,
          ...value3,
        },
        selected: selected,
        boxed: (0, runtime.shouldPreserveMediaAspect)(node, hostSized, inStack),
      });
    }
    let value8 =
        node.videoLink !== undefined
          ? (0, runtime.videoWatchUrl)(node.videoLink)
          : null,
      value9 =
        value8 !== null
          ? {
              "data-video-watch": value8,
            }
          : null;
    if (
      (node.video !== undefined || node.videoLink !== undefined) &&
      (!value || value5 === value)
    ) {
      return SlideRendererJsx.jsx("div", {
        "data-img-path": path,
        "data-node-path": path,
        role: "img",
        "aria-label": node.alt || "Video",
        ...value4,
        ...value9,
        style: {
          ...value2,
          minWidth: 120,
          minHeight: 80,
          backgroundColor: "#141413",
          ...value3,
        },
      });
    }
    if (!value && node.asset === undefined && node.src === undefined) {
      let value10 =
        value7 &&
        value3.backgroundImage === undefined &&
        value3.backgroundColor === undefined;
      return SlideRendererJsx.jsx("div", {
        "data-img-path": path,
        "data-node-path": path,
        ...(value7
          ? {
              role: "img",
              "aria-label": node.alt || "Empty image",
            }
          : {
              "aria-hidden": true,
            }),
        ...value4,
        style: {
          ...value2,
          ...(value7
            ? {
                minWidth: 120,
                minHeight: 80,
              }
            : {}),
          ...(value10
            ? {
                backgroundImage: transparencyCheckerboardGradient,
                backgroundSize: "32px 32px",
              }
            : {}),
          ...value3,
        },
      });
    }
    if (!value || value5 === value) {
      return SlideRendererJsx.jsx("div", {
        "data-img-path": path,
        "data-node-path": path,
        ...value4,
        style: {
          ...value2,
          minWidth: 120,
          minHeight: 80,
          background: "rgba(115,114,108,0.18)",
          border: "2px dashed rgba(115,114,108,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#73726C",
          fontSize: 24,
          fontFamily: "system-ui, sans-serif",
          ...value3,
        },
        children:
          node.alt ||
          (value
            ? "image unavailable here"
            : node.asset !== undefined
              ? "missing asset: " + node.asset
              : "image"),
      });
    }
    if (
      node.crop !== undefined &&
      (0, runtime.shouldPreserveMediaAspect)(node, hostSized, inStack) &&
      !value.startsWith("data:image/svg+xml")
    ) {
      return SlideRendererJsx.jsx("div", {
        "data-img-path": path,
        "data-node-path": path,
        ...value4,
        ...value9,
        style: {
          ...value2,
          ...value3,
          position: "relative",
          overflow: "hidden",
        },
        children: SlideRendererJsx.jsx("img", {
          src: value,
          alt: node.alt,
          draggable: false,
          onError: (): void => value6(value),
          style: (0, runtime.imageCropCss)(node.crop),
        }),
      });
    }
    return SlideRendererJsx.jsx("img", {
      "data-img-path": path,
      "data-node-path": path,
      ...value4,
      ...value9,
      src: value,
      alt: node.alt,
      draggable: false,
      onError: (): void => value6(value),
      style: {
        ...value2,
        objectFit: node.fit,
        ...value3,
      },
    });
  }
  function createClipCapacity(): ClipCapacity {
    let index = 0,
      values = new Set<() => void>();
    return {
      take: (): boolean => index < liveClipCapacity && ++index > 0,
      give: (): void => {
        index = Math.max(0, index - 1);
        for (let value of [...values]) value();
      },
      onFree: (input: () => void): (() => void) => {
        values.add(input);
        return (): void => void values.delete(input);
      },
    };
  }
  function ClipPlaybackProvider({
    clips = "selected",
    slideId: slideId,
    children: children,
  }: ClipPlaybackProviderProps): ReactElement {
    let [value] = SlideRendererReact.useState(createClipCapacity),
      [value2, value3] = SlideRendererReact.useState<
        ActiveClipRecord | undefined
      >(undefined);
    if (value2 !== undefined && value2.slideId !== slideId) {
      value3(undefined);
    }
    let callback = SlideRendererReact.useCallback(
        (input: string | undefined): void =>
          value3(
            input === undefined
              ? undefined
              : {
                  at: input,
                  slideId: slideId,
                },
          ),
        [slideId],
      ),
      memo = SlideRendererReact.useMemo(
        (): ActiveLinkedClip => ({
          at: value2?.at,
          set: callback,
        }),
        [value2, callback],
      );
    return SlideRendererJsx.jsx(clipPlaybackModeContext.Provider, {
      value: clips,
      children: SlideRendererJsx.jsx(clipSlideIdContext.Provider, {
        value: slideId,
        children: SlideRendererJsx.jsx(clipCapacityContext.Provider, {
          value: value,
          children: SlideRendererJsx.jsx(activeLinkedClipContext.Provider, {
            value: memo,
            children: children,
          }),
        }),
      }),
    });
  }
  function LinkedVideoNode({
    node: node,
    link: link,
    src: src,
    path: path,
    marker: marker,
    style: style,
    selected: selected,
    boxed: boxed,
  }: LinkedVideoNodeProps): ReactElement {
    let value = SlideRendererReact.useContext(clipPlaybackModeContext),
      { at: value2, set: value3 } = SlideRendererReact.useContext(
        activeLinkedClipContext,
      ),
      { onLinkOpen: value4 } = SlideRendererReact.useContext(slideLinkContext),
      value5 = SlideRendererReact.useId(),
      value6 = value === "all" || (value === "selected" && selected),
      value7 = value2 === value5 && value6;
    SlideRendererReact.useEffect((): void => {
      if (value2 === value5 && !value6) {
        value3(undefined);
      }
    }, [value2, value5, value6, value3]);
    let value8 = (0, runtime.useVideoProviderBlocked)(link.provider),
      ref = SlideRendererReact.useRef<HTMLElement | null>(null),
      ref2 = SlideRendererReact.useRef({
        live: value7,
        refused: value8,
      });
    ref2.current = {
      live: value7,
      refused: value8,
    };
    let ref3 = SlideRendererReact.useRef(new Set<VideoControllerListener>()),
      callback = (): VideoControllerState => ({
        paused: !ref2.current.live,
        currentTime: 0,
        duration: 0,
        ready: true,
        seekable: false,
        failed: ref2.current.refused,
      });
    SlideRendererReact.useLayoutEffect((): void => {
      for (let value13 of [...ref3.current]) value13(callback());
    }, [value7, value8]);
    SlideRendererReact.useLayoutEffect((): (() => void) | undefined => {
      let current = ref.current;
      if (
        value !== "selected" ||
        !selected ||
        current === null ||
        current.closest("[data-slides-editor]") === null
      ) {
        return;
      }
      let value13 = current
        .closest("[data-frame-id]")
        ?.getAttribute("data-frame-id");
      if (value13 == null) {
        return;
      }
      let state: VideoController = {
        toggle: (): void => value3(ref2.current.live ? undefined : value5),
        play: (): void => value3(value5),
        pause: (): void => value3(undefined),
        seek: (): void => {},
        subscribe: (input: VideoControllerListener): (() => void) => {
          ref3.current.add(input);
          input(callback());
          return (): void => void ref3.current.delete(input);
        },
        detach: (): void => {},
      };
      return (0, runtime.registerClipController)(
        (0, runtime.clipRegistryKey)(value13, path),
        state,
      );
    }, [value, selected, path, value5, value3]);
    let [value9, value10] = SlideRendererReact.useState<string | undefined>(
        undefined,
      ),
      value11 = src !== undefined && src !== value9 ? src : undefined,
      value12 =
        node.crop !== undefined && boxed
          ? (0, runtime.imageCropCss)(node.crop)
          : undefined;
    return SlideRendererJsx.jsx(runtime.VideoLinkPlayer, {
      boxRef: ref,
      link: link,
      poster: value11,
      posterStyle: value12 ?? {
        display: "block",
        width: "100%",
        height: "100%",
        minHeight: "inherit",
        maxHeight: "inherit",
        objectFit: node.fit,
      },
      onPosterError: (): void => value10(value11),
      label: node.alt,
      live: value7,
      onLive: (input: boolean): void => value3(input ? value5 : undefined),
      pressable: value === "all",
      keepKeys: (): boolean =>
        value === "all" &&
        document.querySelector(
          "iframe[" + htmlEmbedMarkerAttribute + "]",
        ) === null,
      trapped: value === "all",
      onOpenLink: value4,
      scale: "var(--slide-scale, 1)",
      style: style,
      marks: {
        "data-img-path": path,
        "data-node-path": path,
        ...marker,
      },
    });
  }
  function prefersReducedMotion(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }
  function StoredVideoNode({
    node: node,
    clip: clip,
    src: src,
    path: path,
    marker: marker,
    style: style,
    selected: selected,
    boxed: boxed,
  }: StoredVideoNodeProps): ReactElement {
    let value = SlideRendererReact.useContext(clipPlaybackModeContext),
      [value2, value3] = SlideRendererReact.useState(false),
      value4 =
        SlideRendererReact.useContext(clipSlideIdContext) +
        `
` +
        clip;
    SlideRendererReact.useLayoutEffect((): void => value3(false), [value4]);
    let value5 = node.videoStart !== "click" && !prefersReducedMotion(),
      value6 = useVideoDelay(
        value === "all" && value5 && !value2 ? (node.videoDelay ?? 0) : 0,
        value4,
      ),
      value7 =
        value === "all"
          ? value2 || (value5 && !value6)
          : value === "selected" && selected,
      [value8, value9] = SlideRendererReact.useState<
        VideoController | undefined
      >(undefined),
      value10 = (0, runtime.useClipPaused)(value8),
      value11 = value8 !== undefined,
      [value12, value13] = SlideRendererReact.useState(false),
      ref = SlideRendererReact.useRef(false);
    if (!value11) {
      ref.current = false;
    } else if (value10 === false) {
      ref.current = true;
    }
    if (!value11 && value12) {
      value13(false);
    }
    let value14 = value11 && (value12 || ref.current) && value10 === true,
      [value15, value16] = SlideRendererReact.useState<string | undefined>(
        undefined,
      ),
      value17 = src !== undefined && src !== value15 ? src : undefined,
      value18 =
        node.crop !== undefined && boxed
          ? (0, runtime.imageCropCss)(node.crop)
          : undefined,
      value19: CSSProperties = value18 ?? {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: node.fit,
      },
      value20 = node.alt || "video",
      callback = (): void =>
        value8 !== undefined ? value8.toggle() : value3(true),
      [value21, value22] = SlideRendererReact.useState<ClipHeldState>(
        undefined,
      );
    if (!value7 && value21 !== undefined) {
      value22(undefined);
    }
    let value23 =
        value7 &&
        !value11 &&
        (value21 === "failed" || (value21 === "waiting" && !value2)),
      ref2 = SlideRendererReact.useRef<HTMLDivElement | null>(null);
    SlideRendererReact.useLayoutEffect((): (() => void) | undefined => {
      let current = ref2.current;
      if (
        value21 !== "failed" ||
        value !== "selected" ||
        current === null ||
        current.closest("[data-slides-editor]") === null
      ) {
        return;
      }
      let value27 = current
        .closest("[data-frame-id]")
        ?.getAttribute("data-frame-id");
      if (value27 != null) {
        return (0, runtime.registerLiveClip)(
          (0, runtime.clipRegistryKey)(value27, path),
        );
      } else {
        return undefined;
      }
    }, [value21, value, path]);
    let value24 = value === "all" && !value23,
      value25 = value24
        ? {
            role: "button",
            tabIndex: 0,
            "aria-label":
              (value11 && !value14
                ? runtime.playbackActionLabels.pause
                : runtime.playbackActionLabels.play) +
              " " +
              value20,
            onClick: (input: ReactMouseEvent): void => {
              input.stopPropagation();
              callback();
            },
            onKeyDown: (event: ReactKeyboardEvent): void => {
              if (event.key !== "Enter" || event.repeat) {
                return;
              }
              event.preventDefault();
              callback();
            },
          }
        : value17 === undefined
          ? {
              role: "img",
              "aria-label": node.alt || "Video",
            }
          : null,
      value26 =
        value21 !== "failed" &&
        (value === "selected"
          ? !value11 || value14
          : value24 && (!value11 || value14));
    return SlideRendererJsx.jsxs("div", {
      ref: ref2,
      "data-img-path": path,
      "data-node-path": path,
      ...marker,
      ...value25,
      style: {
        ...style,
        position: "relative",
        overflow: "hidden",
        ...(value24
          ? {
              cursor: "pointer",
              outlineOffset: -4,
            }
          : null),
        ...(value17 === undefined
          ? {
              minWidth: 120,
              minHeight: 80,
              backgroundColor: "#141413",
            }
          : null),
      },
      children: [
        value17 !== undefined
          ? SlideRendererJsx.jsx("img", {
              src: value17,
              alt: value24 ? "" : node.alt,
              "aria-hidden": value11 || undefined,
              draggable: false,
              onError: (): void => value16(value17),
              style: value18 ?? {
                display: "block",
                width: "100%",
                height: "100%",
                minHeight: "inherit",
                maxHeight: "inherit",
                objectFit: node.fit,
              },
            })
          : null,
        value7
          ? SlideRendererJsx.jsx(
              VideoWithCapacity,
              {
                clip: clip,
                sound: node.videoSound === "on",
                label: node.alt,
                style: value19,
                path: path,
                onController: value9,
                onHeld: value22,
                onKnown: (): void => value13(true),
              },
              clip,
            )
          : null,
        value26
          ? SlideRendererJsx.jsx(runtime.ClipBadge, {
              scale: "var(--slide-scale, 1)",
            })
          : null,
      ],
    });
  }
  function useVideoDelay(delay: number, key: string): boolean {
    let [value, value2] = SlideRendererReact.useState<string | undefined>(
      undefined,
    );
    SlideRendererReact.useEffect((): (() => void) | undefined => {
      if (!(delay > 0)) {
        return;
      }
      let value3 = setTimeout((): void => value2(key), delay * 1000);
      return (): void => clearTimeout(value3);
    }, [delay, key]);
    return delay > 0 && value !== key;
  }
  function VideoWithCapacity({
    clip: clip,
    sound: sound,
    label: label,
    style: style,
    path: path,
    onController: onController,
    onHeld: onHeld,
    onKnown: onKnown,
  }: VideoWithCapacityProps): ReactElement | null {
    let value = SlideRendererReact.useContext(clipCapacityContext),
      ref = SlideRendererReact.useRef(onHeld);
    ref.current = onHeld;
    let [value2, value3] = SlideRendererReact.useState(false),
      [value4, value5] = SlideRendererReact.useState(false);
    SlideRendererReact.useLayoutEffect((): (() => void) | undefined => {
      if (value4) {
        return void ref.current("failed");
      }
      let flag = false,
        callback = (): void => {
          if (flag || !value.take()) {
            return;
          }
          flag = true;
          value3(true);
          ref.current(undefined);
        };
      callback();
      if (!flag) {
        ref.current("waiting");
      }
      let value6 = value.onFree(callback);
      return (): void => {
        value6();
        value3(false);
        if (flag) {
          value.give();
        }
      };
    }, [value, value4]);
    if (value2 && !value4) {
      return SlideRendererJsx.jsx(VideoElement, {
        clip: clip,
        sound: sound,
        label: label,
        style: style,
        path: path,
        onController: onController,
        onKnown: onKnown,
        onError: (): void => value5(true),
      });
    } else {
      return null;
    }
  }
  function VideoElement({
    clip: clip,
    sound: sound,
    label: label,
    style: style,
    path: path,
    onController: onController,
    onKnown: onKnown,
    onError: onError,
  }: VideoElementProps): ReactElement {
    let ref = SlideRendererReact.useRef<HTMLVideoElement>(null),
      [value, value2] = SlideRendererReact.useState<
        VideoController | undefined
      >(undefined),
      ref2 = SlideRendererReact.useRef(onController);
    ref2.current = onController;
    let ref3 = SlideRendererReact.useRef(onKnown);
    ref3.current = onKnown;
    SlideRendererReact.useLayoutEffect((): (() => void) | undefined => {
      let current = ref.current;
      if (current === null) {
        return;
      }
      let value3 = (0, runtime.createVideoController)(current);
      value2(value3);
      ref2.current(value3);
      let flag = true,
        value4: Promise<void> | undefined;
      try {
        value4 = current.play();
      } catch {
        value4 = undefined;
      }
      Promise.resolve(value4)
        .catch((): void => {
          return;
        })
        .then(() => flag && ref3.current());
      return (): void => {
        flag = false;
        ref2.current(undefined);
        value3.detach();
        current.pause();
        current.removeAttribute("src");
        current.load();
      };
    }, []);
    SlideRendererReact.useLayoutEffect((): (() => void) | undefined => {
      let current = ref.current;
      if (
        current === null ||
        value === undefined ||
        current.closest("[data-slides-editor]") === null
      ) {
        return;
      }
      let value3 = current
        .closest("[data-frame-id]")
        ?.getAttribute("data-frame-id");
      if (value3 != null) {
        return (0, runtime.registerClipController)(
          (0, runtime.clipRegistryKey)(value3, path),
          value,
        );
      } else {
        return undefined;
      }
    }, [path, value]);
    return SlideRendererJsx.jsx("video", {
      ref: ref,
      ...runtime.videoPlaybackDefaults,
      muted: !sound,
      src: clip,
      "aria-label": label || "Video",
      disablePictureInPicture: true,
      onError: onError,
      style: style,
    });
  }
  function hexColorRgba(color: string, alpha: number): string {
    let value = parseInt(color.slice(1, 3), 16),
      value2 = parseInt(color.slice(3, 5), 16),
      value3 = parseInt(color.slice(5, 7), 16);
    return (
      "rgba(" +
      String(value) +
      "," +
      String(value2) +
      "," +
      String(value3) +
      "," +
      String(alpha) +
      ")"
    );
  }
  function TextNode({
    node: node,
    slideBg: slideBg,
    path: path,
    editing: editing,
    inStack = false,
    parentAlign: parentAlign,
    parentJustify: parentJustify,
    parentDir: parentDir,
    fitBox: fitBox,
  }: TableNodeProps): ReactElement {
    let ref = SlideRendererReact.useRef<HTMLDivElement>(null),
      value = node.fit ?? runtime.defaultTextFit,
      value2 = (0, runtime.renderingTypeScaleForRole)(node.role ?? "body"),
      value3 = (0, runtime.slideTextColor)(slideBg),
      value4 = "2px solid " + hexColorRgba(value3, 0.22),
      state: CssVariableStyle = {
        display: "grid",
        gridTemplateColumns:
          node.colWidths !== undefined
            ? node.colWidths
                .map((input: number): string => String(input) + "fr")
                .join(" ")
            : "repeat(" + String(node.cols) + ", 1fr)",
        width: "100%",
        boxSizing: "border-box",
        ...(inStack
          ? nodePlacementCss(node, parentAlign, parentJustify)
          : null),
        fontFamily: value2.fontFamily,
        fontSize: value2.fontSize,
        fontWeight: value2.fontWeight,
        lineHeight: value2.lineHeight,
        color: value3,
        ...nodeInlineStyleCss(node.style, "slides-table"),
      };
    if (value2.serifDisplay) {
      state.fontVariationSettings = "'opsz' 48";
    }
    let value5 = positiveFontSizePx(state.fontSize);
    if (value === "shrink") {
      applyTextFitCssVariable(state);
    } else if (
      value === "grow" &&
      inStack &&
      parentDir === "v" &&
      node.place?.shrink === undefined
    ) {
      state.flexShrink = 0;
    }
    useTextFit(ref, {
      node: node,
      fit: value,
      base: value5,
      box: fitBox,
      pinBasis: shouldPinShrinkBasis(node, fitBox, parentDir),
    });
    if (node.rows.length > 0) {
      state.borderTop = value4;
      state.borderLeft = value4;
    }
    return SlideRendererJsx.jsx("div", {
      ref: ref,
      "data-node-path": path,
      style: state,
      children: node.rows.map(
        (input: string[], options: number): ReactElement[] =>
          input.map((input2: string, options2: number): ReactElement => {
            let value6 = String(options) + "." + String(options2),
              value7 = node.colAligns?.[options2],
              value8 = node.cellStyles?.[value6]?.color,
              value9 = node.rowStyles?.[String(options)]?.background,
              state2: CSSProperties = {
                borderRight: value4,
                borderBottom: value4,
                padding: `${node.cellPadding?.y !== undefined ? String(node.cellPadding.y) + "px" : "0.35em"} ${node.cellPadding?.x !== undefined ? String(node.cellPadding.x) + "px" : "0.6em"}`,
                whiteSpace: "pre-wrap",
                overflowWrap: "break-word",
                minWidth: 0,
                boxSizing: "content-box",
                minHeight: "1lh",
                overflowY: "clip",
                ...(value7 === "center"
                  ? {
                      textAlign: "center",
                    }
                  : value7 === "end"
                    ? {
                        textAlign: "right",
                      }
                    : undefined),
                ...(value8 !== undefined
                  ? {
                      color: (0, runtime.resolveSlideColor)(value8),
                    }
                  : undefined),
                ...(node.header && options === 0
                  ? {
                      fontWeight: node.headerWeight ?? 600,
                      background: hexColorRgba(value3, 0.08),
                    }
                  : undefined),
                ...(value9 !== undefined
                  ? {
                      background: (0, runtime.resolveSlideColor)(value9),
                    }
                  : undefined),
              };
            if (
              editing != null &&
              editing.cell !== undefined &&
              editing.cell.r === options &&
              editing.cell.c === options2
            ) {
              return SlideRendererJsx.jsx(
                EditableTableCell,
                {
                  cellKey: value6,
                  name: (0, runtime.accessibleTableCellLabel)({
                    r: options,
                    c: options2,
                  }),
                  style: state2,
                  session: editing,
                },
                value6,
              );
            }
            return SlideRendererJsx.jsx(
              "div",
              {
                "data-cell": value6,
                style: state2,
                children: input2,
              },
              value6,
            );
          }),
      ),
    });
  }
  function useRichTextFormatInput(
    ref: RefObject<HTMLElement | null>,
    onStyle?: (format: RichTextFormatName) => void,
  ): void {
    let ref2 = SlideRendererReact.useRef(onStyle);
    ref2.current = onStyle;
    SlideRendererReact.useEffect((): (() => void) | undefined => {
      let current = ref.current;
      if (current === null) {
        return;
      }
      let callback = (event: InputEvent): void => {
        if (
          (0, runtime.isExecutingRichTextCommand)() ||
          typeof event.inputType !== "string" ||
          !event.inputType.startsWith("format")
        ) {
          return;
        }
        event.preventDefault();
        let value: RichTextFormatName | null =
          event.inputType === "formatBold"
            ? "bold"
            : event.inputType === "formatItalic"
              ? "italic"
              : event.inputType === "formatUnderline"
                ? "underline"
                : null;
        if (value !== null && ref2.current !== undefined) {
          setTimeout((): void => ref2.current?.(value), 0);
        }
      };
      current.addEventListener("beforeinput", callback);
      return (): void => current.removeEventListener("beforeinput", callback);
    }, [ref]);
  }
  function useEditableTextFocus(
    caret?: "end",
    reselect?: true,
  ): RefObject<HTMLDivElement | null> {
    let ref = SlideRendererReact.useRef<HTMLDivElement>(null);
    SlideRendererReact.useLayoutEffect((): (() => void) | undefined => {
      let current = ref.current;
      if (!current) {
        return;
      }
      current.focus({
        preventScroll: true,
      });
      let value = window.getSelection();
      if (value) {
        let value3 = document.createRange();
        if (caret === "end") {
          let value4: Node = current;
          while (value4.lastChild !== null) value4 = value4.lastChild;
          let value5 =
            (value4.nodeType === Node.ELEMENT_NODE
              ? (value4 as Element)
              : value4.parentElement
            )?.closest("a") ?? null;
          if (value5 !== null && current.contains(value5)) {
            value3.setStartAfter(value5);
          } else if (value4.nodeType === Node.TEXT_NODE) {
            value3.setStart(value4, (value4 as Text).length);
          } else if (value4.nodeName === "BR") {
            value3.setStartBefore(value4);
          } else {
            value3.setStart(value4, 0);
          }
          value3.collapse(true);
        } else {
          value3.selectNodeContents(current);
        }
        value.removeAllRanges();
        value.addRange(value3);
      }
      if (reselect !== true || caret === "end") {
        return;
      }
      let ownerDocument = current.ownerDocument,
        callback = (): void => {
          ownerDocument.removeEventListener("selectionchange", callback2);
          current.removeEventListener("beforeinput", callback);
          clearTimeout(value2);
        },
        callback2 = (): void => {
          let value3 = ownerDocument.getSelection();
          if (
            value3 === null ||
            !value3.isCollapsed ||
            !current.contains(value3.anchorNode)
          ) {
            return;
          }
          callback();
          value3.selectAllChildren(current);
        },
        value2 = setTimeout(callback, linkDoublePressTimeoutMs);
      ownerDocument.addEventListener("selectionchange", callback2);
      current.addEventListener("beforeinput", callback);
      return callback;
    }, []);
    return ref;
  }
  function linkUrlFromTitle(element: Element): string {
    let value =
      /(?:^|\s)(https?:\/\/\S+)$/i.exec(
        element.getAttribute("title") ?? "",
      )?.[1] ?? "";
    if ((0, runtime.isSafeHyperlink)(value)) {
      return value;
    } else {
      return "";
    }
  }
  function useEditableLinkPress(ref: RefObject<HTMLElement | null>): void {
    SlideRendererReact.useEffect((): (() => void) | undefined => {
      let current = ref.current;
      if (!current) {
        return;
      }
      let flag = false,
        callback = (input: PointerEvent): void => {
          flag = input.pointerType === "touch";
        },
        callback2 = (input: MouseEvent): void => {
          if (
            input.button !== 0 ||
            input.detail !== 1 ||
            input.shiftKey ||
            (input.ctrlKey && (0, runtime.isApplePlatform)()) ||
            flag
          ) {
            return;
          }
          let ownerDocument = current.ownerDocument,
            value = ownerDocument.getSelection();
          if (value === null || value.isCollapsed || value.rangeCount === 0) {
            return;
          }
          let value2 = ownerDocument.createRange();
          value2.selectNodeContents(current);
          if (
            value.getRangeAt(0).toString().trim() !== value2.toString().trim()
          ) {
            return;
          }
          let value3 =
              typeof ownerDocument.caretRangeFromPoint === "function"
                ? ownerDocument.caretRangeFromPoint(
                    input.clientX,
                    input.clientY,
                  )
                : null,
            value4 =
              value3 === null &&
              typeof ownerDocument.caretPositionFromPoint === "function"
                ? ownerDocument.caretPositionFromPoint(
                    input.clientX,
                    input.clientY,
                  )
                : null,
            value5 =
              value3 !== null
                ? value3.startContainer
                : value4 !== null
                  ? value4.offsetNode
                  : null;
          if (value5 !== null && current.contains(value5)) {
            value.collapse(
              value5,
              value3 !== null ? value3.startOffset : value4!.offset,
            );
          }
        };
      current.addEventListener("pointerdown", callback, true);
      current.addEventListener("mousedown", callback2, true);
      return (): void => {
        current.removeEventListener("pointerdown", callback, true);
        current.removeEventListener("mousedown", callback2, true);
      };
    }, [ref]);
  }
  function RichTextRuns({
    runs: runs,
    editing: editing,
  }: RichTextRunsProps): ReactElement {
    let {
        links: value,
        onLinkOpen: value2,
        plainPress: value3,
      } = SlideRendererReact.useContext(slideLinkContext),
      value4 = SlideRendererReact.useContext(richTextEditingContext),
      ref = SlideRendererReact.useRef<PointerPosition | null>(null),
      ref2 = SlideRendererReact.useRef<{
        timer: ReturnType<typeof setTimeout>;
        doc: Document;
      } | null>(null),
      callback: () => void = SlideRendererReact.useCallback((): void => {
        let current = ref2.current;
        if (current === null) {
          return;
        }
        ref2.current = null;
        clearTimeout(current.timer);
        current.doc.removeEventListener("pointerdown", callback, true);
      }, []);
    SlideRendererReact.useEffect((): (() => void) => callback, [callback]);
    return SlideRendererJsx.jsx(SlideRendererJsx.Fragment, {
      children: runs.map((input: TextRun, options: number): ReactElement => {
        let text: ReactNode = input.text;
        if (input.bold) {
          text = SlideRendererJsx.jsx("b", {
            children: text,
          });
        }
        if (input.italic) {
          text = SlideRendererJsx.jsx("i", {
            children: text,
          });
        }
        if (input.underline) {
          text = SlideRendererJsx.jsx("u", {
            children: text,
          });
        }
        if (input.color !== undefined) {
          text = SlideRendererReact.createElement(
            "font",
            {
              color: input.color,
              style: {
                color: (0, runtime.resolveSlideColor)(input.color) ?? undefined,
                WebkitTextFillColor: "currentcolor",
              },
            },
            text,
          );
        }
        if (input.href !== undefined) {
          let value5 =
              editing || value !== undefined
                ? classifyRenderedLink(input.href)
                : null,
            value6 = value5 !== null && !editing,
            value7 = !editing && (value === "view" || value === "edit"),
            value8 = SlideRendererJsx.jsx("a", {
              title: value7
                ? undefined
                : (value5 !== null && editing ? linkModifierPressHint() : "") +
                  input.href,
              "aria-description": value7 ? input.href : undefined,
              "data-drag-surface":
                !editing && value === "edit" ? "" : undefined,
              style: {
                textDecoration: "underline",
                cursor: editing ? "text" : value6 ? "pointer" : undefined,
              },
              onPointerDown:
                value5 === null || editing
                  ? undefined
                  : (
                      input2: ReactPointerEvent<HTMLAnchorElement>,
                    ): PointerPosition | null =>
                      (ref.current = pointerPositionForMouse(input2)),
              onClick:
                value5 === null || editing
                  ? undefined
                  : (input2: ReactMouseEvent<HTMLAnchorElement>): void => {
                      if (value !== "edit") {
                        input2.stopPropagation();
                      }
                      let current = ref.current;
                      ref.current = null;
                      callback();
                      if (
                        input2.button !== 0 ||
                        input2.detail > 1 ||
                        pointerClickMoved(current, input2)
                      ) {
                        return;
                      }
                      if (value === "edit") {
                        if (
                          input2.metaKey ||
                          input2.ctrlKey ||
                          input2.shiftKey ||
                          input2.altKey ||
                          (input2.detail !== 0 && value3?.() === false)
                        ) {
                          return;
                        }
                        let ownerDocument = input2.currentTarget.ownerDocument,
                          value9 = setTimeout((): void => {
                            callback();
                            (0, runtime.openExternalLink)(
                              value5,
                              renderedLinkOptions,
                            );
                          }, richTextDoubleTapWindowMs);
                        ref2.current = {
                          timer: value9,
                          doc: ownerDocument,
                        };
                        ownerDocument.addEventListener(
                          "pointerdown",
                          callback,
                          true,
                        );
                        return;
                      }
                      if (input2.ctrlKey && (0, runtime.isApplePlatform)()) {
                        return;
                      }
                      value2?.();
                      (0, runtime.openExternalLink)(
                        value5,
                        renderedLinkOptions,
                      );
                    },
              children: text,
            });
          text = value7
            ? SlideRendererJsx.jsx(runtime.Tooltip, {
                content: SlideRendererJsx.jsx("span", {
                  style: mediaPlaceholderLabelCss,
                  children: input.href,
                }),
                detail:
                  value === "edit" && value5 !== null && !value4
                    ? linkModifierKeyLabel() + "-click to select the text box"
                    : undefined,
                side: "bottom",
                delay: 0,
                hoverable: false,
                lazy: true,
                children: value8,
              })
            : value8;
        }
        return SlideRendererJsx.jsx(
          SlideRendererJsx.Fragment,
          {
            children: text,
          },
          options,
        );
      }),
    });
  }
  function RichTextContent({ node: node }: RichTextContentProps): ReactElement {
    let value = SlideRendererReact.useContext(listRenderingContext) === "css";
    if (node.marks === undefined && node.list === undefined) {
      return SlideRendererJsx.jsx(SlideRendererJsx.Fragment, {
        children: node.text,
      });
    }
    let value2 = (0, runtime.textLinesAsRuns)(node);
    if (node.list !== undefined) {
      let value3: "ul" | "ol" = node.list === "bullet" ? "ul" : "ol";
      return SlideRendererJsx.jsx(value3, {
        ...(value
          ? {
              "data-css-list": "",
            }
          : null),
        style: {
          margin: 0,
          listStyleType: node.list === "bullet" ? "disc" : "decimal",
          paddingInlineStart: value ? 0 : "1.2em",
        },
        children: value2.map(
          (items: TextRun[], options: number): ReactElement =>
            SlideRendererJsx.jsx(
              "li",
              {
                children:
                  items.length === 0
                    ? SlideRendererJsx.jsx("br", {})
                    : SlideRendererJsx.jsx(RichTextRuns, {
                        runs: items,
                      }),
              },
              options,
            ),
        ),
      });
    }
    return SlideRendererJsx.jsx(SlideRendererJsx.Fragment, {
      children: value2.map(
        (input: TextRun[], options: number): ReactElement =>
          SlideRendererJsx.jsxs(
            SlideRendererReact.Fragment,
            {
              children: [
                options > 0
                  ? `
`
                  : null,
                SlideRendererJsx.jsx(RichTextRuns, {
                  runs: input,
                }),
              ],
            },
            options,
          ),
      ),
    });
  }
  function renderedTextCss(
    node: TextNodeData,
    background: string | undefined,
    inStack: boolean,
    parentDirection: StackDirection | undefined,
    fitBox: TextFitBox | undefined,
    listMode: ListRenderingMode | undefined,
  ): CSSProperties {
    let value = node.fit ?? runtime.defaultTextFit,
      value2 = (0, runtime.textListGutter)(node, listMode),
      value3 = (0, runtime.applyTextFillCss)(
        {
          ...(0, runtime.textNodeBaseCss)(node, background),
          ...(inStack ? nodePlacementCss(node) : null),
          ...nodeInlineStyleCss(node.style, "slides-text"),
          ...(value2 !== undefined
            ? {
                paddingLeft: value2,
              }
            : null),
        },
        node.fill,
      );
    if (value === "shrink") {
      applyTextFitCssVariable(value3);
      value3.overflowY = ("var(" +
        textFitClipVariable +
        ", visible)") as CSSProperties["overflowY"];
      if (fitBox === "parent") {
        value3.maxHeight = "100%";
      }
    } else if (
      value === "grow" &&
      inStack &&
      parentDirection === "v" &&
      node.place?.shrink === undefined
    ) {
      value3.flexShrink = 0;
    }
    return value3;
  }
  function ReadOnlyTextNode({
    node: node,
    slideBg: slideBg,
    path: path,
    inStack: inStack,
    parentDir: parentDir,
    animate: animate,
    fitBox: fitBox,
  }: ReadOnlyTextNodeProps): ReactElement {
    let ref = SlideRendererReact.useRef<HTMLDivElement>(null),
      value = renderedTextCss(
        node,
        slideBg,
        inStack,
        parentDir,
        fitBox,
        SlideRendererReact.useContext(listRenderingContext),
      );
    useTextFit(ref, {
      node: node,
      fit: node.fit ?? runtime.defaultTextFit,
      base: positiveFontSizePx(
        (
          {
            ...(0, runtime.textNodeBaseCss)(node, slideBg),
            ...nodeInlineStyleCss(node.style, "slides-text"),
          }
        ).fontSize,
      ),
      box: fitBox,
      pinBasis: shouldPinShrinkBasis(node, fitBox, parentDir),
    });
    let value2 = SlideRendererReact.useContext(
      slideStructureEnabledContext,
    )
      ? headingLevelForTextNode(node)
      : undefined;
    return SlideRendererJsx.jsx("div", {
      ref: ref,
      "data-text-path": path,
      "data-node-path": path,
      ...dynamicStyleAttributes(node.style, animate),
      role: value2 !== undefined ? "heading" : undefined,
      "aria-level": value2,
      style: value,
      children: SlideRendererJsx.jsx(RichTextContent, {
        node: node,
      }),
    });
  }
  function useImeGuard(): ImeGuard {
    let ref = SlideRendererReact.useRef(Number.NEGATIVE_INFINITY);
    return {
      onCompositionEnd: (): void => {
        ref.current = performance.now();
      },
      fromIme: (event: ImeGuardEvent): boolean =>
        event.nativeEvent.isComposing ||
        event.keyCode === 229 ||
        (event.key === "Escape" &&
          performance.now() - ref.current < editableFocusTimeoutMs),
    };
  }
  function EditableTextNode({
    node: node,
    slideBg: slideBg,
    path: path,
    session: session,
    inStack = false,
    parentDir: parentDir,
    fitBox: fitBox,
  }: EditableTextNodeProps): ReactElement {
    let value = useEditableTextFocus(session.caret, session.reselect);
    useEditableLinkPress(value);
    let ref = SlideRendererReact.useRef<PointerPosition | null>(null);
    useTextFit(value, {
      node: node,
      fit: node.fit ?? runtime.defaultTextFit,
      base: positiveFontSizePx(
        (
          {
            ...(0, runtime.textNodeBaseCss)(node, slideBg),
            ...nodeInlineStyleCss(node.style, "slides-text"),
          }
        ).fontSize,
      ),
      box: fitBox,
      pinBasis: shouldPinShrinkBasis(node, fitBox, parentDir),
    });
    let value2 = session.onRichInput !== undefined,
      value3 = useImeGuard(),
      value4 = SlideRendererReact.useContext(listRenderingContext) === "css",
      value5 = renderedTextCss(
        node,
        slideBg,
        inStack,
        parentDir,
        fitBox,
        value4 ? "css" : undefined,
      ),
      callback = (input: HTMLElement): void => {
        let value7 = (0, runtime.readEditableRichText)(input);
        session.onRichInput?.({
          text: value7.text,
          marks: value7.marks,
          list: value7.list,
        });
      },
      callback2 = (input: HTMLElement): void => {
        (0, runtime.clearRichTextUndoState)(input);
        let value7 = (0, runtime.readEditableRichText)(input);
        session.onRichCommit?.({
          text: value7.text,
          marks: value7.marks,
          list: value7.list,
        });
      };
    useRichTextFormatInput(value, value2 ? session.onFormat : undefined);
    let [value6] = SlideRendererReact.useState((): ReactNode => {
      if (!value2) {
        return null;
      }
      let value7 = (0, runtime.textLinesAsRuns)({
        text: session.initialText,
        marks: node.marks,
      });
      if (node.list !== undefined) {
        let value8: "ul" | "ol" = node.list === "bullet" ? "ul" : "ol";
        return SlideRendererJsx.jsx(value8, {
          style: {
            margin: 0,
            listStyleType: node.list === "bullet" ? "disc" : "decimal",
            paddingInlineStart: value4 ? 0 : "1.2em",
          },
          children: value7.map(
            (items: TextRun[], options: number): ReactElement =>
              SlideRendererJsx.jsx(
                "li",
                {
                  children:
                    items.length === 0
                      ? SlideRendererJsx.jsx("br", {})
                      : SlideRendererJsx.jsx(RichTextRuns, {
                          runs: items,
                          editing: true,
                        }),
                },
                options,
              ),
          ),
        });
      }
      return value7.map(
        (items: TextRun[], options: number): ReactElement =>
          SlideRendererJsx.jsx(
            "div",
            {
              children:
                items.length === 0
                  ? SlideRendererJsx.jsx("br", {})
                  : SlideRendererJsx.jsx(RichTextRuns, {
                      runs: items,
                      editing: true,
                    }),
            },
            options,
          ),
      );
    });
    return SlideRendererJsx.jsxs(SlideRendererJsx.Fragment, {
      children: [
        value2
          ? SlideRendererJsx.jsx("style", {
              children:
                "[data-text-path][contenteditable] ul{list-style-type:disc;margin:0;padding-inline-start:" +
                (value4 ? "0" : "1.2em") +
                "}[data-text-path][contenteditable] ol{list-style-type:decimal;margin:0;padding-inline-start:" +
                (value4 ? "0" : "1.2em") +
                "}[data-text-path][contenteditable] font[color]{-webkit-text-fill-color:currentcolor}" +
                (node.fill !== undefined
                  ? "[data-text-path][contenteditable]::selection,[data-text-path][contenteditable] ::selection{color:HighlightText;-webkit-text-fill-color:HighlightText;background-color:Highlight}"
                  : ""),
            })
          : null,
        SlideRendererJsx.jsx("div", {
          ref: value,
          "data-text-path": path,
          "data-node-path": path,
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": (0, runtime.accessibleNodeTypeLabel)(node),
          contentEditable:
            !value2 && supportsPlaintextContentEditable
              ? "plaintext-only"
              : true,
          suppressContentEditableWarning: true,
          style: {
            ...value5,
            outlineStyle: "none",
            cursor: "text",
            minWidth:
              value5.minWidth === undefined || value5.minWidth === 0
                ? 40
                : value5.minWidth,
            minHeight:
              value5.minHeight === undefined || value5.minHeight === 0
                ? "1em"
                : value5.minHeight,
          },
          onInput: (event: ReactFormEvent<HTMLDivElement>): void => {
            if (value2) {
              (0, runtime.reconcileNativeRichTextHistory)(
                event.currentTarget,
                event.nativeEvent,
              );
              callback(event.currentTarget);
            } else {
              session.onInput(event.currentTarget.innerText);
            }
          },
          onBlur: (input: ReactFocusEvent<HTMLDivElement>): void => {
            if (
              input.relatedTarget instanceof Element &&
              input.relatedTarget.closest("[data-session-strip]") !== null
            ) {
              return;
            }
            if (value2) {
              callback2(input.currentTarget);
            } else {
              session.onCommit(input.currentTarget.innerText);
            }
          },
          onPointerDown: (input: ReactPointerEvent<HTMLDivElement>): void => {
            input.stopPropagation();
            ref.current = pointerPositionForMouse(input);
          },
          onClick: (event: ReactMouseEvent<HTMLDivElement>): void => {
            let current = ref.current;
            ref.current = null;
            if (
              event.button !== 0 ||
              event.detail > 1 ||
              pointerClickMoved(current, event) ||
              !pointerHasLinkModifier(event)
            ) {
              return;
            }
            let ancestor = (event.target as Element).closest("a:not([href])"),
              value7 =
                ancestor !== null && event.currentTarget.contains(ancestor)
                  ? classifyRenderedLink(linkUrlFromTitle(ancestor))
                  : null;
            if (value7 !== null) {
              (0, runtime.openExternalLink)(value7, renderedLinkOptions);
            }
          },
          onCompositionEnd: value3.onCompositionEnd,
          onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>): void => {
            event.stopPropagation();
            if (value3.fromIme(event)) {
              return;
            }
            if ((0, runtime.isDuplicateShortcut)(event)) {
              event.preventDefault();
            }
            if (
              (event.key === "Escape" && !event.defaultPrevented) ||
              (event.key === "Enter" && (event.metaKey || event.ctrlKey)) ||
              (event.key === "Tab" &&
                !event.altKey &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.defaultPrevented)
            ) {
              if ((event.preventDefault(), value2)) {
                callback2(event.currentTarget);
              } else {
                session.onCommit(event.currentTarget.innerText);
              }
            }
          },
          onPaste: value2 ? pasteRichTextPlaintext : plaintextPasteFallback,
          onDrop: preventDefaultInput,
          onDragOver: preventDefaultInput,
          children: value2 ? value6 : session.initialText,
        }),
      ],
    });
  }
  function EditableTableCell({
    cellKey: cellKey,
    name: name,
    style: style,
    session: session,
  }: EditableTableCellProps): ReactElement {
    let value = useEditableTextFocus(session.caret, session.reselect);
    useEditableLinkPress(value);
    useRichTextFormatInput(value);
    let value2 = useImeGuard(),
      ref = SlideRendererReact.useRef(false),
      callback = (input: () => void): void => {
        if (ref.current) {
          return;
        }
        ref.current = true;
        input();
      };
    return SlideRendererJsx.jsx("div", {
      ref: value,
      "data-cell": cellKey,
      role: "textbox",
      "aria-multiline": "true",
      "aria-label": name,
      contentEditable: supportsPlaintextContentEditable
        ? "plaintext-only"
        : true,
      suppressContentEditableWarning: true,
      style: {
        ...style,
        outlineStyle: "solid",
        outlineWidth: 2,
        outlineColor: "var(--t-app-accent)",
        outlineOffset: -2,
        cursor: "text",
      },
      onInput: (input: ReactFormEvent<HTMLDivElement>): void =>
        session.onInput(input.currentTarget.innerText),
      onBlur: (input: ReactFocusEvent<HTMLDivElement>): void => {
        let innerText = input.currentTarget.innerText;
        callback((): void => session.onCommit(innerText));
      },
      onPointerDown: (input: ReactPointerEvent<HTMLDivElement>): void =>
        input.stopPropagation(),
      onCompositionEnd: value2.onCompositionEnd,
      onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>): void => {
        event.stopPropagation();
        if ((0, runtime.isDuplicateShortcut)(event)) {
          event.preventDefault();
        }
        if (value2.fromIme(event)) {
          return;
        }
        let innerText = event.currentTarget.innerText;
        if (event.key === "Escape") {
          if (event.defaultPrevented) {
            return;
          }
          event.preventDefault();
          callback((): void => session.onCommit(innerText));
        } else if (event.key === "Enter") {
          if (
            (event.preventDefault(),
            event.altKey && !event.ctrlKey && !event.metaKey)
          ) {
            if (!document.execCommand("insertLineBreak")) {
              document.execCommand(
                "insertText",
                false,
                `
`,
              );
            }
          } else if (event.metaKey || event.ctrlKey) {
            callback((): void => session.onCommit(innerText));
          } else {
            let value3 = event.shiftKey ? -1 : 1;
            callback((): void => session.onCommitMove?.(innerText, value3, 0));
          }
        } else if (event.key === "Tab") {
          event.preventDefault();
          let value3 = event.shiftKey ? -1 : 1;
          callback((): void => session.onCommitMove?.(innerText, 0, value3));
        }
      },
      onPaste: plaintextPasteFallback,
      onDrop: preventDefaultInput,
      onDragOver: preventDefaultInput,
      children: session.initialText,
    });
  }
  function SpacerNode({
    node: node,
    path: path,
    showHatch: showHatch,
  }: SpacerNodeProps): ReactElement {
    return SlideRendererJsx.jsx("div", {
      "data-node-path": path,
      style: {
        ...nodePlacementCss(node),
        ...(showHatch
          ? {
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(115,114,108,0.18) 0 6px, transparent 6px 12px)",
              outline: "1px dashed rgba(115,114,108,0.35)",
              outlineOffset: -1,
            }
          : null),
      },
    });
  }
  function gridTrackCss(track: GridTrack): string {
    if (track === "auto") {
      return "auto";
    }
    if ("fr" in track) {
      return String(track.fr) + "fr";
    }
    return String(track.px) + "px";
  }
  function normalizeGridAlignmentCss(
    alignment: ContainerAlignment,
  ): ContainerAlignment {
    return alignment;
  }
  function GridNode({
    node: node,
    slideBg: slideBg,
    assets: assets,
    path = "",
    box: box,
    editing: editing,
    animate: animate,
    frameSelected: frameSelected,
  }: GridNodeProps): ReactElement {
    let value = path === "";
    return SlideRendererJsx.jsx("div", {
      "data-node-path": path,
      ...dynamicStyleAttributes(node.style, animate),
      style: {
        display: "grid",
        gridTemplateColumns: node.columns.map(gridTrackCss).join(" "),
        ...(node.rows !== undefined
          ? {
              gridTemplateRows: node.rows.map(gridTrackCss).join(" "),
            }
          : {}),
        gap: node.gap,
        ...(node.alignItems !== undefined
          ? {
              alignItems: normalizeGridAlignmentCss(node.alignItems),
            }
          : {}),
        ...(node.justifyItems !== undefined
          ? {
              justifyItems: normalizeGridAlignmentCss(node.justifyItems),
            }
          : {}),
        ...textFitContainerCss(node, value, box),
        ...nodeInlineStyleCss(node.style, "slides-stack"),
      },
      children: node.children.map(
        (input: SlideNodeData, options: number): ReactElement =>
          SlideRendererJsx.jsx(
            SlideNode,
            {
              node: input,
              slideBg: slideBg,
              assets: assets,
              inStack: true,
              parentAlign: node.alignItems ?? "stretch",
              parentJustify: node.justifyItems ?? "stretch",
              path:
                path === "" ? String(options) : path + "." + String(options),
              editing: editing,
              animate: animate,
              frameSelected: frameSelected,
            },
            options,
          ),
      ),
    });
  }
  function StackNode({
    node: node,
    slideBg: slideBg,
    assets: assets,
    inStack = false,
    parentAlign: parentAlign,
    parentJustify: parentJustify,
    path = "",
    editing: editing,
    animate: animate,
    frameSelected: frameSelected,
  }: StackNodeProps): ReactElement {
    let value = path === "",
      callback = (input: number): string =>
        path === "" ? String(input) : path + "." + String(input);
    return SlideRendererJsx.jsxs("div", {
      "data-node-path": path,
      ...dynamicStyleAttributes(node.style, animate),
      style: {
        position: "relative",
        display: "flex",
        flexDirection: "column",
        ...(value
          ? {
              width: "100%",
              height: "100%",
            }
          : nodePlacementCss(node, parentAlign, parentJustify)),
        ...nodeInlineStyleCss(node.style, "slides-stack"),
      },
      children: [
        SlideRendererJsx.jsx(SlideNode, {
          node: node.base,
          slideBg: slideBg,
          assets: assets,
          inStack: inStack,
          path: callback(0),
          box: "grow",
          editing: editing,
          animate: animate,
          frameSelected: frameSelected,
        }),
        node.layers.map((input: OverlayLayer, options: number): ReactElement => {
          let value2 = (0, runtime.framePositionCss)({
            id: "layer",
            x: input.x,
            y: input.y,
            node: input.node,
          });
          return SlideRendererJsx.jsx(
            "div",
            {
              "data-overlay-layer": callback(options + 1),
              style: {
                position: "absolute",
                ...value2,
                boxSizing: "border-box",
              },
              children: SlideRendererJsx.jsx(SlideNode, {
                node: input.node,
                slideBg: slideBg,
                assets: assets,
                path: callback(options + 1),
                box: "fill",
                editing: editing,
                animate: animate,
                frameSelected: frameSelected,
                frameSize: {
                  w: input.x.anchor === "fill" ? undefined : input.x.size,
                  h: input.y.anchor === "fill" ? undefined : input.y.size,
                },
                hostSized: (0, runtime.axisSpecsAreSized)(input.x, input.y),
              }),
            },
            options,
          );
        }),
      ],
    });
  }
  function OverlayNode({
    node: node,
    slideBg: slideBg,
    assets: assets,
    path = "",
    box: box,
    editing: editing,
    animate: animate,
    frameSelected: frameSelected,
  }: OverlayNodeProps): ReactElement {
    let value = path === "";
    return SlideRendererJsx.jsx("div", {
      "data-node-path": path,
      ...dynamicStyleAttributes(node.style, animate),
      style: {
        display: "flex",
        flexDirection: node.dir === "h" ? "row" : "column",
        ...(node.wrap === true && node.dir === "h"
          ? {
              flexWrap: "wrap",
            }
          : {}),
        alignItems: flexAlignmentCss(node.align),
        ...(node.justify !== undefined
          ? {
              justifyContent: flexJustificationCss(node.justify),
            }
          : {}),
        gap: node.gap,
        ...textFitContainerCss(node, value, box),
        ...nodeInlineStyleCss(node.style, "slides-stack"),
      },
      children: node.children.map(
        (input: SlideNodeData, options: number): ReactElement =>
          SlideRendererJsx.jsx(
            SlideNode,
            {
              node: input,
              slideBg: slideBg,
              assets: assets,
              inStack: true,
              parentAlign: node.align,
              parentDir: node.dir,
              path:
                path === "" ? String(options) : path + "." + String(options),
              editing: editing,
              animate: animate,
              frameSelected: frameSelected,
            },
            options,
          ),
      ),
    });
  }
  function SlideNode({
    node: node,
    slideBg: slideBg,
    assets: assets,
    inStack = false,
    parentAlign: parentAlign,
    parentJustify: parentJustify,
    parentDir: parentDir,
    path = "",
    box: box,
    editing: editing,
    animate = true,
    frameSelected: frameSelected,
    frameSize: frameSize,
    hostSized: hostSized,
  }: SlideNodeProps): ReactElement {
    if (node.kind === "text") {
      let value: TextFitBox | undefined = inStack
        ? parentDir === "v"
          ? "self"
          : undefined
        : path === "" && frameSize?.h !== undefined
          ? "parent"
          : undefined;
      if (editing && editing.path === path) {
        return SlideRendererJsx.jsx(EditableTextNode, {
          node: node,
          slideBg: slideBg,
          path: path,
          session: editing,
          inStack: inStack,
          parentDir: parentDir,
          fitBox: value,
        });
      }
      return SlideRendererJsx.jsx(ReadOnlyTextNode, {
        node: node,
        slideBg: slideBg,
        path: path,
        inStack: inStack,
        parentDir: parentDir,
        animate: animate,
        fitBox: value,
      });
    }
    if (node.kind === "img") {
      return SlideRendererJsx.jsx(ImageNode, {
        node: node,
        assets: assets,
        hostSized: !inStack && hostSized === true,
        inStack: inStack,
        parentAlign: parentAlign,
        parentJustify: parentJustify,
        path: path,
        animate: animate,
        selected: frameSelected === true,
      });
    }
    if (node.kind === "icon") {
      return SlideRendererJsx.jsx(IconNode, {
        node: node,
        slideBg: slideBg,
        inStack: inStack,
        path: path,
        animate: animate,
      });
    }
    if (node.kind === "shape") {
      return SlideRendererJsx.jsx(ShapeNode, {
        node: node,
        inStack: inStack,
        parentDir: parentDir,
        path: path,
        frameSize: frameSize,
        animate: animate,
      });
    }
    if (node.kind === "table") {
      return SlideRendererJsx.jsx(TextNode, {
        node: node,
        slideBg: slideBg,
        path: path,
        editing: editing && editing.path === path ? editing : null,
        inStack: inStack,
        parentAlign: parentAlign,
        parentJustify: parentJustify,
        parentDir: parentDir,
        fitBox: inStack && parentDir === "v" ? "self" : undefined,
      });
    }
    if (node.kind === "html") {
      return SlideRendererJsx.jsx(HtmlEmbedNode, {
        node: node,
        path: path,
        animate: animate,
        selected: frameSelected,
      });
    }
    if (node.kind === "spacer") {
      if (node.ghost !== undefined) {
        return SlideRendererJsx.jsx("div", {
          style: {
            display: "contents",
            visibility: "hidden",
            pointerEvents: "none",
          },
          "aria-hidden": true,
          children: SlideRendererJsx.jsx(SlideNode, {
            node: node.ghost,
            slideBg: slideBg,
            assets: assets,
            inStack: inStack,
            parentAlign: parentAlign,
            parentJustify: parentJustify,
            parentDir: parentDir,
            path: path,
            box: box,
            animate: false,
            frameSize: frameSize,
          }),
        });
      }
      return SlideRendererJsx.jsx(SpacerNode, {
        node: node,
        path: path,
        showHatch: animate && frameSelected === true,
      });
    }
    if (node.kind === "overlay") {
      return SlideRendererJsx.jsx(StackNode, {
        node: node,
        slideBg: slideBg,
        assets: assets,
        inStack: inStack,
        parentAlign: parentAlign,
        parentJustify: parentJustify,
        path: path,
        editing: editing,
        animate: animate,
        frameSelected: frameSelected,
      });
    }
    if (node.kind === "grid") {
      return SlideRendererJsx.jsx(GridNode, {
        node: node,
        slideBg: slideBg,
        assets: assets,
        path: path,
        box: box,
        editing: editing,
        animate: animate,
        frameSelected: frameSelected,
      });
    }
    return SlideRendererJsx.jsx(OverlayNode, {
      node: node,
      slideBg: slideBg,
      assets: assets,
      path: path,
      box: box,
      editing: editing,
      animate: animate,
      frameSelected: frameSelected,
    });
  }
  function SlideFrame({
    frame: frame,
    zIndex: zIndex,
    slideBg: slideBg,
    assets: assets,
    interactive: interactive,
    animate: animate,
  }: SlideFrameProps): ReactElement {
    let state: CSSProperties = {
      position: "absolute",
      ...(0, runtime.framePositionCss)(frame),
      boxSizing: "border-box",
    };
    if (zIndex !== undefined) {
      state.zIndex = zIndex;
    }
    let value =
      interactive?.editing != null && interactive.editing.frameId === frame.id
        ? interactive.editing
        : null;
    if (interactive) {
      state.cursor = "default";
    }
    let value2 =
      interactive !== undefined &&
      (0, runtime.isEmptyGroupBase)(frame.node) &&
      !(0, runtime.overlayHasVisiblePaint)(frame.node as OverlayNodeData);
    if (value2) {
      state.pointerEvents = "none";
    }
    let value3 = interactive?.selectedFrameIds?.includes(frame.id) === true;
    return SlideRendererJsx.jsx("div", {
      "data-frame-id": frame.id,
      style: state,
      "data-free-group": value2 ? "" : undefined,
      ref: interactive
        ? (input: HTMLDivElement | null): void =>
            interactive.registerFrame(frame.id, input)
        : undefined,
      onPointerDown: interactive
        ? (input: ReactPointerEvent<HTMLDivElement>): void =>
            interactive.onFramePointerDown(frame.id, input)
        : undefined,
      children: SlideRendererJsx.jsx(richTextEditingContext.Provider, {
        value: value3,
        children: SlideRendererJsx.jsx(SlideNode, {
          node: frame.node,
          slideBg: slideBg,
          assets: assets,
          editing: value,
          animate: animate,
          frameSelected: value3,
          frameSize: {
            w:
              frame.x.anchor === "fill"
                ? runtime.SLIDE_WIDTH - 2 * frame.x.margin
                : frame.x.size,
            h:
              frame.y.anchor === "fill"
                ? runtime.SLIDE_HEIGHT - 2 * frame.y.margin
                : frame.y.size,
          },
          hostSized: (0, runtime.axisSpecsAreSized)(frame.x, frame.y),
        }),
      }),
    });
  }
  function orderedRenderedFrames(
    slide: Slide,
    containsEmbeds: boolean,
  ): OrderedFrame[] {
    if (
      !(
        containsEmbeds &&
        slide.frames.some(
          (input: Frame): boolean =>
            (0, runtime.countNodeEmbeds)(input.node) > 0,
        )
      )
    ) {
      return slide.frames.map(
        (input: Frame): OrderedFrame => ({
          f: input,
          zIndex: undefined,
        }),
      );
    }
    return slide.frames
      .map(
        (input: Frame, options: number): OrderedFrame => ({
          f: input,
          zIndex: options,
        }),
      )
      .sort(
        (input: OrderedFrame, options: OrderedFrame): number =>
          input.f.id < options.f.id ? -1 : input.f.id > options.f.id ? 1 : 0,
      );
  }
  function SlideCanvas({
    slide: slide,
    assets: assets,
    width: width,
    animate = true,
    editorChrome: editorChrome,
    structure = true,
    links: links,
    onLinkOpen: onLinkOpen,
    clips: clips,
    interactive: interactive,
  }: SlideCanvasProps): ReactElement {
    let value = interactive?.plainPress,
      memo = SlideRendererReact.useMemo(
        (): SlideLinkState => ({
          links: links,
          onLinkOpen: onLinkOpen,
          plainPress: value,
        }),
        [links, onLinkOpen, value],
      ),
      value2 = width / runtime.SLIDE_WIDTH;
    return SlideRendererJsx.jsx("div", {
      ...(interactive
        ? null
        : {
            "data-uncommentable": "",
          }),
      style: {
        ["--slide-scale"]: value2,
        width: width,
        height: (width * runtime.SLIDE_HEIGHT) / runtime.SLIDE_WIDTH,
        overflow: "clip",
        contain: "paint",
        position: "relative",
        flexShrink: 0,
      },
      children: SlideRendererJsx.jsx("div", {
        style: {
          width: runtime.SLIDE_WIDTH,
          height: runtime.SLIDE_HEIGHT,
          transform: "scale(" + String(value2) + ")",
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
          background: (0, runtime.slideBackgroundColor)(slide.bg),
          overflow: "clip",
          contain: "paint",
        },
        children: SlideRendererJsx.jsx(slideEditorChromeContext.Provider, {
          value: editorChrome === true,
          children: SlideRendererJsx.jsx(
            slideStructureEnabledContext.Provider,
            {
              value: structure,
              children: SlideRendererJsx.jsx(slideLinkContext.Provider, {
                value: memo,
                children: SlideRendererJsx.jsx(ClipPlaybackProvider, {
                  clips: clips,
                  slideId: slide.id,
                  children: SlideRendererJsx.jsx(
                    listRenderingContext.Provider,
                    {
                      value: slide.lists,
                      children: orderedRenderedFrames(slide, animate).map(
                        ({ f: f, zIndex: zIndex }: OrderedFrame): ReactElement =>
                          SlideRendererJsx.jsx(
                            SlideFrame,
                            {
                              frame: f,
                              zIndex: zIndex,
                              slideBg: slide.bg,
                              assets: assets,
                              interactive: interactive,
                              animate: animate,
                            },
                            f.id,
                          ),
                      ),
                    },
                  ),
                }),
              }),
            },
          ),
        }),
      }),
    });
  }
  function SlideSurface({
    slide: slide,
    assets: assets,
    animate = true,
    editorChrome: editorChrome,
    structure = true,
    links: links,
    onLinkOpen: onLinkOpen,
    clips: clips,
    bgOverride: bgOverride,
    underlay: underlay,
  }: SlideSurfaceProps): ReactElement {
    let memo = SlideRendererReact.useMemo(
      (): SlideLinkState => ({
        links: links,
        onLinkOpen: onLinkOpen,
      }),
      [links, onLinkOpen],
    );
    return SlideRendererJsx.jsxs("div", {
      "data-uncommentable": "",
      style: {
        width: runtime.SLIDE_WIDTH,
        height: runtime.SLIDE_HEIGHT,
        position: "relative",
        background: bgOverride ?? (0, runtime.slideBackgroundColor)(slide.bg),
        overflow: "clip",
        contain: "paint",
      },
      children: [
        underlay,
        SlideRendererJsx.jsx(slideEditorChromeContext.Provider, {
          value: editorChrome === true,
          children: SlideRendererJsx.jsx(
            slideStructureEnabledContext.Provider,
            {
              value: structure,
              children: SlideRendererJsx.jsx(slideLinkContext.Provider, {
                value: memo,
                children: SlideRendererJsx.jsx(ClipPlaybackProvider, {
                  clips: clips,
                  slideId: slide.id,
                  children: SlideRendererJsx.jsx(
                    listRenderingContext.Provider,
                    {
                      value: slide.lists,
                      children: orderedRenderedFrames(slide, animate).map(
                        ({ f: f, zIndex: zIndex }: OrderedFrame): ReactElement =>
                          SlideRendererJsx.jsx(
                            SlideFrame,
                            {
                              frame: f,
                              zIndex: zIndex,
                              slideBg: slide.bg,
                              assets: assets,
                              interactive: undefined,
                              animate: animate,
                            },
                            f.id,
                          ),
                      ),
                    },
                  ),
                }),
              }),
            },
          ),
        }),
      ],
    });
  }
  bindRuntimeValue(runtime, "nodeInlineStyleCss", () => nodeInlineStyleCss);
  bindRuntimeValue(
    runtime,
    "dynamicStyleAttributes",
    () => dynamicStyleAttributes,
  );
  bindRuntimeValue(runtime, "flexAlignmentCss", () => flexAlignmentCss);
  bindRuntimeValue(runtime, "flexJustificationCss", () => flexJustificationCss);
  bindRuntimeValue(
    runtime,
    "hasTextFitCssVariable",
    () => hasTextFitCssVariable,
  );
  bindRuntimeValue(
    runtime,
    "applyTextFitCssVariable",
    () => applyTextFitCssVariable,
  );
  bindRuntimeValue(runtime, "positiveFontSizePx", () => positiveFontSizePx);
  bindRuntimeValue(runtime, "shouldPinShrinkBasis", () => shouldPinShrinkBasis);
  bindRuntimeValue(runtime, "useTextFit", () => useTextFit);
  bindRuntimeValue(runtime, "textFitContainerCss", () => textFitContainerCss);
  bindRuntimeValue(runtime, "nodePlacementCss", () => nodePlacementCss);
  bindRuntimeValue(runtime, "resolveImageUrl", () => resolveImageUrl);
  bindRuntimeValue(runtime, "classifyRenderedLink", () => classifyRenderedLink);
  bindRuntimeValue(
    runtime,
    "headingLevelForTextNode",
    () => headingLevelForTextNode,
  );
  bindRuntimeValue(runtime, "MediaPlaceholder", () => MediaPlaceholder);
  bindRuntimeValue(runtime, "HtmlEmbedNode", () => HtmlEmbedNode);
  bindRuntimeValue(runtime, "ensureShapeStyles", () => ensureShapeStyles);
  bindRuntimeValue(runtime, "IconNode", () => IconNode);
  bindRuntimeValue(runtime, "shadowDropFilter", () => shadowDropFilter);
  bindRuntimeValue(runtime, "strokeDashArray", () => strokeDashArray);
  bindRuntimeValue(runtime, "ShapeNode", () => ShapeNode);
  bindRuntimeValue(
    runtime,
    "useElementContentSize",
    () => useElementContentSize,
  );
  bindRuntimeValue(runtime, "ConnectorShape", () => ConnectorShape);
  bindRuntimeValue(runtime, "PolygonShape", () => PolygonShape);
  bindRuntimeValue(runtime, "ImageNode", () => ImageNode);
  bindRuntimeValue(runtime, "createClipCapacity", () => createClipCapacity);
  bindRuntimeValue(runtime, "ClipPlaybackProvider", () => ClipPlaybackProvider);
  bindRuntimeValue(runtime, "LinkedVideoNode", () => LinkedVideoNode);
  bindRuntimeValue(runtime, "prefersReducedMotion", () => prefersReducedMotion);
  bindRuntimeValue(runtime, "StoredVideoNode", () => StoredVideoNode);
  bindRuntimeValue(runtime, "useVideoDelay", () => useVideoDelay);
  bindRuntimeValue(runtime, "VideoWithCapacity", () => VideoWithCapacity);
  bindRuntimeValue(runtime, "VideoElement", () => VideoElement);
  bindRuntimeValue(runtime, "hexColorRgba", () => hexColorRgba);
  bindRuntimeValue(runtime, "TextNode", () => TextNode);
  bindRuntimeValue(
    runtime,
    "useRichTextFormatInput",
    () => useRichTextFormatInput,
  );
  bindRuntimeValue(runtime, "useEditableTextFocus", () => useEditableTextFocus);
  bindRuntimeValue(runtime, "linkUrlFromTitle", () => linkUrlFromTitle);
  bindRuntimeValue(runtime, "useEditableLinkPress", () => useEditableLinkPress);
  bindRuntimeValue(runtime, "RichTextRuns", () => RichTextRuns);
  bindRuntimeValue(runtime, "RichTextContent", () => RichTextContent);
  bindRuntimeValue(runtime, "renderedTextCss", () => renderedTextCss);
  bindRuntimeValue(runtime, "ReadOnlyTextNode", () => ReadOnlyTextNode);
  bindRuntimeValue(runtime, "useImeGuard", () => useImeGuard);
  bindRuntimeValue(runtime, "EditableTextNode", () => EditableTextNode);
  bindRuntimeValue(runtime, "EditableTableCell", () => EditableTableCell);
  bindRuntimeValue(runtime, "SpacerNode", () => SpacerNode);
  bindRuntimeValue(runtime, "gridTrackCss", () => gridTrackCss);
  bindRuntimeValue(
    runtime,
    "normalizeGridAlignmentCss",
    () => normalizeGridAlignmentCss,
  );
  bindRuntimeValue(runtime, "GridNode", () => GridNode);
  bindRuntimeValue(runtime, "StackNode", () => StackNode);
  bindRuntimeValue(runtime, "OverlayNode", () => OverlayNode);
  bindRuntimeValue(runtime, "SlideNode", () => SlideNode);
  bindRuntimeValue(runtime, "SlideFrame", () => SlideFrame);
  bindRuntimeValue(
    runtime,
    "orderedRenderedFrames",
    () => orderedRenderedFrames,
  );
  bindRuntimeValue(runtime, "SlideCanvas", () => SlideCanvas);
  bindRuntimeValue(runtime, "SlideSurface", () => SlideSurface);
  bindRuntimeValue(
    runtime,
    "SlideRendererReact",
    () => SlideRendererReact,
    (value) => {
      SlideRendererReact = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SlideRendererJsx",
    () => SlideRendererJsx,
    (value) => {
      SlideRendererJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textFitScaleVariable",
    () => textFitScaleVariable,
    (value) => {
      textFitScaleVariable = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textFitFontSizeVariable",
    () => textFitFontSizeVariable,
    (value) => {
      textFitFontSizeVariable = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textFitClipVariable",
    () => textFitClipVariable,
    (value) => {
      textFitClipVariable = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideEditorChromeContext",
    () => slideEditorChromeContext,
    (value) => {
      slideEditorChromeContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideStructureEnabledContext",
    () => slideStructureEnabledContext,
    (value) => {
      slideStructureEnabledContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "linkModifierKeyLabel",
    () => linkModifierKeyLabel,
    (value) => {
      linkModifierKeyLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "linkModifierPressHint",
    () => linkModifierPressHint,
    (value) => {
      linkModifierPressHint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "richTextDoubleTapWindowMs",
    () => richTextDoubleTapWindowMs,
    (value) => {
      richTextDoubleTapWindowMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "renderedLinkOptions",
    () => renderedLinkOptions,
    (value) => {
      renderedLinkOptions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pointerClickMovementTolerance",
    () => pointerClickMovementTolerance,
    (value) => {
      pointerClickMovementTolerance = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pointerPositionForMouse",
    () => pointerPositionForMouse,
    (value) => {
      pointerPositionForMouse = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pointerClickMoved",
    () => pointerClickMoved,
    (value) => {
      pointerClickMoved = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pointerHasLinkModifier",
    () => pointerHasLinkModifier,
    (value) => {
      pointerHasLinkModifier = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideLinkContext",
    () => slideLinkContext,
    (value) => {
      slideLinkContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "richTextEditingContext",
    () => richTextEditingContext,
    (value) => {
      richTextEditingContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "listRenderingContext",
    () => listRenderingContext,
    (value) => {
      listRenderingContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mediaPlaceholderLabelCss",
    () => mediaPlaceholderLabelCss,
    (value) => {
      mediaPlaceholderLabelCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "transparencyCheckerboardGradient",
    () => transparencyCheckerboardGradient,
    (value) => {
      transparencyCheckerboardGradient = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "allowEmbedScripts",
    () => allowEmbedScripts,
    (value) => {
      allowEmbedScripts = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "htmlEmbedMarkerAttribute",
    () => htmlEmbedMarkerAttribute,
    (value) => {
      htmlEmbedMarkerAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "embedsDisabledEventName",
    () => embedsDisabledEventName,
    (value) => {
      embedsDisabledEventName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideEmbedGuardConfig",
    () => slideEmbedGuardConfig,
    (value) => {
      slideEmbedGuardConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideEmbedContentSecurityPolicy",
    () => slideEmbedContentSecurityPolicy,
    (value) => {
      slideEmbedContentSecurityPolicy = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shapeStyleElementId",
    () => shapeStyleElementId,
    (value) => {
      shapeStyleElementId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shapeStylesCss",
    () => shapeStylesCss,
    (value) => {
      shapeStylesCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shapeClipPaths",
    () => shapeClipPaths,
    (value) => {
      shapeClipPaths = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "liveClipCapacity",
    () => liveClipCapacity,
    (value) => {
      liveClipCapacity = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clipSlideIdContext",
    () => clipSlideIdContext,
    (value) => {
      clipSlideIdContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clipCapacityContext",
    () => clipCapacityContext,
    (value) => {
      clipCapacityContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clipPlaybackModeContext",
    () => clipPlaybackModeContext,
    (value) => {
      clipPlaybackModeContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "activeLinkedClipContext",
    () => activeLinkedClipContext,
    (value) => {
      activeLinkedClipContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "supportsPlaintextContentEditable",
    () => supportsPlaintextContentEditable,
    (value) => {
      supportsPlaintextContentEditable = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "linkDoublePressTimeoutMs",
    () => linkDoublePressTimeoutMs,
    (value) => {
      linkDoublePressTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "plaintextPasteFallback",
    () => plaintextPasteFallback,
    (value) => {
      plaintextPasteFallback = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preventDefaultInput",
    () => preventDefaultInput,
    (value) => {
      preventDefaultInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pasteRichTextPlaintext",
    () => pasteRichTextPlaintext,
    (value) => {
      pasteRichTextPlaintext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "editableFocusTimeoutMs",
    () => editableFocusTimeoutMs,
    (value) => {
      editableFocusTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSlideRenderer",
    () => initializeSlideRenderer,
    (value) => {
      initializeSlideRenderer = value;
    },
  );
  return () => {
    textFitScaleVariable = "--fit";
    textFitFontSizeVariable = "--fit-size";
    textFitClipVariable = "--fit-clip";
    linkModifierKeyLabel = (): string =>
      (0, runtime.isApplePlatform)() ? "⌘" : "Ctrl";
    linkModifierPressHint = (): string =>
      linkModifierKeyLabel() + "-click to open: ";
    richTextDoubleTapWindowMs = 300;
    pointerClickMovementTolerance = 4;
    pointerPositionForMouse = (input): PointerPosition | null =>
      input.pointerType === "touch"
        ? null
        : {
            x: input.clientX,
            y: input.clientY,
          };
    pointerClickMoved = (input, options): boolean =>
      options.detail !== 0 &&
      input !== null &&
      Math.hypot(options.clientX - input.x, options.clientY - input.y) >
        pointerClickMovementTolerance;
    pointerHasLinkModifier = (input): boolean =>
      input.metaKey || (input.ctrlKey && !(0, runtime.isApplePlatform)());
    transparencyCheckerboardGradient =
      "repeating-conic-gradient(#d7d6d1 0 25%, #ffffff 0 50%)";
    allowEmbedScripts = true;
    htmlEmbedMarkerAttribute = "data-embed-frame";
    embedsDisabledEventName = "slides-embeds-disabled";
    shapeStyleElementId = "mc-anthropicons";
    liveClipCapacity = 4;
    linkDoublePressTimeoutMs = 700;
    preventDefaultInput = (event: SyntheticEvent): void => {
      event.preventDefault();
    };
    pasteRichTextPlaintext = (event: ReactClipboardEvent<HTMLElement>): void => {
      event.preventDefault();
      let value = event.clipboardData.getData("text/plain"),
        value2 = window.getSelection(),
        value3 =
          value2 !== null &&
          value2.rangeCount > 0 &&
          !value2.isCollapsed &&
          event.currentTarget.contains(value2.getRangeAt(0).startContainer) &&
          event.currentTarget.contains(value2.getRangeAt(0).endContainer),
        value4 = value.trim();
      if (value3 && (0, runtime.isSafeHyperlink)(value4)) {
        (0, runtime.executeRichTextCommand)("createLink", value4);
        return;
      }
      document.execCommand("insertText", false, value);
    };
    editableFocusTimeoutMs = 500;
    initializeSlideRenderer = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeRichTextDom)();
      (0, runtime.initializeModelEditing)();
      (0, runtime.initializeObjectNavigation)();
      (0, runtime.initializeModelSelection)();
      (0, runtime.initializeImageCrop)();
      (0, runtime.initializeVideoAssets)();
      (0, runtime.initializeUiInputs210)();
      (0, runtime.initializeVideoController)();
      (0, runtime.initializeClipRegistry)();
      (0, runtime.initializeVideoLinkPlayer)();
      (0, runtime.initializeClipBadge)();
      (0, runtime.initializeVideoLinks)();
      (0, runtime.initializeExternalLinks)();
      (0, runtime.initializeModelGeometry)();
      (0, runtime.initializeRenderingTheme)();
      (0, runtime.initializeModelSelection)();
      (0, runtime.initializeStyleSchema)();
      (0, runtime.initializeEmbeds)();
      (0, runtime.initializeIconFont)();
      SlideRendererReact = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      SlideRendererJsx = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      slideEditorChromeContext = SlideRendererReact.createContext(false);
      slideStructureEnabledContext = SlideRendererReact.createContext(true);
      renderedLinkOptions = {
        storedUrl: true,
      };
      slideLinkContext = SlideRendererReact.createContext({});
      richTextEditingContext = SlideRendererReact.createContext(false);
      listRenderingContext = SlideRendererReact.createContext<
        ListRenderingMode | undefined
      >(undefined);
      mediaPlaceholderLabelCss = {
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 3,
        overflow: "hidden",
        wordBreak: "break-all",
      };
      slideEmbedGuardConfig = {
        markerAttr: htmlEmbedMarkerAttribute,
        disabledEvent: embedsDisabledEventName,
      };
      slideEmbedContentSecurityPolicy = (0, runtime.embedContentSecurityPolicy)(
        allowEmbedScripts,
      );
      shapeStylesCss =
        "@font-face{font-family:'mc-anthropicons';src:url('" +
        runtime.iconFontCss +
        "') format('woff2');font-display:block}";
      shapeClipPaths = {
        diamond: "50,0 100,50 50,100 0,50",
        "arrow-right": "0,30 60,30 60,10 100,50 60,90 60,70 0,70",
        "arrow-left": "100,30 40,30 40,10 0,50 40,90 40,70 100,70",
        "arrow-up": "30,100 30,40 10,40 50,0 90,40 70,40 70,100",
        "arrow-down": "30,0 30,60 10,60 50,100 90,60 70,60 70,0",
      };
      clipSlideIdContext = SlideRendererReact.createContext("");
      clipCapacityContext = SlideRendererReact.createContext<ClipCapacity>({
        take: (): boolean => true,
        give: (): void => {},
        onFree: (): (() => void) => (): void => {},
      });
      clipPlaybackModeContext =
        SlideRendererReact.createContext<ClipPlaybackMode>("selected");
      activeLinkedClipContext = SlideRendererReact.createContext<ActiveLinkedClip>({
        at: undefined,
        set: (): void => {},
      });
      supportsPlaintextContentEditable = ((): boolean => {
        if (typeof document === "undefined") {
          return false;
        }
        let value = document.createElement("div");
        try {
          value.contentEditable = "plaintext-only";
        } catch {
          return false;
        }
        return value.contentEditable === "plaintext-only";
      })();
      plaintextPasteFallback = supportsPlaintextContentEditable
        ? undefined
        : (event: ReactClipboardEvent<HTMLElement>): void => {
            event.preventDefault();
            let value = event.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, value);
          };
    });
  };
}
