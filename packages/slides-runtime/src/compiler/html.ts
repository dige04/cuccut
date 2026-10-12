/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  Alignment,
  Axis,
  AxisAnchor,
  BlendModeValue,
  BorderSidesValue,
  BuildEffect,
  BuildEffectName,
  CompileDiagnostic,
  DeckContent,
  DeckSection,
  HtmlCompileResult,
  ArrowHeadKind,
  ConnectorCorner,
  ConnectorHead,
  ConnectorRouting,
  ContainerAlignment,
  CssSizeValue,
  CustomFontFamilyValue,
  FilterValue,
  FlowContainerNode,
  FontFace,
  FontFamilyFallback,
  FontFamilyValue,
  FontStyleValue,
  FontVariantNumericValue,
  Frame,
  FrameBuild,
  GradientStop,
  GradientValue,
  GridNode,
  GridTrack,
  IconNode,
  ImageNode,
  Justification,
  ListRenderingMode,
  NodeBase,
  NodePlacement,
  OverlayLayer,
  OverlayNode,
  ShadowPresetName,
  ShadowValue,
  ShapeNode,
  ShapeVariant,
  Slide,
  SlideColor,
  SlideNode,
  SlideNodeKind,
  SlideTransition,
  SpacerNode,
  StackNode,
  StyleBag,
  StylePropertyName,
  TableNode,
  TextAlignValue,
  TextDecorationLineValue,
  TextDecorationStyleValue,
  TextFill,
  TextMark,
  TextNode,
  TextRole,
  TextTransformValue,
} from "../deck-contracts";
import type { VideoLink } from "../media/video-links";
import type { ConnectorArrowHeads, ConnectorHeadFields } from "../model/deck";
import type {
  NumericBounds,
  NumericSchema,
  ShadowBounds,
} from "../model/style-schema";
import type {
  CssBorder,
  CssNumberToken,
  CssToken,
  GradientBox,
  ParsedCssDeclaration,
  ParsedCssTransform,
} from "./css-values";

/** An identifier token such as `auto` or `center`. */
type CssIdentToken = Extract<CssToken, { t: "ident" }>;

/** A 1-based line and column in the HTML being compiled. */
export interface HtmlSourcePosition {
  line: number;
  col: number;
}
/** Attribute values by name: lower-cased in HTML, as written inside SVG. */
export type HtmlAttributes = Record<string, string>;
/** An element of the parsed slide HTML. */
export interface HtmlElementNode extends HtmlSourcePosition {
  kind: "el";
  tag: string;
  attrs: HtmlAttributes;
  children: HtmlTreeNode[];
  /** The closing tag was left out in the source. */
  implied?: boolean;
  /** Raw source of an `<svg>` element, which is not parsed further. */
  source?: string;
  /** Set on a `<video>` that was written as an `<iframe>`. */
  wrote?: "iframe";
}
/** A run of text between tags, with its entities decoded. */
export interface HtmlTextNode extends HtmlSourcePosition {
  kind: "text";
  text: string;
}
export type HtmlTreeNode = HtmlElementNode | HtmlTextNode;
/** An opening or closing tag as read from the source. */
export interface HtmlTag extends HtmlSourcePosition {
  name: string;
  attrs: HtmlAttributes;
  selfClosing: boolean;
  closing: boolean;
}
/** Reads the HTML source and maps offsets to lines and columns. */
export interface HtmlSourceCursorInstance {
  src: string;
  baseLine: number;
  baseCol: number;
  pos: number;
  lineStarts: number[];
  lineCol(offset?: number): HtmlSourcePosition;
  fail(message: string, offset?: number): never;
}
export interface HtmlSourceCursorConstructor {
  new (
    src: string,
    baseLine?: number,
    baseCol?: number,
  ): HtmlSourceCursorInstance;
}
/** A syntax error in the HTML source, with the position where it was found. */
export interface HtmlParseErrorInstance extends Error {
  line: number;
  col: number;
}
export interface HtmlParseErrorConstructor {
  new (message: string, line: number, col: number): HtmlParseErrorInstance;
}
/** Side of a box in the order CSS writes them. */
export type CssBoxSide = "top" | "right" | "bottom" | "left";
export type BorderSideWidthField =
  | "borderTopWidth"
  | "borderRightWidth"
  | "borderBottomWidth"
  | "borderLeftWidth";
/** Inclusive limits a length is clamped to. */
export interface LengthBounds {
  lo: number;
  hi: number;
}
/** A font family the compiler maps to one of the built-in generic faces. */
export interface FontFamilyChoice {
  family: string;
  fallback: FontFamilyFallback;
}
export interface WebSafeFontAlias extends FontFamilyChoice {
  /** The family is one of the basic faces every viewer has. */
  basic?: true;
}
/** Font size, weight and line height an imported heading or paragraph starts from. */
export interface ImportedTypeScaleEntry {
  size: number;
  weight: number;
  lh: number;
}
export interface HtmlShadowPreset {
  y: number;
  blur: number;
  color: string;
}
/** An SVG pattern and the reason text containing it is refused. */
export type SvgMarkupRule = [pattern: RegExp, message: string];
/** A `<svg>` root: its attributes and everything between the root tags. */
export interface SvgRoot {
  attrs: HtmlAttributes;
  inner: string;
}

/** An SVG element that is open while its markup is sanitized: its name as written, lower-cased, and the namespace prefixes in scope. */
export interface SvgOpenElement {
  name: string;
  lower: string;
  prefixes: ReadonlySet<string>;
}
/** SVG markup rewritten as XML, with what had to change and which elements were left open. */
export interface SanitizedSvgMarkup {
  xml: string;
  said: string[];
  open: string[];
}

/** Nodes with an explicit `w` and `h`. */
export type SizedNode = ImageNode | IconNode | ShapeNode;
/** The alignment a flow container passes down to its children, per axis. */
export interface StretchSources {
  w?: string;
  h?: string;
}
/** The container settings that decide how a child is aligned. */
export type FlowContainerAlignment = Partial<
  Pick<GridNode, "justifyItems" | "alignItems"> &
    Pick<StackNode, "align" | "dir">
>;
/** What a node is compiled inside: the ancestors' inherited style and the container it sits in. */
export interface HtmlNodeContext {
  inh: InheritedTextStyle;
  depth: number;
  parentDir?: "h" | "v";
  parentGrid?: boolean;
  inContainer?: boolean;
  parentAlign?: StretchSources;
  parentBlock?: boolean;
  flowCount?: number;
  parentJustify?: Justification;
  faded?: boolean;
  /** The container is a div nested inside a position:relative host. */
  nestedHost?: boolean;
  /** The axes of the position:relative host the node's positioned children are pinned to. */
  layerGeom?: { x: Axis; y: Axis };
  /** Which axes the element fills: its position:absolute offsets span the whole slide. */
  fill?: { x: boolean; y: boolean };
  /** The size the node has, when known before it is compiled. */
  box?: { w: number | undefined; h: number | undefined };
}
/** Receives one diagnostic message. */
export type HtmlDiagnosticReporter = (message: string) => void;
/** What `parseInlineStyle` notes about the slide box it reads: its size, the background colour it kept and a gradient it refused. */
export interface InlineStyleBoxState {
  box: GradientBox;
  keptColour?: string;
  wroteColour?: boolean;
  refusedGradient?: "background" | "background-image";
}
/** A `top` / `right` / `bottom` / `left` value: auto, a length, a percentage or `calc(N% +/- Mpx)`. */
export type CssOffsetValue =
  | "auto"
  | CssSizeValue
  | { calcPct: number; px: number };
/** The stroke of a parsed inline style: the shorthand fields plus the drawn sides and per-side widths. */
export interface ParsedInlineBorder extends CssBorder {
  widths?: Partial<Record<CssBoxSide, number>>;
  sides?: CssBoxSide[];
}
/** One radius for every corner, or the four corners in order top-left, top-right, bottom-right, bottom-left. */
export type ParsedBorderRadius = CssSizeValue | { corners: CssSizeValue[] };
/** The properties of an inline `style` attribute that the format accepts, by CSS name. */
export interface ParsedInlineStyle {
  position?: "relative" | "absolute";
  top?: CssOffsetValue;
  right?: CssOffsetValue;
  bottom?: CssOffsetValue;
  left?: CssOffsetValue;
  width?: "auto" | CssSizeValue;
  height?: "auto" | CssSizeValue;
  "min-width"?: CssSizeValue;
  "min-height"?: CssSizeValue;
  "max-width"?: CssSizeValue;
  "max-height"?: CssSizeValue;
  /** `min-content` or `max-content`. */
  "min-width-fit"?: string;
  display?: "flex" | "grid" | "none";
  "flex-direction"?: "row" | "column" | "row-reverse" | "column-reverse";
  "flex-wrap"?: boolean;
  gap?: number;
  "align-items"?: ContainerAlignment;
  "justify-content"?: Justification;
  "justify-items"?: ContainerAlignment;
  "align-self"?: ContainerAlignment;
  "justify-self"?: ContainerAlignment;
  "grid-template-columns"?: GridTrack[];
  "grid-template-rows"?: GridTrack[];
  "padding-top"?: number;
  "padding-right"?: number;
  "padding-bottom"?: number;
  "padding-left"?: number;
  overflow?: "visible" | "hidden";
  "flex-grow"?: number;
  "flex-shrink"?: number;
  "flex-basis"?: "auto" | number;
  "aspect-ratio"?: number;
  "grid-column"?: number;
  "grid-row"?: number;
  "font-family"?: string[];
  "font-size"?: number;
  "font-weight"?: number;
  "font-style"?: FontStyleValue;
  "line-height"?: number | { px: number };
  "letter-spacing"?: number | { em: number };
  "text-align"?: TextAlignValue;
  "text-transform"?: TextTransformValue;
  "white-space"?: "normal" | "nowrap";
  "text-decoration-line"?: TextDecorationLineValue;
  "text-decoration-style"?: TextDecorationStyleValue;
  "text-decoration-color"?: string;
  "font-variant-numeric"?: FontVariantNumericValue;
  "text-stroke-width"?: number;
  "text-stroke-color"?: string;
  color?: string;
  "background-color"?: string;
  "background-gradient"?: GradientValue;
  "background-image-src"?: string;
  "background-size"?: "cover" | "contain";
  "background-clip"?: "text";
  "background-position"?: true;
  "background-repeat"?: true;
  "text-fill-transparent"?: true;
  "text-fill-current"?: true;
  border?: ParsedInlineBorder;
  "border-radius"?: ParsedBorderRadius;
  "box-shadow"?: ShadowValue[];
  "text-shadow"?: ShadowValue[];
  opacity?: number;
  transform?: ParsedCssTransform;
  filter?: FilterValue;
  "backdrop-filter"?: FilterValue;
  "mix-blend-mode"?: BlendModeValue;
  "object-fit"?: "cover" | "contain";
}

/** Padding that a node adds to its width (`x`) and height (`y`). */
export interface PaddingSize {
  x: number;
  y: number;
}
/** Style properties holding a node's padding, read as plain numbers. */
export type PaddingStyleKey =
  | "paddingLeft"
  | "paddingRight"
  | "paddingTop"
  | "paddingBottom";
/** The longest word of a text node and the width it needs. */
export interface LongestWord {
  px: number;
  word: string;
}
/** Where a node starts along one axis and, when known, how long it is. */
export interface AxisPlacement {
  at: number;
  size?: number;
}
/** A rotated rectangle: its centre, half width, half height and rotation in degrees. */
export interface RotatedBox {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  rot: number;
}
/** A point as `[x, y]`. */
export type Point = [x: number, y: number];
/** A rectangle in slide pixels: top left corner, width and height. */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** A problem with the style of an icon; equal `key`s are reported together. */
export interface IconStyleWarning {
  key: string;
  msg: string;
}
/** A `#rrggbb[aa]` colour as red, green and blue in 0..1 plus alpha. */
export interface HexColorChannels {
  ch: number[];
  a: number;
}

/** The properties the paint and contrast checks read from a node of any kind, whether or not that kind has them. */
export interface NodeProbe extends NodeBase {
  kind: SlideNodeKind;
  text?: string;
  color?: SlideColor;
  fill?: { kind: string; gradient?: GradientValue };
  marks?: TextMark[];
  children?: SlideNode[];
  base?: SlideNode;
  layers?: OverlayLayer[];
}
/** The backgrounds under a node: none that show ("hidden"), not known ("unknown"), or the colours stacked below it. */
export type PaintFills = "hidden" | "unknown" | Array<string | undefined>;
/** A text, icon or table that is painted over a stack of backgrounds. */
export interface PaintLayer {
  colors: Array<string | undefined>;
  ink: Array<string | undefined>;
  opacity: number;
  fills: Array<string | undefined>;
  bare: boolean;
}
/** What a slide paints: the content layers and whether any could not be measured or has no colour of its own. */
export interface SlidePaintLayers {
  shown: PaintLayer[];
  unmeasured: boolean;
  colourless: boolean;
}

/** A run of inline text with the formatting it was written with. */
export interface InlineFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  href?: string;
}
export interface InlineRun extends InlineFormat {
  text: string;
}
/** An inline text block: the text and marks, the marks without background styling, and a call that reports the style diagnostics held back while reading it. */
export interface InlineBlock extends ParsedInlineText {
  plain: TextMark[];
  say: () => void;
}
/** The plain text of an inline run list and the formatting marks over it. */
export interface ParsedInlineText {
  text: string;
  marks: TextMark[];
}
/** What the `<head>` of an HTML deck contributes. */
export interface ParsedHtmlHead {
  title?: string;
}

/** How a div lays its children out: a flex row or column, or a grid. */
export interface ContainerLayout {
  gap: number;
  dir?: "h" | "v";
  reverse?: boolean;
  wrap?: true;
  align?: ContainerAlignment;
  justify?: Justification;
  columns?: GridTrack[];
  rows?: GridTrack[];
  alignItems?: GridNode["alignItems"];
  justifyItems?: GridNode["justifyItems"];
}
/** The layout of a div and whether it is a grid. */
export interface LayoutResult {
  isGrid: boolean;
  layout: ContainerLayout;
}
/** An element's placement along one axis, whether its size is still open, and the size the offsets leave. */
export interface ResolvedAxis {
  spec: Axis;
  sizeless: boolean;
  resolved?: number;
}
/** What the section and deck compilers use of the HTML compiler class, which is built inside the install function. */
export interface SlideHtmlCompilerInstance {
  warnings: CompileDiagnostic[];
  errors: CompileDiagnostic[];
  lints: CompileDiagnostic[];
  unsupported: CompileDiagnostic[];
  files: HtmlFileReference[];
  faces: FontFace[];
  cellRemovals: number;
  slideLabel: string;
  slideBg: string | undefined;
  sawFontFamily: boolean;
  resetSlide(): void;
  flushIcons(): void;
  dedupeDiags(): void;
  notes(): CompileNote[];
  collectsFiles(): boolean;
  fileRef(
    input: string,
    options: "font" | "image",
    context: HtmlSourcePosition,
  ): string | undefined;
  declareFace(input: FontFace, options: HtmlSourcePosition): void;
  warnAt(input: HtmlSourcePosition, options: string): void;
  errorAt(input: HtmlSourcePosition, options: string): void;
  rejectAt(input: HtmlSourcePosition, options: string): void;
  warner(input: HtmlSourcePosition, options: string): HtmlDiagnosticReporter;
  rejecter(input: HtmlSourcePosition, options: string): HtmlDiagnosticReporter;
  leftovers(
    input: ParsedInlineStyle,
    options: Set<string>,
    context: HtmlElementNode,
    value: string,
  ): void;
  inherit(
    input: ParsedInlineStyle,
    options: InheritedTextStyle,
    context: HtmlSourcePosition,
  ): InheritedTextStyle;
  inline(
    input: HtmlElementNode,
    options?: HtmlElementNode,
    context?: boolean,
  ): InlineBlock;
  layout(
    input: ParsedInlineStyle,
    options: Set<string>,
    context: HtmlDiagnosticReporter,
    value: HtmlDiagnosticReporter,
  ): LayoutResult;
  node(input: HtmlElementNode, options: HtmlNodeContext): SlideNode | undefined;
  frame(
    input: HtmlElementNode,
    options: HtmlNodeContext,
    context: number | undefined,
    value: number | undefined,
    extra?: boolean,
  ): Frame | undefined;
  lintPinned(
    input: PinnedNode[],
    options: number | undefined,
    context: number | undefined,
    value: string | undefined,
  ): void;
  loneShareAfterDrops(
    items: HtmlElementNode[],
    options: HtmlElementNode[],
    items2: SlideNode[],
    value: "h" | "v",
    extra: boolean,
  ): void;
}
export interface SlideHtmlCompilerConstructor {
  new (
    fileMap: ReadonlyMap<string, string> | undefined,
    collectFiles: boolean,
    lists: ListRenderingMode | undefined,
  ): SlideHtmlCompilerInstance;
}
/** The options `compileSlideHtml` reads. */
export interface CompileSlideHtmlOptions {
  fileMap?: ReadonlyMap<string, string>;
  collectFiles?: boolean;
  lists?: unknown;
  /** The record key the first section takes as its slide id. */
  sectionId?: string;
}
/** The result of compiling a deck's HTML, with its diagnostic lists typed. */
export interface CompiledSlideHtml extends HtmlCompileResult {
  notes: CompileNote[];
  unsupported: CompileDiagnostic[];
  cellRemovals: number;
  lints: CompileDiagnostic[];
  files: HtmlFileReference[];
}
/** A table cell's padding and the cell it was read from. */
export interface TableCellPadding {
  cell: HtmlElementNode;
  x?: number;
  y?: number;
}
/** A node placed by its x and y position, with the element it was compiled from. */
export interface PinnedNode {
  node: SlideNode;
  el: HtmlElementNode;
  x: Axis;
  y: Axis;
  /** The slide itself rather than a node placed on it. */
  root?: true;
  /** The element the slide's content starts with, for the reading-order check. */
  lead?: HtmlElementNode;
}
/** A file the HTML points to that the build has to supply. */
export interface HtmlFileReference extends HtmlSourcePosition {
  ref: string;
  kind: "font" | "image";
}
/** An icon style problem held back until the slide is done, so equal ones are reported once. */
export interface QueuedIconWarning {
  p: HtmlSourcePosition;
  key: string;
  msg: string;
}
/** A warning that is reported once however many times it happens. */
export interface CompileNote extends CompileDiagnostic {
  key: string;
  count: number;
}

/** A node measured for the overlap, hidden-text and connector checks, in paint order `i`. */
export interface LintBox {
  i: number;
  el: HtmlElementNode;
  node: SlideNode;
  rect: RotatedBox;
  /** The node has text or other content to read. */
  text: boolean;
  painted: boolean;
  opaque: boolean;
  opacity: number;
  surface: string | undefined;
  border: number;
  skew: boolean;
  /** The axis-aligned footprint when it is exact, otherwise undefined. */
  aabb: PixelRect | undefined;
  bbox: PixelRect | undefined;
  /** Painted boxes of the layers inside an overlay. */
  kids: PixelRect[];
  filled: boolean;
  fillAlpha: number;
  blend: boolean;
  /** Large enough, or covering enough, to count as a background region rather than an object. */
  region: boolean;
}
/** A rule or connector as the points it passes through, in paint order `i`. */
export interface LintStroke {
  i: number;
  el: HtmlElementNode;
  pts: Point[];
  sw: number;
  conn: boolean;
  heads?: ConnectorArrowHeads;
  color?: SlideColor;
}
/** A node placed on the slide that is checked for reading order. */
export interface ReadingBox extends PixelRect {
  el: HtmlElementNode;
  estH: boolean;
  before: boolean;
}
/** Where the slide's own content starts: nodes that read before it must not sit below it. */
export interface ReadingLead {
  top: number;
  x0: number;
  x1: number;
  lead: HtmlElementNode;
}
/** The longest stretch where a stroke runs along or through a box, and the leg it is on. */
export interface StrokeContact {
  run: number;
  leg: number;
  touchRun: number;
  touches?: "start" | "end";
}
/** A stroke running along the edge of a box. */
export interface EdgeContact {
  run: number;
  leg: number;
  side: CssBoxSide;
  head: boolean;
  clear: number;
}
/** One contact between a stroke and a box: how far it runs, on which leg, and what it touches. */
export interface StrokeContactReport {
  run: number;
  leg: number;
  legs: number;
  o: LintBox;
  ln: LintStroke;
  touchRun?: number;
  touches?: "start" | "end";
  under?: boolean;
  side?: CssBoxSide;
  head?: boolean;
  clear?: number;
}
/** The strongest contact found for a key and how many there were. */
export interface StrokeContactGroup {
  best: StrokeContactReport;
  n: number;
  head: boolean;
}

/** A grid track read without knowing which of its kinds it is. */
export type GridTrackProbe = "auto" | { fr?: number; px?: number };

/** The text properties an element inherits from the ones around it. */
export interface InheritedTextStyle {
  fontFamily?: FontFamilyValue;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: FontStyleValue;
  lineHeight?: number;
  letterSpacing?: number;
  color?: string;
  textAlign?: TextAlignValue;
  textTransform?: TextTransformValue;
  noWrap?: boolean;
}
/** The kind of box a style applies to, which decides the properties that are allowed. */
export type StyleTargetKind =
  | "text"
  | "img"
  | "icon"
  | "stack"
  | "table"
  | "shape"
  | "spacer";

declare module "../bindings" {
  interface RuntimeBindings {
    HtmlSourceCursor: HtmlSourceCursorConstructor;
    slideHtmlPrefixPattern: RegExp;
    htmlVoidElementNames: Set<string>;
    htmlRawTextElementNames: Set<string>;
    htmlBlockElementNames: Set<string>;
    htmlOptionalClosingElementNames: Set<string>;
    htmlNamedEntities: Record<string, string>;
    HtmlParseError: HtmlParseErrorConstructor;
    cssBoxSideNames: CssBoxSide[];
    cssBorderSideWidthFields: Record<CssBoxSide, BorderSideWidthField>;
    containerPaddingBounds: LengthBounds;
    slideBoxShadowBounds: ShadowBounds;
    shapeStrokeBounds: LengthBounds;
    diagnosticCssPropertyNames: Record<string, string>;
    diagnosticCssPropertyName: (property: string) => string;
    diagnosticHtmlTagLabel: (subject: object) => string;
    connectorAttributeNames: Set<string>;
    videoAttributeNames: Set<string>;
    imageVideoAttributeNames: Set<string>;
    blockTextElementNames: Set<string>;
    cssAlignmentMap: Record<string, ContainerAlignment>;
    cssJustificationMap: Record<string, Justification>;
    genericFontFallbackKinds: Record<string, FontFamilyFallback>;
    webSafeFontAliases: Record<string, WebSafeFontAlias>;
    webSafeFallbackFaces: Record<FontFamilyFallback, string>;
    specialGenericFontFaces: Record<string, string>;
    supportedSlideHtmlElementNames: Set<string>;
    supportedInlineElementNames: Set<string>;
    inlineFormatElementNames: Set<string>;
    flattenableInlineElementNames: Set<string>;
    unsafeSvgMarkupRules: SvgMarkupRule[];
    unsupportedSvgAnimationRules: SvgMarkupRule[];
    nonRenderingSvgElementNames: Set<string>;
    forbiddenSvgElementNames: Set<string>;
    svgExternalResourceAttributes: Set<string>;
    svgTagTokenPattern: (lenient: boolean) => RegExp;
    svgAttributeTokenPattern: (lenient: boolean) => RegExp;
    svgNamespace: string;
    xlinkNamespace: string;
    htmlWindows1252CodePoints: Record<number, number>;
    isInvalidXmlCodePoint: (codePoint: number) => boolean;
    htmlCompilerCounters: { fillWalks: number; commentScans: number };
    inheritedInlineStyles: WeakMap<HtmlElementNode, string>;
    elementInlineStyle: (element: HtmlElementNode) => string | undefined;
    compileWarningCodes: Array<[pattern: RegExp, code: string]>;
    estimatedGlyphWidthFactor: number;
    estimatedLongWordWidthFactor: number;
    importedHtmlTypeScale: Record<"h1" | "h2" | "h3" | "p", ImportedTypeScaleEntry>;
    htmlHeadingNames: Set<string>;
    slideHtmlIconNames: string[];
    mediaHtmlElementNames: Set<string>;
    iconPlaceholderLabel: (name: string) => string;
    genericIconPlaceholderLabel: string;
    elementPlaceholderLabel: (element: HtmlElementNode) => string;
    neutralHtmlShadowPresets: Record<ShadowPresetName, HtmlShadowPreset>;
    htmlTagTextRoles: Record<string, TextRole>;
    simpleCssColorSource: string;
    transparentContainerBorderPattern: RegExp;
    noBorderPattern: RegExp;
    transparentContainerFillPattern: RegExp;
    transparentContainerStylePatterns: Map<string, RegExp>;
    fontFaceRulesPattern: RegExp;
    SlideHtmlCompiler: SlideHtmlCompilerConstructor;
    looksLikeSlideHtml: (html: unknown) => html is string;
    decodeHtmlEntities: (text: string) => string;
    parseHtmlTag: (cursor: HtmlSourceCursorInstance, svgMode?: boolean) => HtmlTag;
    parseSlideHtmlTree: (html: string, fragment?: boolean, baseLine?: number, baseColumn?: number) => HtmlTreeNode[];
    recoverSectionTrees: (html: string, reportError2: (error: HtmlParseErrorInstance) => void) => HtmlTreeNode[];
    slideStylePropertySchema: (property: StylePropertyName) => NumericSchema;
    connectorHasExplicitEndpoints: (element: HtmlElementNode) => boolean;
    clampShapeOutlineWidth: (border?: CssBorder) => number;
    ownRecordValue: <T>(record: Record<string, T>, key: string) => T | undefined;
    resolveFontFamilyAlias: (family: string) => FontFamilyChoice | undefined;
    resolveBasicFontFamily: (family: string) => string | undefined;
    webSafeFontFallback: (font: FontFamilyFallback | CustomFontFamilyValue) => FontFamilyChoice;
    stripHtmlMarkup: (html: string) => string;
    utf8ToBase64: (text: string) => string;
    parseSvgDimensions: (svg: string) => SvgRoot | undefined;
    decodeCssEscapes: (css: string) => string;
    sanitizeSvgXmlText: (text: string, inAttribute: Set<string>) => string;
    sanitizeSvgMarkup: (svg: string, report: ReadonlySet<string>) => SanitizedSvgMarkup;
    validateSvgMarkup: (svg: string, allowAnimation?: boolean) => string | undefined;
    decodeSvgDataUrl: (src: string) => string | undefined;
    parseInlineStyleUnchecked: (style: string | undefined) => ParsedCssDeclaration[];
    inlineStyleSuppressesFlowLayout: (style: string | undefined) => boolean;
    inlineStyleHasPercentSize: (style: string | undefined, axis: "width" | "height") => boolean;
    nodeHasExplicitAxisSize: (node: SlideNode, axis: "x" | "y") => boolean;
    inheritedContainerStretchSources: (grid: boolean, node: FlowContainerAlignment) => StretchSources | undefined;
    nonStretchAxisExplanation: (context: Pick<HtmlNodeContext, "parentGrid" | "parentAlign">, dimension: "width" | "height", alignSelf: string | undefined, justifySelf: string | undefined) => string | undefined;
    inlineStyleHasUnsafeSizing: (style: string | undefined, dimension: "width" | "height") => boolean;
    inlineStyleHasUnsafeBackground: (style: string | undefined) => boolean;
    parseInlineStyle: (css: string | undefined, warn: HtmlDiagnosticReporter, drop: HtmlDiagnosticReporter, box?: InlineStyleBoxState, fontSize?: number) => ParsedInlineStyle;
    resolveEmListPadding: (declarations: ParsedCssDeclaration[], getFontSize: () => number, warn: HtmlDiagnosticReporter) => ParsedCssDeclaration[];
    nodeFontSize: (node: SlideNode) => number;
    nodeLineHeight: (node: SlideNode) => number;
    nodePaddingSize: (node: SlideNode) => PaddingSize;
    nodeHasVisibleContent: (node: SlideNode) => boolean;
    estimateTableHeight: (table: TableNode, width: number) => number;
    estimateTextUnwrappedWidth: (node: TextNode) => number;
    estimateLongestWordWidth: (node: TextNode) => LongestWord;
    estimateNodeHeight: (node: SlideNode, width: number) => number | undefined;
    explicitNodeWidth: (node: SlideNode) => number | undefined;
    resolveHtmlAxisPlacement: (axis: Axis, designSize?: number) => AxisPlacement | undefined;
    rotatedBox: (x: number, y: number, width: number, height: number, centerX: number, centerY: number, rotation: number) => RotatedBox;
    pointInRotatedBoxCoordinates: (box: RotatedBox, point: Point) => Point;
    segmentIntersectsRotatedBox: (box: RotatedBox, padding: number, start: Point, end: Point) => [number, number] | undefined;
    rotatedBoxesOverlap: (box: RotatedBox, otherBox: RotatedBox) => number;
    estimateTextBounds: (node: TextNode, width: number, height: number) => PixelRect;
    iconStyleWarnings: (node: IconNode, parentPainted?: boolean) => IconStyleWarning[];
    hasLowOpaqueContrast: (foreground: string | undefined, background: string | undefined, opacity?: number, minimumRatio?: number) => boolean;
    parseHexColorChannels: (color: string | undefined) => HexColorChannels | undefined;
    hexContrastRatio: (foreground: string | undefined, background: string | undefined, opacity?: number) => number | undefined;
    compositeHexColor: (foreground: string | undefined, background?: string) => string | undefined;
    contrastingTextColor: (background: string | undefined) => string;
    collectSlidePaintLayers: (slide: Frame[]) => SlidePaintLayers;
    nodePaintsVisibleContent: (node: NodeProbe) => boolean;
    backgroundChangePreservesContrast: (paints: SlidePaintLayers, previousBackground: string, background: string) => boolean;
    hexColorAlpha: (color: string | undefined) => number;
    combineNestedAxisSpecs: (outerAxis: Axis, innerAxis: Axis) => Axis | "outer" | "inner";
    inlineStyleIsAbsolute: (css: string | undefined) => boolean;
    unwrapTransparentContainer: (element: HtmlElementNode, node: ParsedInlineStyle, context: HtmlNodeContext) => number | undefined;
    migrateThinBorderToFill: (node: ShapeNode, style: StyleBag, placement: NodePlacement, context: HtmlNodeContext, thickness: number) => void;
    parseInlineTextTree: (element: InlineRun[]) => ParsedInlineText;
    stripCssComments: (css: string) => string;
    parseFontFaceRules: (css: string, warn: SlideHtmlCompilerInstance, report: HtmlSourcePosition) => void;
    parseHtmlHead: (head: HtmlElementNode, compiler: SlideHtmlCompilerInstance) => ParsedHtmlHead;
    deterministicEmbedId: (html: string, index: number) => string;
    compileHtmlSection: (section: HtmlElementNode, compiler: SlideHtmlCompilerInstance, theme: InheritedTextStyle, index: number, assets: Set<string>, previousSlide: string | undefined) => Slide;
    normalizeVideoIframes: (elements: HtmlTreeNode[]) => void;
    compileSlideHtml: (html: string, options?: CompileSlideHtmlOptions) => CompiledSlideHtml;
    formatCompileDiagnostic: (diagnostic: CompileDiagnostic | undefined) => string;
    initializeHtmlCompiler: () => void;
  }
}

export function installCompilerHtml(runtime: RuntimeBindings): () => void {
  var HtmlSourceCursor: RuntimeBindings["HtmlSourceCursor"];
  var SlideHtmlCompiler: SlideHtmlCompilerConstructor;
  var slideHtmlPrefixPattern: RuntimeBindings["slideHtmlPrefixPattern"];
  var htmlVoidElementNames: RuntimeBindings["htmlVoidElementNames"];
  var htmlRawTextElementNames: RuntimeBindings["htmlRawTextElementNames"];
  var htmlBlockElementNames: RuntimeBindings["htmlBlockElementNames"];
  var htmlOptionalClosingElementNames: RuntimeBindings["htmlOptionalClosingElementNames"];
  var htmlNamedEntities: RuntimeBindings["htmlNamedEntities"];
  var HtmlParseError: RuntimeBindings["HtmlParseError"];
  var cssBoxSideNames: RuntimeBindings["cssBoxSideNames"];
  var cssBorderSideWidthFields: RuntimeBindings["cssBorderSideWidthFields"];
  var containerPaddingBounds: RuntimeBindings["containerPaddingBounds"];
  var slideBoxShadowBounds: RuntimeBindings["slideBoxShadowBounds"];
  var shapeStrokeBounds: RuntimeBindings["shapeStrokeBounds"];
  var diagnosticCssPropertyNames: RuntimeBindings["diagnosticCssPropertyNames"];
  var diagnosticCssPropertyName: RuntimeBindings["diagnosticCssPropertyName"];
  var diagnosticHtmlTagLabel: RuntimeBindings["diagnosticHtmlTagLabel"];
  var connectorAttributeNames: RuntimeBindings["connectorAttributeNames"];
  var videoAttributeNames: RuntimeBindings["videoAttributeNames"];
  var imageVideoAttributeNames: RuntimeBindings["imageVideoAttributeNames"];
  var blockTextElementNames: RuntimeBindings["blockTextElementNames"];
  var cssAlignmentMap: RuntimeBindings["cssAlignmentMap"];
  var cssJustificationMap: RuntimeBindings["cssJustificationMap"];
  var genericFontFallbackKinds: RuntimeBindings["genericFontFallbackKinds"];
  var webSafeFontAliases: RuntimeBindings["webSafeFontAliases"];
  var webSafeFallbackFaces: RuntimeBindings["webSafeFallbackFaces"];
  var specialGenericFontFaces: RuntimeBindings["specialGenericFontFaces"];
  var supportedSlideHtmlElementNames: RuntimeBindings["supportedSlideHtmlElementNames"];
  var supportedInlineElementNames: RuntimeBindings["supportedInlineElementNames"];
  var inlineFormatElementNames: RuntimeBindings["inlineFormatElementNames"];
  var flattenableInlineElementNames: RuntimeBindings["flattenableInlineElementNames"];
  var unsafeSvgMarkupRules: RuntimeBindings["unsafeSvgMarkupRules"];
  var unsupportedSvgAnimationRules: RuntimeBindings["unsupportedSvgAnimationRules"];
  var nonRenderingSvgElementNames: RuntimeBindings["nonRenderingSvgElementNames"];
  var forbiddenSvgElementNames: RuntimeBindings["forbiddenSvgElementNames"];
  var svgExternalResourceAttributes: RuntimeBindings["svgExternalResourceAttributes"];
  var svgTagTokenPattern: RuntimeBindings["svgTagTokenPattern"];
  var svgAttributeTokenPattern: RuntimeBindings["svgAttributeTokenPattern"];
  var svgNamespace: RuntimeBindings["svgNamespace"];
  var xlinkNamespace: RuntimeBindings["xlinkNamespace"];
  var htmlWindows1252CodePoints: RuntimeBindings["htmlWindows1252CodePoints"];
  var isInvalidXmlCodePoint: RuntimeBindings["isInvalidXmlCodePoint"];
  var htmlCompilerCounters: RuntimeBindings["htmlCompilerCounters"];
  var inheritedInlineStyles: RuntimeBindings["inheritedInlineStyles"];
  var elementInlineStyle: RuntimeBindings["elementInlineStyle"];
  var compileWarningCodes: RuntimeBindings["compileWarningCodes"];
  var estimatedGlyphWidthFactor: RuntimeBindings["estimatedGlyphWidthFactor"];
  var estimatedLongWordWidthFactor: RuntimeBindings["estimatedLongWordWidthFactor"];
  var importedHtmlTypeScale: RuntimeBindings["importedHtmlTypeScale"];
  var htmlHeadingNames: RuntimeBindings["htmlHeadingNames"];
  var slideHtmlIconNames: RuntimeBindings["slideHtmlIconNames"];
  var mediaHtmlElementNames: RuntimeBindings["mediaHtmlElementNames"];
  var iconPlaceholderLabel: RuntimeBindings["iconPlaceholderLabel"];
  var genericIconPlaceholderLabel: RuntimeBindings["genericIconPlaceholderLabel"];
  var elementPlaceholderLabel: RuntimeBindings["elementPlaceholderLabel"];
  var neutralHtmlShadowPresets: RuntimeBindings["neutralHtmlShadowPresets"];
  var htmlTagTextRoles: RuntimeBindings["htmlTagTextRoles"];
  var simpleCssColorSource: RuntimeBindings["simpleCssColorSource"];
  var transparentContainerBorderPattern: RuntimeBindings["transparentContainerBorderPattern"];
  var noBorderPattern: RuntimeBindings["noBorderPattern"];
  var transparentContainerFillPattern: RuntimeBindings["transparentContainerFillPattern"];
  var transparentContainerStylePatterns: RuntimeBindings["transparentContainerStylePatterns"];
  var fontFaceRulesPattern: RuntimeBindings["fontFaceRulesPattern"];
  var initializeHtmlCompiler: RuntimeBindings["initializeHtmlCompiler"];
  function looksLikeSlideHtml(html: unknown): html is string {
    return typeof html === "string" && slideHtmlPrefixPattern.test(html);
  }
  function decodeHtmlEntities(text: string): string {
    if (text.indexOf("&") < 0) {
      return text;
    }
    return text.replace(
      /&(#x[0-9a-f]+|#\d+|[a-zA-Z][a-zA-Z0-9]{1,31});?/gi,
      (input: string, options: string): string => {
        if (options[0] === "#") {
          let value = options[1] === "x" || options[1] === "X",
            value2 = parseInt(
              options.slice(value ? 2 : 1),
              value ? 16 : 10,
            );
          if (
            !Number.isFinite(value2) ||
            value2 > 1114111 ||
            (value2 >= 55296 && value2 <= 57343)
          ) {
            return String.fromCharCode(65533);
          }
          if (value2 === 0) {
            return String.fromCharCode(65533);
          }
          return String.fromCodePoint(value2);
        }
        if (!input.endsWith(";")) {
          return input;
        }
        if (Object.hasOwn(htmlNamedEntities, options)) {
          return htmlNamedEntities[options]!;
        } else {
          return input;
        }
      },
    );
  }
  function parseHtmlTag(cursor: HtmlSourceCursorInstance, svgMode = false): HtmlTag {
    let pos = cursor.pos,
      { line: value, col: value2 } = cursor.lineCol(pos),
      src = cursor.src;
    cursor.pos++;
    let flag = false;
    if (src[cursor.pos] === "/") {
      flag = true;
      cursor.pos++;
    }
    let value3 = /^[a-zA-Z][\w:-]*/.exec(
      src.slice(cursor.pos, cursor.pos + 64),
    );
    if (!value3) {
      cursor.fail("malformed tag", pos);
    }
    let value4 = value3[0].toLowerCase();
    cursor.pos += value3[0].length;
    let value5: HtmlAttributes = Object.create(null);
    for (;;) {
      while (cursor.pos < src.length && /\s/.test(src[cursor.pos]!))
        cursor.pos++;
      let value6 = src[cursor.pos];
      if (value6 === undefined) {
        cursor.fail("unclosed tag <" + value4 + ">", pos);
      }
      if (value6 === ">") {
        cursor.pos++;
        return {
          name: value4,
          attrs: value5,
          selfClosing: false,
          closing: flag,
          line: value,
          col: value2,
        };
      }
      if (value6 === "/" && src[cursor.pos + 1] === ">") {
        cursor.pos += 2;
        return {
          name: value4,
          attrs: value5,
          selfClosing: true,
          closing: flag,
          line: value,
          col: value2,
        };
      }
      if (flag) {
        cursor.fail(
          "closing tag </" + value4 + "> cannot have attributes",
          pos,
        );
      }
      let value7 =
        /^([^\s"'>\/=]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\`]+)))?/.exec(
          src.slice(cursor.pos),
        );
      if (!value7 || value7[0].length === 0) {
        cursor.fail("malformed attribute in <" + value4 + ">", cursor.pos);
      }
      let value8 = svgMode ? value7[1]! : value7[1]!.toLowerCase(),
        value9 = value7[2] ?? value7[3] ?? value7[4] ?? "";
      if (/^[a-z][\w:-]*$/.test(value8) && !Object.hasOwn(value5, value8)) {
        value5[value8] = decodeHtmlEntities(value9);
      }
      cursor.pos += value7[0].length;
    }
  }
  function parseSlideHtmlTree(
    html: string,
    fragment = false,
    baseLine = 0,
    baseColumn = 0,
  ): HtmlTreeNode[] {
    let cursor: HtmlSourceCursorInstance = new HtmlSourceCursor(html, baseLine, baseColumn),
      root: HtmlElementNode = {
        kind: "el",
        tag: "#root",
        attrs: Object.create(null),
        children: [],
        line: 1,
        col: 1,
      },
      stack: HtmlElementNode[] = [root],
      currentElement = (): HtmlElementNode => stack[stack.length - 1]!,
      value = html,
      index = 0,
      callback = (input: number): void => {
        if (input <= index) {
          return;
        }
        let value2 = value.slice(index, input);
        if (
          value2.trim() === "" &&
          !/[\u00a0]/.test(value2) &&
          currentElement().tag !== "p" &&
          currentElement().tag !== "li" &&
          currentElement().tag !== "td" &&
          currentElement().tag !== "th" &&
          currentElement().tag !== "span" &&
          currentElement().tag !== "a" &&
          currentElement().tag !== "b" &&
          currentElement().tag !== "i" &&
          currentElement().tag !== "u" &&
          currentElement().tag !== "strong" &&
          currentElement().tag !== "em" &&
          !/^h[1-6]$/.test(currentElement().tag)
        ) {
          return;
        }
        let { line: value3, col: value4 } = cursor.lineCol(index);
        currentElement().children.push({
          kind: "text",
          text: decodeHtmlEntities(value2),
          line: value3,
          col: value4,
        });
      },
      callback2 = (input: number): void => {
        while (stack.length - 1 > input) {
          let value2: HtmlElementNode = stack.pop()!;
          if (!htmlOptionalClosingElementNames.has(value2.tag)) {
            cursor.fail(
              "<" +
                value2.tag +
                "> opened at " +
                String(value2.line) +
                ":" +
                String(value2.col) +
                " was never closed",
              cursor.pos,
            );
          }
          value2.implied = true;
        }
      };
    while (cursor.pos < value.length) {
      let value2 = value.indexOf("<", cursor.pos);
      if (value2 < 0) {
        callback(value.length);
        cursor.pos = value.length;
        break;
      }
      if (value2 > cursor.pos) {
        callback(value2);
        cursor.pos = value2;
        index = value2;
      }
      if (value.startsWith("<\!--", cursor.pos)) {
        let value4 = value.indexOf("-->", cursor.pos + 4);
        if (value4 < 0) {
          cursor.fail("unclosed comment");
        }
        cursor.pos = value4 + 3;
        index = cursor.pos;
        continue;
      }
      if (
        value.startsWith("<!", cursor.pos) ||
        value.startsWith("<?", cursor.pos)
      ) {
        let value4 = value.indexOf(">", cursor.pos);
        if (value4 < 0) {
          cursor.fail("malformed <! declaration");
        }
        cursor.pos = value4 + 1;
        index = cursor.pos;
        continue;
      }
      if (!/[a-zA-Z\/]/.test(value[cursor.pos + 1] ?? "")) {
        cursor.pos++;
        continue;
      }
      let value3 = parseHtmlTag(cursor);
      index = cursor.pos;
      if (value3.closing) {
        let value4 = -1;
        for (let value5 = stack.length - 1; value5 > 0; value5--)
          if (stack[value5]!.tag === value3.name) {
            value4 = value5;
            break;
          }
        if (value4 < 0) {
          if (
            htmlVoidElementNames.has(value3.name) ||
            htmlOptionalClosingElementNames.has(value3.name) ||
            value3.name === "body" ||
            value3.name === "html" ||
            value3.name === "head"
          ) {
            continue;
          }
          cursor.fail(
            "stray closing tag </" + value3.name + "> (nothing open to close)",
            value2,
          );
        }
        callback2(value4);
        stack.pop();
        continue;
      }
      if (
        value3.name === "li" ||
        value3.name === "td" ||
        value3.name === "th" ||
        value3.name === "tr" ||
        value3.name === "p" ||
        htmlBlockElementNames.has(value3.name)
      ) {
        for (let value4 = stack.length - 1; value4 > 0; value4--) {
          let tag = stack[value4]!.tag;
          if (
            (tag === "p" && htmlBlockElementNames.has(value3.name)) ||
            (tag === "li" && value3.name === "li") ||
            ((tag === "td" || tag === "th") &&
              (value3.name === "td" ||
                value3.name === "th" ||
                value3.name === "tr")) ||
            (tag === "tr" && value3.name === "tr")
          ) {
            callback2(value4 - 1);
            break;
          }
          if (
            tag === "ul" ||
            tag === "ol" ||
            tag === "table" ||
            tag === "div" ||
            tag === "section"
          ) {
            break;
          }
        }
      }
      let state: HtmlElementNode = {
        kind: "el",
        tag: value3.name,
        attrs: value3.attrs,
        children: [],
        line: value3.line,
        col: value3.col,
      };
      currentElement().children.push(state);
      if (htmlVoidElementNames.has(value3.name) || value3.selfClosing) {
        continue;
      }
      if (value3.name === "svg") {
        let value4 = /<svg\b|<\/svg\s*>/gi;
        value4.lastIndex = cursor.pos;
        let count = 1,
          value5 = -1,
          value6: RegExpExecArray | null;
        while ((value6 = value4.exec(value)) !== null)
          if (value6[0][1] === "/") {
            count--;
            if (count === 0) {
              value5 = value6.index + value6[0].length;
              break;
            }
          } else {
            count++;
          }
        if (value5 < 0) {
          cursor.fail("unclosed <svg>", value2);
        }
        state.source = value.slice(value2, value5);
        cursor.pos = value5;
        index = cursor.pos;
        continue;
      }
      if (htmlRawTextElementNames.has(value3.name)) {
        let value4 = new RegExp(
          "</" + value3.name + "\\s*>",
          "i",
        ).exec(value.slice(cursor.pos));
        if (value4 === null) {
          cursor.fail("unclosed <" + value3.name + ">", value2);
        }
        let value5 = value.slice(
            cursor.pos,
            cursor.pos + value4.index,
          ),
          { line: value6, col: value7 } = cursor.lineCol(cursor.pos);
        state.children.push({
          kind: "text",
          text:
            value3.name === "title" || value3.name === "textarea"
              ? decodeHtmlEntities(value5)
              : value5,
          line: value6,
          col: value7,
        });
        cursor.pos += value4.index + value4[0].length;
        index = cursor.pos;
        continue;
      }
      stack.push(state);
    }
    callback(value.length);
    while (stack.length > 1) {
      let value2: HtmlElementNode = stack.pop()!;
      if (fragment && value2.tag === "section") {
        continue;
      }
      if (
        !htmlOptionalClosingElementNames.has(value2.tag) &&
        value2.tag !== "html" &&
        value2.tag !== "body" &&
        value2.tag !== "head"
      ) {
        cursor.fail(
          "<" +
            value2.tag +
            "> opened at " +
            String(value2.line) +
            ":" +
            String(value2.col) +
            " was never closed",
          value.length,
        );
      }
    }
    return root.children;
  }
  function recoverSectionTrees(
    html: string,
    reportError2: (error: HtmlParseErrorInstance) => void,
  ): HtmlTreeNode[] {
    let sectionOffsets: number[] = [],
      sectionPattern = /<section\b/gi,
      match: RegExpExecArray | null;
    while ((match = sectionPattern.exec(html)) !== null)
      sectionOffsets.push(match.index);
    if (sectionOffsets.length === 0) {
      return [];
    }
    let sections: HtmlTreeNode[] = [],
      ranges: Array<[start: number, end: number]> = [[0, sectionOffsets[0]!]];
    for (let index = 0; index < sectionOffsets.length; index++)
      ranges.push([
        sectionOffsets[index]!,
        sectionOffsets[index + 1] ?? html.length,
      ]);
    for (let [value, value2] of ranges) {
      let value3 = html.slice(value, value2);
      if (value3.trim() === "") {
        continue;
      }
      let length = (html.slice(0, value).match(/\n/g) ?? []).length,
        value4 =
          value -
          (html.lastIndexOf(
            `
`,
            value - 1,
          ) +
            1);
      try {
        sections.push(...parseSlideHtmlTree(value3, true, length, value4));
      } catch (value5: unknown) {
        if (!(value5 instanceof HtmlParseError)) {
          throw value5;
        }
        reportError2(value5);
      }
    }
    return sections;
  }
  function slideStylePropertySchema(property: StylePropertyName): NumericSchema {
    let value = runtime.stylePropertyRegistry[property];
    return (value.slidesValue ?? value.value) as NumericSchema;
  }
  function connectorHasExplicitEndpoints(element: HtmlElementNode): boolean {
    return ["x1", "y1", "x2", "y2"].some(
      (input) => element.attrs[input] !== undefined,
    );
  }
  function clampShapeOutlineWidth(border?: CssBorder): number {
    let value =
      border !== undefined && border.style !== "none"
        ? border.width
        : undefined;
    if (value === undefined || value <= 0) {
      return runtime.defaultShapeStrokeWidth;
    } else {
      return Math.min(runtime.maxShapeStrokeWidth, Math.max(1, value));
    }
  }
  function ownRecordValue<T>(record: Record<string, T>, key: string): T | undefined {
    if (Object.hasOwn(record, key)) {
      return record[key];
    } else {
      return undefined;
    }
  }
  function resolveFontFamilyAlias(family: string): FontFamilyChoice | undefined {
    let value = ownRecordValue(
      webSafeFontAliases,
      family.toLowerCase(),
    );
    if (value === undefined) {
      return undefined;
    } else {
      return {
        family: value.family,
        fallback: value.fallback,
      };
    }
  }
  function resolveBasicFontFamily(family: string): string | undefined {
    let value = ownRecordValue(
      webSafeFontAliases,
      family.toLowerCase(),
    );
    if (value?.basic === true) {
      return value.family;
    } else {
      return undefined;
    }
  }
  function webSafeFontFallback(font: FontFamilyFallback | CustomFontFamilyValue): FontFamilyChoice {
    if (typeof font === "string") {
      return {
        family: webSafeFallbackFaces[font],
        fallback: font,
      };
    }
    return {
      family:
        (font.webSafe !== undefined
          ? resolveBasicFontFamily(font.webSafe)
          : undefined) ??
        resolveBasicFontFamily(font.family) ??
        webSafeFallbackFaces[font.fallback],
      fallback: font.fallback,
    };
  }
  function stripHtmlMarkup(html: string): string {
    let text = "",
      position = 0;
    for (;;) {
      let value = html.indexOf("<", position);
      if (value < 0) {
        return text + html.slice(position);
      }
      text += html.slice(position, value);
      let value2 = -1,
        text2 = "";
      if (html.startsWith("<\!--", value)) {
        value2 =
          html.indexOf("-->", value + 4) < 0
            ? -1
            : html.indexOf("-->", value + 4) + 3;
      } else if (html.startsWith("<![CDATA[", value)) {
        let value3 = html.indexOf("]]>", value + 9);
        if (value3 >= 0) {
          text2 = html
            .slice(value + 9, value3)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          value2 = value3 + 3;
        }
      } else if (/^<\?xml[\s?]/i.test(html.slice(value, value + 6))) {
        value2 =
          html.indexOf("?>", value + 2) < 0
            ? -1
            : html.indexOf("?>", value + 2) + 2;
      } else if (/^<!DOCTYPE/i.test(html.slice(value, value + 9))) {
        let value3 = html.indexOf(">", value);
        if (value3 >= 0 && !html.slice(value, value3).includes("[")) {
          value2 = value3 + 1;
        }
      } else {
        text += "<";
        position = value + 1;
        continue;
      }
      if (value2 < 0) {
        return text + html.slice(value);
      }
      text += text2;
      position = value2;
    }
  }
  function utf8ToBase64(text: string): string {
    let bytes = new TextEncoder().encode(text),
      binary = "";
    for (let index = 0; index < bytes.length; index += 32768)
      binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    return btoa(binary);
  }
  function parseSvgDimensions(svg: string): SvgRoot | undefined {
    try {
      let value: HtmlSourceCursorInstance = new HtmlSourceCursor(svg);
      value.pos = svg.indexOf("<");
      if (value.pos < 0) {
        return;
      }
      let value2 = parseHtmlTag(value, true);
      if (value2.name !== "svg" || value2.closing) {
        return;
      }
      let value3 = -1;
      for (let value4 of svg.matchAll(/<\/svg\b/gi))
        value3 = value4.index;
      if (value3 < value.pos) {
        return;
      }
      return {
        attrs: value2.attrs,
        inner: svg.slice(value.pos, value3),
      };
    } catch {
      return;
    }
  }
  function decodeCssEscapes(css: string): string {
    if (css.indexOf("\\") < 0) {
      return css;
    }
    return css.replace(
      /\\([0-9a-fA-F]{1,6})\s?|\\(.)/g,
      (input: string, options: string | undefined, context: string | undefined): string => {
        if (options !== undefined) {
          let value = parseInt(options, 16);
          if (
            value > 0 &&
            value <= 1114111 &&
            !(value >= 55296 && value <= 57343)
          ) {
            return String.fromCodePoint(value);
          } else {
            return String.fromCharCode(65533);
          }
        }
        return context ?? "";
      },
    );
  }
  function sanitizeSvgXmlText(text: string, inAttribute: Set<string>): string {
    if (
      !/[&\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|\]\]>/.test(text)
    ) {
      return text;
    }
    return text.replace(
      /&(#[xX][0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]{0,31})?(;?)|\]\]>|[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,
      (input: string, options: string | undefined, context: string | undefined): string => {
        if (input === "]]>") {
          inAttribute.add('"]]>" in text');
          return "]]&gt;";
        }
        if (input[0] !== "&") {
          inAttribute.add("a character XML forbids");
          return String.fromCharCode(65533);
        }
        if (options === undefined) {
          inAttribute.add("a bare &");
          return "&amp;" + (context ?? "");
        }
        if (options[0] === "#") {
          let value = options[1] === "x" || options[1] === "X",
            value2 = parseInt(
              options.slice(value ? 2 : 1),
              value ? 16 : 10,
            ),
            value3 =
              !Number.isFinite(value2) ||
              value2 === 0 ||
              isInvalidXmlCodePoint(value2)
                ? 65533
                : (htmlWindows1252CodePoints[value2] ?? value2),
            value4 =
              value3 !== value2
                ? "&#" + String(value3) + ";"
                : "&" +
                  (options[1] === "X" ? "#x" + options.slice(2) : options) +
                  ";";
          if (value4 !== input) {
            inAttribute.add(
              value3 === 65533
                ? "a numeric reference XML cannot hold"
                : value3 !== value2
                  ? "a numeric reference a page reads as another character (&#" +
                    String(value2) +
                    ";)"
                  : "a numeric reference not written as XML writes it",
            );
          }
          return value4;
        }
        if (context !== ";") {
          inAttribute.add(
            "&" + options + " without its semicolon (kept as those letters)",
          );
          return "&amp;" + options;
        }
        if (
          options === "amp" ||
          options === "lt" ||
          options === "gt" ||
          options === "quot" ||
          options === "apos"
        ) {
          return input;
        }
        if (Object.hasOwn(htmlNamedEntities, options)) {
          inAttribute.add("&" + options + ";");
          return [...htmlNamedEntities[options]!]
            .map(
              (input2: string): string =>
                "&#" + String(input2.codePointAt(0)) + ";",
            )
            .join("");
        }
        inAttribute.add("a bare &");
        return "&amp;" + options + ";";
      },
    );
  }
  function sanitizeSvgMarkup(svg: string, report: ReadonlySet<string>): SanitizedSvgMarkup {
    let values: Set<string> = new Set(),
      items: string[] = [],
      items2: SvgOpenElement[] = [],
      entries: Map<string, number> = new Map(),
      callback = (input: SvgOpenElement): void => {
        entries.set(input.lower, (entries.get(input.lower) ?? 1) - 1);
      },
      value = svgTagTokenPattern(true),
      value2 = /^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/,
      text = "",
      index = 0;
    for (;;) {
      let value3 = svg.indexOf("<", index);
      text += sanitizeSvgXmlText(
        svg.slice(index, value3 < 0 ? svg.length : value3),
        values,
      );
      if (value3 < 0) {
        break;
      }
      value.lastIndex = value3;
      let value4 = value.exec(svg);
      if (value4 === null) {
        text += svg.slice(value3);
        break;
      }
      index = value3 + value4[0].length;
      let value5 = value4[2]!,
        value6 =
          items2.length > 0 ? items2[items2.length - 1]!.prefixes : report;
      if (value4[1] === "/") {
        let value13 = value5.toLowerCase();
        if ((entries.get(value13) ?? 0) === 0) {
          values.add("a closing tag that closes nothing (left out)");
          continue;
        }
        let value14 = items2.length - 1;
        if (items2[value14]!.lower !== value13) {
          let value17 = value14;
          while (items2[value17]!.lower !== value13) value17--;
          items.push("<" + items2[value14]!.name + "> is never closed");
          for (let value18 of items2.splice(value17))
            callback(value18);
          text += value4[0];
          continue;
        }
        let value15 = items2.pop()!;
        callback(value15);
        let name = value15.name,
          value16 = "</" + name + ">";
        if (
          value4[0] !== value16 &&
          !/^<\/[^\s/>]+[ \t\r\n]*>$/.test(value4[0])
        ) {
          values.add("a closing tag that carries more than its name");
        }
        if (name !== value5) {
          values.add("a closing tag in another case than its opening tag");
        }
        text +=
          name === value5 && /^<\/[^\s/>]+[ \t\r\n]*>$/.test(value4[0])
            ? value4[0]
            : value16;
        continue;
      }
      let value7 = value6,
        values2: Set<string> = new Set(),
        value8 = svgAttributeTokenPattern(true),
        text2 = "",
        flag = false,
        value9: RegExpExecArray | null,
        entries2: Map<string, string> = new Map(),
        values3: Set<string> = new Set();
      while ((value9 = value8.exec(value4[3]!)) !== null) {
        let value13 = value9[2]!.toLowerCase(),
          entry = entries2.get(value13);
        if (
          entry === undefined ||
          (!/^[a-z]/.test(entry) && /^[a-z]/.test(value9[2]!))
        ) {
          entries2.set(value13, value9[2]!);
        }
      }
      value8.lastIndex = 0;
      while ((value9 = value8.exec(value4[3]!)) !== null) {
        let value13 = !values3.has(value9[2]!.toLowerCase());
        values3.add(value9[2]!.toLowerCase());
        if (
          value13 &&
          value9[2]!.startsWith("xmlns:") &&
          value9[2] !== "xmlns:xmlns" &&
          (value9[3] ?? value9[4] ?? value9[5] ?? "") !== "" &&
          !value7.has(value9[2]!.slice(6))
        ) {
          value7 = new Set(value7).add(value9[2]!.slice(6));
        }
      }
      value8.lastIndex = 0;
      while ((value9 = value8.exec(value4[3]!)) !== null) {
        let value13 =
            entries2.get(value9[2]!.toLowerCase()) ?? value9[2]!,
          value14 = value9[3] ?? value9[4] ?? value9[5],
          callback2 = (input: string): void => {
            values.add(input);
            flag = true;
          };
        if (values2.has(value13.toLowerCase())) {
          callback2("an attribute written twice (the first is kept)");
          continue;
        }
        values2.add(value13.toLowerCase());
        let value15 = value13 !== value9[2];
        if (!value2.test(value13)) {
          callback2("an attribute name XML cannot read");
          continue;
        }
        if (
          value13 === "xmlns"
            ? value14 !== svgNamespace
            : value13.startsWith("xmlns:") &&
              ((value14 ?? "") === "" || value13 === "xmlns:xmlns")
        ) {
          callback2("a namespace an HTML page ignores");
          continue;
        }
        let value16 = value13.indexOf(":");
        if (
          value16 > 0 &&
          value13.slice(0, value16) !== "xmlns" &&
          !value7.has(value13.slice(0, value16))
        ) {
          callback2(
            "an attribute whose prefix is declared nowhere (" + value13 + ")",
          );
          continue;
        }
        let value17 = /^[ \t\r\n]+$/.test(value9[1]!),
          value18 =
            value14 === undefined ? "" : sanitizeSvgXmlText(value14, values);
        if (!value17) {
          values.add("a gap inside a tag that XML does not read as space");
        }
        if (value9[5] !== undefined) {
          values.add("an attribute value without quotes");
        }
        if (value14 === undefined) {
          values.add("an attribute with no value");
        }
        let value19 =
          value14 === undefined ||
          value9[5] !== undefined ||
          /^[ \t\r\n]+[^\s=]+[ \t\r\n]*=[ \t\r\n]*$/.test(
            value9[0].slice(0, value9[0].length - value14.length - 2),
          );
        if (!value19) {
          values.add("a gap inside a tag that XML does not read as space");
        }
        let value20 =
          value17 &&
          value19 &&
          !value15 &&
          value14 !== undefined &&
          value9[5] === undefined &&
          value18 === value14;
        if (!value20) {
          flag = true;
        }
        text2 += value20
          ? value9[0]
          : (value17 ? value9[1]! : " ") +
            value13 +
            "=" +
            (value9[4] !== undefined
              ? "'" + value18 + "'"
              : '"' + value18 + '"');
      }
      let value10 = value5.indexOf(":");
      if (
        !value2.test(value5) ||
        (value10 > 0 && !value7.has(value5.slice(0, value10)))
      ) {
        items.push("<" + value5 + "> has a prefix that is declared nowhere");
      }
      let value11 = svg.slice(
          value3 + 1 + value5.length + value4[3]!.length,
          index,
        ),
        value12 = /^[ \t\r\n]*\/?>$/.test(value11);
      if (!value12) {
        values.add("a gap inside a tag that XML does not read as space");
      }
      text +=
        flag || !value12
          ? "<" +
            value5 +
            text2 +
            (value12 ? value11 : value4[4] === "/" ? "/>" : ">")
          : value4[0];
      if (value4[4] !== "/") {
        items2.push({
          name: value5,
          lower: value5.toLowerCase(),
          prefixes: value7,
        });
        entries.set(
          value5.toLowerCase(),
          (entries.get(value5.toLowerCase()) ?? 0) + 1,
        );
      }
    }
    for (let value3 of items2.reverse())
      items.push("<" + value3.name + "> is never closed");
    return {
      xml: text,
      said: [...values],
      open: [...new Set(items)],
    };
  }
  function validateSvgMarkup(
    svg: string,
    allowAnimation = false,
  ): string | undefined {
    let value = decodeHtmlEntities(svg);
    for (let value5 of [value, decodeCssEscapes(value)]) {
      let value6 =
        unsafeSvgMarkupRules.find(
          ([input]) => input.test(value5),
        ) ??
        (allowAnimation
          ? undefined
          : unsupportedSvgAnimationRules.find(
              ([input]) => input.test(value5),
            ));
      if (value6 !== undefined) {
        return value6[1];
      }
    }
    if (parseSvgDimensions(svg) === undefined) {
      return "is not one <svg>…</svg> element";
    }
    let value2 = svgTagTokenPattern(allowAnimation),
      value3 = svgAttributeTokenPattern(allowAnimation),
      index = 0,
      flag = false,
      value4 = svg.indexOf("<");
    while (value4 >= 0) {
      value2.lastIndex = value4;
      let value5 = value2.exec(svg);
      if (value5 === null) {
        if (allowAnimation) {
          return "has markup this format cannot read (a comment or CDATA section that is never closed, a processing instruction, or a malformed tag)";
        } else {
          return "has markup this format cannot read (a comment, CDATA, processing instruction or malformed tag)";
        }
      }
      let value6 = value5[1] === "/",
        value7 = value5[2]!.toLowerCase();
      if (
        forbiddenSvgElementNames.has(value7) &&
        !(allowAnimation && nonRenderingSvgElementNames.has(value7))
      ) {
        return "may not contain <" + value7 + ">";
      }
      if (!value6) {
        value3.lastIndex = 0;
        let value8: RegExpExecArray | null;
        while ((value8 = value3.exec(value5[3]!)) !== null) {
          let value9 = value8[2]!.toLowerCase();
          if (value9.startsWith("on")) {
            return "may not carry on*= event attributes";
          }
          if (svgExternalResourceAttributes.has(value9)) {
            return (
              "may not carry " +
              value9 +
              '= (URL attributes: href="#…" or data:image/… only)'
            );
          }
        }
      }
      if (value7 === "svg") {
        if (flag) {
          return "is not one <svg>…</svg> element";
        }
        if (value6) {
          index--;
        } else if (value5[4] !== "/") {
          index++;
        }
        if (index < 0) {
          return "is not one <svg>…</svg> element";
        }
        if (index === 0) {
          flag = true;
        }
      }
      value4 = svg.indexOf("<", value4 + value5[0].length);
    }
    if (!flag || index !== 0) {
      return "is not one <svg>…</svg> element";
    }
    if (
      !/^\s*<\/svg\s*>\s*$/i.test(
        svg.slice(svg.toLowerCase().lastIndexOf("</svg")),
      )
    ) {
      return "is not one <svg>…</svg> element";
    }
    return;
  }
  function decodeSvgDataUrl(src: string): string | undefined {
    if (!src.startsWith("data:image/svg+xml;base64,")) {
      return;
    }
    try {
      let value = atob(src.slice(26)),
        value2 = new Uint8Array(value.length);
      for (let index = 0; index < value.length; index++)
        value2[index] = value.charCodeAt(index);
      let value3 = new TextDecoder().decode(value2);
      if (/^\s*<svg\b/i.test(value3)) {
        return value3;
      } else {
        return undefined;
      }
    } catch {
      return;
    }
  }
  function parseInlineStyleUnchecked(style: string | undefined): ParsedCssDeclaration[] {
    if (style === undefined) {
      return [];
    } else {
      return (0, runtime.parseCssDeclarations)(
        stripCssComments(style).replace(/!\s*important/gi, ""),
        (): void => {
          return;
        },
      );
    }
  }
  function inlineStyleSuppressesFlowLayout(style: string | undefined): boolean {
    let display = parseInlineStyleUnchecked(style).find(
      (input) => input.prop === "display",
    );
    return (
      display !== undefined &&
      !/^(inline-)?(flex|grid)\b/i.test(display.value.trim())
    );
  }
  function inlineStyleHasPercentSize(style: string | undefined, axis: "width" | "height"): boolean {
    let logicalDimension =
        axis === "width" ? "inline-size" : "block-size",
      declarations = parseInlineStyleUnchecked(style),
      propertyHasPercent = (
        input: string,
        options: string,
      ): boolean =>
        declarations
          .filter(
            (input2) =>
              input2.prop === input || input2.prop === options,
          )
          .pop()
          ?.value.includes("%") === true;
    return (
      propertyHasPercent(axis, logicalDimension) ||
      propertyHasPercent("min-" + axis, "min-" + logicalDimension)
    );
  }
  function nodeHasExplicitAxisSize(node: SlideNode, axis: "x" | "y"): boolean {
    if (node.kind === "spacer") {
      return false;
    }
    let placement: NodePlacement = node.place ?? {},
      positiveSize = (input: unknown): boolean =>
        typeof input === "number" && input > 0,
      media =
        node.kind === "img" || node.kind === "icon" || node.kind === "shape";
    if (
      positiveSize(
        media
          ? axis === "x"
            ? (node as SizedNode).w
            : (node as SizedNode).h
          : axis === "x"
            ? placement.minW
            : placement.minH,
      )
    ) {
      return true;
    }
    if (node.kind === "icon" || node.kind === "shape") {
      return !(axis === "x" && (node as ShapeNode).shape === "line");
    }
    if (node.kind === "text") {
      return typeof node.text === "string" && node.text.trim() !== "";
    }
    if (node.kind === "img") {
      return typeof node.src === "string";
    }
    if (node.kind === "overlay") {
      return nodeHasExplicitAxisSize(node.base, axis);
    }
    return (
      node.kind === "table" ||
      (Array.isArray((node as FlowContainerNode).children) &&
        (node as FlowContainerNode).children.some(
          (input) => nodeHasExplicitAxisSize(input, axis),
        ))
    );
  }
  function inheritedContainerStretchSources(
    grid: boolean,
    node: FlowContainerAlignment,
  ): StretchSources | undefined {
    let sources: StretchSources = {};
    if (grid) {
      if (node.justifyItems !== undefined) {
        sources.w = "justify-items:" + node.justifyItems;
      }
      if (node.alignItems !== undefined) {
        sources.h = "align-items:" + node.alignItems;
      }
    } else if (node.align !== undefined && node.align !== "stretch") {
      sources[node.dir === "h" ? "h" : "w"] = "align-items:" + node.align;
    }
    if (sources.w === undefined && sources.h === undefined) {
      return undefined;
    } else {
      return sources;
    }
  }
  function nonStretchAxisExplanation(
    context: Pick<HtmlNodeContext, "parentGrid" | "parentAlign">,
    dimension: "width" | "height",
    alignSelf: string | undefined,
    justifySelf: string | undefined,
  ): string | undefined {
    let value =
      context.parentGrid === true && dimension === "width"
        ? justifySelf === undefined
          ? undefined
          : "justify-self:" + justifySelf
        : alignSelf === undefined
          ? undefined
          : "align-self:" + alignSelf;
    if (value !== undefined) {
      if (value.endsWith(":stretch")) {
        return undefined;
      } else {
        return "its " + value;
      }
    }
    let value2 =
      dimension === "width" ? context.parentAlign?.w : context.parentAlign?.h;
    if (value2 === undefined) {
      return undefined;
    } else {
      return "the parent's " + value2;
    }
  }
  function inlineStyleHasUnsafeSizing(
    style: string | undefined,
    dimension: "width" | "height",
  ): boolean {
    if (style === undefined || !/-(width|height|size)/i.test(style)) {
      return false;
    }
    let items: string[] = [
        dimension,
        dimension === "width" ? "inline-size" : "block-size",
      ],
      flag = false,
      value = (0, runtime.parseCssDeclarations)(
        stripCssComments(style),
        (input: string): void => {
          if (
            input.startsWith("unbalanced") ||
            items.some(
              (input2) =>
                input.startsWith("min-" + input2 + ":") ||
                input.startsWith("max-" + input2 + ":"),
            )
          ) {
            flag = true;
          }
        },
      );
    return (
      flag ||
      value.some(
        (input) =>
          items.some(
            (input2) =>
              (input.prop === "max-" + input2 &&
                !/^(none|100%)$/i.test(input.value.trim())) ||
              (input.prop === "min-" + input2 &&
                !/^(auto|0(px|%)?|100%)$/i.test(input.value.trim())),
          ),
      )
    );
  }
  function inlineStyleHasUnsafeBackground(style: string | undefined): boolean {
    if (style === undefined || !/background/i.test(style)) {
      return false;
    }
    let flag = false,
      value = (0, runtime.parseCssDeclarations)(
        stripCssComments(style),
        (input: string): void => {
          if (
            input.startsWith("background") ||
            input.startsWith("unbalanced")
          ) {
            flag = true;
          }
        },
      );
    return (
      flag ||
      value.some(
        (input) =>
          input.prop.startsWith("background") &&
          !/^(none|transparent)$/i.test(input.value.trim()),
      )
    );
  }
  function parseInlineStyle(
    css: string | undefined,
    warn: HtmlDiagnosticReporter,
    drop: HtmlDiagnosticReporter,
    box?: InlineStyleBoxState,
    fontSize?: number,
  ): ParsedInlineStyle {
    let style: ParsedInlineStyle = {};
    if (css === undefined || css.trim() === "") {
      return style;
    }
    let declarations = (0, runtime.parseCssDeclarations)(css, drop),
      resolvedDeclarations =
        fontSize === undefined
          ? declarations
          : resolveEmListPadding(
              declarations,
              (): number =>
                parseInlineStyle(
                  css,
                  (): void => {
                    return;
                  },
                  (): void => {
                    return;
                  },
                )["font-size"] ?? fontSize,
              drop,
            ),
      callback = (
        input: string,
        options: string,
        context = "",
      ): void =>
        drop(
          input +
            ': "' +
            (0, runtime.compactDiagnosticValue)(options) +
            '"' +
            (context !== ""
              ? " — " + context
              : (0, runtime.cssPropertyValueHint)(input)),
        ),
      callback2 = <K extends keyof ParsedInlineStyle>(
        input: K,
        options: ParsedInlineStyle[K] | undefined,
        context: string,
        value: string,
      ): void => {
        if (options === undefined) {
          callback(context, value);
        } else {
          style[input] = options;
        }
      },
      callback3 = (
        input: string,
        options: number,
        context: LengthBounds | NumericBounds,
        value: string,
      ): number | undefined => {
        let value2 = "lo" in context ? context.lo : context.min,
          value3 = "hi" in context ? context.hi : context.max;
        if (options >= value2 && options <= value3) {
          return options;
        }
        callback(
          input,
          value,
          "outside " + String(value2) + "–" + String(value3),
        );
        return;
      },
      callback4 = (input: ShadowValue) => ({
        x: input.x,
        y: input.y,
        blur: input.blur,
        ...(input.spread !== undefined
          ? {
              spread: input.spread,
            }
          : {}),
      }),
      callback5 = (
        input: string,
        options: object,
        context: Record<string, NumericBounds | undefined>,
        value: string,
      ): boolean =>
        Object.entries<number>(options as Record<string, number>).every(
          ([input2, input3]: [string, number]): boolean =>
            context[input2] === undefined ||
            callback3(input + " " + input2, input3, context[input2], value) !==
              undefined,
        ),
      callback6 = (input: string): number | undefined => {
        let value = (0, runtime.tokenizeCssValue)(input);
        if (value.length === 1) {
          return (0, runtime.cssTokenPixels)(value[0]);
        } else {
          return undefined;
        }
      },
      callback7 = (input: string, options: boolean): CssOffsetValue | undefined => {
        let value = (0, runtime.tokenizeCssValue)(input),
          value2 = value[0];
        if (value.length !== 1 || value2 === undefined) {
          return;
        }
        if (value2.t === "ident" && value2.v === "auto") {
          return "auto";
        }
        if (value2.t === "fn" && value2.name === "calc" && options) {
          let value3 =
            /^\s*([+-]?[\d.]+)%\s*([+-])\s*([\d.]+)(?:px)?\s*$/.exec(
              value2.args,
            );
          if (value3) {
            return {
              calcPct: Number(value3[1]),
              px: (value3[2] === "-" ? -1 : 1) * Number(value3[3]),
            };
          }
          return;
        }
        return (0, runtime.cssTokenSize)(value2);
      },
      callback8 = (input: string): "auto" | CssSizeValue | undefined => {
        let value = (0, runtime.tokenizeCssValue)(input),
          value2 = value[0];
        if (value.length !== 1 || value2 === undefined) {
          return;
        }
        if (value2.t === "ident" && value2.v === "auto") {
          return "auto";
        }
        return (0, runtime.cssTokenSize)(value2);
      },
      callback9 = (input: string): string | undefined =>
        (0, runtime.normalizeCssColorHex)(input),
      callback10 = <T>(input: string, options: Record<string, T>): T | undefined => {
        let value = input.trim().toLowerCase();
        if (Object.hasOwn(options, value)) {
          return options[value];
        } else {
          return undefined;
        }
      },
      callback11 = <T extends string>(input: string, options: readonly T[]): T | undefined => {
        let value = input.trim().toLowerCase();
        if ((options as readonly string[]).includes(value)) {
          return value as T;
        } else {
          return undefined;
        }
      },
      callback12 = (input: string, options: string): void => {
        let value = (0, runtime.splitCssTokenGroups)(
            (0, runtime.tokenizeCssValue)(options),
          ),
          value2 =
            value.length > 1 &&
            value[0]!.some(
              (input2: CssToken) =>
                input2.t === "fn" && /-gradient$/.test(input2.name),
            ),
          value3 =
            input === "background" && value2 && value.length === 2
              ? (0, runtime.parseCssColorTokens)(value[1]!)
              : undefined,
          callback14 = (input2?: string): void => {
            if (
              box !== undefined &&
              value.some(
                (input3: CssToken[]) =>
                  input3.some(
                    (input4: CssToken) =>
                      input4.t === "fn" && /-gradient$/.test(input4.name),
                  ),
              )
            ) {
              let callback15 = (input3: CssToken[]) =>
                  input3
                    .flatMap(
                      (input4: CssToken) =>
                        input4.t === "fn" &&
                        !/^(rgba?|hsla?)$/.test(input4.name)
                          ? []
                          : [(0, runtime.normalizeCssColorHex)(input4.raw)],
                    )
                    .filter(
                      (input4: string | undefined) => input4 !== undefined,
                    ),
                value7 = callback15(value[value.length - 1] ?? []),
                value8 =
                  input === "background" &&
                  value7.length === 1 &&
                  !value
                    .slice(0, -1)
                    .some(
                      (input3: CssToken[]) =>
                        callback15(input3).some(
                          (input4: string) =>
                            hexColorAlpha(input4) > 0,
                        ),
                    )
                    ? hexColorAlpha(value7[0])
                    : 0;
              if (value8 === 1) {
                box.keptColour = value7[0];
              }
              if (value8 > 0) {
                box.wroteColour = true;
              }
              box.refusedGradient =
                input === "background" ? input : "background-image";
            }
            callback(input, options, input2);
          };
        if (value.length > (value3 !== undefined ? 2 : 1)) {
          return callback14(
            value2
              ? "one gradient, then at most one plain COLOR, and only in the background shorthand: background: GRADIENT, #hex"
              : "one background layer only (a color, or one gradient)",
          );
        }
        let value4 = value[0] ?? [];
        if (
          value4.length === 1 &&
          value4[0]!.t === "ident" &&
          value4[0]!.v === "none"
        ) {
          delete style["background-image-src"];
          delete style["background-gradient"];
          if (input === "background") {
            delete style["background-color"];
          }
          if (box !== undefined) {
            box.refusedGradient = undefined;
          }
          return;
        }
        if (value4[0]?.t === "fn" && value4[0].name === "url") {
          let value7 = (0, runtime.parseSingleCssName)(value4[0].args);
          if (value7 === undefined) {
            return callback(
              input,
              options,
              "url(SRC) names one image, as <img src> does",
            );
          }
          let value8: "cover" | "contain" | undefined;
          for (let count = 1; count < value4.length; count++) {
            let value9 = value4[count]!;
            if (
              value9.t === "ident" &&
              (value9.v === "center" || value9.v === "no-repeat")
            ) {
              continue;
            }
            if (
              value9.t === "slash" &&
              value4[count + 1]?.t === "ident" &&
              (value4[count + 1] as CssIdentToken).v === "cover"
            ) {
              value8 = "cover";
            } else if (
              value9.t === "slash" &&
              value4[count + 1]?.t === "ident" &&
              (value4[count + 1] as CssIdentToken).v === "contain"
            ) {
              value8 = "contain";
            } else {
              return callback(
                input,
                options,
                "url(SRC) [center / cover | contain] — with background-clip: text",
              );
            }
            count++;
          }
          style["background-image-src"] = value7;
          if (value8 !== undefined) {
            style["background-size"] = value8;
          }
          delete style["background-gradient"];
          if (input === "background") {
            delete style["background-color"];
          }
          if (box !== undefined) {
            box.refusedGradient = undefined;
          }
          return;
        }
        let value5 = value3,
          value6: GradientValue | undefined;
        for (let value7 of value4) {
          if (
            value7.t === "fn" &&
            /^(repeating-linear|linear|radial)-gradient$/.test(value7.name) &&
            value6 === undefined
          ) {
            let value9 = (0, runtime.parseCssGradient)(
              value7,
              box?.box,
            );
            if (value9 === undefined) {
              return callback14(
                "gradients are linear-gradient(ANGLE | to SIDE, COLOR [N%], …), radial-gradient([circle | ellipse] [closest-side | closest-corner | farthest-side | farthest-corner] [at X% Y% | at top right], …) or repeating-linear-gradient(ANGLE, COLOR Npx, …) with 2–8 stops — no radial size (600px, 120% 80%) and no px centre",
              );
            }
            value6 = value9;
            continue;
          }
          let value8 =
            value7.t === "fn" && !/^(rgba?|hsla?)$/.test(value7.name)
              ? undefined
              : (0, runtime.normalizeCssColorHex)(value7.raw);
          if (value8 !== undefined && value5 === undefined) {
            value5 = value8;
            continue;
          }
          return callback14();
        }
        if (value5 !== undefined) {
          style["background-color"] = value5;
        }
        if (value6 !== undefined) {
          style["background-gradient"] = value6;
        }
        if (value6 !== undefined || input === "background") {
          delete style["background-image-src"];
        }
        if (box !== undefined && value6 !== undefined) {
          box.refusedGradient = undefined;
        }
      },
      callback13 = (input: string, options?: CssBoxSide): void => {
        let value =
            options === undefined ? "border" : "border-" + options,
          value2 = (0, runtime.tokenizeCssValue)(input),
          value3 = value2[0];
        if (
          value2.length === 1 &&
          value3 !== undefined &&
          ((value3.t === "ident" &&
            (value3.v === "none" || value3.v === "hidden")) ||
            (value3.t === "num" && value3.n === 0))
        ) {
          if (options === undefined) {
            style.border = {
              style: "none",
            };
          } else if (
            style.border !== undefined &&
            style.border.style !== "none"
          ) {
            let value6 = (
              style.border.sides ?? cssBoxSideNames
            ).filter((input2: CssBoxSide) => input2 !== options);
            if (value6.length === 0) {
              style.border = {
                style: "none",
              };
            } else if (
              ((style.border = {
                ...style.border,
                sides: value6,
              }),
              style.border.widths !== undefined)
            ) {
              let { [options]: widths, ...widths2 } =
                style.border.widths;
              style.border.widths = widths2;
            }
          }
          return;
        }
        let value4 = (0, runtime.parseCssBorder)(value2);
        if (value4 === undefined) {
          return callback(value, input);
        }
        if (value4.style === undefined) {
          return callback(
            value,
            input,
            "name the style: " +
              String(value4.width ?? 1) +
              "px solid " +
              (value4.color ?? "COLOR") +
              " (CSS draws nothing without one)",
          );
        }
        if (
          value4.width !== undefined &&
          callback3(value, value4.width, shapeStrokeBounds, input) === undefined
        ) {
          return;
        }
        let value5 =
          style.border !== undefined &&
          style.border.style !== undefined &&
          style.border.style !== "none"
            ? style.border
            : undefined;
        if (options === undefined) {
          let {
            sides: value6,
            widths: value7,
            ...value8
          }: ParsedInlineBorder = value5 ?? {};
          style.border = {
            ...value8,
            ...value4,
          };
          return;
        }
        let state = {
          ...value4,
        };
        if (value5 === undefined) {
          style.border = {
            ...state,
            sides: [options],
          };
          return;
        }
        if (
          (value5.style ?? "solid") !== (state.style ?? "solid") ||
          (value5.color ?? "") !== (state.color ?? "")
        ) {
          drop(
            value +
              ': "' +
              (0, runtime.compactDiagnosticValue)(input) +
              '" — the drawn sides share one style and color here (widths may differ); for a different rule use a painted div',
          );
          return;
        }
        if (
          value5.widths !== undefined ||
          (value5.width ?? 1) !== (state.width ?? 1)
        ) {
          let value6: Partial<Record<CssBoxSide, number>> =
            value5.widths !== undefined
              ? {
                  ...value5.widths,
                }
              : Object.fromEntries(
                  (value5.sides ?? cssBoxSideNames).map(
                    (input2: CssBoxSide): [CssBoxSide, number] => [input2, value5.width ?? 1],
                  ),
                );
          value6[options] = state.width ?? 1;
          style.border = {
            style: value5.style,
            color: value5.color,
            widths: value6,
            sides: cssBoxSideNames.filter(
              (input2: CssBoxSide) => value6[input2] !== undefined,
            ),
          };
          return;
        }
        if (value5.sides !== undefined && !value5.sides.includes(options)) {
          style.border = {
            ...value5,
            sides: cssBoxSideNames.filter(
              (input2: CssBoxSide) =>
                input2 === options || value5.sides!.includes(input2),
            ),
          };
        }
      };
    for (let {
      prop: value,
      value: value2,
    } of resolvedDeclarations) {
      let value3 = (0, runtime.tokenizeCssValue)(value2);
      if (
        /^(inherit|initial|unset|revert|revert-layer)$/i.test(value2.trim())
      ) {
        drop(
          value +
            ': "' +
            value2.trim() +
            '" — CSS-wide keywords are not in this format; write the value (text properties inherit on their own)',
        );
        continue;
      }
      if ((0, runtime.canonicalCssPropertyName)(value) === undefined) {
        if (
          ownRecordValue(runtime.acceptedNoOpCssPropertyPatterns, value)?.test(
            value2.trim(),
          ) === true
        ) {
          continue;
        }
        let value4 =
          ownRecordValue(runtime.unsupportedCssPropertyHints, value) ??
          ownRecordValue(
            runtime.unsupportedCssPropertyHints,
            value.replace(/-(top|right|bottom|left|inline|block)(-\w+)?$/, ""),
          );
        drop(
          value +
            " is not in this format" +
            (value4 !== undefined
              ? " — " + value4
              : value.startsWith("-")
                ? " (no vendor properties)"
                : ""),
        );
        continue;
      }
      switch (value) {
        case "position": {
          let value4 = callback11(value2, ["relative", "absolute"]);
          if (value4 === undefined) {
            callback(
              value,
              value2,
              "absolute | relative (static is the default — delete it; nothing is fixed or sticky on a slide)",
            );
          } else {
            style.position = value4;
          }
          break;
        }
        case "top":
        case "right":
        case "bottom":
        case "left":
          callback2(
            value,
            callback7(value2, value === "left" || value === "top"),
            value,
            value2,
          );
          break;
        case "inset": {
          let value4 = (0, runtime.expandCssBoxValues)(
              value3,
              (input: CssToken) =>
                (0, runtime.cssTokenSize)(input) !== undefined ? 1 : undefined,
            ),
            value5 = value3.map(
              (input: CssToken) => (0, runtime.cssTokenSize)(input),
            );
          if (
            value4 === undefined ||
            value5.some((input: CssSizeValue | undefined) => input === undefined)
          ) {
            callback(value, value2, "1 to 4 of LEN | PCT");
            break;
          }
          let [
            value6,
            value7 = value6,
            value8 = value6,
            value9 = value7,
          ] = value5;
          style.top = value6;
          style.right = value7;
          style.bottom = value8;
          style.left = value9;
          break;
        }
        case "width":
        case "height":
          callback2(value, callback8(value2), value, value2);
          break;
        case "min-width":
        case "min-height":
        case "max-width":
        case "max-height": {
          if (
            value === "min-width" &&
            /^\s*(min|max)-content\s*$/i.test(value2)
          ) {
            style["min-width-fit"] = value2.trim().toLowerCase();
            break;
          }
          if (
            (value === "max-width" && /^\s*(100%|none)\s*$/i.test(value2)) ||
            (value.startsWith("min-") && /^\s*0(px)?\s*$/.test(value2))
          ) {
            break;
          }
          let value4 = callback8(value2);
          if (value4 === undefined || value4 === "auto" || "pct" in value4) {
            callback(value, value2);
          } else {
            style[value] = value4;
          }
          break;
        }
        case "display": {
          let value4 = callback11(value2, [
            "flex",
            "grid",
            "none",
            "block",
            "inline-flex",
            "inline-grid",
            "inline-block",
            "inline",
          ]);
          if (value4 === "flex" || value4 === "grid" || value4 === "none") {
            style.display = value4;
          } else if (value4 === "block") {
            break;
          } else if (value4 === "inline-flex" || value4 === "inline-grid") {
            callback(
              value,
              value2,
              "write " + value4.slice(7) + " (every element is a block here)",
            );
          } else {
            callback(
              value,
              value2,
              "flex | grid (a pill is a <p> with background + padding; text runs are <span>s inside one <p>)",
            );
          }
          break;
        }
        case "flex-direction":
          callback2(
            "flex-direction",
            callback11(value2, [
              "row",
              "column",
              "row-reverse",
              "column-reverse",
            ]),
            value,
            value2,
          );
          break;
        case "flex-flow": {
          let value4 = value3.find(
              (input: CssToken) =>
                input.t === "ident" &&
                ["row", "column", "row-reverse", "column-reverse"].includes(
                  input.v,
                ),
            ),
            value5 = value3.find(
              (input: CssToken) =>
                input.t === "ident" &&
                (input.v === "wrap" || input.v === "nowrap"),
            );
          if (
            value3.length < 1 ||
            value3.length > 2 ||
            value3.some(
              (input: CssToken) =>
                input !== value4 && input !== value5,
            )
          ) {
            callback(value, value2, "flex-direction and/or wrap | nowrap");
            break;
          }
          if (value4?.t === "ident") {
            style["flex-direction"] = value4.v as ParsedInlineStyle["flex-direction"];
          }
          if (value5?.t === "ident") {
            style["flex-wrap"] = value5.v === "wrap";
          }
          break;
        }
        case "flex-wrap": {
          let value4 = callback11(value2, ["nowrap", "wrap"]);
          if (value4 === undefined) {
            callback(value, value2);
          } else {
            style["flex-wrap"] = value4 === "wrap";
          }
          break;
        }
        case "gap":
        case "grid-gap": {
          let value4 = value3.map(
            (input: CssToken) => (0, runtime.cssTokenPixels)(input),
          );
          if (
            value4.length < 1 ||
            value4.length > 2 ||
            value4.some((input: number | undefined) => input === undefined)
          ) {
            callback(value, value2);
          } else if (value4.length === 2 && value4[0] !== value4[1]) {
            callback(
              value,
              value2,
              "one gap for both axes here (write a single LEN)",
            );
          } else if (
            callback3(value, value4[0]!, containerPaddingBounds, value2) !==
            undefined
          ) {
            style.gap = value4[0];
          }
          break;
        }
        case "row-gap":
        case "column-gap":
        case "grid-row-gap":
        case "grid-column-gap": {
          let value4 = callback6(value2);
          if (value4 === undefined) {
            callback(value, value2);
          } else if (style.gap !== undefined && style.gap !== value4) {
            callback(value, value2, "one gap for both axes here (use gap)");
          } else if (
            callback3(value, value4, containerPaddingBounds, value2) !==
            undefined
          ) {
            style.gap = value4;
          }
          break;
        }
        case "align-items":
          callback2(
            "align-items",
            callback10(value2, cssAlignmentMap),
            value,
            value2,
          );
          break;
        case "justify-content":
          callback2(
            "justify-content",
            callback10(value2, cssJustificationMap),
            value,
            value2,
          );
          break;
        case "justify-items": {
          let value4 = callback10(value2, cssAlignmentMap);
          callback2(
            "justify-items",
            value4 === "baseline" ? undefined : value4,
            value,
            value2,
          );
          break;
        }
        case "place-items": {
          let value4 = value3.map(
            (input: CssToken) =>
              input.t === "ident" ? cssAlignmentMap[input.v] : undefined,
          );
          if (
            value4.length < 1 ||
            value4.length > 2 ||
            value4.some((input: ContainerAlignment | undefined) => input === undefined) ||
            value4[1] === "baseline"
          ) {
            callback(
              value,
              value2,
              "ALIGN [ALIGN] (no baseline on the justify axis)",
            );
            break;
          }
          style["align-items"] = value4[0];
          if ((value4[1] ?? value4[0]) !== "baseline") {
            style["justify-items"] = value4[1] ?? value4[0];
          }
          break;
        }
        case "grid-template-columns":
        case "grid-template-rows": {
          if (
            value3.length === 1 &&
            value3[0]!.t === "ident" &&
            value3[0]!.v === "none"
          ) {
            break;
          }
          let value4 = (0, runtime.parseCssGridTracks)(value3);
          if (value4 === undefined) {
            callback(value, value2);
          }
          style[value] = value4 ?? [
            {
              fr: 1,
            },
          ];
          break;
        }
        case "padding": {
          let value4 = (0, runtime.expandCssBoxValues)(
            value3,
            runtime.cssTokenPixels,
          );
          if (value4 === undefined) {
            callback(value, value2);
          } else if (
            value4.every(
              (input: number) =>
                callback3(
                  value,
                  input,
                  slideStylePropertySchema("paddingTop"),
                  value2,
                ) !== undefined,
            )
          ) {
            [
              style["padding-top"],
              style["padding-right"],
              style["padding-bottom"],
              style["padding-left"],
            ] = value4;
          }
          break;
        }
        case "padding-top":
        case "padding-right":
        case "padding-bottom":
        case "padding-left": {
          let value4 = callback6(value2);
          if (value4 === undefined) {
            callback(value, value2);
          } else if (
            callback3(
              value,
              value4,
              slideStylePropertySchema("paddingTop"),
              value2,
            ) !== undefined
          ) {
            style[value] = value4;
          }
          break;
        }
        case "padding-inline":
        case "padding-block": {
          let value4 = (0, runtime.expandCssBoxValues)(
            value3,
            runtime.cssTokenPixels,
          );
          if (value4 === undefined || value3.length > 2) {
            callback(value, value2, "LEN [LEN]");
          } else if (
            value4.every(
              (input: number) =>
                callback3(
                  value,
                  input,
                  slideStylePropertySchema("paddingTop"),
                  value2,
                ) !== undefined,
            )
          ) {
            if (value === "padding-inline") {
              [style["padding-left"], style["padding-right"]] = [
                value4[0],
                value4[1],
              ];
            } else {
              [style["padding-top"], style["padding-bottom"]] = [
                value4[0],
                value4[1],
              ];
            }
          }
          break;
        }
        case "overflow":
        case "overflow-x":
        case "overflow-y":
          callback2(
            "overflow",
            callback11(value2, ["visible", "hidden"]),
            value,
            value2,
          );
          break;
        case "flex": {
          let value4 = (0, runtime.parseCssFlex)(value3);
          if (value4 === undefined) {
            callback(value, value2);
          } else {
            if (value4.grow !== undefined) {
              style["flex-grow"] = value4.grow;
            }
            if (value4.shrink !== undefined) {
              style["flex-shrink"] = value4.shrink;
            }
            if (value4.basis !== undefined) {
              style["flex-basis"] = value4.basis;
            }
          }
          break;
        }
        case "flex-grow":
        case "flex-shrink": {
          let value4 = value3[0];
          callback2(
            value,
            value3.length === 1 &&
              value4?.t === "num" &&
              value4.unit === "" &&
              value4.n >= 0
              ? value4.n
              : undefined,
            value,
            value2,
          );
          break;
        }
        case "flex-basis": {
          let value4 = value3[0];
          if (
            value3.length === 1 &&
            value4?.t === "ident" &&
            value4.v === "auto"
          ) {
            style["flex-basis"] = "auto";
          } else {
            callback2("flex-basis", callback6(value2), value, value2);
          }
          break;
        }
        case "align-self": {
          if (value2.trim().toLowerCase() === "auto") {
            break;
          }
          callback2(
            "align-self",
            callback10(value2, cssAlignmentMap),
            value,
            value2,
          );
          break;
        }
        case "justify-self": {
          if (value2.trim().toLowerCase() === "auto") {
            break;
          }
          let value4 = callback10(value2, cssAlignmentMap);
          callback2(
            "justify-self",
            value4 === "baseline" ? undefined : value4,
            value,
            value2,
          );
          break;
        }
        case "place-self": {
          if (value2.trim().toLowerCase() === "auto") {
            break;
          }
          let value4 = value3.map(
            (input: CssToken) =>
              input.t === "ident" ? cssAlignmentMap[input.v] : undefined,
          );
          if (
            value4.length < 1 ||
            value4.length > 2 ||
            value4.some((input: ContainerAlignment | undefined) => input === undefined) ||
            value4[1] === "baseline"
          ) {
            callback(
              value,
              value2,
              "ALIGN [ALIGN] | auto (no baseline on the justify axis)",
            );
            break;
          }
          style["align-self"] = value4[0];
          if ((value4[1] ?? value4[0]) !== "baseline") {
            style["justify-self"] = value4[1] ?? value4[0];
          }
          break;
        }
        case "aspect-ratio": {
          let value4 = value3.filter(
            (input: CssToken): input is CssNumberToken =>
              input.t === "num" && input.unit === "",
          );
          if (value4.length === 1 && value3.length === 1 && value4[0]!.n > 0) {
            style["aspect-ratio"] = value4[0]!.n;
          } else if (
            value4.length === 2 &&
            value3.length === 3 &&
            value3[1]!.t === "slash" &&
            value4[0]!.n > 0 &&
            value4[1]!.n > 0
          ) {
            style["aspect-ratio"] = value4[0]!.n / value4[1]!.n;
          } else {
            callback(value, value2);
          }
          break;
        }
        case "grid-column":
        case "grid-row":
        case "grid-column-end":
        case "grid-row-end": {
          let value4 = /^\s*span\s+(\d+)\s*$/i.exec(value2),
            value5 = value4 ? Number(value4[1]) : NaN;
          if (!Number.isInteger(value5) || value5 < 1 || value5 > 24) {
            callback(
              value,
              value2,
              "span INT only — cells place in source order; there are no line numbers here",
            );
          } else {
            style[
              value.startsWith("grid-column") ? "grid-column" : "grid-row"
            ] = value5;
          }
          break;
        }
        case "font-family":
          callback2(
            "font-family",
            (0, runtime.parseCssFontFamilies)(value3),
            value,
            value2,
          );
          break;
        case "font-size": {
          let value4 = value3[0],
            value5: number | undefined;
          if (
            value3.length === 1 &&
            value4?.t === "num" &&
            (value4.unit === "px" || value4.unit === "")
          ) {
            value5 = value4.n;
          } else if (
            value3.length === 1 &&
            value4?.t === "num" &&
            value4.unit === "pt"
          ) {
            value5 = Math.round((value4.n * 4) / 3);
            warn("font-size: pt converted to px (" + String(value5) + "px)");
          }
          if (value5 === undefined) {
            callback(value, value2);
          } else if (
            callback3(
              value,
              value5,
              slideStylePropertySchema("fontSize"),
              value2,
            ) !== undefined
          ) {
            style["font-size"] = value5;
          }
          break;
        }
        case "font-weight":
          callback2(
            "font-weight",
            (0, runtime.parseCssFontWeight)(value3),
            value,
            value2,
          );
          break;
        case "font-style": {
          let value4 = value2.trim().toLowerCase();
          callback2(
            "font-style",
            value4 === "italic" || value4 === "oblique"
              ? "italic"
              : value4 === "normal"
                ? "normal"
                : undefined,
            value,
            value2,
          );
          break;
        }
        case "font": {
          let value4 = (0, runtime.parseCssFontShorthand)(value3);
          if (
            value4 === undefined ||
            callback3(
              "font-size",
              value4.size,
              slideStylePropertySchema("fontSize"),
              value2,
            ) === undefined
          ) {
            if (value4 === undefined) {
              callback(value, value2);
            }
            break;
          }
          style["font-size"] = value4.size;
          style["font-family"] = value4.family;
          if (value4.weight !== undefined) {
            style["font-weight"] = value4.weight;
          }
          if (value4.style !== undefined) {
            style["font-style"] = value4.style;
          }
          if (
            value4.lineHeight !== undefined &&
            callback3(
              "line-height",
              value4.lineHeight,
              slideStylePropertySchema("lineHeight"),
              value2,
            ) !== undefined
          ) {
            style["line-height"] = value4.lineHeight;
          }
          break;
        }
        case "line-height": {
          let value4 = value3[0],
            value5: number | undefined;
          if (value3.length !== 1 || value4 === undefined) {
            value5 = undefined;
          } else if (value4.t === "ident" && value4.v === "normal") {
            break;
          } else if (
            value4.t === "num" &&
            (value4.unit === "" || value4.unit === "em")
          ) {
            value5 = value4.n;
          } else if (value4.t === "num" && value4.unit === "%") {
            value5 = value4.n / 100;
          } else if (value4.t === "num" && value4.unit === "px") {
            style["line-height"] = {
              px: value4.n,
            };
            break;
          }
          if (value5 === undefined) {
            callback(value, value2);
          } else if (
            callback3(
              value,
              value5,
              slideStylePropertySchema("lineHeight"),
              value2,
            ) !== undefined
          ) {
            style["line-height"] = value5;
          }
          break;
        }
        case "letter-spacing": {
          let value4 = value3[0];
          if (value3.length !== 1 || value4 === undefined) {
            callback(value, value2);
          } else if (value4.t === "ident" && value4.v === "normal") {
            style["letter-spacing"] = 0;
          } else if (
            value4.t === "num" &&
            (value4.unit === "px" || value4.unit === "")
          ) {
            if (
              callback3(
                value,
                value4.n,
                slideStylePropertySchema("letterSpacing"),
                value2,
              ) !== undefined
            ) {
              style["letter-spacing"] = value4.n;
            }
          } else if (value4.t === "num" && value4.unit === "em") {
            style["letter-spacing"] = {
              em: value4.n,
            };
          } else {
            callback(value, value2);
          }
          break;
        }
        case "text-align": {
          let value4 = value2.trim().toLowerCase();
          callback2(
            "text-align",
            callback11(
              value4 === "start" ? "left" : value4 === "end" ? "right" : value4,
              ["left", "center", "right", "justify"],
            ),
            value,
            value2,
          );
          break;
        }
        case "text-transform":
          callback2(
            "text-transform",
            callback11(value2, [
              "none",
              "uppercase",
              "lowercase",
              "capitalize",
            ]),
            value,
            value2,
          );
          break;
        case "white-space": {
          let value4 = callback11(value2, ["normal", "nowrap"]);
          if (value4 === undefined) {
            callback(value, value2, "normal | nowrap (line breaks are <br>)");
          } else {
            style["white-space"] = value4;
          }
          break;
        }
        case "text-decoration":
        case "text-decoration-line":
        case "text-decoration-style":
        case "text-decoration-color": {
          if (
            value3.length === 1 &&
            value3[0]!.t === "ident" &&
            value3[0]!.v === "none"
          ) {
            style["text-decoration-line"] = "none";
            break;
          }
          for (let value4 of value3)
            if (
              value4.t === "ident" &&
              (value4.v === "underline" || value4.v === "line-through")
            ) {
              style["text-decoration-line"] = value4.v;
            } else if (
              value4.t === "ident" &&
              ["solid", "double", "dotted", "dashed", "wavy"].includes(value4.v)
            ) {
              style["text-decoration-style"] = value4.v as TextDecorationStyleValue;
            } else {
              let value5 =
                value4.t === "ident" && value4.v === "overline"
                  ? undefined
                  : (0, runtime.normalizeCssColorHex)(value4.raw);
              if (value5 !== undefined) {
                style["text-decoration-color"] = value5;
              } else {
                callback(value, value2);
              }
            }
          break;
        }
        case "font-variant-numeric":
          callback2(
            "font-variant-numeric",
            callback11(value2, ["normal", "tabular-nums"]),
            value,
            value2,
          );
          break;
        case "-webkit-text-stroke": {
          let value4 = value3.find(
              (input: CssToken) =>
                (0, runtime.cssTokenPixels)(input) !== undefined,
            ),
            value5 = value3
              .map(
                (input: CssToken) =>
                  (0, runtime.normalizeCssColorHex)(input.raw),
              )
              .find((input: string | undefined) => input !== undefined);
          if (
            (value4 === undefined && value5 === undefined) ||
            value3.length > 2
          ) {
            callback(value, value2);
            break;
          }
          if (
            value4 !== undefined &&
            callback3(
              value,
              (0, runtime.cssTokenPixels)(value4)!,
              slideStylePropertySchema("textStrokeWidth"),
              value2,
            ) !== undefined
          ) {
            style["text-stroke-width"] = (0, runtime.cssTokenPixels)(value4);
          }
          if (value5 !== undefined) {
            style["text-stroke-color"] = value5;
          }
          break;
        }
        case "-webkit-text-stroke-width": {
          let value4 = callback6(value2);
          if (value4 === undefined) {
            callback(value, value2);
          } else if (
            callback3(
              value,
              value4,
              slideStylePropertySchema("textStrokeWidth"),
              value2,
            ) !== undefined
          ) {
            style["text-stroke-width"] = value4;
          }
          break;
        }
        case "-webkit-text-stroke-color":
          callback2("text-stroke-color", callback9(value2), value, value2);
          break;
        case "color":
          callback2("color", callback9(value2), value, value2);
          break;
        case "background":
        case "background-image":
          callback12(value, value2);
          break;
        case "background-color": {
          let value4 = callback9(value2);
          callback2("background-color", value4, value, value2);
          if (box !== undefined && value4 !== undefined) {
            box.keptColour = undefined;
          }
          break;
        }
        case "background-clip":
        case "-webkit-background-clip":
          if (/^\s*text\s*$/i.test(value2)) {
            style["background-clip"] = "text";
          } else {
            callback(
              value,
              value2,
              "text is the one clip (the glyphs take the background)",
            );
          }
          break;
        case "-webkit-text-fill-color":
          if (/^\s*transparent\s*$/i.test(value2)) {
            style["text-fill-transparent"] = true;
          } else if (/^\s*currentcolor\s*$/i.test(value2)) {
            style["text-fill-current"] = true;
          } else {
            callback(
              value,
              value2,
              "transparent beside background-clip: text (the text color is color:), or currentcolor on a span inside such text",
            );
          }
          break;
        case "background-size": {
          let value4 = callback11(value2, ["cover", "contain"]);
          if (value4 === undefined) {
            callback(
              value,
              value2,
              "cover | contain, for a text fill's url() (box images are <img> with object-fit)",
            );
          } else {
            style["background-size"] = value4;
          }
          break;
        }
        case "background-position":
          if (/^\s*(center|50%)(\s+(center|50%))?\s*$/i.test(value2)) {
            style["background-position"] = true;
          } else {
            callback(
              value,
              value2,
              "center only (a text fill's url() is centered)",
            );
          }
          break;
        case "background-repeat":
          if (/^\s*no-repeat\s*$/i.test(value2)) {
            style["background-repeat"] = true;
          } else {
            callback(
              value,
              value2,
              "no-repeat only (a text fill's url() never tiles)",
            );
          }
          break;
        case "border":
          callback13(value2);
          break;
        case "border-top":
        case "border-right":
        case "border-bottom":
        case "border-left":
          callback13(value2, value.slice(7) as CssBoxSide);
          break;
        case "border-width": {
          let value4 =
            callback6(value2) ??
            (value3.length === 1 && value3[0]?.t === "ident"
              ? (
                  {
                    thin: 1,
                    medium: 3,
                    thick: 5,
                  } as Record<string, number>
                )[value3[0].v]
              : undefined);
          if (value4 === undefined) {
            callback(
              value,
              value2,
              "one LEN for the whole stroke (per-side: border-top|right|bottom|left)",
            );
          } else if (
            callback3(value, value4, shapeStrokeBounds, value2) !== undefined
          ) {
            style.border =
              value4 === 0
                ? {
                    style: "none",
                  }
                : {
                    ...style.border,
                    width: value4,
                    widths: undefined,
                  };
          }
          break;
        }
        case "border-style": {
          let value4 = callback11(value2, [
            "none",
            "hidden",
            "solid",
            "dashed",
            "dotted",
            "double",
          ]);
          if (value4 === undefined) {
            callback(value, value2, "solid | dashed | dotted | double | none");
          } else {
            style.border =
              value4 === "hidden" || value4 === "none"
                ? {
                    style: "none",
                  }
                : {
                    ...style.border,
                    style: value4,
                  };
          }
          break;
        }
        case "border-color": {
          let value4 =
            value3.length === 1 ? callback9(value3[0]!.raw) : undefined;
          if (value4 === undefined) {
            callback(value, value2, "one COLOR for the whole stroke");
          } else {
            style.border = {
              ...style.border,
              color: value4,
            };
          }
          break;
        }
        case "border-radius": {
          let value4: Array<CssSizeValue | undefined> =
            value3.length >= 1 && value3.length <= 4
              ? value3.map(
                  (input: CssToken) =>
                    (0, runtime.cssTokenSize)(input),
                )
              : [undefined];
          if (
            value4.some(
              (input: CssSizeValue | undefined) =>
                input === undefined || ("px" in input && input.px < 0),
            )
          ) {
            callback(value, value2, "1–4 LEN | PCT (TL TR BR BL)");
            break;
          }
          let callback14 = (input: CssSizeValue) =>
              "px" in input
                ? {
                    px: Math.min(
                      input.px,
                      slideStylePropertySchema("borderRadius").hi,
                    ),
                  }
                : input,
            value5 = (value4 as CssSizeValue[]).map(callback14),
            value6: CssSizeValue[] =
              value5.length === 1
                ? [value5[0]!, value5[0]!, value5[0]!, value5[0]!]
                : value5.length === 2
                  ? [value5[0]!, value5[1]!, value5[0]!, value5[1]!]
                  : value5.length === 3
                    ? [value5[0]!, value5[1]!, value5[2]!, value5[1]!]
                    : [value5[0]!, value5[1]!, value5[2]!, value5[3]!],
            value7 = value6.every(
              (input: CssSizeValue) =>
                JSON.stringify(input) === JSON.stringify(value6[0]),
            );
          style["border-radius"] = value7
            ? value6[0]
            : {
                corners: value6,
              };
          break;
        }
        case "box-shadow":
        case "text-shadow": {
          if (
            value3.length === 1 &&
            value3[0]!.t === "ident" &&
            value3[0]!.v === "none"
          ) {
            break;
          }
          let value4 = (0, runtime.splitCssTokenGroups)(value3);
          if (value4.length > runtime.maxShadowCount) {
            callback(
              value,
              value2,
              "at most " + String(runtime.maxShadowCount) + " shadows",
            );
            break;
          }
          let value5 = value4.map(
            (input: CssToken[]) =>
              (0, runtime.parseCssShadow)(input, value === "box-shadow"),
          );
          if (value5.some((input: ShadowValue | undefined) => input === undefined)) {
            callback(value, value2);
          } else if (
            value5.every(
              (input: ShadowValue | undefined) =>
                callback5(
                  value,
                  callback4(input!),
                  value === "box-shadow"
                    ? slideBoxShadowBounds
                    : runtime.defaultShadowBounds,
                  value2,
                ),
            )
          ) {
            style[value] = value5 as ShadowValue[];
          }
          break;
        }
        case "opacity": {
          let value4 =
            value3.length === 1
              ? (0, runtime.cssTokenRatio)(value3[0])
              : undefined;
          callback2(
            "opacity",
            value4 === undefined ? undefined : Math.max(0, Math.min(1, value4)),
            value,
            value2,
          );
          break;
        }
        case "transform": {
          let value4 = (0, runtime.parseCssTransform)(value3);
          if (value4 === undefined) {
            callback(value, value2);
          } else if (
            style.transform?.value.rotate !== undefined &&
            value4.value.rotate !== undefined
          ) {
            callback(
              value,
              value2,
              "rotate is given both as rotate: and inside transform — write one",
            );
          } else if (
            callback5(value, value4.value, runtime.transformBounds, value2)
          ) {
            style.transform = {
              ...value4,
              value: {
                ...style.transform?.value,
                ...value4.value,
              },
            };
          }
          break;
        }
        case "rotate": {
          let value4 =
            value3.length === 1
              ? (0, runtime.cssTokenDegrees)(value3[0])
              : undefined;
          if (value4 === undefined) {
            callback(value, value2, "ANGLE");
          } else if (style.transform?.value.rotate !== undefined) {
            callback(
              value,
              value2,
              "rotate is given both as rotate: and inside transform — write one",
            );
          } else {
            style.transform = {
              centerX: false,
              centerY: false,
              ...style.transform,
              value: {
                ...style.transform?.value,
                rotate: (0, runtime.normalizeSignedDegrees)(value4),
              },
            };
          }
          break;
        }
        case "filter":
        case "backdrop-filter":
        case "-webkit-backdrop-filter": {
          let value4 = (0, runtime.parseCssFilter)(value3);
          if (value4 === undefined) {
            callback(value, value2);
          } else if (callback5(value, value4, runtime.filterBounds, value2)) {
            style[value === "filter" ? "filter" : "backdrop-filter"] = value4;
          }
          break;
        }
        case "mix-blend-mode":
          callback2(
            "mix-blend-mode",
            callback11(value2, [
              "normal",
              "multiply",
              "screen",
              "overlay",
              "darken",
              "lighten",
            ]),
            value,
            value2,
          );
          break;
        case "object-fit":
          callback2(
            "object-fit",
            callback11(value2, ["cover", "contain"]),
            value,
            value2,
          );
          break;
        default:
          drop(value + " is not in this format");
      }
    }
    return style;
  }
  function resolveEmListPadding(
    declarations: ParsedCssDeclaration[],
    getFontSize: () => number,
    warn: HtmlDiagnosticReporter,
  ): ParsedCssDeclaration[] {
    let { lo: value, hi: value2 } =
      slideStylePropertySchema("paddingLeft");
    return declarations.flatMap((input: ParsedCssDeclaration): ParsedCssDeclaration[] => {
      if (
        input.prop !== "padding-left" &&
        input.prop !== "padding-inline-start"
      ) {
        return [input];
      }
      let value3 = (0, runtime.tokenizeCssValue)(input.value),
        value4 = value3.length === 1 ? value3[0] : undefined,
        value5 =
          value4?.t === "num" &&
          value4.unit === "em" &&
          Number.isFinite(value4.n)
            ? value4.n
            : undefined,
        value6 =
          value5 !== undefined
            ? Math.round(value5 * getFontSize() * 100) / 100
            : (0, runtime.cssTokenPixels)(value4);
      if (value6 !== undefined && value6 >= value && value6 <= value2) {
        return [
          {
            prop: "padding-left",
            value: String(value6) + "px",
          },
        ];
      }
      if (value6 === undefined && input.prop === "padding-left") {
        return [input];
      }
      let value7 =
        value6 === undefined
          ? "a px or em length"
          : (value5 !== undefined
              ? "is " +
                String(value6) +
                "px at the " +
                String(getFontSize()) +
                "px font size, "
              : "") +
            "outside " +
            String(value) +
            "–" +
            String(value2);
      warn(
        input.prop +
          ': "' +
          (0, runtime.compactDiagnosticValue)(input.value) +
          '" — ' +
          value7,
      );
      return [];
    });
  }
  function nodeFontSize(node: SlideNode): number {
    let style = node.style;
    if (typeof style?.fontSize === "number") {
      return style.fontSize;
    }
    let role = String((node as TextNode | TableNode).role ?? "body");
    return runtime.neutralTypeScale[role]?.fontSize ?? 32;
  }
  function nodeLineHeight(node: SlideNode): number {
    let style = node.style;
    if (typeof style?.lineHeight === "number") {
      return style.lineHeight;
    }
    let role = String((node as TextNode | TableNode).role ?? "body");
    return runtime.neutralTypeScale[role]?.lineHeight ?? 1.4;
  }
  function nodePaddingSize(node: SlideNode): PaddingSize {
    let style = node.style ?? {},
      numeric = (input: PaddingStyleKey): number =>
        typeof style[input] === "number" ? style[input] : 0;
    return {
      x: numeric("paddingLeft") + numeric("paddingRight"),
      y: numeric("paddingTop") + numeric("paddingBottom"),
    };
  }
  function nodeHasVisibleContent(node: SlideNode): boolean {
    if (node.kind === "text") {
      return String(node.text ?? "").trim() !== "";
    }
    if (node.kind === "stack" || node.kind === "grid") {
      return (node.children ?? []).some(nodeHasVisibleContent);
    }
    if (node.kind === "overlay") {
      return (
        nodeHasVisibleContent(node.base) ||
        (node.layers ?? []).some(
          (input: OverlayLayer): boolean => nodeHasVisibleContent(input.node),
        )
      );
    }
    if (node.kind === "table") {
      return (node.rows ?? []).some(
        (input: string[]): boolean =>
          input.some(
            (input2: string): boolean => String(input2).trim() !== "",
          ),
      );
    }
    return false;
  }
  function estimateTableHeight(table: TableNode, width: number): number {
    let value = table.rows ?? [],
      value2 = Math.max(
        1,
        typeof table.cols === "number" ? table.cols : 1,
      ),
      value3 =
        Array.isArray(table.colWidths) && table.colWidths.length === value2
          ? table.colWidths
          : Array.from<unknown, number>(
              {
                length: value2,
              },
              (): number => 1,
            ),
      value4 = value3.reduce(
        (input: number, options: number): number => input + options,
        0,
      ),
      value5 = nodeFontSize(table),
      value6 = nodeLineHeight(table) * value5,
      cellPadding = table.cellPadding,
      value7 =
        cellPadding?.x !== undefined ? 2 * cellPadding.x : 0.8 * value5,
      value8 =
        cellPadding?.y !== undefined ? 2 * cellPadding.y : 0.7 * value5,
      index = 0;
    for (let value9 of value) {
      let count = 1;
      value9.forEach((input: string, options: number): void => {
        let value10 = Math.max(
          1,
          (width * (value3[options] ?? 1)) / value4 - value7,
        );
        for (let value11 of String(input).split(`
`))
          count = Math.max(
            count,
            Math.ceil(
              (value11.length * value5 * estimatedGlyphWidthFactor) / value10,
            ),
          );
      });
      index += value8 + count * value6;
    }
    return index;
  }
  function estimateTextUnwrappedWidth(node: TextNode): number {
    let fontSize = nodeFontSize(node),
      width = 0;
    for (let value of String(node.text ?? "").split(`
`))
      width = Math.max(
        width,
        value.length * fontSize * estimatedGlyphWidthFactor,
      );
    return width + nodePaddingSize(node).x;
  }
  function estimateLongestWordWidth(node: TextNode): LongestWord {
    let fontSize = nodeFontSize(node),
      longestWord = "";
    for (let value of String(node.text ?? "").split(/\s+/))
      if (value.length > longestWord.length) {
        longestWord = value;
      }
    return {
      px: longestWord.length * fontSize * estimatedLongWordWidthFactor,
      word: longestWord,
    };
  }
  function estimateNodeHeight(node: SlideNode, width: number): number | undefined {
    let padding = nodePaddingSize(node),
      innerWidth = Math.max(1, width - padding.x);
    if (node.kind === "text") {
      let value = nodeFontSize(node),
        value2 = nodeLineHeight(node) * value,
        index = 0;
      for (let value3 of String(node.text ?? "").split(`
`))
        index +=
          node.wrap === "nowrap"
            ? 1
            : Math.max(
                1,
                Math.ceil(
                  (value3.length * value * estimatedGlyphWidthFactor) /
                    innerWidth,
                ),
              );
      return index * value2 + padding.y;
    }
    if (node.kind === "spacer") {
      return 0;
    }
    if (node.kind === "table") {
      return estimateTableHeight(node, innerWidth) + padding.y;
    }
    if (
      node.kind === "img" ||
      node.kind === "icon" ||
      node.kind === "shape" ||
      node.kind === "html"
    ) {
      if (typeof (node as SizedNode).h === "number") {
        return (node as SizedNode).h;
      } else {
        return undefined;
      }
    }
    if (node.kind === "stack") {
      let value = node.children ?? [],
        value2 = typeof node.gap === "number" ? node.gap : 0;
      if (node.dir === "h") {
        if (node.wrap === true) {
          return;
        }
        let index2 = 0,
          value3 = Math.max(
            1,
            (innerWidth - value2 * Math.max(0, value.length - 1)) /
              Math.max(1, value.length),
          );
        for (let value4 of value) {
          let value5 = estimateNodeHeight(
            value4,
            explicitNodeWidth(value4) ?? value3,
          );
          if (value5 === undefined) {
            return;
          }
          index2 = Math.max(index2, value5);
        }
        return index2 + padding.y;
      }
      let index = 0;
      for (let value3 of value) {
        let value4 = estimateNodeHeight(value3, innerWidth);
        if (value4 === undefined) {
          return;
        }
        index += value4;
      }
      return index + value2 * Math.max(0, value.length - 1) + padding.y;
    }
    return;
  }
  function explicitNodeWidth(node: SlideNode): number | undefined {
    let place = node.place;
    if (place?.minWFit !== undefined) {
      return;
    }
    if (
      place !== undefined &&
      typeof place.minW === "number" &&
      place.minW === place.maxW
    ) {
      return place.minW;
    }
    if (
      (node.kind === "img" || node.kind === "icon" || node.kind === "shape") &&
      typeof node.w === "number"
    ) {
      return node.w;
    }
    return;
  }
  function resolveHtmlAxisPlacement(
    axis: Axis,
    designSize?: number,
  ): AxisPlacement | undefined {
    let value = typeof axis.margin === "number" ? axis.margin : 0,
      value2 = typeof axis.size === "number" ? axis.size : undefined,
      value3 = typeof axis.offset === "number" ? axis.offset : 0;
    switch (axis.anchor) {
      case "leading":
        return {
          at: value,
          ...(value2 !== undefined
            ? {
                size: value2,
              }
            : {}),
        };
      case "fill":
        if (designSize === undefined) {
          return undefined;
        } else {
          return {
            at: value,
            size: Math.max(0, designSize - 2 * value),
          };
        }
      case "trailing":
        if (designSize === undefined || value2 === undefined) {
          return undefined;
        } else {
          return {
            at: designSize - value - value2,
            size: value2,
          };
        }
      case "center":
        if (designSize === undefined || value2 === undefined) {
          return undefined;
        } else {
          return {
            at: designSize / 2 + value3 - value2 / 2,
            size: value2,
          };
        }
      default:
        return;
    }
  }
  function rotatedBox(
    x: number,
    y: number,
    width: number,
    height: number,
    centerX: number,
    centerY: number,
    rotation: number,
  ): RotatedBox {
    let value = (rotation * Math.PI) / 180,
      value2 = x + width / 2 - centerX,
      value3 = y + height / 2 - centerY;
    return {
      cx: centerX + value2 * Math.cos(value) - value3 * Math.sin(value),
      cy: centerY + value2 * Math.sin(value) + value3 * Math.cos(value),
      hw: width / 2,
      hh: height / 2,
      rot: rotation,
    };
  }
  function pointInRotatedBoxCoordinates(
    box: RotatedBox,
    point: Point,
  ): Point {
    let value = (-box.rot * Math.PI) / 180,
      value2 = point[0] - box.cx,
      value3 = point[1] - box.cy;
    return [
      value2 * Math.cos(value) - value3 * Math.sin(value),
      value2 * Math.sin(value) + value3 * Math.cos(value),
    ];
  }
  function segmentIntersectsRotatedBox(
    box: RotatedBox,
    padding: number,
    start: Point,
    end: Point,
  ): [number, number] | undefined {
    let [value, value2] = pointInRotatedBoxCoordinates(box, start),
      [value3, value4] = pointInRotatedBoxCoordinates(box, end),
      index = 0,
      count = 1,
      items: Point[] = [
        [-(value3 - value), value + box.hw + padding],
        [value3 - value, box.hw + padding - value],
        [-(value4 - value2), value2 + box.hh + padding],
        [value4 - value2, box.hh + padding - value2],
      ];
    for (let [value5, value6] of items) {
      if (Math.abs(value5) < 0.000000001) {
        if (value6 < 0) {
          return;
        }
        continue;
      }
      let value7 = value6 / value5;
      if (value5 < 0) {
        index = Math.max(index, value7);
      } else {
        count = Math.min(count, value7);
      }
      if (index > count) {
        return;
      }
    }
    return [index, count];
  }
  function rotatedBoxesOverlap(box: RotatedBox, otherBox: RotatedBox): number {
    let callback = (input: RotatedBox): Point[] => {
        let value4 = (input.rot * Math.PI) / 180,
          items: Point = [
            Math.cos(value4) * input.hw,
            Math.sin(value4) * input.hw,
          ],
          items2: Point = [
            -Math.sin(value4) * input.hh,
            Math.cos(value4) * input.hh,
          ];
        return [
          [input.cx + items[0] + items2[0], input.cy + items[1] + items2[1]],
          [input.cx + items[0] - items2[0], input.cy + items[1] - items2[1]],
          [input.cx - items[0] + items2[0], input.cy - items[1] + items2[1]],
          [input.cx - items[0] - items2[0], input.cy - items[1] - items2[1]],
        ];
      },
      value = callback(box),
      value2 = callback(otherBox),
      value3 = 1 / 0;
    for (let value4 of [box, otherBox]) {
      let value5 = (value4.rot * Math.PI) / 180;
      for (let value6 of [
        [Math.cos(value5), Math.sin(value5)],
        [-Math.sin(value5), Math.cos(value5)],
      ] as Point[]) {
        let value7 = value.map(
            (input: Point): number =>
              input[0] * value6[0] + input[1] * value6[1],
          ),
          value8 = value2.map(
            (input: Point): number =>
              input[0] * value6[0] + input[1] * value6[1],
          ),
          value9 =
            Math.min(Math.max(...value7), Math.max(...value8)) -
            Math.max(Math.min(...value7), Math.min(...value8));
        if (value9 <= 0) {
          return 0;
        }
        value3 = Math.min(value3, value9);
      }
    }
    return value3;
  }
  function estimateTextBounds(
    node: TextNode,
    width: number,
    height: number,
  ): PixelRect {
    let value = node.style ?? {},
      callback = (input: PaddingStyleKey): number =>
        typeof value[input] === "number" ? value[input] : 0,
      value2 = nodeFontSize(node),
      value3 = nodeLineHeight(node) * value2,
      value4 = Math.max(
        1,
        width - callback("paddingLeft") - callback("paddingRight"),
      ),
      value5 =
        estimateTextUnwrappedWidth(node) - nodePaddingSize(node).x,
      value6 = node.wrap !== "nowrap" && value5 > value4,
      index = 0;
    for (let value12 of String(node.text ?? "").split(`
`))
      index += value6
        ? Math.max(
            1,
            Math.ceil(
              (value12.length * value2 * estimatedGlyphWidthFactor) / value4,
            ),
          )
        : 1;
    let value7 = value6 ? value4 : value5,
      value8 = Math.min(
        height - callback("paddingTop") - callback("paddingBottom"),
        index * value3,
      ),
      value9 = Math.max(0, value4 - value7),
      value10 =
        callback("paddingLeft") +
        (node.align === "center"
          ? value9 / 2
          : node.align === "end"
            ? value9
            : 0),
      value11 = Math.max(0.15 * value2, (value3 - 1.15 * value2) / 2);
    return {
      x: value10,
      y: callback("paddingTop") + value11,
      w: value7,
      h: Math.max(1, value8 - 2 * value11),
    };
  }
  function iconStyleWarnings(node: IconNode, parentPainted?: boolean): IconStyleWarning[] {
    let items: IconStyleWarning[] = [],
      value = node.style ?? {},
      value2 = typeof value.opacity === "number" ? value.opacity : 1;
    if (parentPainted || value2 <= 0.5) {
      return items;
    }
    let value3 = typeof node.w === "number" ? node.w : undefined,
      value4 = typeof node.h === "number" ? node.h : value3;
    if (value3 === undefined || value4 === undefined) {
      return items;
    }
    let value5 = Math.round(
      Math.min(value3, value4) * Number((value.transform ?? {}).scale ?? 1),
    );
    if (value5 < 32) {
      items.push({
        key: "size",
        msg:
          '"' +
          String(node.icon) +
          '" is ' +
          String(value5) +
          "px — an icon draws its glyph at about half its box, so under 32px it reads as a speck beside the text; give it width and height of at least 32px (48px next to 24px text)",
      });
    }
    return items;
  }
  function hasLowOpaqueContrast(
    foreground: string | undefined,
    background: string | undefined,
    opacity?: number,
    minimumRatio = 1.6,
  ): boolean {
    if ((parseHexColorChannels(background)?.a ?? 0) < 0.8) {
      return false;
    }
    let value = hexContrastRatio(foreground, background, opacity);
    return value !== undefined && value < minimumRatio;
  }
  function parseHexColorChannels(color: string | undefined): HexColorChannels | undefined {
    let match =
      typeof color === "string"
        ? /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(color)
        : null;
    if (match === null) {
      return undefined;
    } else {
      return {
        ch: [0, 2, 4].map(
          (input: number): number =>
            parseInt(match[1]!.slice(input, input + 2), 16) / 255,
        ),
        a: match[2] !== undefined ? parseInt(match[2], 16) / 255 : 1,
      };
    }
  }
  function hexContrastRatio(
    foreground: string | undefined,
    background: string | undefined,
    opacity = 1,
  ): number | undefined {
    let [foregroundColor, backgroundColor] = [
      parseHexColorChannels(foreground),
      parseHexColorChannels(background),
    ];
    if (foregroundColor === undefined || backgroundColor === undefined) {
      return;
    }
    let luminance = (input: number[]): number => {
        let value4 = input.map(
          (input2: number): number =>
            input2 <= 0.03928
              ? input2 / 12.92
              : ((input2 + 0.055) / 1.055) ** 2.4,
        );
        return 0.2126 * value4[0]! + 0.7152 * value4[1]! + 0.0722 * value4[2]!;
      },
      value = foregroundColor.a * opacity,
      value2 = luminance(
        foregroundColor.ch.map(
          (input: number, options: number): number =>
            value * input + (1 - value) * backgroundColor.ch[options]!,
        ),
      ),
      value3 = luminance(backgroundColor.ch);
    return (
      (Math.max(value2, value3) + 0.05) / (Math.min(value2, value3) + 0.05)
    );
  }
  function compositeHexColor(
    foreground: string | undefined,
    background = "#ffffff",
  ): string | undefined {
    let [foregroundColor, backgroundColor] = [
      parseHexColorChannels(foreground),
      parseHexColorChannels(background),
    ];
    if (foregroundColor === undefined || backgroundColor === undefined) {
      return foreground;
    } else {
      return (
        "#" +
        foregroundColor.ch
          .map(
            (input: number, options: number): string =>
              Math.round(
                (foregroundColor.a * input +
                  (1 - foregroundColor.a) * backgroundColor.ch[options]!) *
                  255,
              )
                .toString(16)
                .padStart(2, "0"),
          )
          .join("")
      );
    }
  }
  function contrastingTextColor(background: string | undefined): string {
    if (
      (hexContrastRatio("#faf9f5", background) ?? 0) >
      (hexContrastRatio("#141413", background) ?? 0)
    ) {
      return "#faf9f5";
    } else {
      return "#141413";
    }
  }
  function collectSlidePaintLayers(slide: Frame[]): SlidePaintLayers {
    let items: PaintLayer[] = [],
      [items2, items3] = [false, false],
      callback = (
        source: NodeProbe,
        options: PaintFills,
        context: number,
        value: boolean,
        extra: boolean,
        detail: number,
      ): PaintFills => {
        let value2 = source.style ?? {},
          value3 =
            context * (typeof value2.opacity === "number" ? value2.opacity : 1),
          backgroundGradient = value2.backgroundGradient,
          value4 =
            backgroundGradient !== undefined
              ? (backgroundGradient.stops ?? []).every(
                  (input: GradientStop): boolean =>
                    parseHexColorChannels(input.color)?.a === 1,
                )
                ? 1
                : undefined
              : value2.backgroundColor === undefined
                ? 0
                : parseHexColorChannels(value2.backgroundColor)?.a,
          value5 =
            extra || (value2.mixBlendMode ?? "normal") !== "normal",
          value6 =
            value2.filter !== undefined ||
            value2.backdropFilter !== undefined ||
            value4 === undefined ||
            (value4 > 0 && value3 < 1),
          value7 =
            options === "hidden"
              ? options
              : value5
                ? "unknown"
                : value4 === 1 && value3 === 1
                  ? "hidden"
                  : value6
                    ? "unknown"
                    : options === "unknown" || value4 === 0
                      ? options
                      : [...options, value2.backgroundColor],
          value8 =
            source.kind === "text" &&
            typeof source.text === "string" &&
            source.text.trim() !== "";
        if (
          source.kind === "table" ||
          ((value8 || source.kind === "icon") &&
            source.fill === undefined &&
            source.color === undefined)
        ) {
          items3 = true;
        }
        if (
          value7 !== "hidden" &&
          (value8 ||
            source.kind === "icon" ||
            source.kind === "table" ||
            source.kind === "html")
        ) {
          let fill = source.fill,
            value9 = Array.isArray(source.marks)
              ? source.marks.flatMap(
                  (input: TextMark): string[] =>
                    input.color === undefined ? [] : [input.color],
                )
              : [],
            value10 =
              typeof value2.textStrokeWidth === "number" &&
              value2.textStrokeWidth > 0,
            value11 =
              fill !== undefined
                ? (fill.gradient?.stops ?? []).map(
                    (input: GradientStop): string => input.color,
                  )
                : [source.color],
            value12 =
              source.kind === "table" ||
              source.kind === "html" ||
              value10 ||
              (fill !== undefined && fill.kind !== "gradient")
                ? undefined
                : [...value11, ...value9];
          if (value7 === "unknown" || value12 === undefined) {
            items2 = true;
          } else {
            items.push({
              colors: value12,
              ink: value11,
              opacity: value3,
              fills: value7,
              bare:
                value &&
                value8 &&
                value7.length === 0 &&
                value12.every(
                  (input: string | undefined): boolean => input !== undefined,
                ),
            });
          }
        }
        for (let value9 of (Array.isArray(source.children)
          ? source.children
          : []))
          if (value9 !== null && typeof value9 === "object") {
            callback(value9, value7, value3, value, value5, detail);
          }
        if (source.base !== null && typeof source.base === "object") {
          let base = source.base,
            value9 = callback(
              base,
              value7,
              value3,
              value,
              value5,
              detail,
            ),
            value10 =
              value && value9 === value7 && !nodePaintsVisibleContent(base),
            value11 = base.style ?? {},
            value12 =
              (typeof value11.opacity === "number" && value11.opacity < 1) ||
              value11.filter !== undefined,
            value13 = value9 !== value7 && value9 !== "hidden";
          if (value13 && detail >= 2) {
            items2 = true;
          }
          for (let value14 of (Array.isArray(source.layers)
            ? source.layers
            : [])) {
            if (value14.node === null || typeof value14.node !== "object") {
              continue;
            }
            callback(
              value14.node,
              value12 && value7 !== "hidden" ? "unknown" : value7,
              value3,
              value10,
              value5,
              value13 ? detail + 1 : detail,
            );
            if (value13 && detail < 2) {
              callback(value14.node, value9, value3, false, value5, detail + 1);
            }
          }
        }
        return value7;
      };
    for (let value of slide)
      callback(value.node, [], 1, true, false, 0);
    return {
      shown: items,
      unmeasured: items2,
      colourless: items3,
    };
  }
  function nodePaintsVisibleContent(node: NodeProbe): boolean {
    let value = node.style ?? {};
    if (
      value.backgroundGradient !== undefined ||
      (value.backgroundColor !== undefined &&
        parseHexColorChannels(value.backgroundColor)?.a !== 0)
    ) {
      return true;
    }
    if (node.kind === "text") {
      return typeof node.text === "string" && node.text.trim() !== "";
    }
    if (node.kind === "spacer") {
      return false;
    }
    if (
      node.kind !== "stack" &&
      node.kind !== "grid" &&
      node.kind !== "overlay"
    ) {
      return true;
    }
    return [
      ...(Array.isArray(node.children) ? node.children : []),
      node.base,
      ...(Array.isArray(node.layers)
        ? node.layers.map((input: OverlayLayer): SlideNode => input.node)
        : []),
    ].some(
      (input: SlideNode | undefined): boolean =>
        input !== null &&
        typeof input === "object" &&
        nodePaintsVisibleContent(input),
    );
  }
  function backgroundChangePreservesContrast(
    paints: SlidePaintLayers,
    previousBackground: string,
    background: string,
  ): boolean {
    let callback = (
      input: PaintLayer,
      options: string | undefined,
      context: string,
    ): number | undefined =>
      hexContrastRatio(
        options ?? contrastingTextColor(context),
        input.fills.reduce(
          (input2: string | undefined, options2: string | undefined): string | undefined =>
            compositeHexColor(options2, input2),
          compositeHexColor(context),
        ),
        input.opacity,
      );
    return (
      paints.unmeasured ||
      paints.shown.some(
        (input: PaintLayer): boolean =>
          input.colors.some((input2: string | undefined): boolean => {
            let [items, items2] = [
              callback(input, input2, previousBackground),
              callback(input, input2, background),
            ];
            return (
              items === undefined ||
              items2 === undefined ||
              (items >= 3 && items2 < 3)
            );
          }),
      )
    );
  }
  function hexColorAlpha(color: string | undefined): number {
    let value =
      typeof color === "string"
        ? /^#[0-9a-f]{6}([0-9a-f]{2})$/i.exec(color)
        : null;
    if (value === null) {
      return 1;
    } else {
      return parseInt(value[1]!, 16) / 255;
    }
  }
  function combineNestedAxisSpecs(
    outerAxis: Axis,
    innerAxis: Axis,
  ): Axis | "outer" | "inner" {
    let { anchor: outerAnchor, margin: outerMargin } = outerAxis,
      outerOffset = outerAxis.offset ?? 0,
      outerSize = outerAxis.size,
      innerAnchor = innerAxis.anchor,
      innerMargin = innerAxis.margin,
      innerOffset = innerAxis.offset ?? 0,
      innerSize = innerAxis.size,
      axis = (
        input: AxisAnchor,
        options: number,
        context: number,
        value2?: number,
      ): Axis => {
        let state: Axis = {
          anchor: input,
          margin: options,
          offset: context,
        };
        if (value2 !== undefined) {
          state.size = Math.max(1, value2);
        }
        return state;
      };
    if (outerAnchor === "fill") {
      if (innerAnchor === "center") {
        return axis("center", 0, innerOffset, innerSize);
      }
      return axis(
        innerAnchor,
        outerMargin + innerMargin,
        0,
        innerAnchor === "fill" ? undefined : innerSize,
      );
    }
    if (innerAnchor === outerAnchor) {
      return axis(
        outerAnchor,
        outerAnchor === "center" ? 0 : outerMargin + innerMargin,
        outerAnchor === "center" ? outerOffset + innerOffset : 0,
        innerSize,
      );
    }
    if (outerSize === undefined) {
      return "outer";
    }
    if (innerAnchor === "fill") {
      return axis(
        outerAnchor,
        outerAnchor === "center" ? 0 : outerMargin + innerMargin,
        outerOffset,
        outerSize - 2 * innerMargin,
      );
    }
    if (innerSize === undefined) {
      return "inner";
    }
    let value =
      innerAnchor === "leading"
        ? innerMargin
        : innerAnchor === "trailing"
          ? outerSize - innerMargin - innerSize
          : outerSize / 2 + innerOffset - innerSize / 2;
    if (outerAnchor === "leading") {
      return axis("leading", outerMargin + value, 0, innerSize);
    }
    if (outerAnchor === "trailing") {
      return axis(
        "trailing",
        outerMargin + outerSize - value - innerSize,
        0,
        innerSize,
      );
    }
    return axis(
      "center",
      0,
      outerOffset - outerSize / 2 + value + innerSize / 2,
      innerSize,
    );
  }
  function inlineStyleIsAbsolute(css: string | undefined): boolean {
    if (css === undefined || !/position/i.test(css)) {
      return false;
    }
    let position = (0, runtime.parseCssDeclarations)(
      css,
      (): void => {},
    ).find((input: ParsedCssDeclaration): boolean => input.prop === "position");
    return position !== undefined && /^absolute$/i.test(position.value.trim());
  }
  function unwrapTransparentContainer(
    element: HtmlElementNode,
    node: ParsedInlineStyle,
    context: HtmlNodeContext,
  ): number | undefined {
    if (
      Object.keys(element.attrs).some(
        (input: string): boolean => input !== "style",
      )
    ) {
      return;
    }
    let flag = false,
      callback = (): void => {
        flag = true;
      };
    parseInlineStyle(element.attrs.style, callback, callback);
    if (
      flag ||
      (0, runtime.parseCssDeclarations)(
        element.attrs.style ?? "",
        callback,
      ).some(
        (input: ParsedCssDeclaration): boolean =>
          transparentContainerStylePatterns
            .get(input.prop)
            ?.test(input.value) !== true,
      )
    ) {
      return;
    }
    let callback2 = (input: "auto" | CssSizeValue | undefined): number | undefined =>
        input !== undefined && input !== "auto" && "px" in input
          ? input.px
          : undefined,
      value = callback2(node.width);
    if (
      value !== undefined
        ? value <= 0
        : context.parentDir === "h" ||
          context.parentAlign?.w !== undefined ||
          (context.flowCount ?? 0) < 2
    ) {
      return;
    }
    let value2 = callback2(node.height) ?? 0,
      border = node.border;
    if (border === undefined || border.style === "none") {
      if (node["background-color"] !== undefined && value2 > 0) {
        return value2;
      } else {
        return undefined;
      }
    }
    let value3 = border.width ?? 0;
    if (
      border.sides?.length !== 1 ||
      value3 <= 0 ||
      node["background-color"] !== undefined
    ) {
      return;
    }
    if (value2 <= value3) {
      return value3;
    } else {
      return undefined;
    }
  }
  function migrateThinBorderToFill(
    node: ShapeNode,
    style: StyleBag,
    placement: NodePlacement,
    context: HtmlNodeContext,
    thickness: number,
  ): void {
    node.h = thickness;
    style.backgroundColor = style.borderColor;
    for (let value of ["borderStyle", "borderWidth", "borderColor"] as StylePropertyName[])
      delete style[value];
    node.style = style;
    if (
      context.parentDir === "v" &&
      context.parentGrid !== true &&
      thickness <= 2 * runtime.maxShapeStrokeWidth
    ) {
      Object.assign(placement, {
        grow: 0,
        shrink: 0,
      });
    }
  }
  function parseInlineTextTree(element: InlineRun[]): ParsedInlineText {
    let text = "",
      marks: TextMark[] = [],
      hasList = false,
      format: InlineRun | undefined,
      markStart = 0,
      flushMark = (): void => {
        if (
          format !== undefined &&
          text.length > markStart &&
          (format.bold ||
            format.italic ||
            format.underline ||
            format.color !== undefined ||
            format.href !== undefined)
        ) {
          let state: TextMark = {
            start: markStart,
            end: text.length,
          };
          if (format.bold) {
            state.bold = true;
          }
          if (format.italic) {
            state.italic = true;
          }
          if (format.underline) {
            state.underline = true;
          }
          if (format.color !== undefined) {
            state.color = format.color;
          }
          if (format.href !== undefined) {
            state.href = format.href;
          }
          marks.push(state);
        }
      },
      callback = (input: InlineRun | undefined, options: InlineRun): boolean =>
        input !== undefined &&
        input.bold === options.bold &&
        input.italic === options.italic &&
        input.underline === options.underline &&
        input.color === options.color &&
        input.href === options.href,
      callback2 = (input: InlineRun, options: InlineRun): InlineRun => ({
        text: "",
        ...(input.bold !== undefined && input.bold === options.bold
          ? {
              bold: input.bold,
            }
          : {}),
        ...(input.italic !== undefined && input.italic === options.italic
          ? {
              italic: input.italic,
            }
          : {}),
        ...(input.underline !== undefined &&
        input.underline === options.underline
          ? {
              underline: input.underline,
            }
          : {}),
        ...(input.color !== undefined && input.color === options.color
          ? {
              color: input.color,
            }
          : {}),
        ...(input.href !== undefined && input.href === options.href
          ? {
              href: input.href,
            }
          : {}),
      }),
      callback3 = (input: string, options: InlineRun): void => {
        if (!callback(format, options)) {
          flushMark();
          format = options;
          markStart = text.length;
        }
        text += input;
      },
      value: InlineRun | undefined;
    for (let value2 of element)
      for (let value3 of value2.text) {
        if (
          value3 ===
            `
` &&
          value2.text ===
            `
`
        ) {
          hasList = false;
          while (text.endsWith(" "))
            if (
              ((text = text.slice(0, -1)),
              format !== undefined && text.length < markStart)
            ) {
              markStart = text.length;
            }
          callback3(
            `
`,
            {
              text: "",
            },
          );
          value = value2;
          continue;
        }
        if (
          value3 === " " ||
          value3 === "\t" ||
          value3 ===
            `
` ||
          value3 === "\r" ||
          value3 === "\f"
        ) {
          hasList = true;
          value = value2;
          continue;
        }
        if (
          hasList &&
          text.length > 0 &&
          !text.endsWith(`
`)
        ) {
          callback3(
            " ",
            value === undefined
              ? {
                  text: "",
                }
              : callback(value, value2)
                ? value2
                : callback2(value, value2),
          );
        }
        hasList = false;
        callback3(value3, value2);
        value = value2;
      }
    flushMark();
    return {
      text: text,
      marks: marks,
    };
  }
  function stripCssComments(css: string): string {
    let text = "",
      index = 0;
    for (;;) {
      htmlCompilerCounters.commentScans++;
      let value = css.indexOf("/*", index);
      if (value < 0) {
        break;
      }
      let value2 = css.indexOf("*/", value + 2);
      if (value2 < 0) {
        break;
      }
      text += css.slice(index, value);
      index = value2 + 2;
    }
    return text + css.slice(index);
  }
  function parseFontFaceRules(
    css: string,
    warn: SlideHtmlCompilerInstance,
    report: HtmlSourcePosition,
  ): void {
    let value = stripCssComments(css),
      value2: RegExpExecArray | null,
      text = "";
    fontFaceRulesPattern.lastIndex = 0;
    while ((value2 = fontFaceRulesPattern.exec(value)) !== null) {
      text += value2[0];
      let value4 = value2[1]!,
        value5: string | undefined,
        value6: string | undefined,
        flag = false,
        items: string[] = [],
        index = 0,
        index2 = 0;
      for (let index3 = 0; index3 < value4.length; index3++) {
        let value8 = value4[index3];
        if (value8 === "(") {
          index++;
        } else if (value8 === ")") {
          index = Math.max(0, index - 1);
        } else if (value8 === ";" && index === 0) {
          items.push(value4.slice(index2, index3));
          index2 = index3 + 1;
        }
      }
      items.push(value4.slice(index2));
      for (let value8 of items) {
        if (value8.trim() === "") {
          continue;
        }
        let value9 = value8.indexOf(":"),
          value10 = value8.slice(0, value9).trim().toLowerCase(),
          value11 = value8.slice(value9 + 1).trim();
        if (value10 === "font-family") {
          let value12 = /^(?:"([^"]*)"|'([^']*)'|([^"']+))$/.exec(
            value11,
          );
          value5 = (value12?.[1] ?? value12?.[2] ?? value12?.[3] ?? "").trim();
        } else if (value10 === "src") {
          let value12 =
            /^url\(\s*(?:"([^"]*)"\s*|'([^']*)'\s*|([^"')\s]+)\s*)?\)(?:\s*format\((?:\s*"[^"]*"\s*|\s*'[^']*'\s*|[^)]*)\))?$/i.exec(
              value11,
            );
          if (!value12) {
            warn.errorAt(
              report,
              "@font-face src must be one url(file.woff2) (or a data: URI)",
            );
            flag = true;
          } else {
            value6 = (value12[1] ?? value12[2] ?? value12[3] ?? "").trim();
          }
        } else if (
          value10 === "font-weight" ||
          value10 === "font-style" ||
          value10 === "font-display" ||
          value10 === "unicode-range" ||
          value10 === "font-stretch"
        ) {
        } else {
          warn.errorAt(
            report,
            '@font-face: "' +
              (0, runtime.compactDiagnosticValue)(value10) +
              '" — only font-family and src',
          );
          flag = true;
        }
      }
      if (flag) {
        continue;
      }
      if (
        value5 === undefined ||
        !runtime.customFontFamilyPattern.test(value5)
      ) {
        warn.errorAt(
          report,
          '@font-face font-family "' +
            (0, runtime.compactDiagnosticValue)(value5 ?? "") +
            '" — a plain name (letters, digits, spaces, - _; ≤40 chars, starts with a letter)',
        );
        continue;
      }
      if (value6 === undefined || value6 === "") {
        warn.errorAt(
          report,
          '@font-face for "' + value5 + '" has no src: url(…)',
        );
        continue;
      }
      if (/^data:/i.test(value6)) {
        if (!(0, runtime.isEmbeddedFontDataUrl)(value6)) {
          warn.errorAt(
            report,
            '@font-face "' +
              value5 +
              '": src must be data:font/(woff2|woff|ttf|otf);base64,… up to 512 KB',
          );
          continue;
        }
        warn.declareFace(
          {
            family: value5,
            src: value6,
          },
          report,
        );
        continue;
      }
      if (
        (0, runtime.isModelBlobReference)(value6) ||
        runtime.designSystemFontPathPattern.test(value6)
      ) {
        warn.declareFace(
          {
            family: value5,
            src: value6,
          },
          report,
        );
        continue;
      }
      if (/^https?:/i.test(value6)) {
        warn.errorAt(
          report,
          '@font-face "' +
            value5 +
            '": fonts are embedded from a file beside the deck (url(Name.woff2)) or linked through a Google Fonts <link>; other URLs are not fetched',
        );
        continue;
      }
      if (
        /^\//.test(value6) ||
        (!warn.collectsFiles() && /(^|[\\/])\.\.([\\/]|$)/.test(value6))
      ) {
        warn.errorAt(
          report,
          '@font-face "' +
            value5 +
            '": url(' +
            (0, runtime.compactDiagnosticValue)(value6) +
            ") — a file name or relative path (no absolute paths)",
        );
        continue;
      }
      let value7 = warn.fileRef(value6, "font", report);
      if (value7 === undefined && !warn.collectsFiles()) {
        warn.errorAt(
          report,
          '@font-face "' +
            value5 +
            '": url(' +
            (0, runtime.compactDiagnosticValue)(value6) +
            ") is a file reference with no data — build the deck with scripts/make.ts (it uploads or embeds the font)",
        );
      }
      warn.declareFace(
        value7 !== undefined
          ? {
              family: value5,
              src: value7,
            }
          : {
              family: value5,
              src: "file:" + value6,
            },
        report,
      );
    }
    let value3 = value.replace(fontFaceRulesPattern, "").trim();
    if (value3 !== "") {
      warn.errorAt(
        report,
        '<style> may contain only @font-face rules — everything else is inline style="" (found "' +
          (0, runtime.compactDiagnosticValue)(value3, 50) +
          '")',
      );
    }
  }
  function parseHtmlHead(
    head: HtmlElementNode,
    compiler: SlideHtmlCompilerInstance,
  ): ParsedHtmlHead {
    let value: string | undefined;
    for (let value2 of head.children) {
      if (value2.kind === "text") {
        continue;
      }
      switch (value2.tag) {
        case "title":
          value = value2.children
            .map(
              (source: HtmlTreeNode): string =>
                source.kind === "text" ? source.text : "",
            )
            .join("")
            .replace(/\s+/g, " ")
            .trim();
          break;
        case "meta":
        case "base":
          break;
        case "link": {
          let value3 = (value2.attrs.rel ?? "").trim().toLowerCase(),
            value4 = (value2.attrs.href ?? "").trim();
          if (value3 !== "stylesheet") {
            if (
              value3 === "preconnect" ||
              value3 === "dns-prefetch" ||
              value3 === "icon" ||
              value3 === "preload"
            ) {
              compiler.warnAt(
                value2,
                '<link rel="' + value3 + '"> is not in this format — dropped',
              );
              break;
            }
            compiler.errorAt(
              value2,
              '<link> — only rel="stylesheet" to a Google Fonts css2 URL',
            );
            break;
          }
          if (!(0, runtime.isAllowedGoogleFontStylesheet)(value4)) {
            compiler.errorAt(
              value2,
              '<link rel="stylesheet"> may only load https://fonts.googleapis.com/css2?family=… (≤1024 chars, spaces as +, no %-escapes); everything else is inline style=""',
            );
            break;
          }
          let value5 = [
            ...value4.matchAll(/[?&]family=([^&:]+)/g),
          ].map(
            (input: RegExpMatchArray): string =>
              decodeURIComponent(input[1]!.replace(/\+/g, " ")).trim(),
          );
          if (value5.length === 0) {
            compiler.errorAt(
              value2,
              "Google Fonts <link> names no family= parameter",
            );
          }
          for (let value6 of value5) {
            if (!runtime.customFontFamilyPattern.test(value6)) {
              compiler.errorAt(
                value2,
                'Google Fonts family "' +
                  (0, runtime.compactDiagnosticValue)(value6) +
                  '" is not a usable family name',
              );
              continue;
            }
            compiler.declareFace(
              {
                family: value6,
                href: value4,
              },
              value2,
            );
          }
          break;
        }
        case "style":
          parseFontFaceRules(
            value2.children
              .map(
                (source: HtmlTreeNode): string =>
                  source.kind === "text" ? source.text : "",
              )
              .join(""),
            compiler,
            value2,
          );
          break;
        case "script":
          compiler.errorAt(
            value2,
            "<script> is not allowed (scripts never run here)",
          );
          break;
        default:
          compiler.errorAt(
            value2,
            "<" +
              value2.tag +
              "> does not belong in <head> (title, link, style, meta)",
          );
      }
    }
    if (value !== undefined) {
      return {
        title: value,
      };
    } else {
      return {};
    }
  }
  function deterministicEmbedId(html: string, index: number): string {
    let count = 2166136261;
    for (let index2 = 0; index2 < html.length; index2++) {
      count ^= html.charCodeAt(index2);
      count = Math.imul(count, 16777619) >>> 0;
    }
    return "e" + String(index) + "-" + count.toString(36);
  }
  function compileHtmlSection(
    section: HtmlElementNode,
    compiler: SlideHtmlCompilerInstance,
    theme: InheritedTextStyle,
    index: number,
    assets: Set<string>,
    previousSlide: string | undefined,
  ): Slide {
    compiler.resetSlide();
    compiler.slideLabel =
      "slide " +
      String(index + 1) +
      (section.attrs.id !== undefined
        ? ' "' + (0, runtime.compactDiagnosticValue)(section.attrs.id, 24) + '"'
        : "") +
      ": ";
    let value = compiler.warner(section, "<section> "),
      state: InlineStyleBoxState = {
        box: {
          w: runtime.SLIDE_WIDTH,
          h: runtime.SLIDE_HEIGHT,
        },
      },
      value2 = parseInlineStyle(
        section.attrs.style,
        value,
        compiler.rejecter(section, "<section> "),
        state,
      ),
      values = new Set<string>(),
      state2 = {
        v: 1,
      } as Slide,
      value3 = (section.attrs.id ?? "").trim();
    if (previousSlide !== undefined) {
      if (value3 !== previousSlide) {
        value(
          'id="' +
            (0, runtime.compactDiagnosticValue)(value3) +
            '" differs from the record key "' +
            previousSlide +
            '" — the key is used',
        );
      }
      state2.id = previousSlide;
    } else if (value3 !== "" && /^[\w-]{1,64}$/.test(value3)) {
      state2.id = value3;
    } else {
      if (value3 !== "") {
        value(
          'id="' +
            (0, runtime.compactDiagnosticValue)(value3) +
            '" — letters, digits, - and _ only — a generated id is used',
        );
      }
      let value14 = index + 1;
      while (assets.has("slide-" + String(value14))) value14++;
      let value15 = "slide-" + String(value14);
      state2.id = value15;
      assets.add(value15);
    }
    for (let value14 of Object.keys(section.attrs)) {
      if (
        value14 === "id" ||
        value14 === "style" ||
        value14 === "hidden" ||
        value14 === "data-transition" ||
        value14 === "data-section"
      ) {
        continue;
      }
      if (value14.startsWith("on")) {
        value(value14 + " is dropped (scripts never run here)");
      } else {
        value(value14 + " attribute is not in this format — dropped");
      }
    }
    if (
      (section.attrs["data-section"] ?? "").replace(/\s+/g, " ").trim().length >
      runtime.maxSectionDescriptionLength
    ) {
      value(
        "data-section is one sentence — capped at " +
          String(runtime.maxSectionDescriptionLength) +
          " characters",
      );
    }
    if (section.attrs.hidden !== undefined) {
      state2.skipped = true;
    }
    let value4 = section.attrs["data-transition"];
    if (value4 !== undefined) {
      let value14 = value4.trim().toLowerCase();
      if (runtime.slideTransitionValues.includes(value14)) {
        state2.transition = value14 as SlideTransition;
      } else if (value14 !== "none" && value14 !== "") {
        value(
          'data-transition="' +
            (0, runtime.compactDiagnosticValue)(value4) +
            '" — fade | push | magic — dropped',
        );
      }
    }
    values.add("background-color");
    values.add("background-gradient");
    state2.bg = value2["background-color"] ?? "#ffffff";
    let value5 = value2["background-gradient"];
    compiler.slideBg =
      value5 !== undefined
        ? undefined
        : (value2["background-color"] ?? "#ffffff");
    let value6 = compiler.inherit(value2, theme, section);
    for (let value14 of [
      "font-family",
      "font-size",
      "font-weight",
      "font-style",
      "line-height",
      "letter-spacing",
      "text-align",
      "text-transform",
      "white-space",
      "color",
    ] as const)
      values.add(value14);
    let items: Frame[] = [],
      items2: HtmlElementNode[] = [],
      items3: Array<{ at: number; el: HtmlElementNode }> = [],
      value7: string | undefined,
      value8 = -1,
      index2 = 0;
    for (let value14 of section.children) {
      if (value14.kind === "text") {
        if (value14.text.trim() !== "") {
          compiler.warnAt(
            value14,
            "text directly inside <section> — wrapped in <p>",
          );
          if (value8 < 0) {
            value8 = index2;
          }
          items2.push({
            kind: "el",
            tag: "p",
            attrs: Object.create(null),
            children: [value14],
            line: value14.line,
            col: value14.col,
          });
          index2++;
        }
        continue;
      }
      if (value14.tag === "aside") {
        let { text: value15 } = compiler.inline(value14, value14);
        if (value14.attrs.style !== undefined) {
          compiler.warnAt(
            value14,
            "style on <aside> is ignored (speaker notes are plain text)",
          );
        }
        if (value15.trim() !== "") {
          value7 =
            value7 === undefined
              ? value15
              : value7 +
                `
` +
                value15;
        }
        if (
          value7 !== undefined &&
          value7.length > runtime.maxSlideNotesLength
        ) {
          compiler.warnAt(
            value14,
            "speaker notes are capped at " +
              String(runtime.maxSlideNotesLength) +
              " characters — the rest are dropped",
          );
        }
        continue;
      }
      if (value14.tag === "section") {
        compiler.errorAt(
          value14,
          "<section> inside <section> — slides do not nest; close the previous section first",
        );
        continue;
      }
      if (
        inlineStyleIsAbsolute(value14.attrs.style) ||
        (value14.tag === "x-connector" &&
          connectorHasExplicitEndpoints(value14))
      ) {
        items3.push({
          at: index2,
          el: value14,
        });
      } else {
        if (value8 < 0) {
          value8 = index2;
        }
        items2.push(value14);
      }
      index2++;
    }
    if (value5 !== undefined) {
      let value14 = (0, runtime.gradientSourceMetadata)(value5) ?? {
        first: value5.stops[0]!.color,
        seeThrough: (0, runtime.gradientContainsAlpha)(value5),
      };
      if (
        value2["background-color"] === undefined &&
        !(
          value14.seeThrough &&
          (0, runtime.gradientHasCustomRadialGeometry)(value5)
        )
      ) {
        state2.bg = value14.first;
      }
      items.push({
        id: "",
        x: {
          anchor: "fill",
          margin: 0,
          offset: 0,
        },
        y: {
          anchor: "fill",
          margin: 0,
          offset: 0,
        },
        node: {
          kind: "stack",
          dir: "v",
          align: "stretch",
          gap: 0,
          children: [],
          style: {
            backgroundGradient: value5,
          },
        },
      });
    }
    let { layout: value9, isGrid: value10 } = compiler.layout(
      value2,
      values,
      value,
      compiler.rejecter(section, "<section> "),
    );
    values.add("position");
    values.add("display");
    let items4 = [
      value2["padding-top"],
      value2["padding-right"],
      value2["padding-bottom"],
      value2["padding-left"],
    ];
    for (let value14 of [
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
      "overflow",
    ] as const)
      values.add(value14);
    let value11: Frame | undefined, value12: HtmlElementNode | undefined;
    if (items2.length > 0) {
      let value14: "h" | "v" = !value10 && value9.dir === "h" ? "h" : "v",
        state3: HtmlNodeContext = {
          inh: value6,
          depth: 1,
          parentDir: value14,
          parentGrid: value10,
          inContainer: true,
          parentAlign: inheritedContainerStretchSources(value10, value9),
          parentBlock: inlineStyleSuppressesFlowLayout(section.attrs.style),
          flowCount: items2.length,
          parentJustify: value9.justify,
        },
        items7: SlideNode[] = [],
        items8: HtmlElementNode[] = [];
      for (let value16 of items2) {
        let value17 = compiler.node(value16, state3);
        if (value17 !== undefined) {
          items7.push(value17);
          items8.push(value16);
        }
      }
      compiler.loneShareAfterDrops(items2, items8, items7, value14, value10);
      value12 = items8[0];
      let value15: GridNode | StackNode;
      if (value10) {
        value15 = {
          kind: "grid",
          columns: value9.columns!,
          gap: value9.gap,
          children: items7,
        };
        if (value9.rows !== undefined) {
          value15.rows = value9.rows;
        }
        if (value9.alignItems !== undefined) {
          value15.alignItems = value9.alignItems;
        }
        if (value9.justifyItems !== undefined) {
          value15.justifyItems = value9.justifyItems;
        }
      } else {
        value15 = {
          kind: "stack",
          dir: value14,
          align: value9.align ?? "stretch",
          gap: value9.gap,
          children: items7,
        };
        if (value9.justify !== undefined && value9.justify !== "start") {
          value15.justify = value9.justify;
        }
        if (value9.wrap === true && value14 === "h") {
          value15.wrap = true;
        }
        if (value9.reverse) {
          items7.reverse();
        }
      }
      let state4: StyleBag = {};
      if (items4[0] !== undefined) {
        state4.paddingTop = items4[0];
      }
      if (items4[1] !== undefined) {
        state4.paddingRight = items4[1];
      }
      if (items4[2] !== undefined) {
        state4.paddingBottom = items4[2];
      }
      if (items4[3] !== undefined) {
        state4.paddingLeft = items4[3];
      }
      if (value2.overflow !== undefined) {
        state4.overflow = value2.overflow;
      }
      if (Object.keys(state4).length > 0) {
        value15.style = state4;
      }
      value11 = {
        id: "",
        x: {
          anchor: "fill",
          margin: 0,
          offset: 0,
        },
        y: {
          anchor: "fill",
          margin: 0,
          offset: 0,
        },
        node: value15,
      };
    }
    for (let value14 of [
      "border",
      "border-radius",
      "box-shadow",
      "opacity",
      "transform",
      "filter",
      "backdrop-filter",
      "mix-blend-mode",
      "text-shadow",
      "text-decoration-line",
      "text-decoration-style",
      "text-decoration-color",
      "font-variant-numeric",
      "text-stroke-width",
      "text-stroke-color",
      "width",
      "height",
      "min-width",
      "min-width-fit",
      "min-height",
      "max-width",
      "max-height",
      "flex-grow",
      "flex-shrink",
      "flex-basis",
      "align-self",
      "justify-self",
      "aspect-ratio",
      "grid-column",
      "grid-row",
      "object-fit",
      "top",
      "right",
      "bottom",
      "left",
    ] as const) {
      if (value2[value14] !== undefined) {
        compiler.rejectAt(
          section,
          "<section> " +
            diagnosticCssPropertyName(value14) +
            " does not apply to <section> (the slide is the canvas: background, text defaults, display/gap/padding/align)",
        );
      }
      values.add(value14);
    }
    compiler.leftovers(value2, values, section, "<section>");
    let items5: Frame[] = [],
      items6: PinnedNode[] = [],
      index3 = 0,
      value13 = index2;
    for (let index4 = 0; index4 < value13; index4++) {
      if (index4 === value8 && value11 !== undefined) {
        items5.push(value11);
        items6.push({
          el: section,
          x: value11.x,
          y: value11.y,
          node: value11.node,
          root: true,
          lead: value12,
        });
      }
      while (index3 < items3.length && items3[index3]!.at === index4) {
        let value14 = compiler.frame(
          items3[index3]!.el,
          {
            inh: value6,
            depth: 0,
            inContainer: false,
          },
          runtime.SLIDE_WIDTH,
          runtime.SLIDE_HEIGHT,
          false,
        );
        if (value14 !== undefined) {
          items5.push(value14);
          items6.push({
            el: items3[index3]!.el,
            x: value14.x,
            y: value14.y,
            node: value14.node,
          });
        }
        index3++;
      }
    }
    if (
      value5 === undefined &&
      state.keptColour !== undefined &&
      state.keptColour !== state2.bg
    ) {
      let value14 = collectSlidePaintLayers(items5);
      if (
        !backgroundChangePreservesContrast(
          value14,
          state2.bg,
          state.keptColour,
        ) &&
        !(
          value14.colourless &&
          contrastingTextColor(state.keptColour) !==
            contrastingTextColor(state2.bg)
        )
      ) {
        state2.bg = compiler.slideBg = state.keptColour;
        value(
          "background: Slides cannot draw this background, so the slide uses the plain colour written in it, " +
            state.keptColour +
            " — add background-color: #hex after it to choose another",
        );
      }
    }
    if (
      value5 === undefined &&
      state.refusedGradient !== undefined &&
      state.wroteColour !== true &&
      value2["background-color"] === undefined
    ) {
      let value14 = collectSlidePaintLayers(items5),
        value15 = value14.shown.filter(
          (input: PaintLayer): boolean => input.bare,
        ),
        value16 =
          value15.every(
            (input: PaintLayer): boolean =>
              input.colors.every(
                (input2: string | undefined): boolean =>
                  (hexContrastRatio(input2, "#ffffff", input.opacity) ?? 3) <
                    3 &&
                  (hexContrastRatio(input2, "#141413", input.opacity) ?? 0) >=
                    3,
              ),
          ) &&
          value15.some(
            (input: PaintLayer): boolean =>
              input.ink.length > 0 &&
              input.ink.every(
                (input2: string | undefined): boolean =>
                  (hexContrastRatio(
                    typeof input2 === "string" ? input2.slice(0, 7) : input2,
                    "#ffffff",
                  ) ?? 3) < 2,
              ),
          );
      if (
        value15.length > 0 &&
        !value14.colourless &&
        value16 &&
        !backgroundChangePreservesContrast(value14, "#ffffff", "#141413")
      ) {
        state2.bg = compiler.slideBg = "#141413";
        value(
          state.refusedGradient +
            ": Slides cannot draw this background and found no plain background colour (a hex, rgb(), hsl() or named colour), so the slide is made dark (#141413) to keep its light text readable — add background-color: #hex to choose your own",
        );
      }
    }
    compiler.lintPinned(
      items6,
      runtime.SLIDE_WIDTH,
      runtime.SLIDE_HEIGHT,
      compiler.slideBg,
    );
    compiler.flushIcons();
    items.push(...items5);
    let count = 1;
    for (let value14 of items)
      for (let value15 of ["in", "out"] as const) {
        let value16 = value14.build?.[value15];
        if (value16 === undefined) {
          continue;
        }
        if (typeof value16.order !== "number") {
          value16.order = count;
        }
        count = Math.max(count, value16.order + 1);
      }
    let values2 = new Set<string>();
    for (let value14 of items) {
      if (value14.id !== "" && values2.has(value14.id)) {
        compiler.warnAt(
          section,
          'duplicate id "' +
            value14.id +
            '" on this slide — the second gets a generated id',
        );
        value14.id = "";
      }
      if (value14.id !== "") {
        values2.add(value14.id);
      }
    }
    items.forEach((input: Frame, options: number): void => {
      if (input.id !== "") {
        return;
      }
      let value14 = deterministicEmbedId(state2.id, options);
      for (let count2 = 1; values2.has(value14); count2++)
        value14 = deterministicEmbedId(
          state2.id,
          options + count2 * items.length,
        );
      input.id = value14;
      values2.add(value14);
    });
    state2.frames = items;
    if (value7 !== undefined) {
      state2.notes = value7;
    }
    return state2;
  }
  function normalizeVideoIframes(elements: HtmlTreeNode[]): void {
    for (let value of elements) {
      if (value.kind !== "el") {
        continue;
      }
      if (
        value.tag !== "iframe" ||
        (0, runtime.parseVideoLinkUrl)(value.attrs.src ?? "") === null
      ) {
        normalizeVideoIframes(value.children);
        continue;
      }
      let value2: HtmlAttributes = Object.create(null);
      for (let value3 of [
        "src",
        "title",
        "width",
        "height",
        "style",
        "id",
        "data-build-in",
        "data-build-out",
      ] as const)
        if (value.attrs[value3] !== undefined) {
          value2[value3] = value.attrs[value3];
        }
      value.wrote = "iframe";
      value.tag = "video";
      value.attrs = value2;
      value.children = [];
    }
  }
  function compileSlideHtml(
    html: string,
    options: CompileSlideHtmlOptions = {},
  ): CompiledSlideHtml {
    let compiler = new SlideHtmlCompiler(
        options.fileMap,
        options.collectFiles === true,
        (0, runtime.normalizeListRenderingMode)(options.lists),
      ),
      elements: HtmlTreeNode[];
    try {
      elements = parseSlideHtmlTree(html);
    } catch (value9: unknown) {
      if (!(value9 instanceof HtmlParseError)) {
        throw value9;
      }
      compiler.errorAt(value9, value9.message);
      elements = recoverSectionTrees(
        html,
        (input: HtmlParseErrorInstance): void =>
          compiler.errorAt(input, input.message),
      );
    }
    normalizeVideoIframes(elements);
    let value: HtmlElementNode | undefined,
      value2: HtmlElementNode | undefined,
      items: HtmlTreeNode[] = [],
      index = 0,
      callback = (input: HtmlTreeNode[]): void => {
        for (let value9 of input) {
          if (value9.kind === "text") {
            if (value9.text.trim() !== "") {
              items.push(value9);
            }
            continue;
          }
          if (value9.tag === "html") {
            for (let value10 of Object.keys(value9.attrs))
              if (value10 !== "lang") {
                compiler.warnAt(
                  value9,
                  "<html " + value10 + "> attribute is dropped",
                );
              }
            callback(value9.children);
          } else if (value9.tag === "head") {
            if (value !== undefined) {
              compiler.errorAt(value9, "a second <head>");
            }
            value = value9;
          } else if (value9.tag === "body") {
            if (value2 !== undefined) {
              compiler.errorAt(value9, "a second <body>");
            }
            value2 = value9;
          } else if (
            value9.tag === "title" ||
            value9.tag === "link" ||
            value9.tag === "style" ||
            value9.tag === "meta"
          ) {
            if (value === undefined) {
              value = {
                kind: "el",
                tag: "head",
                attrs: Object.create(null),
                children: [],
                line: value9.line,
                col: value9.col,
              };
            }
            value.children.push(value9);
            index += 1;
          } else {
            items.push(value9);
          }
        }
      };
    callback(elements);
    let { title: value3 }: ParsedHtmlHead =
        value !== undefined ? parseHtmlHead(value, compiler) : {},
      value4 = compiler.warner(
        value2 ?? {
          line: 1,
          col: 1,
        },
        "<body> ",
      ),
      value5 = compiler.rejecter(
        value2 ?? {
          line: 1,
          col: 1,
        },
        "<body> ",
      ),
      value6: ParsedInlineStyle =
        value2 !== undefined
          ? parseInlineStyle(value2.attrs.style, value4, value5)
          : {};
    if (value2 !== undefined) {
      for (let value9 of Object.keys(value2.attrs))
        if (value9 !== "style") {
          value4(value9 + " attribute is dropped");
        }
    }
    let value7 = compiler.inherit(
      value6,
      {},
      value2 ?? {
        line: 1,
        col: 1,
      },
    );
    for (let value9 of Object.keys(value6) as Array<keyof ParsedInlineStyle>)
      if (
        ![
          "font-family",
          "font-size",
          "font-weight",
          "font-style",
          "line-height",
          "letter-spacing",
          "text-align",
          "text-transform",
          "white-space",
          "color",
        ].includes(value9) &&
        value6[value9] !== undefined
      ) {
        value5(
          diagnosticCssPropertyName(value9) +
            " does not apply to <body> (text defaults only: font-family/size/weight/style, line-height, letter-spacing, color, text-align, text-transform)",
        );
      }
    let items2: HtmlElementNode[] = [],
      items3: HtmlTreeNode[] = [...(value2?.children ?? []), ...items];
    for (let value9 of items3) {
      if (value9.kind === "text") {
        if (value9.text.trim() !== "") {
          compiler.errorAt(
            value9,
            "text outside any <section> — every slide is a <section>",
          );
        }
        continue;
      }
      if (value9.tag === "section") {
        items2.push(value9);
      } else if (
        value9.tag === "aside" ||
        supportedSlideHtmlElementNames.has(value9.tag) ||
        supportedInlineElementNames.has(value9.tag)
      ) {
        compiler.errorAt(
          value9,
          "<" +
            value9.tag +
            "> outside any <section> — every slide is a <section>; put it inside one",
        );
      } else {
        compiler.errorAt(
          value9,
          "<" + value9.tag + "> is not a tag in this format",
        );
      }
    }
    if (items2.length === 0 && compiler.errors.length === 0) {
      compiler.errorAt(
        {
          line: 1,
          col: 1,
        },
        "no <section> found — a deck is one <section> per slide",
      );
    }
    if (items2.length > runtime.maxDeckSlides) {
      compiler.errorAt(
        items2[runtime.maxDeckSlides]!,
        "more than " + String(runtime.maxDeckSlides) + " slides",
      );
    }
    let items4: string[] = [],
      value8: Record<string, Slide> = Object.create(null),
      items5: DeckSection[] = [],
      values = new Set<string>(),
      values2 = new Set<string>();
    for (let value9 of items2) {
      let value10 = (value9.attrs.id ?? "").trim();
      if (/^[\w-]{1,64}$/.test(value10)) {
        values2.add(value10);
      }
    }
    items2
      .slice(0, runtime.maxDeckSlides)
      .forEach((input: HtmlElementNode, options2: number): void => {
        let value9 = compileHtmlSection(
          input,
          compiler,
          value7,
          options2,
          values2,
          options2 === 0 ? options.sectionId : undefined,
        );
        if (value9 === undefined) {
          return;
        }
        let id = value9.id;
        if (values.has(id)) {
          compiler.errorAt(
            input,
            'duplicate section id "' +
              id +
              '" — ids must be unique (magic move pairs elements by id across slides)',
          );
          let count = 2;
          while (values.has(id + "-" + String(count))) count++;
          id = id + "-" + String(count);
          value9.id = id;
        }
        values.add(id);
        items4.push(id);
        value8[id] = value9;
        if (input.attrs["data-section"] !== undefined) {
          if (items5.length >= runtime.maxDeckSections) {
            compiler.warnAt(
              input,
              "more than " +
                String(runtime.maxDeckSections) +
                " deck sections — data-section dropped",
            );
          } else if (/^__.*__$/.test(id)) {
            compiler.warnAt(
              input,
              'id="' + id + '" cannot key a deck section — rename the slide',
            );
          } else {
            items5.push({
              id: id,
              description: input.attrs["data-section"],
              start: id,
            });
          }
        }
      });
    if (
      items2.length > 0 &&
      compiler.faces.length === 0 &&
      !compiler.sawFontFamily
    ) {
      compiler.warnAt(
        value2 ?? {
          line: 1,
          col: 1,
        },
        "no fonts declared (no @font-face <style> or Google Fonts <link>) and no font-family anywhere — text renders in the viewer's default fonts; link a face from Google Fonts or set font-family on <body>",
      );
    }
    let state: DeckContent = {
      theme: "neutral",
      format: "html",
      order: items4,
      slides: value8,
      assets: {},
    };
    if ((0, runtime.normalizeListRenderingMode)(options.lists) !== undefined) {
      state.lists = (0, runtime.normalizeListRenderingMode)(options.lists);
    }
    if (items5.length > 0) {
      state.sections = items5;
    }
    if (compiler.faces.length > 0) {
      state.faces = compiler.faces.map(
        (input: FontFace): FontFace =>
          typeof input.src === "string" && input.src.startsWith("file:")
            ? {
                family: input.family,
              }
            : input,
      );
    }
    compiler.dedupeDiags();
    return {
      content: state,
      ...(value3 !== undefined && value3 !== ""
        ? {
            title: value3,
          }
        : {}),
      warnings: compiler.warnings,
      errors: compiler.errors,
      hoisted: index,
      notes: compiler.notes(),
      unsupported: compiler.unsupported,
      cellRemovals: compiler.cellRemovals,
      lints: compiler.lints,
      files: compiler.files,
    };
  }
  function formatCompileDiagnostic(
    diagnostic: CompileDiagnostic | undefined,
  ): string {
    return (
      String(diagnostic!.line) +
      ":" +
      String(diagnostic!.col) +
      " " +
      diagnostic!.message
    );
  }
  bindRuntimeValue(runtime, "looksLikeSlideHtml", () => looksLikeSlideHtml);
  bindRuntimeValue(runtime, "decodeHtmlEntities", () => decodeHtmlEntities);
  bindRuntimeValue(
    runtime,
    "HtmlSourceCursor",
    () => HtmlSourceCursor,
    (value) => {
      HtmlSourceCursor = value;
    },
  );
  bindRuntimeValue(runtime, "parseHtmlTag", () => parseHtmlTag);
  bindRuntimeValue(runtime, "parseSlideHtmlTree", () => parseSlideHtmlTree);
  bindRuntimeValue(runtime, "recoverSectionTrees", () => recoverSectionTrees);
  bindRuntimeValue(
    runtime,
    "slideStylePropertySchema",
    () => slideStylePropertySchema,
  );
  bindRuntimeValue(
    runtime,
    "connectorHasExplicitEndpoints",
    () => connectorHasExplicitEndpoints,
  );
  bindRuntimeValue(
    runtime,
    "clampShapeOutlineWidth",
    () => clampShapeOutlineWidth,
  );
  bindRuntimeValue(runtime, "ownRecordValue", () => ownRecordValue);
  bindRuntimeValue(
    runtime,
    "resolveFontFamilyAlias",
    () => resolveFontFamilyAlias,
  );
  bindRuntimeValue(
    runtime,
    "resolveBasicFontFamily",
    () => resolveBasicFontFamily,
  );
  bindRuntimeValue(runtime, "webSafeFontFallback", () => webSafeFontFallback);
  bindRuntimeValue(runtime, "stripHtmlMarkup", () => stripHtmlMarkup);
  bindRuntimeValue(runtime, "utf8ToBase64", () => utf8ToBase64);
  bindRuntimeValue(runtime, "parseSvgDimensions", () => parseSvgDimensions);
  bindRuntimeValue(runtime, "decodeCssEscapes", () => decodeCssEscapes);
  bindRuntimeValue(runtime, "sanitizeSvgXmlText", () => sanitizeSvgXmlText);
  bindRuntimeValue(runtime, "sanitizeSvgMarkup", () => sanitizeSvgMarkup);
  bindRuntimeValue(runtime, "validateSvgMarkup", () => validateSvgMarkup);
  bindRuntimeValue(runtime, "decodeSvgDataUrl", () => decodeSvgDataUrl);
  bindRuntimeValue(
    runtime,
    "parseInlineStyleUnchecked",
    () => parseInlineStyleUnchecked,
  );
  bindRuntimeValue(
    runtime,
    "inlineStyleSuppressesFlowLayout",
    () => inlineStyleSuppressesFlowLayout,
  );
  bindRuntimeValue(
    runtime,
    "inlineStyleHasPercentSize",
    () => inlineStyleHasPercentSize,
  );
  bindRuntimeValue(
    runtime,
    "nodeHasExplicitAxisSize",
    () => nodeHasExplicitAxisSize,
  );
  bindRuntimeValue(
    runtime,
    "inheritedContainerStretchSources",
    () => inheritedContainerStretchSources,
  );
  bindRuntimeValue(
    runtime,
    "nonStretchAxisExplanation",
    () => nonStretchAxisExplanation,
  );
  bindRuntimeValue(
    runtime,
    "inlineStyleHasUnsafeSizing",
    () => inlineStyleHasUnsafeSizing,
  );
  bindRuntimeValue(
    runtime,
    "inlineStyleHasUnsafeBackground",
    () => inlineStyleHasUnsafeBackground,
  );
  bindRuntimeValue(runtime, "parseInlineStyle", () => parseInlineStyle);
  bindRuntimeValue(runtime, "resolveEmListPadding", () => resolveEmListPadding);
  bindRuntimeValue(runtime, "nodeFontSize", () => nodeFontSize);
  bindRuntimeValue(runtime, "nodeLineHeight", () => nodeLineHeight);
  bindRuntimeValue(runtime, "nodePaddingSize", () => nodePaddingSize);
  bindRuntimeValue(
    runtime,
    "nodeHasVisibleContent",
    () => nodeHasVisibleContent,
  );
  bindRuntimeValue(runtime, "estimateTableHeight", () => estimateTableHeight);
  bindRuntimeValue(
    runtime,
    "estimateTextUnwrappedWidth",
    () => estimateTextUnwrappedWidth,
  );
  bindRuntimeValue(
    runtime,
    "estimateLongestWordWidth",
    () => estimateLongestWordWidth,
  );
  bindRuntimeValue(runtime, "estimateNodeHeight", () => estimateNodeHeight);
  bindRuntimeValue(runtime, "explicitNodeWidth", () => explicitNodeWidth);
  bindRuntimeValue(
    runtime,
    "resolveHtmlAxisPlacement",
    () => resolveHtmlAxisPlacement,
  );
  bindRuntimeValue(runtime, "rotatedBox", () => rotatedBox);
  bindRuntimeValue(
    runtime,
    "pointInRotatedBoxCoordinates",
    () => pointInRotatedBoxCoordinates,
  );
  bindRuntimeValue(
    runtime,
    "segmentIntersectsRotatedBox",
    () => segmentIntersectsRotatedBox,
  );
  bindRuntimeValue(runtime, "rotatedBoxesOverlap", () => rotatedBoxesOverlap);
  bindRuntimeValue(runtime, "estimateTextBounds", () => estimateTextBounds);
  bindRuntimeValue(runtime, "iconStyleWarnings", () => iconStyleWarnings);
  bindRuntimeValue(runtime, "hasLowOpaqueContrast", () => hasLowOpaqueContrast);
  bindRuntimeValue(
    runtime,
    "parseHexColorChannels",
    () => parseHexColorChannels,
  );
  bindRuntimeValue(runtime, "hexContrastRatio", () => hexContrastRatio);
  bindRuntimeValue(runtime, "compositeHexColor", () => compositeHexColor);
  bindRuntimeValue(runtime, "contrastingTextColor", () => contrastingTextColor);
  bindRuntimeValue(
    runtime,
    "collectSlidePaintLayers",
    () => collectSlidePaintLayers,
  );
  bindRuntimeValue(
    runtime,
    "nodePaintsVisibleContent",
    () => nodePaintsVisibleContent,
  );
  bindRuntimeValue(
    runtime,
    "backgroundChangePreservesContrast",
    () => backgroundChangePreservesContrast,
  );
  bindRuntimeValue(runtime, "hexColorAlpha", () => hexColorAlpha);
  bindRuntimeValue(
    runtime,
    "SlideHtmlCompiler",
    () => SlideHtmlCompiler,
    (value) => {
      SlideHtmlCompiler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "combineNestedAxisSpecs",
    () => combineNestedAxisSpecs,
  );
  bindRuntimeValue(
    runtime,
    "inlineStyleIsAbsolute",
    () => inlineStyleIsAbsolute,
  );
  bindRuntimeValue(
    runtime,
    "unwrapTransparentContainer",
    () => unwrapTransparentContainer,
  );
  bindRuntimeValue(
    runtime,
    "migrateThinBorderToFill",
    () => migrateThinBorderToFill,
  );
  bindRuntimeValue(runtime, "parseInlineTextTree", () => parseInlineTextTree);
  bindRuntimeValue(runtime, "stripCssComments", () => stripCssComments);
  bindRuntimeValue(runtime, "parseFontFaceRules", () => parseFontFaceRules);
  bindRuntimeValue(runtime, "parseHtmlHead", () => parseHtmlHead);
  bindRuntimeValue(runtime, "deterministicEmbedId", () => deterministicEmbedId);
  bindRuntimeValue(runtime, "compileHtmlSection", () => compileHtmlSection);
  bindRuntimeValue(
    runtime,
    "normalizeVideoIframes",
    () => normalizeVideoIframes,
  );
  bindRuntimeValue(runtime, "compileSlideHtml", () => compileSlideHtml);
  bindRuntimeValue(
    runtime,
    "formatCompileDiagnostic",
    () => formatCompileDiagnostic,
  );
  bindRuntimeValue(
    runtime,
    "slideHtmlPrefixPattern",
    () => slideHtmlPrefixPattern,
    (value) => {
      slideHtmlPrefixPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "htmlVoidElementNames",
    () => htmlVoidElementNames,
    (value) => {
      htmlVoidElementNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "htmlRawTextElementNames",
    () => htmlRawTextElementNames,
    (value) => {
      htmlRawTextElementNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "htmlBlockElementNames",
    () => htmlBlockElementNames,
    (value) => {
      htmlBlockElementNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "htmlOptionalClosingElementNames",
    () => htmlOptionalClosingElementNames,
    (value) => {
      htmlOptionalClosingElementNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "htmlNamedEntities",
    () => htmlNamedEntities,
    (value) => {
      htmlNamedEntities = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HtmlParseError",
    () => HtmlParseError,
    (value) => {
      HtmlParseError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssBoxSideNames",
    () => cssBoxSideNames,
    (value) => {
      cssBoxSideNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssBorderSideWidthFields",
    () => cssBorderSideWidthFields,
    (value) => {
      cssBorderSideWidthFields = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "containerPaddingBounds",
    () => containerPaddingBounds,
    (value) => {
      containerPaddingBounds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideBoxShadowBounds",
    () => slideBoxShadowBounds,
    (value) => {
      slideBoxShadowBounds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shapeStrokeBounds",
    () => shapeStrokeBounds,
    (value) => {
      shapeStrokeBounds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "diagnosticCssPropertyNames",
    () => diagnosticCssPropertyNames,
    (value) => {
      diagnosticCssPropertyNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "diagnosticCssPropertyName",
    () => diagnosticCssPropertyName,
    (value) => {
      diagnosticCssPropertyName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "diagnosticHtmlTagLabel",
    () => diagnosticHtmlTagLabel,
    (value) => {
      diagnosticHtmlTagLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "connectorAttributeNames",
    () => connectorAttributeNames,
    (value) => {
      connectorAttributeNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "videoAttributeNames",
    () => videoAttributeNames,
    (value) => {
      videoAttributeNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "imageVideoAttributeNames",
    () => imageVideoAttributeNames,
    (value) => {
      imageVideoAttributeNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blockTextElementNames",
    () => blockTextElementNames,
    (value) => {
      blockTextElementNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssAlignmentMap",
    () => cssAlignmentMap,
    (value) => {
      cssAlignmentMap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssJustificationMap",
    () => cssJustificationMap,
    (value) => {
      cssJustificationMap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "genericFontFallbackKinds",
    () => genericFontFallbackKinds,
    (value) => {
      genericFontFallbackKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "webSafeFontAliases",
    () => webSafeFontAliases,
    (value) => {
      webSafeFontAliases = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "webSafeFallbackFaces",
    () => webSafeFallbackFaces,
    (value) => {
      webSafeFallbackFaces = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "specialGenericFontFaces",
    () => specialGenericFontFaces,
    (value) => {
      specialGenericFontFaces = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "supportedSlideHtmlElementNames",
    () => supportedSlideHtmlElementNames,
    (value) => {
      supportedSlideHtmlElementNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "supportedInlineElementNames",
    () => supportedInlineElementNames,
    (value) => {
      supportedInlineElementNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inlineFormatElementNames",
    () => inlineFormatElementNames,
    (value) => {
      inlineFormatElementNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "flattenableInlineElementNames",
    () => flattenableInlineElementNames,
    (value) => {
      flattenableInlineElementNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unsafeSvgMarkupRules",
    () => unsafeSvgMarkupRules,
    (value) => {
      unsafeSvgMarkupRules = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unsupportedSvgAnimationRules",
    () => unsupportedSvgAnimationRules,
    (value) => {
      unsupportedSvgAnimationRules = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "nonRenderingSvgElementNames",
    () => nonRenderingSvgElementNames,
    (value) => {
      nonRenderingSvgElementNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "forbiddenSvgElementNames",
    () => forbiddenSvgElementNames,
    (value) => {
      forbiddenSvgElementNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "svgExternalResourceAttributes",
    () => svgExternalResourceAttributes,
    (value) => {
      svgExternalResourceAttributes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "svgTagTokenPattern",
    () => svgTagTokenPattern,
    (value) => {
      svgTagTokenPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "svgAttributeTokenPattern",
    () => svgAttributeTokenPattern,
    (value) => {
      svgAttributeTokenPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "svgNamespace",
    () => svgNamespace,
    (value) => {
      svgNamespace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "xlinkNamespace",
    () => xlinkNamespace,
    (value) => {
      xlinkNamespace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "htmlWindows1252CodePoints",
    () => htmlWindows1252CodePoints,
    (value) => {
      htmlWindows1252CodePoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isInvalidXmlCodePoint",
    () => isInvalidXmlCodePoint,
    (value) => {
      isInvalidXmlCodePoint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "htmlCompilerCounters",
    () => htmlCompilerCounters,
    (value) => {
      htmlCompilerCounters = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inheritedInlineStyles",
    () => inheritedInlineStyles,
    (value) => {
      inheritedInlineStyles = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "elementInlineStyle",
    () => elementInlineStyle,
    (value) => {
      elementInlineStyle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "compileWarningCodes",
    () => compileWarningCodes,
    (value) => {
      compileWarningCodes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "estimatedGlyphWidthFactor",
    () => estimatedGlyphWidthFactor,
    (value) => {
      estimatedGlyphWidthFactor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "estimatedLongWordWidthFactor",
    () => estimatedLongWordWidthFactor,
    (value) => {
      estimatedLongWordWidthFactor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "importedHtmlTypeScale",
    () => importedHtmlTypeScale,
    (value) => {
      importedHtmlTypeScale = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "htmlHeadingNames",
    () => htmlHeadingNames,
    (value) => {
      htmlHeadingNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideHtmlIconNames",
    () => slideHtmlIconNames,
    (value) => {
      slideHtmlIconNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mediaHtmlElementNames",
    () => mediaHtmlElementNames,
    (value) => {
      mediaHtmlElementNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "iconPlaceholderLabel",
    () => iconPlaceholderLabel,
    (value) => {
      iconPlaceholderLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "genericIconPlaceholderLabel",
    () => genericIconPlaceholderLabel,
    (value) => {
      genericIconPlaceholderLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "elementPlaceholderLabel",
    () => elementPlaceholderLabel,
    (value) => {
      elementPlaceholderLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "neutralHtmlShadowPresets",
    () => neutralHtmlShadowPresets,
    (value) => {
      neutralHtmlShadowPresets = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "htmlTagTextRoles",
    () => htmlTagTextRoles,
    (value) => {
      htmlTagTextRoles = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "simpleCssColorSource",
    () => simpleCssColorSource,
    (value) => {
      simpleCssColorSource = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "transparentContainerBorderPattern",
    () => transparentContainerBorderPattern,
    (value) => {
      transparentContainerBorderPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "noBorderPattern",
    () => noBorderPattern,
    (value) => {
      noBorderPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "transparentContainerFillPattern",
    () => transparentContainerFillPattern,
    (value) => {
      transparentContainerFillPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "transparentContainerStylePatterns",
    () => transparentContainerStylePatterns,
    (value) => {
      transparentContainerStylePatterns = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontFaceRulesPattern",
    () => fontFaceRulesPattern,
    (value) => {
      fontFaceRulesPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeHtmlCompiler",
    () => initializeHtmlCompiler,
    (value) => {
      initializeHtmlCompiler = value;
    },
  );
  return () => {
    HtmlSourceCursor = class HtmlSourceCursor {
      src: string;
      baseLine: number;
      baseCol: number;
      pos = 0;
      lineStarts: number[] = [0];
      constructor(items: string, options = 0, context = 0) {
        this.src = items;
        this.baseLine = options;
        this.baseCol = context;
        for (let index = 0; index < items.length; index++)
          if (
            items[index] ===
            `
`
          ) {
            this.lineStarts.push(index + 1);
          }
      }
      lineCol(input = this.pos): HtmlSourcePosition {
        let index = 0,
          value = this.lineStarts.length - 1;
        while (index < value) {
          let value4 = (index + value + 1) >> 1;
          if (this.lineStarts[value4]! <= input) {
            index = value4;
          } else {
            value = value4 - 1;
          }
        }
        let value2 = index + 1,
          value3 = input - this.lineStarts[index]! + 1;
        return {
          line: value2 + this.baseLine,
          col: value2 === 1 ? value3 + this.baseCol : value3,
        };
      }
      fail(input: string, options = this.pos): never {
        let { line: value, col: value2 } = this.lineCol(options);
        throw new HtmlParseError(input, value, value2);
      }
    };
    SlideHtmlCompiler = class SlideHtmlCompiler {
      fileMap: ReadonlyMap<string, string> | undefined;
      collectFiles: boolean;
      lists: ListRenderingMode | undefined;
      warnings: CompileDiagnostic[] = [];
      errors: CompileDiagnostic[] = [];
      lints: CompileDiagnostic[] = [];
      slideBg: string | undefined;
      iconQ: QueuedIconWarning[] = [];
      queueIcon(
        input: HtmlSourcePosition,
        options: string,
        context: IconNode,
        value?: boolean,
      ): void {
        for (let value2 of iconStyleWarnings(context, value))
          this.iconQ.push({
            p: input,
            key: value2.key,
            msg: options + value2.msg,
          });
      }
      flushIcons(): void {
        let entries = new Map<string, { first: QueuedIconWarning; n: number }>();
        for (let value of this.iconQ) {
          let entry = entries.get(value.key);
          if (entry === undefined) {
            entries.set(value.key, {
              first: value,
              n: 1,
            });
          } else {
            entry.n++;
          }
        }
        for (let { first: value, n: value2 } of entries.values())
          this.lintAt(
            value.p,
            value.msg +
              (value2 > 1
                ? " (and " + String(value2 - 1) + " more like it on this slide)"
                : ""),
          );
        this.iconQ = [];
      }
      lintAt(input: HtmlSourcePosition, options: string): void {
        if (this.lints.length < 500) {
          this.lints.push({
            line: input.line,
            col: input.col,
            message: options,
          });
        }
      }
      lintPinned(
        input: PinnedNode[],
        options: number | undefined,
        context: number | undefined,
        value: string | undefined,
      ): void {
        let callback = (input2: HtmlElementNode): string =>
            "<" +
            input2.tag +
            (input2.attrs.id !== undefined
              ? ' id="' +
                (0, runtime.compactDiagnosticValue)(input2.attrs.id) +
                '"'
              : "") +
            ">",
          value2 = input.map((input2) => {
            let value4 = resolveHtmlAxisPlacement(input2.x, options),
              value5 = resolveHtmlAxisPlacement(input2.y, context),
              value6 = value4?.size,
              value7 = value5?.size,
              flag = false;
            if (
              value7 === undefined &&
              value6 !== undefined &&
              nodeHasVisibleContent(input2.node)
            ) {
              value7 = estimateNodeHeight(input2.node, value6);
              flag = true;
            }
            let value8 =
                input2.node.kind === "overlay" ? input2.node.base : input2.node,
              value9 =
                input2.node.kind === "shape"
                  ? {
                      rotate: Number(input2.node.rotate ?? 0),
                    }
                  : value8.style?.transform,
              value10 = Number(value9?.rotate ?? 0) % 180,
              value11 = Math.abs(Math.abs(value10) - 90) < 1,
              value12 =
                (!value11 && Math.abs(value10) > 0.5) ||
                (value9?.scale ?? 1) !== 1 ||
                (value9?.skewX ?? 0) !== 0 ||
                (value9?.skewY ?? 0) !== 0,
              value13 =
                value4 === undefined
                  ? undefined
                  : value4.at + Number(value9?.translateX ?? 0),
              value14 =
                value5 === undefined
                  ? undefined
                  : value5.at + Number(value9?.translateY ?? 0),
              value15 =
                value6 !== undefined &&
                input2.node.kind === "text" &&
                input2.node.wrap === "nowrap"
                  ? Math.max(value6, estimateTextUnwrappedWidth(input2.node))
                  : value6,
              value16 =
                value11 &&
                value13 !== undefined &&
                value14 !== undefined &&
                value6 !== undefined &&
                value15 !== undefined &&
                value7 !== undefined
                  ? {
                      x: value13 + value6 / 2 - value7 / 2,
                      y:
                        value10 < 0
                          ? value14 + value7 / 2 + value6 / 2 - value15
                          : value14 + value7 / 2 - value6 / 2,
                      w: value7,
                      h: value15,
                    }
                  : {
                      x: value13,
                      y: value14,
                      w: value15,
                      h: value7,
                    };
            return {
              it: input2,
              x: value13,
              y: value14,
              w: value6,
              h: value7,
              estH: flag,
              skew: value12,
              quarter: value11,
              foot: value16,
            };
          });
        for (let value4 of value2) {
          let { node: it, el: it2 } = value4.it;
          if (
            it.kind === "shape" &&
            String(it.shape).startsWith("arrow-") &&
            value4.w !== undefined &&
            value4.h !== undefined &&
            value4.w > 0 &&
            value4.h > 0
          ) {
            let value5 =
              String(it.shape).endsWith("left") ||
              String(it.shape).endsWith("right")
                ? value4.w / value4.h
                : value4.h / value4.w;
            if (value5 > 3) {
              this.lintAt(
                it2,
                callback(it2) +
                  ' kind="' +
                  String(it.shape) +
                  '" is stretched ' +
                  String(Math.round(value5 * 10) / 10) +
                  ":1 — block arrows distort past ~2:1; for a line with an arrowhead use <x-connector x1 y1 x2 y2>",
              );
            }
          }
          if (value4.w !== undefined && it.kind !== "shape") {
            this.lintWords(it, value4.w, it2, callback(it2));
          }
          if (
            value4.w !== undefined &&
            value4.h !== undefined &&
            !value4.estH &&
            nodeHasVisibleContent(it)
          ) {
            let value5 = estimateNodeHeight(it, value4.w);
            if (value5 !== undefined && value5 > value4.h * 1.05 + 8) {
              this.lintAt(
                it2,
                callback(it2) +
                  " is " +
                  String(Math.round(value4.h)) +
                  "px tall but holds an estimated ~" +
                  String(Math.round(value5)) +
                  "px of content — " +
                  ((it.kind === "text" &&
                    (it.fit ?? runtime.defaultTextFit) === "shrink") ||
                  (it.kind === "stack" && it.dir !== "h")
                    ? value4.h / value5 >= runtime.textFitMinimumScale
                      ? "expect its text to shrink to ~" +
                        String(
                          Math.min(99, Math.round((value4.h / value5) * 100)),
                        ) +
                        "% to fit"
                      : "its text shrinks to the " +
                        String(Math.round(runtime.textFitMinimumScale * 100)) +
                        "% floor and still does not fit"
                    : "it may overflow") +
                  "; budget the height, shorten the text, or let the box size itself (drop height)",
              );
            }
          }
        }
        for (let index = 0; index < value2.length; index++) {
          let foot = value2[index]!.foot,
            value4 = value2[index]!;
          if (
            value4.it.root === true ||
            value4.skew ||
            foot.x === undefined ||
            foot.y === undefined ||
            foot.w === undefined ||
            foot.h === undefined ||
            !nodeHasVisibleContent(value4.it.node)
          ) {
            continue;
          }
          for (
            let value5 = index + 1;
            value5 < value2.length;
            value5++
          ) {
            let foot2 = value2[value5]!.foot,
              value6 = value2[value5]!;
            if (
              value6.it.root === true ||
              value6.skew ||
              foot2.x === undefined ||
              foot2.y === undefined ||
              foot2.w === undefined ||
              foot2.h === undefined ||
              !nodeHasVisibleContent(value6.it.node)
            ) {
              continue;
            }
            let value7 =
                Math.min(foot.x + foot.w, foot2.x + foot2.w) -
                Math.max(foot.x, foot2.x),
              value8 =
                Math.min(foot.y + foot.h, foot2.y + foot2.h) -
                Math.max(foot.y, foot2.y);
            if (value7 > 4 && value8 > 4) {
              this.lintAt(
                value6.it.el,
                callback(value6.it.el) +
                  " overlaps " +
                  callback(value4.it.el) +
                  " (line " +
                  String(value4.it.el.line) +
                  ") by " +
                  String(Math.round(value7)) +
                  "×" +
                  String(Math.round(value8)) +
                  "px" +
                  (value4.estH || value6.estH
                    ? " (heights estimated from the text)"
                    : "") +
                  " — both hold text; move or resize one",
              );
            }
          }
        }
        {
          let items3: ReadingBox[] = [],
            value4: ReadingLead | undefined,
            flag = false;
          for (let value5 of value2) {
            if (value5.it.root === true) {
              flag = true;
              let node2 = value5.it.node,
                value7 = node2.style ?? {},
                callback12 = (input2: PaddingStyleKey): number =>
                  typeof value7[input2] === "number" ? value7[input2] : 0;
              if (
                (node2.kind === "grid"
                  ? node2.rows === undefined &&
                    (node2.alignItems === undefined ||
                      node2.alignItems === "start")
                  : node2.kind === "stack" &&
                    (node2.dir === "h"
                      ? node2.align === "stretch" || node2.align === "start"
                      : node2.justify === undefined ||
                        node2.justify === "between")) &&
                value5.it.lead !== undefined &&
                nodeHasVisibleContent(node2) &&
                options !== undefined
              ) {
                value4 = {
                  top: callback12("paddingTop"),
                  x0: callback12("paddingLeft"),
                  x1: options - callback12("paddingRight"),
                  lead: value5.it.lead,
                };
              }
              continue;
            }
            let node = value5.it.node,
              style = (node.kind === "overlay" ? node.base : node)
                .style;
            if (
              value5.skew ||
              value5.quarter ||
              (style?.opacity ?? 1) <= 0.25 ||
              !nodeHasVisibleContent(node) ||
              value5.x === undefined ||
              value5.w === undefined ||
              value5.h === undefined
            ) {
              continue;
            }
            let value6 =
              value5.y ??
              (() => {
                let value7 = resolveHtmlAxisPlacement(
                  {
                    ...value5.it.y,
                    size: value5.h,
                  },
                  context,
                );
                if (value7 === undefined) {
                  return undefined;
                } else {
                  return value7.at + Number(style?.transform?.translateY ?? 0);
                }
              })();
            if (value6 === undefined) {
              continue;
            }
            items3.push({
              el: value5.it.el,
              x: value5.x,
              y: value6,
              w: value5.w,
              h: value5.h,
              estH: value5.estH,
              before: !flag,
            });
          }
          let text = " — a screen reader follows source order: ",
            callback9 = (input2: ReadingBox): string =>
              input2.estH ? " (height estimated from the text)" : "";
          if (value4 !== undefined) {
            let value5 = value4,
              value6 = items3.filter(
                (input2) =>
                  input2.before &&
                  input2.y >= value5.top + 8 &&
                  Math.min(input2.x + input2.w, value5.x1) -
                    Math.max(input2.x, value5.x0) >
                    8,
              );
            if (value6.length > 0) {
              this.lintAt(
                value6[0]!.el,
                callback(value6[0]!.el) +
                  " reads before " +
                  callback(value5.lead) +
                  " (line " +
                  String(value5.lead.line) +
                  ") but sits below it (y " +
                  String(Math.round(value6[0]!.y)) +
                  " vs " +
                  String(Math.round(value5.top)) +
                  ")" +
                  (value6.length > 1
                    ? ", and so do " +
                      String(value6.length - 1) +
                      " more before it"
                    : "") +
                  callback9(value6[0]!) +
                  text +
                  "move it after the content it belongs to",
              );
            }
          }
          let callback10 = (input2: ReadingBox, options2: ReadingBox): boolean =>
              Math.min(input2.x + input2.w, options2.x + options2.w) -
                Math.max(input2.x, options2.x) >
              8,
            callback11 = (input2: ReadingBox, options2: ReadingBox): boolean =>
              Math.min(input2.y + input2.h, options2.y + options2.h) -
                Math.max(input2.y, options2.y) >=
              0.5 * Math.min(input2.h, options2.h),
            text2 = ", unless this is the order it should be heard in";
          for (let count = 2; count < items3.length; count++) {
            let value5 = items3[count]!,
              value6 = items3.slice(0, count),
              value7 = value6[0]!;
            if (
              value6.every(
                (input2) =>
                  value5.y + value5.h <= input2.y + 8 &&
                  callback10(input2, value5),
              )
            ) {
              this.lintAt(
                value5.el,
                callback(value5.el) +
                  " reads after " +
                  callback(value7.el) +
                  " (line " +
                  String(value7.el.line) +
                  ") but sits above it (y " +
                  String(Math.round(value5.y)) +
                  " vs " +
                  String(Math.round(value7.y)) +
                  ")" +
                  callback9(value5) +
                  text +
                  "move it before them in the file" +
                  text2,
              );
            } else if (
              value6.every(
                (input2) =>
                  value5.x + value5.w <= input2.x + 8 &&
                  callback11(input2, value5),
              )
            ) {
              this.lintAt(
                value5.el,
                callback(value5.el) +
                  " reads after " +
                  callback(value7.el) +
                  " (line " +
                  String(value7.el.line) +
                  ") but sits left of it (x " +
                  String(Math.round(value5.x)) +
                  " vs " +
                  String(Math.round(value7.x)) +
                  ")" +
                  text +
                  "move it before them in the file" +
                  text2,
              );
            }
          }
        }
        let value3 = value2.flatMap((input2) => {
          let node = input2.it.node;
          if (
            node.kind !== "shape" ||
            node.shape !== "connector" ||
            input2.x === undefined ||
            input2.y === undefined ||
            input2.w === undefined ||
            input2.h === undefined
          ) {
            return [];
          }
          let { start: value4, end: value5 } = (0,
            runtime.connectorEndpoints)(
              input2.w,
              input2.h,
              node.from,
              node.strokeWidth,
            ),
            value6 = (0, runtime.connectorArrowHeads)(node),
            items3 = [];
          if (value6.start === "none") {
            items3.push([input2.x + value4[0], input2.y + value4[1]]);
          }
          if (value6.end === "none") {
            items3.push([input2.x + value5[0], input2.y + value5[1]]);
          }
          if (items3.length === 0) {
            return [];
          } else {
            return [
              {
                b: input2,
                pts: items3,
                stroke: node.stroke,
                sw: node.strokeWidth ?? runtime.defaultShapeStrokeWidth,
              },
            ];
          }
        });
        for (let index = 0; index < value3.length; index++)
          for (
            let value4 = index + 1;
            value4 < value3.length;
            value4++
          ) {
            let value5 = value3[index]!,
              value6 = value3[value4]!;
            if (value5.stroke !== value6.stroke || value5.sw !== value6.sw) {
              continue;
            }
            let value7 = Math.max(2 * value5.sw, 3),
              value8 = value5.pts
                .flatMap(
                  (input2) =>
                    value6.pts.map(
                      (input3) => ({
                        p: input2,
                        d: Math.hypot(
                          input2[0]! - input3[0]!,
                          input2[1]! - input3[1]!,
                        ),
                      }),
                    ),
                )
                .find(({ d: d }) => d > 0.5 && d <= value7);
            if (value8 !== undefined) {
              this.lintAt(
                value6.b.it.el,
                callback(value6.b.it.el) +
                  " and " +
                  callback(value5.b.it.el) +
                  " (line " +
                  String(value5.b.it.el.line) +
                  ") end " +
                  String(Math.round(value8.d * 10) / 10) +
                  "px apart near (" +
                  String(Math.round(value8.p[0]!)) +
                  ", " +
                  String(Math.round(value8.p[1]!)) +
                  ") — give both ends the same x y so the round caps fuse into one line",
              );
            }
          }
        let items: LintBox[] = [],
          items2: LintStroke[] = [];
        value2.forEach((input2, options2) => {
          let { el: it } = input2.it,
            value4 =
              input2.it.node.kind === "overlay"
                ? input2.it.node.base
                : input2.it.node;
          if (
            input2.it.root === true ||
            it.tag === "svg" ||
            value4.kind === "html" ||
            value4.kind === "spacer"
          ) {
            return;
          }
          let value5 = Number(
              value4.style?.transform?.translateX ?? 0,
            ),
            value6 = Number(value4.style?.transform?.translateY ?? 0),
            value7 =
              options === undefined
                ? 1 / 0
                : input2.x !== undefined
                  ? options - (input2.x - value5)
                  : input2.it.x.anchor === "center"
                    ? options / 2 - Number(input2.it.x.offset ?? 0)
                    : input2.it.x.anchor === "trailing"
                      ? options - Number(input2.it.x.margin ?? 0)
                      : 1 / 0,
            value8 =
              input2.w ??
              (value4.kind === "text"
                ? Math.min(
                    estimateTextUnwrappedWidth(value4),
                    Math.max(
                      estimateLongestWordWidth(value4).px +
                        nodePaddingSize(value4).x,
                      value7,
                    ),
                  )
                : undefined),
            value9 =
              input2.h ??
              (value4.kind === "text" && value8 !== undefined
                ? estimateNodeHeight(value4, value8)
                : undefined);
          if (value8 === undefined || value9 === undefined) {
            return;
          }
          let value10 =
              input2.x ??
              (() => {
                let value33 = resolveHtmlAxisPlacement(
                  {
                    ...input2.it.x,
                    size: value8,
                  },
                  options,
                );
                if (value33 === undefined) {
                  return undefined;
                } else {
                  return value33.at + value5;
                }
              })(),
            value11 =
              input2.y ??
              (() => {
                let value33 = resolveHtmlAxisPlacement(
                  {
                    ...input2.it.y,
                    size: value9,
                  },
                  context,
                );
                if (value33 === undefined) {
                  return undefined;
                } else {
                  return value33.at + value6;
                }
              })();
          if (value10 === undefined || value11 === undefined) {
            return;
          }
          let value12 = value4.style ?? {},
            value13 =
              value4.kind === "shape"
                ? {
                    rotate: Number(value4.rotate ?? 0),
                  }
                : (value12.transform ?? {});
          if (
            (value13.scale ?? 1) !== 1 ||
            (value13.skewX ?? 0) !== 0 ||
            (value13.skewY ?? 0) !== 0
          ) {
            return;
          }
          let value14 = Number(value13.rotate ?? 0),
            [items3, items4] = [value10, value11];
          if (value4.kind === "shape" && value4.shape === "connector") {
            let value33 = value4,
              value34 = (0, runtime.connectorGeometry)(
                value8,
                value9,
                value33,
              );
            items2.push({
              i: options2,
              el: it,
              pts: value34.points.map(
                ([input3, input4]) => [
                  items3 + input3,
                  items4 + input4,
                ],
              ),
              sw: value33.strokeWidth ?? runtime.defaultShapeStrokeWidth,
              conn: true,
              heads: (0, runtime.connectorArrowHeads)(value33),
              color: value4.stroke,
            });
            return;
          }
          let value15 =
            typeof value12.opacity === "number" ? value12.opacity : 1;
          if (value15 <= 0.25) {
            return;
          }
          let value16 = value4.kind === "shape",
            value17 = value16
              ? (0, runtime.shapeOutline)(value12)
              : undefined,
            value18 =
              value16 && (value4 as ShapeNode).shape === "line"
                ? (value17?.color ?? value12.backgroundColor)
                : value12.backgroundColor,
            value19 =
              value18 !== undefined && hexColorAlpha(value18) > 0.1,
            backgroundGradient = value12.backgroundGradient,
            value20 =
              (typeof value12.borderWidth === "number" &&
                value12.borderWidth > 0 &&
                value12.borderSides === undefined) ||
              (
                [
                  "borderTopWidth",
                  "borderRightWidth",
                  "borderBottomWidth",
                  "borderLeftWidth",
                ] as const
              ).every(
                (input3) =>
                  typeof value12[input3] === "number" && value12[input3] > 0,
              ),
            value21 = value16
              ? value17 !== undefined && hexColorAlpha(value17.color) > 0.1
              : value20 && hexColorAlpha(value12.borderColor) > 0.1,
            value22 =
              value4.kind === "img" ||
              value4.kind === "icon" ||
              value19 ||
              backgroundGradient !== undefined ||
              value21,
            value23 = nodeHasVisibleContent(input2.it.node);
          if (
            !value22 &&
            !(value23 && (value4.kind === "text" || value4.kind === "table"))
          ) {
            return;
          }
          let value24 =
            value15 >= 0.8 &&
            (value12.mixBlendMode ?? "normal") === "normal" &&
            (value4.kind === "img" ||
              (backgroundGradient !== undefined &&
                backgroundGradient.stops.every(
                  (input3) =>
                    hexColorAlpha(input3.color) >= 0.8,
                )) ||
              (value19 && hexColorAlpha(value18) >= 0.8));
          if (
            value22 &&
            !nodeHasVisibleContent(value4) &&
            value4.kind !== "icon" &&
            value4.kind !== "img" &&
            Math.min(value8, value9) <= 16 &&
            Math.max(value8, value9) >= 3 * Math.min(value8, value9)
          ) {
            if (Math.min(value8, value9) < 2 || !value24) {
              return;
            }
            let value33 = (value14 * Math.PI) / 180,
              [value34, value35] =
                value8 >= value9
                  ? [
                      (value8 / 2) * Math.cos(value33),
                      (value8 / 2) * Math.sin(value33),
                    ]
                  : [
                      -(value9 / 2) * Math.sin(value33),
                      (value9 / 2) * Math.cos(value33),
                    ],
              value36 = items3 + value8 / 2,
              value37 = items4 + value9 / 2;
            items2.push({
              i: options2,
              el: it,
              pts: [
                [value36 - value34, value37 - value35],
                [value36 + value34, value37 + value35],
              ],
              sw: Math.min(value8, value9),
              conn: false,
            });
            return;
          }
          let value25 =
              (value16 &&
                ((value4 as ShapeNode).shape === "diamond" ||
                  (value4 as ShapeNode).shape === "ellipse")) ||
              ((typeof value12.borderRadius === "number"
                ? value12.borderRadius
                : 0) >=
                Math.min(value8, value9) / 2 - 0.5 &&
                Math.abs(value8 - value9) <= 1),
            value26 =
              (value4 as ShapeNode).shape === "diamond"
                ? 0.5
                : value25
                  ? Math.SQRT1_2
                  : 1,
            value27 =
              value4.kind === "text" && !value22
                ? estimateTextBounds(value4, value8, value9)
                : {
                    x: (value8 * (1 - value26)) / 2,
                    y: (value9 * (1 - value26)) / 2,
                    w: value8 * value26,
                    h: value9 * value26,
                  },
            value28 = rotatedBox(
              items3 + value27.x,
              items4 + value27.y,
              value27.w,
              value27.h,
              items3 + value8 / 2,
              items4 + value9 / 2,
              value14,
            ),
            value29 = Math.abs(Math.abs(value14 % 180) - 90) < 1,
            value30 =
              Math.abs(value14 % 180) < 0.5
                ? {
                    x: items3,
                    y: items4,
                    w: value8,
                    h: value9,
                  }
                : value29
                  ? {
                      x: items3 + value8 / 2 - value9 / 2,
                      y: items4 + value9 / 2 - value8 / 2,
                      w: value9,
                      h: value8,
                    }
                  : undefined,
            value31 = value25 ? undefined : value30,
            value32 = value16
              ? (value4 as ShapeNode).shape === "line"
                ? 0
                : (value17?.width ?? 0)
              : value21
                ? typeof value12.borderWidth === "number"
                  ? value12.borderWidth
                  : Math.min(
                      Number(value12.borderTopWidth ?? 0),
                      Number(value12.borderRightWidth ?? 0),
                      Number(value12.borderBottomWidth ?? 0),
                      Number(value12.borderLeftWidth ?? 0),
                    )
                : 0,
            items5 = [];
          if (input2.it.node.kind === "overlay" && value22) {
            for (let value33 of (input2.it.node.layers ?? [])) {
              let value34 = value33.node.style ?? {},
                value35 =
                  (value34.backgroundColor !== undefined &&
                    hexColorAlpha(value34.backgroundColor) > 0.1) ||
                  (typeof value34.borderWidth === "number" &&
                    value34.borderWidth > 0 &&
                    value34.borderSides === undefined &&
                    hexColorAlpha(value34.borderColor) > 0.1),
                value36 = resolveHtmlAxisPlacement(value33.x, value8);
              if (
                !value35 ||
                !nodeHasVisibleContent(value33.node) ||
                value36?.size === undefined ||
                value36.size >= 0.9 * value8
              ) {
                continue;
              }
              let value37 = resolveHtmlAxisPlacement(
                  value33.y,
                  value9,
                ),
                value38 =
                  value37?.size ??
                  estimateNodeHeight(value33.node, value36.size);
              if (value37 === undefined || value38 === undefined) {
                continue;
              }
              let value39 = value34.transform ?? {};
              items5.push({
                x: items3 + value36.at + Number(value39.translateX ?? 0),
                y: items4 + value37.at + Number(value39.translateY ?? 0),
                w: value36.size,
                h: value38,
              });
            }
          }
          items.push({
            i: options2,
            el: it,
            node: value4,
            rect: value28,
            text: value23,
            painted: value22,
            opaque: value24,
            opacity: value15,
            surface: typeof value18 === "string" ? value18 : undefined,
            border: value32,
            skew: !value29 && Math.abs(value14 % 180) > 0.5,
            aabb: value31,
            bbox: value30,
            kids: items5,
            filled:
              value19 ||
              backgroundGradient !== undefined ||
              value4.kind === "img",
            fillAlpha:
              value4.kind === "img"
                ? 1
                : 1 -
                  (1 - (value19 ? hexColorAlpha(value18) : 0)) *
                    (1 -
                      (backgroundGradient !== undefined
                        ? Math.min(
                            ...backgroundGradient.stops.map(
                              (input3) =>
                                hexColorAlpha(input3.color),
                            ),
                          )
                        : 0)),
            blend: (value12.mixBlendMode ?? "normal") !== "normal",
            region: false,
          });
        });
        let callback2 = (input2: Point, options2: number): string | undefined => {
          let value4 = items.findLast((input3) => {
            if (
              input3.i >= options2 ||
              !(
                input3.opaque ||
                (input3.surface !== undefined &&
                  hexColorAlpha(input3.surface) > 0.1)
              )
            ) {
              return false;
            }
            let [value5, value6] = pointInRotatedBoxCoordinates(
              input3.rect,
              input2,
            );
            return (
              Math.abs(value5) <= input3.rect.hw &&
              Math.abs(value6) <= input3.rect.hh
            );
          });
          if (value4 === undefined) {
            return value;
          } else {
            if (value4.opaque) {
              return value4.surface;
            } else {
              return undefined;
            }
          }
        };
        for (let value4 = items.length - 1; value4 >= 0; value4--) {
          let value5 = items[value4]!;
          if (
            !value5.painted &&
            value5.node.kind === "text" &&
            value5.node.fill === undefined &&
            hasLowOpaqueContrast(
              value5.node.color,
              callback2([value5.rect.cx, value5.rect.cy], value5.i),
              value5.opacity,
            )
          ) {
            items.splice(value4, 1);
          }
        }
        let callback3 = (input2: PixelRect): boolean =>
          items2.some(
            (input3) =>
              input3.conn &&
              [input3.pts[0]!, input3.pts[input3.pts.length - 1]!].some(
                (input4) =>
                  input4[0] >= input2.x - 10 &&
                  input4[0] <= input2.x + input2.w + 10 &&
                  input4[1] >= input2.y - 10 &&
                  input4[1] <= input2.y + input2.h + 10,
              ),
          );
        for (let value4 of items) {
          if (!value4.painted) {
            continue;
          }
          let bbox = value4.bbox,
            value5 = bbox?.w ?? 2 * value4.rect.hw,
            value6 = bbox?.h ?? 2 * value4.rect.hh,
            value7 = value4.node.kind === "text" ? 0.9 : 0.6,
            value8 =
              !value4.text &&
              !value4.opaque &&
              value4.border === 0 &&
              value4.node.kind !== "img" &&
              value4.node.kind !== "icon" &&
              value4.node.kind !== "shape" &&
              (value4.opacity <= 0.5 ||
                value4.blend ||
                (value4.filled && value4.fillAlpha < 0.55));
          value4.region =
            value8 ||
            value4.kids.some(callback3) ||
            (options !== undefined &&
              value5 >= Math.min(options, Math.max(value7 * options, 480))) ||
            (context !== undefined &&
              value6 >= Math.min(context, Math.max(value7 * context, 240))) ||
            (bbox !== undefined &&
              items.some(
                (input2) =>
                  input2 !== value4 &&
                  input2.painted &&
                  input2.node.kind !== "icon" &&
                  input2.bbox !== undefined &&
                  input2.bbox.x >= bbox.x + 4 &&
                  input2.bbox.y >= bbox.y + 4 &&
                  input2.bbox.x + input2.bbox.w <= bbox.x + bbox.w - 4 &&
                  input2.bbox.y + input2.bbox.h <= bbox.y + bbox.h - 4 &&
                  callback3(input2.bbox),
              ));
        }
        let callback4 = (input2: LintBox): string =>
            callback(input2.el) +
            " (line " +
            String(input2.el.line) +
            ")" +
            (input2.node.kind === "text"
              ? ' "' +
                (0, runtime.compactDiagnosticValue)(
                  String(input2.node.text ?? ""),
                  24,
                ) +
                '"'
              : ""),
          callback5 = (input2: number, options2: number): string =>
            options2 === 1
              ? ""
              : (input2 === 0
                  ? "first"
                  : input2 === options2 - 1
                    ? "last"
                    : "middle") + " leg ",
          callback6 = (input2: number, options2: string, context2: string): string =>
            input2 > 1
              ? " (and " +
                String(input2 - 1) +
                " more " +
                (input2 > 2 ? context2 : options2) +
                ")"
              : "",
          state: Record<CssBoxSide, (input2: PixelRect) => [number, number, number]> = {
            top: (input2) => [
              input2.y + input2.h,
              input2.x,
              input2.x + input2.w,
            ],
            bottom: (input2) => [
              input2.y,
              input2.x,
              input2.x + input2.w,
            ],
            left: (input2) => [
              input2.x + input2.w,
              input2.y,
              input2.y + input2.h,
            ],
            right: (input2) => [
              input2.x,
              input2.y,
              input2.y + input2.h,
            ],
          },
          callback7 = (input2: LintBox): boolean =>
            input2.node.kind === "icon" ||
            (input2.node.kind === "text" &&
              input2.text &&
              (!input2.painted ||
                (input2.rect.hw <= 130 && input2.rect.hh <= 30))),
          entries = new Map<number, StrokeContactGroup>(),
          entries2 = new Map<number, StrokeContactGroup>(),
          entries3 = new Map<number, StrokeContactGroup>(),
          entries4 = new Map<number, StrokeContactGroup>(),
          callback8 = (
            input2: Map<number, StrokeContactGroup>,
            options2: number,
            context2: StrokeContactReport,
          ): void => {
            let entry = input2.get(options2);
            if (entry === undefined) {
              input2.set(options2, {
                best: context2,
                n: 1,
                head: context2.head === true,
              });
            } else if (
              (entry.n++,
              (entry.head ||= context2.head === true),
              context2.run > entry.best.run)
            ) {
              entry.best = context2;
            }
          };
        for (let value4 of items2) {
          let value5 = value4.heads ?? {
              start: "none",
              end: "none",
            },
            value6 = value5.start !== "none" || value5.end !== "none",
            value7 = value4.pts.slice(1).map(
              (input2, options2) => ({
                p: value4.pts[options2]!,
                q: input2,
                len: Math.hypot(
                  input2[0] - value4.pts[options2]![0],
                  input2[1] - value4.pts[options2]![1],
                ),
              }),
            ),
            value8 = value7.reduce(
              (input2, options2) =>
                input2 + options2.len,
              0,
            );
          if (value8 < 1) {
            continue;
          }
          let value9 = value4.conn
              ? Math.min(Math.max(8, 3 * value4.sw), value8 / 4)
              : 0,
            items3: Array<[number, number]> = [];
          for (let value10 of items) {
            if (value10.i <= value4.i || !value10.opaque) {
              continue;
            }
            let index = 0;
            for (let value11 of value7) {
              let value12 =
                value11.len > 0
                  ? segmentIntersectsRotatedBox(
                      value10.rect,
                      0,
                      value11.p,
                      value11.q,
                    )
                  : undefined;
              if (value12 !== undefined) {
                items3.push([
                  index + value12[0] * value11.len,
                  index + value12[1] * value11.len,
                ]);
              }
              index += value11.len;
            }
          }
          let callback9 = (input2: number, options2: number): number => {
            let value10 = items3
                .filter(
                  ([input3, input4]) =>
                    input4 > input2 && input3 < options2,
                )
                .sort(
                  (input3, options3) =>
                    input3[0]! - options3[0]!,
                ),
              index = 0,
              value11 = input2;
            for (let [value12, value13] of value10) {
              index = Math.max(index, value12 - value11);
              value11 = Math.max(value11, value13);
            }
            return Math.max(index, options2 - value11);
          };
          for (let value10 of items) {
            if (value10.i === value4.i || value10.region) {
              continue;
            }
            let value11 =
              !value4.conn || (!value6 && value7.length === 1);
            if (!value4.conn && !callback7(value10)) {
              continue;
            }
            if (!value4.conn && value10.i > value4.i) {
              let [items4, items5] = [value4.pts[0]!, value4.pts[1]!],
                value20 = -(items5[1] - items4[1]) / value8,
                value21 = (items5[0] - items4[0]) / value8,
                value22 = Math.abs(
                  value20 * (value10.rect.cx - items4[0]) +
                    value21 * (value10.rect.cy - items4[1]),
                ),
                value23 = (value10.rect.rot * Math.PI) / 180,
                value24 =
                  Math.abs(
                    value20 * Math.cos(value23) + value21 * Math.sin(value23),
                  ) *
                    value10.rect.hw +
                  Math.abs(
                    -value20 * Math.sin(value23) + value21 * Math.cos(value23),
                  ) *
                    value10.rect.hh;
              if (value22 + 0.5 * value24 <= value4.sw / 2) {
                continue;
              }
            }
            if (
              value4.conn &&
              !(value10.opaque && value10.i < value4.i) &&
              hasLowOpaqueContrast(
                value4.color,
                callback2(
                  [value10.rect.cx, value10.rect.cy],
                  Math.min(value10.i, value4.i),
                ),
                1,
                1.25,
              )
            ) {
              continue;
            }
            let value12 = [
                value4.pts[0]!,
                value4.pts[value4.pts.length - 1]!,
              ].map((input2) => {
                let [value20, value21] = pointInRotatedBoxCoordinates(
                  value10.rect,
                  input2,
                );
                return (
                  Math.abs(value20) <= value10.rect.hw + value4.sw / 2 + 2 &&
                  Math.abs(value21) <= value10.rect.hh + value4.sw / 2 + 2
                );
              }),
              value13 =
                value10.painted && value12[0] === true && value12[1] === true,
              value14 = value12[0] === true || value12[1] === true,
              value15 =
                !value10.text &&
                (value10.node.kind === "shape" ||
                  value10.node.kind === "img" ||
                  value10.node.kind === "icon" ||
                  (value10.painted &&
                    Math.max(value10.rect.hw, value10.rect.hh) <= 32));
            if (
              value15 &&
              !value10.opaque &&
              (value10.surface === undefined ||
                hexColorAlpha(value10.surface) <= 0.1) &&
              Math.max(value10.rect.hw, value10.rect.hh) <= 32 &&
              value7.some((input2) => {
                if (input2.len <= 0) {
                  return false;
                }
                let value20 = Math.max(
                  0,
                  Math.min(
                    1,
                    ((value10.rect.cx - input2.p[0]) *
                      (input2.q[0] - input2.p[0]) +
                      (value10.rect.cy - input2.p[1]) *
                        (input2.q[1] - input2.p[1])) /
                      (input2.len * input2.len),
                  ),
                );
                return (
                  Math.hypot(
                    value10.rect.cx -
                      (input2.p[0] + value20 * (input2.q[0] - input2.p[0])),
                    value10.rect.cy -
                      (input2.p[1] + value20 * (input2.q[1] - input2.p[1])),
                  ) <=
                  value4.sw / 2 + 2
                );
              })
            ) {
              continue;
            }
            let value16 = value10.painted
                ? -Math.min(
                    value4.sw / 2 + 1,
                    Math.min(value10.rect.hw, value10.rect.hh) - 1,
                  )
                : value4.sw / 2,
              index = 0,
              state2: StrokeContact = {
                run: 0,
                leg: -1,
                touchRun: 0,
              };
            if (
              !(value15 && value14) &&
              !value13 &&
              !(value11 && value4.conn && !callback7(value10))
            ) {
              for (let index2 = 0; index2 < value7.length; index2++) {
                let value20 = value7[index2]!,
                  value21 =
                    value20.len > 0
                      ? segmentIntersectsRotatedBox(
                          value10.rect,
                          value16,
                          value20.p,
                          value20.q,
                        )
                      : undefined;
                if (value21 !== undefined) {
                  let value22 = Math.max(
                      index + value21[0] * value20.len,
                      value9,
                    ),
                    value23 = Math.min(
                      index + value21[1] * value20.len,
                      value8 - value9,
                    ),
                    value24 =
                      value23 > value22 ? callback9(value22, value23) : 0,
                    value25: "start" | "end" | undefined =
                      value24 > 0
                        ? value22 <= value9
                          ? "start"
                          : value23 >= value8 - value9
                            ? "end"
                            : undefined
                        : undefined;
                  if (value24 > state2.run) {
                    state2 = {
                      ...state2,
                      run: value24,
                      leg: index2,
                    };
                  }
                  if (value25 !== undefined && value24 > state2.touchRun) {
                    state2 = {
                      ...state2,
                      touches: value25,
                      touchRun: value24,
                    };
                  }
                }
                index += value20.len;
              }
            }
            let value17: EdgeContact | undefined,
              value18 =
                callback7(value10) ||
                (value15 && Math.max(value10.rect.hw, value10.rect.hh) <= 32);
            if (
              value4.conn &&
              value10.painted &&
              !value18 &&
              value10.aabb !== undefined &&
              (value14
                ? value6 || value7.length > 1
                : value6 && value10.border > 0 && value10.i < value4.i)
            ) {
              let aabb = value10.aabb,
                value20 = value4.sw / 2 + value10.border / 2 + 3,
                index2 = 0;
              value7.forEach(
                (input2, options2) => {
                  let value21 = Math.max(index2, value9) - index2,
                    value22 =
                      Math.min(index2 + input2.len, value8 - value9) - index2;
                  index2 += input2.len;
                  if (value22 - value21 < 24) {
                    return;
                  }
                  let value23 =
                      Math.abs(input2.q[1] - input2.p[1]) < 0.5,
                    value24 =
                      Math.abs(input2.q[0] - input2.p[0]) < 0.5;
                  if (!value23 && !value24) {
                    return;
                  }
                  let value25: 0 | 1 = value23 ? 0 : 1,
                    value26 = value23 ? input2.p[1] : input2.p[0],
                    value27 = Math.sign(
                      input2.q[value25]! - input2.p[value25]!,
                    ),
                    value28 = input2.p[value25]! + value27 * value21,
                    value29 = input2.p[value25]! + value27 * value22,
                    [value30, value31] =
                      value28 < value29
                        ? [value28, value29]
                        : [value29, value28],
                    value32: Array<[CssBoxSide, number, number, number]> = value23
                      ? [
                          ["top", aabb.y, aabb.x, aabb.x + aabb.w],
                          ["bottom", aabb.y + aabb.h, aabb.x, aabb.x + aabb.w],
                        ]
                      : [
                          ["left", aabb.x, aabb.y, aabb.y + aabb.h],
                          ["right", aabb.x + aabb.w, aabb.y, aabb.y + aabb.h],
                        ];
                  for (let [
                    value33,
                    value34,
                    value35,
                    value36,
                  ] of value32) {
                    if (Math.abs(value26 - value34) > value20) {
                      continue;
                    }
                    let value37 = Math.max(value30, value35),
                      value38 = Math.min(value31, value36);
                    if (
                      value38 - value37 < 24 ||
                      (value17 !== undefined &&
                        value38 - value37 <= value17.run)
                    ) {
                      continue;
                    }
                    let value39 =
                      value33 === "top" || value33 === "left"
                        ? value26 - value34
                        : value34 - value26;
                    if (
                      value10.i > value4.i &&
                      value10.opaque &&
                      value39 >= value4.sw / 2
                    ) {
                      continue;
                    }
                    let index3 = 0;
                    for (let value41 of items) {
                      if (
                        value41 === value10 ||
                        !value41.painted ||
                        value41.aabb === undefined
                      ) {
                        continue;
                      }
                      let [value42, value43, value44] = state[value33](
                        value41.aabb,
                      );
                      if (Math.abs(value42 - value34) <= value20) {
                        index3 += Math.max(
                          0,
                          Math.min(value38, value44) -
                            Math.max(value37, value43),
                        );
                      }
                    }
                    if (index3 >= Math.max(12, (value38 - value37) / 2)) {
                      continue;
                    }
                    let callback10 = (input3: Point): boolean =>
                        input3[value25] >= value37 - value9 - 2 &&
                        input3[value25] <= value38 + value9 + 2,
                      value40 =
                        (options2 === value7.length - 1 &&
                          value5.end !== "none" &&
                          callback10(input2.q)) ||
                        (options2 === 0 &&
                          value5.start !== "none" &&
                          callback10(input2.p));
                    value17 = {
                      run: value38 - value37,
                      leg: options2,
                      side: value33,
                      head: value40,
                      clear: Math.ceil(value20 - value4.sw / 2 + 1),
                    };
                  }
                },
              );
            }
            let value19 =
              value10.node.kind === "text" && !value10.painted
                ? Math.max(8, 1.8 * Math.min(value10.rect.hw, value10.rect.hh))
                : 8;
            if (value17 !== undefined) {
              callback8(entries, value4.i, {
                ...value17,
                legs: value7.length,
                o: value10,
                ln: value4,
                touches: value14 ? "end" : undefined,
              });
            } else if (state2.run >= value19) {
              let state3: StrokeContactReport = {
                ...state2,
                legs: value7.length,
                o: value10,
                ln: value4,
                under: value10.i < value4.i && (value10.opaque || !value4.conn),
              };
              if (value18) {
                callback8(entries4, value10.i, state3);
              } else if (value14) {
                state3.touches =
                  state2.touches ?? (value12[1] === true ? "end" : "start");
                let value20 =
                  state3.touches === "start"
                    ? value4.pts[0]!
                    : value4.pts[value4.pts.length - 1]!;
                if (
                  !items.some((input2) => {
                    if (
                      input2 === value10 ||
                      input2.i === value4.i ||
                      input2.region ||
                      (!input2.painted &&
                        input2.rect.hw >= 0.8 * value10.rect.hw)
                    ) {
                      return false;
                    }
                    let [value21, value22] =
                      pointInRotatedBoxCoordinates(input2.rect, value20);
                    if (
                      Math.abs(value21) > input2.rect.hw + value9 + 2 ||
                      Math.abs(value22) > input2.rect.hh + value9 + 2
                    ) {
                      return false;
                    }
                    let [value23, value24] =
                        pointInRotatedBoxCoordinates(value10.rect, [
                          input2.rect.cx,
                          input2.rect.cy,
                        ]),
                      value25 =
                        ((input2.rect.rot - value10.rect.rot) * Math.PI) / 180,
                      value26 =
                        Math.abs(Math.cos(value25)) * input2.rect.hw +
                        Math.abs(Math.sin(value25)) * input2.rect.hh,
                      value27 =
                        Math.abs(Math.sin(value25)) * input2.rect.hw +
                        Math.abs(Math.cos(value25)) * input2.rect.hh;
                    return (
                      Math.abs(value23) + value26 <= value10.rect.hw + 2 &&
                      Math.abs(value24) + value27 <= value10.rect.hh + 2
                    );
                  })
                ) {
                  callback8(entries3, value4.i, state3);
                }
              } else {
                callback8(entries2, value4.i, {
                  ...state3,
                  touches: undefined,
                });
              }
            }
          }
        }
        for (let {
          best: value4,
          n: value5,
          head: value6,
        } of entries.values())
          this.lintAt(
            value4.ln.el,
            callback(value4.ln.el) +
              " " +
              callback5(value4.leg, value4.legs) +
              "runs along the " +
              String(value4.side) +
              " edge of " +
              callback4(value4.o) +
              " for " +
              String(Math.round(value4.run)) +
              "px" +
              callback6(value5, "edge", "edges") +
              " — the line disappears into the " +
              (value4.o.border > 0 ? "border" : "edge") +
              (value6 ? " and the head lies sideways" : "") +
              (value4.touches !== undefined
                ? "; leave that box from another edge (vh/hv), or run the leg through the gap between the boxes"
                : "; move the leg into the gap, at least " +
                  String(Math.max(8, value4.clear ?? 8)) +
                  "px clear of the edge"),
          );
        for (let { best: value4, n: value5 } of entries2.values())
          this.lintAt(
            value4.ln.el,
            callback(value4.ln.el) +
              " " +
              callback5(value4.leg, value4.legs) +
              "runs through " +
              callback4(value4.o) +
              " for " +
              String(Math.round(value4.run)) +
              "px" +
              callback6(value5, "box", "boxes") +
              ' — route it around: through the gap between the boxes (vh/hv from another edge, or straight head="none" segments), never across a box',
          );
        for (let { best: value4, n: value5 } of entries3.values())
          this.lintAt(
            value4.ln.el,
            callback(value4.ln.el) +
              " runs " +
              String(Math.round(value4.run)) +
              "px inside " +
              callback4(value4.o) +
              (value4.touches === "start"
                ? " from its start"
                : " before its end") +
              callback6(value5, "box", "boxes") +
              " — put " +
              (value4.touches === "start" ? "x1 y1" : "x2 y2") +
              " on the edge of that box nearest the other end, so the line stops at the box",
          );
        for (let { best: value4, n: value5 } of entries4.values()) {
          let value6 = value4.ln.conn
              ? callback(value4.ln.el) +
                " (line " +
                String(value4.ln.el.line) +
                ")" +
                (value4.legs > 1
                  ? ", " + callback5(value4.leg, value4.legs).trim()
                  : "")
              : "the " +
                String(Math.round(value4.ln.sw)) +
                "px rule " +
                callback(value4.ln.el) +
                " (line " +
                String(value4.ln.el.line) +
                ")",
            value7 =
              value4.under === true
                ? " — it is listed before the line, so the line is drawn over it; put it after the line in the source, or move it clear"
                : value4.o.node.kind === "icon"
                  ? " — move it clear of the line, or give it a background and list it after the line"
                  : (Math.abs(value4.o.rect.rot % 180) > 0.5
                      ? " (a rotated label turns about its box centre, not its first letter)"
                      : value4.o.painted
                        ? ""
                        : " (text extent estimated)") +
                    " — move " +
                    (value4.o.text ? "the label" : "it") +
                    " 8px clear of the line, or route the line past it";
          this.lintAt(
            value4.o.el,
            callback4(value4.o) +
              " is crossed by " +
              value6 +
              callback6(value5, "line", "lines") +
              value7,
          );
        }
        for (let index = 0; index < items.length; index++)
          for (
            let value4 = index + 1;
            value4 < items.length;
            value4++
          ) {
            let value5 = items[index]!,
              value6 = items[value4]!;
            if (
              !value5.text ||
              !value6.text ||
              (!value5.skew &&
                !value6.skew &&
                value2[value5.i]!.w !== undefined &&
                value2[value6.i]!.w !== undefined)
            ) {
              continue;
            }
            let value7 = rotatedBoxesOverlap(value5.rect, value6.rect);
            if (value7 > 4) {
              this.lintAt(
                value6.el,
                callback(value6.el) +
                  " overlaps " +
                  callback(value5.el) +
                  " (line " +
                  String(value5.el.line) +
                  ") by ~" +
                  String(Math.round(value7)) +
                  "px (" +
                  (value5.skew || value6.skew ? "rotated footprints, " : "") +
                  "estimated from the text) — both hold text; move one or trim its width to the text",
              );
            }
          }
      }
      lintWords(
        source: SlideNode,
        options: number | undefined,
        context: HtmlElementNode,
        value: string,
      ): void {
        let entry = this.nodeEl.get(source),
          value2 = entry ?? context,
          value3 =
            entry !== undefined &&
            (entry.line !== context.line || entry.col !== context.col),
          value4 = value3 ? "<" + entry!.tag + "> in " + value : value;
        if (source.kind === "text") {
          if (options === undefined || source.place?.minWFit !== undefined) {
            return;
          }
          let x = nodePaddingSize(source).x,
            value5 = Math.max(1, options - x);
          if (source.wrap === "nowrap") {
            let value8 = estimateTextUnwrappedWidth(source) - x;
            if (value8 > value5 + 2) {
              this.lintAt(
                value2,
                value4 +
                  " is " +
                  String(Math.round(value5)) +
                  "px wide" +
                  (x > 0 ? " inside its padding" : "") +
                  " but its one-line text needs ~" +
                  String(Math.round(value8)) +
                  "px — white-space: nowrap does not widen the box, the text will run past it; widen the box or shorten the text",
              );
            }
            return;
          }
          let { px: value6, word: value7 } =
            estimateLongestWordWidth(source);
          if (value7.length >= 3 && value6 > value5 + 2) {
            this.lintAt(
              value2,
              value4 +
                " is " +
                String(Math.round(value5)) +
                "px wide" +
                (x > 0 ? " inside its padding" : "") +
                ' but "' +
                (0, runtime.compactDiagnosticValue)(value7) +
                '" needs ~' +
                String(Math.round(value6)) +
                "px — it will break mid-word; widen the box" +
                (value3
                  ? " or use min-width: min-content on it (with white-space: nowrap for a one-line label)"
                  : " or shorten the word"),
            );
          }
          return;
        }
        if (
          source.kind === "shape" &&
          String(source.shape).startsWith("arrow-") &&
          typeof source.w === "number" &&
          typeof source.h === "number" &&
          source.w > 0 &&
          source.h > 0
        ) {
          let value5 =
            String(source.shape).endsWith("left") ||
            String(source.shape).endsWith("right")
              ? source.w / source.h
              : source.h / source.w;
          if (value5 > 3) {
            this.lintAt(
              value2,
              value4 +
                ' kind="' +
                String(source.shape) +
                '" is stretched ' +
                String(Math.round(value5 * 10) / 10) +
                ":1 — block arrows distort past ~2:1; for a line with an arrowhead use <x-connector>",
            );
          }
          return;
        }
        if (
          source.kind === "stack" ||
          source.kind === "overlay" ||
          source.kind === "grid"
        ) {
          if (source.kind === "overlay") {
            this.lintWords(source.base, options, context, value);
            return;
          }
          let value5 = nodePaddingSize(source),
            value6 =
              options === undefined
                ? undefined
                : Math.max(1, options - value5.x),
            value7 = source.children ?? [],
            value8 = typeof source.gap === "number" ? source.gap : 0;
          if (source.kind === "grid") {
            let value10: GridTrackProbe[] = source.columns ?? [],
              value11 = value7.some((input) => {
                let place = input.place;
                return (
                  (place?.colSpan ?? 1) !== 1 || (place?.rowSpan ?? 1) !== 1
                );
              }),
              value12: number[] | undefined;
            if (
              value6 !== undefined &&
              !value11 &&
              value10.length > 0 &&
              value10.every(
                (input) => typeof input === "object",
              )
            ) {
              let value13 = value10.reduce(
                  (input, options2) =>
                    input +
                    (typeof options2 === "object" &&
                    typeof options2.px === "number"
                      ? options2.px
                      : 0),
                  0,
                ),
                value14 = value10.reduce(
                  (input, options2) =>
                    input +
                    (typeof options2 === "object" &&
                    typeof options2.fr === "number"
                      ? options2.fr
                      : 0),
                  0,
                ),
                value15 = Math.max(
                  0,
                  value6 - value8 * (value10.length - 1) - value13,
                );
              value12 = value10.map(
                (input) =>
                  typeof input === "object" && typeof input.px === "number"
                    ? input.px
                    : value14 > 0
                      ? (value15 *
                          (typeof input === "object" &&
                          typeof input.fr === "number"
                            ? input.fr
                            : 0)) /
                        value14
                      : 0,
              );
            }
            value7.forEach(
              (input, options2) =>
                this.lintWords(
                  input,
                  explicitNodeWidth(input) ??
                    (value12 !== undefined
                      ? Math.max(1, value12[options2 % value12.length]!)
                      : undefined),
                  context,
                  value,
                ),
            );
            return;
          }
          let callback = (input: SlideNode): number =>
              Number(input.place?.grow ?? 0),
            callback2 = (input: SlideNode): number | undefined =>
              input.place?.basis,
            value9: number | undefined;
          if (
            source.dir === "h" &&
            value6 !== undefined &&
            source.wrap !== true
          ) {
            let index = 0,
              index2 = 0;
            for (let value10 of value7) {
              let value11 = explicitNodeWidth(value10);
              if (value11 !== undefined) {
                index += value11;
              } else {
                index2 += Math.max(1, callback(value10));
              }
            }
            if (index2 > 0) {
              value9 = Math.max(
                1,
                (value6 - value8 * Math.max(0, value7.length - 1) - index) /
                  index2,
              );
            }
          }
          for (let value10 of value7) {
            let value11 = explicitNodeWidth(value10),
              value12 =
                value9 !== undefined &&
                callback(value10) > 0 &&
                callback2(value10) === 0
                  ? value9 * callback(value10)
                  : undefined,
              value13 =
                value11 !== undefined
                  ? Math.min(value11, value6 ?? value11)
                  : source.dir === "h"
                    ? value12
                    : value6;
            this.lintWords(value10, value13, context, value);
          }
        }
      }
      files: HtmlFileReference[] = [];
      faces: FontFace[] = [];
      faceNames: Map<string, string> = new Map();
      slideNodes: number = 0;
      fileSeen: Set<string> = new Set();
      constructor(
        input: ReadonlyMap<string, string> | undefined,
        options: boolean,
        context: ListRenderingMode | undefined,
      ) {
        this.fileMap = input;
        this.collectFiles = options;
        this.lists = context;
      }
      listEm(input: HtmlElementNode, options: HtmlNodeContext): number | undefined {
        if (
          this.lists === "css" &&
          (input.tag === "ul" || input.tag === "ol")
        ) {
          return options.inh.fontSize ?? importedHtmlTypeScale.p.size;
        } else {
          return undefined;
        }
      }
      noteMap: Map<string, CompileNote> = new Map();
      lifted: PinnedNode[] = [];
      warnAt(input: HtmlSourcePosition, options: string): void {
        for (let [value, value2] of compileWarningCodes) {
          if (!value.test(options)) {
            continue;
          }
          let entry = this.noteMap.get(value2);
          if (entry !== undefined) {
            entry.count++;
          } else {
            this.noteMap.set(value2, {
              key: value2,
              count: 1,
              line: input.line,
              col: input.col,
              message: options,
            });
          }
          return;
        }
        if (this.warnings.length < 2000) {
          this.warnings.push({
            line: input.line,
            col: input.col,
            message: options,
          });
        }
      }
      notes(): CompileNote[] {
        return [...this.noteMap.values()];
      }
      loneShareAfterDrops(
        items: HtmlElementNode[],
        options: HtmlElementNode[],
        items2: SlideNode[],
        value: "h" | "v",
        extra: boolean,
      ): void {
        if (extra || items.length < 2) {
          return;
        }
        let callback = (input: SlideNode): number | undefined => input.place?.grow,
          value2 = items2.filter(
            (input: SlideNode) =>
              typeof callback(input) === "number" && callback(input)! > 0,
          );
        if (value2.length !== 1) {
          return;
        }
        let value3 = items2.indexOf(value2[0]!),
          value4 = options[value3]!,
          value5: "width" | "height" = value === "h" ? "width" : "height",
          value6 = parseInlineStyle(
            value4.attrs.style,
            () => {
              return;
            },
            () => {
              return;
            },
          )[value5];
        if (
          value6 === undefined ||
          value6 === "auto" ||
          !("pct" in value6) ||
          value6.pct >= 100 ||
          callback(value2[0]!) !== value6.pct
        ) {
          return;
        }
        let entry = this.noteMap.get("percent-width");
        if (entry !== undefined && --entry.count === 0) {
          this.noteMap.delete("percent-width");
        }
        if (items2.length === 1) {
          this.warnAt(
            value4,
            value5 +
              ":" +
              String(value6.pct) +
              "% is dropped and the child stretches to the FULL " +
              value5 +
              " of its parent (100%, not " +
              String(value6.pct) +
              "% — its siblings were dropped, so its share is the whole axis); give it px",
          );
        } else {
          this.warnAt(
            value4,
            value5 +
              ":" +
              String(value6.pct) +
              "% is dropped and the child takes ALL the free " +
              value5 +
              " next to its siblings (not " +
              String(value6.pct) +
              "% of the parent — it is the only child that grows); give it px",
          );
        }
      }
      errorAt(input: HtmlSourcePosition, options: string): void {
        if (this.errors.length < 500) {
          this.errors.push({
            line: input.line,
            col: input.col,
            message: options,
          });
        }
      }
      warner(input: HtmlSourcePosition, options: string): HtmlDiagnosticReporter {
        return (input2: string): void =>
          this.warnAt(input, options + input2);
      }
      unsupported: CompileDiagnostic[] = [];
      cellRemovals: number = 0;
      slideLabel: string = "";
      rejectAt(input: HtmlSourcePosition, options: string): void {
        if (this.unsupported.length < 2000) {
          this.unsupported.push({
            line: input.line,
            col: input.col,
            message: this.slideLabel + options,
          });
        }
      }
      rejecter(input: HtmlSourcePosition, options: string): HtmlDiagnosticReporter {
        return (input2: string): void =>
          this.rejectAt(input, options + input2);
      }
      countNode(input: HtmlSourcePosition): boolean {
        this.slideNodes++;
        if (this.slideNodes === runtime.maxSlideFrames + 1) {
          this.errorAt(
            input,
            "more than " +
              String(runtime.maxSlideFrames) +
              " elements on one slide",
          );
        }
        return this.slideNodes <= runtime.maxSlideFrames;
      }
      resetSlide(): void {
        this.slideNodes = 0;
        this.slideCells = 0;
      }
      slideCells: number = 0;
      deckCells: number = 0;
      countCells(input: HtmlSourcePosition, options: number): void {
        this.slideCells += options;
        this.deckCells += options;
        if (
          this.slideCells > runtime.maxSlideTableCells &&
          this.slideCells - options <= runtime.maxSlideTableCells
        ) {
          this.errorAt(
            input,
            "tables on this slide hold more than " +
              String(runtime.maxSlideTableCells) +
              " cells — split the table across slides",
          );
        }
        if (
          this.deckCells > runtime.maxDeckTableCells &&
          this.deckCells - options <= runtime.maxDeckTableCells
        ) {
          this.errorAt(
            input,
            "tables in this deck hold more than " +
              String(runtime.maxDeckTableCells) +
              " cells in total",
          );
        }
      }
      textCaps(input: HtmlSourcePosition, items: string, items2: TextMark[]): void {
        if (items.length > runtime.maxNodeTextLength) {
          this.errorAt(
            input,
            "text is " +
              String(items.length) +
              " characters — one element holds at most " +
              String(runtime.maxNodeTextLength) +
              "; split it",
          );
        }
        if (items2.length > runtime.maxTextMarks) {
          this.errorAt(
            input,
            String(items2.length) +
              " inline marks (b/i/u/a/span) in one element — at most " +
              String(runtime.maxTextMarks) +
              "; split it",
          );
        }
      }
      collectsFiles(): boolean {
        return this.collectFiles;
      }
      fileRef(
        input: string,
        options: "font" | "image",
        context: HtmlSourcePosition,
      ): string | undefined {
        let value = this.fileMap?.get(input);
        if (value !== undefined) {
          return value;
        }
        if (!this.fileSeen.has(input)) {
          this.fileSeen.add(input);
          this.files.push({
            ref: input,
            kind: options,
            line: context.line,
            col: context.col,
          });
        }
        return;
      }
      declareFace(input: FontFace, options: HtmlSourcePosition): void {
        let value = input.family.toLowerCase();
        if (this.faceNames.has(value)) {
          this.warnAt(
            options,
            'font "' +
              input.family +
              '" is declared twice — the first declaration is used',
          );
          return;
        }
        if (this.faces.length >= runtime.maxDeckFontFaces) {
          this.warnAt(
            options,
            "more than " +
              String(runtime.maxDeckFontFaces) +
              ' font families declared — "' +
              input.family +
              '" is dropped',
          );
          return;
        }
        this.faceNames.set(value, input.family);
        this.faces.push(input);
      }
      sawFontFamily: boolean = false;
      resolveFamily(
        input: string[],
        options: HtmlSourcePosition,
      ): FontFamilyValue | undefined {
        this.sawFontFamily = true;
        let value: FontFamilyFallback | undefined,
          text: string = "sans-serif",
          value2: string | undefined;
        for (let value8 of input.slice(1)) {
          let value9 = ownRecordValue(
            genericFontFallbackKinds,
            value8.toLowerCase(),
          );
          if (value9 === undefined) {
            value2 ??= resolveBasicFontFamily(value8);
          } else if (value === undefined) {
            value = value9;
            text = value8.toLowerCase();
            value2 ??= ownRecordValue(specialGenericFontFaces, text);
          }
        }
        let value3 = input[0] ?? "",
          value4 = value3.toLowerCase(),
          value5 = ownRecordValue(genericFontFallbackKinds, value4);
        if (value5 !== undefined) {
          return value5;
        }
        let value6 = ownRecordValue(webSafeFontAliases, value4),
          value7 =
            value6?.basic === true || value2 === undefined
              ? {}
              : {
                  webSafe: value2,
                },
          entry = this.faceNames.get(value4);
        if (
          (entry !== undefined || value6 !== undefined) &&
          value2 === undefined &&
          value6?.basic !== true &&
          value6?.fallback !== "helvetica"
        ) {
          let value8 =
            webSafeFallbackFaces[
              entry !== undefined ? (value ?? "sans") : value6!.fallback
            ];
          this.warnAt(
            options,
            'font-family: "' +
              value3 +
              '" names no basic face (fonts.md), so a PowerPoint export with basic fonts falls back to ' +
              value8 +
              " — to choose, name one before the generic: font-family:'" +
              value3 +
              "', " +
              value8 +
              ", " +
              text,
          );
        }
        if (entry !== undefined) {
          return {
            family: entry,
            fallback: value ?? "sans",
            ...value7,
          };
        }
        if (value6 !== undefined) {
          return {
            family: value6.family,
            fallback: value6.fallback,
            ...value7,
          };
        }
        if (!runtime.customFontFamilyPattern.test(value3)) {
          this.warnAt(
            options,
            'font-family: "' +
              (0, runtime.compactDiagnosticValue)(value3) +
              '" is not a usable family name — using ' +
              (value ?? "sans-serif"),
          );
          return value ?? "sans";
        }
        this.warnAt(
          options,
          'font-family: "' +
            value3 +
            '" is not declared in <head> (a Google Fonts <link> or an @font-face) and is not a web-safe face — using ' +
            (value ?? "sans-serif") +
            "; declare it or pick a web-safe/generic family",
        );
        return value ?? "sans";
      }
      typography(
        input: ParsedInlineStyle,
        options: InheritedTextStyle,
        context: string,
        value: HtmlSourcePosition,
      ): { own: InheritedTextStyle; eff: InheritedTextStyle } {
        let state: InheritedTextStyle = {},
          value2 = htmlHeadingNames.has(context),
          value3 =
            importedHtmlTypeScale[
              (value2 ? context : "p") as keyof RuntimeBindings["importedHtmlTypeScale"]
            ];
        if (input["font-family"] !== undefined) {
          let value7 = this.resolveFamily(input["font-family"], value);
          if (value7 !== undefined) {
            state.fontFamily = value7;
          }
        }
        if (input["font-size"] !== undefined) {
          state.fontSize = input["font-size"];
        }
        if (input["font-weight"] !== undefined) {
          state.fontWeight = input["font-weight"];
        }
        if (input["font-style"] !== undefined) {
          state.fontStyle = input["font-style"];
        }
        if (input.color !== undefined) {
          state.color = input.color;
        }
        if (input["text-align"] !== undefined) {
          state.textAlign = input["text-align"];
        }
        if (input["text-transform"] !== undefined) {
          state.textTransform = input["text-transform"];
        }
        if (input["white-space"] !== undefined) {
          state.noWrap = input["white-space"] === "nowrap";
        }
        let value4 =
            state.fontSize ??
            (value2 ? value3.size : (options.fontSize ?? value3.size)),
          callback = (
            input2: "line-height" | "letter-spacing",
            options2: number,
            context2: "lineHeight" | "letterSpacing",
            value7: string,
          ): number | undefined => {
            let { lo: value8, hi: value9 } = slideStylePropertySchema(context2);
            if (options2 >= value8 && options2 <= value9) {
              return options2;
            }
            this.rejectAt(
              value,
              "<" +
                context +
                "> " +
                input2 +
                ": " +
                value7 +
                " is " +
                String(options2) +
                (input2 === "line-height" ? "× the " : "px at the ") +
                String(value4) +
                "px font size — outside " +
                String(value8) +
                "–" +
                String(value9),
            );
            return;
          },
          value5 = input["line-height"];
        if (value5 !== undefined) {
          if (typeof value5 === "number") {
            state.lineHeight = value5;
          } else {
            let value7 = callback(
              "line-height",
              Math.round((value5.px / value4) * 100) / 100,
              "lineHeight",
              String(value5.px) + "px",
            );
            if (value7 !== undefined) {
              state.lineHeight = value7;
              this.warnAt(
                value,
                "line-height: " +
                  String(value5.px) +
                  "px converted to " +
                  String(value7) +
                  " (unitless, relative to the " +
                  String(value4) +
                  "px font size)",
              );
            }
          }
        }
        let value6 = input["letter-spacing"];
        if (value6 !== undefined) {
          let value7 =
            typeof value6 === "number"
              ? value6
              : callback(
                  "letter-spacing",
                  Math.round(value6.em * value4 * 10) / 10,
                  "letterSpacing",
                  String(value6.em) + "em",
                );
          if (value7 !== undefined) {
            state.letterSpacing = value7;
          }
        }
        let state2: InheritedTextStyle = {
          fontFamily: state.fontFamily ?? options.fontFamily,
          fontSize: state.fontSize ?? (value2 ? undefined : options.fontSize),
          fontWeight:
            state.fontWeight ?? (value2 ? undefined : options.fontWeight),
          fontStyle: state.fontStyle ?? options.fontStyle,
          lineHeight: state.lineHeight ?? options.lineHeight,
          letterSpacing: state.letterSpacing ?? options.letterSpacing,
          color: state.color ?? options.color,
          textAlign: state.textAlign ?? options.textAlign,
          textTransform: state.textTransform ?? options.textTransform,
          noWrap: state.noWrap ?? options.noWrap,
        };
        return {
          own: state,
          eff: state2,
        };
      }
      inherit(
        input: ParsedInlineStyle,
        options: InheritedTextStyle,
        context: HtmlSourcePosition,
      ): InheritedTextStyle {
        let { own: value } = this.typography(
          input,
          options,
          "div",
          context,
        );
        return {
          ...options,
          ...value,
        };
      }
      paintBag(
        input: ParsedInlineStyle,
        options: StyleTargetKind,
        context: HtmlElementNode,
        value: Set<string>,
      ): StyleBag {
        let state: StyleBag = {},
          callback = (input2: string): void =>
            this.rejectAt(
              context,
              input2 +
                " does not apply to <" +
                (
                  {
                    text: "p/h1/h2/h3/ul/ol",
                    img: "img",
                    icon: "x-icon",
                    stack: "div",
                    table: "table",
                    shape: "x-shape",
                  } as Record<string, string>
                )[options] +
                ">",
            ),
          callback2 = <K extends keyof ParsedInlineStyle>(
            input2: K,
          ): ParsedInlineStyle[K] => {
            value.add(input2);
            return input[input2];
          },
          value2 = callback2("background-color");
        if (value2 !== undefined) {
          state.backgroundColor = value2;
        }
        let value3 = callback2("background-gradient");
        if (value3 !== undefined) {
          if (options === "icon" || options === "shape") {
            callback("background gradient");
          } else {
            state.backgroundGradient = value3;
          }
        }
        let items = [
          callback2("padding-top"),
          callback2("padding-right"),
          callback2("padding-bottom"),
          callback2("padding-left"),
        ];
        if (items.some((input2) => input2 !== undefined)) {
          if (
            options === "stack" ||
            options === "text" ||
            options === "table"
          ) {
            if (items[0] !== undefined) {
              state.paddingTop = items[0];
            }
            if (items[1] !== undefined) {
              state.paddingRight = items[1];
            }
            if (items[2] !== undefined) {
              state.paddingBottom = items[2];
            }
            if (items[3] !== undefined) {
              state.paddingLeft = items[3];
            }
          } else {
            callback("padding");
          }
        }
        let value4 = callback2("border");
        if (value4 !== undefined) {
          if (value4.style === "none") {
          } else if (value4.style === undefined) {
            this.rejectAt(
              context,
              diagnosticHtmlTagLabel(context) +
                "border-width/border-color without a border-style draw nothing — write border: " +
                String(value4.width ?? 1) +
                "px solid " +
                (value4.color ?? "COLOR"),
            );
          } else if (
            Math.max(
              value4.width ?? 1,
              ...Object.values<number>(value4.widths ?? {}),
            ) >
            (options === "shape"
              ? runtime.maxShapeStrokeWidth
              : slideStylePropertySchema("borderWidth").hi)
          ) {
            this.rejectAt(
              context,
              diagnosticHtmlTagLabel(context) +
                "border: " +
                String(
                  Math.max(
                    value4.width ?? 1,
                    ...Object.values<number>(value4.widths ?? {}),
                  ),
                ) +
                "px — a border is 0–" +
                String(slideStylePropertySchema("borderWidth").hi) +
                "px (only x-shape / x-connector strokes go to " +
                String(runtime.maxShapeStrokeWidth) +
                ")",
            );
          } else if (
            value4.widths !== undefined &&
            new Set(
              cssBoxSideNames
                .map((input2) => value4.widths![input2] ?? 0)
                .filter((input2) => input2 > 0),
            ).size > 1
          ) {
            state.borderStyle = value4.style ?? "solid";
            state.borderColor = value4.color ?? "#000000";
            for (let value14 of cssBoxSideNames) {
              let value15 = value4.widths[value14];
              if (value15 !== undefined && value15 > 0) {
                state[cssBorderSideWidthFields[value14]] = value15;
              }
            }
          } else {
            if (value4.widths !== undefined) {
              let value14 = cssBoxSideNames.filter(
                (input2) => (value4.widths![input2] ?? 0) > 0,
              );
              value4.width = value14.length > 0 ? value4.widths[value14[0]!] : 0;
              value4.sides = value14;
              if (value14.length === 0) {
                value4.style = "none";
              }
            }
            if (value4.style === "none") {
            } else if (
              ((state.borderWidth = value4.width ?? 1),
              (state.borderStyle = value4.style ?? "solid"),
              (state.borderColor = value4.color ?? "#000000"),
              value4.sides !== undefined && value4.sides.length < 4)
            ) {
              state.borderSides = value4.sides!.join(" ") as BorderSidesValue;
            }
          }
        }
        let value5 = callback2("border-radius");
        if (value5 !== undefined) {
          let callback3 = (input2: CssSizeValue): number =>
            "px" in input2
              ? input2.px
              : input2.pct >= 50
                ? 256
                : Math.round((input2.pct / 100) * 256);
          if (options === "icon") {
            callback("border-radius");
          } else {
            let value14 =
              "corners" in value5 ? value5.corners.map(callback3) : null;
            if (
              value14 !== null &&
              value14.some((input2) => input2 !== value14[0])
            ) {
              [
                state.borderTopLeftRadius,
                state.borderTopRightRadius,
                state.borderBottomRightRadius,
                state.borderBottomLeftRadius,
              ] = value14;
            } else {
              state.borderRadius =
                value14 !== null ? value14[0] : callback3(value5 as CssSizeValue);
            }
          }
        }
        let value6 = callback2("opacity");
        if (value6 !== undefined) {
          state.opacity = value6;
        }
        let value7 = callback2("box-shadow");
        if (value7 !== undefined) {
          state.boxShadow = value7;
        }
        let value8 = callback2("text-shadow");
        if (value8 !== undefined) {
          if (options === "text" || options === "table") {
            state.textShadow = value8;
          } else {
            callback("text-shadow");
          }
        }
        let value9 = callback2("transform");
        if (value9 !== undefined && Object.keys(value9.value).length > 0) {
          state.transform = value9.value;
        }
        let value10 = callback2("filter");
        if (value10 !== undefined && Object.keys(value10).length > 0) {
          state.filter = value10;
        }
        let value11 = callback2("backdrop-filter");
        if (value11 !== undefined && Object.keys(value11).length > 0) {
          state.backdropFilter = value11;
        }
        let value12 = callback2("mix-blend-mode");
        if (value12 !== undefined) {
          state.mixBlendMode = value12;
        }
        let value13 = callback2("overflow");
        if (value13 !== undefined) {
          if (options === "stack") {
            state.overflow = value13;
          } else {
            callback("overflow");
          }
        }
        return state;
      }
      textBag(
        input: ParsedInlineStyle,
        options: InheritedTextStyle,
        context: HtmlElementNode,
        value: Set<string>,
      ): StyleBag {
        let value2 = this.paintBag(input, "text", context, value);
        for (let value3 of [
          "font-family",
          "font-size",
          "font-weight",
          "font-style",
          "line-height",
          "letter-spacing",
          "text-align",
          "text-transform",
          "white-space",
          "color",
          "text-decoration-line",
          "text-decoration-style",
          "text-decoration-color",
          "font-variant-numeric",
          "text-stroke-width",
          "text-stroke-color",
        ] as const)
          value.add(value3);
        this.typeKeys(value2, input, options, context);
        return value2;
      }
      typeKeys(
        input: StyleBag,
        options: ParsedInlineStyle,
        context: InheritedTextStyle,
        value: HtmlElementNode,
      ): void {
        if (context.fontFamily !== undefined) {
          input.fontFamily = context.fontFamily;
        }
        if (context.fontSize !== undefined) {
          input.fontSize = context.fontSize;
        }
        if (context.fontWeight !== undefined) {
          input.fontWeight = context.fontWeight;
        }
        if (context.fontStyle !== undefined) {
          input.fontStyle = context.fontStyle;
        }
        if (context.lineHeight !== undefined) {
          input.lineHeight = context.lineHeight;
        }
        if (context.letterSpacing !== undefined) {
          input.letterSpacing = context.letterSpacing;
        }
        if (context.textTransform !== undefined) {
          input.textTransform = context.textTransform;
        }
        let value2 = options["text-decoration-line"];
        if (value2 !== undefined) {
          input.textDecorationLine = value2;
        }
        if (
          options["text-decoration-style"] !== undefined ||
          options["text-decoration-color"] !== undefined
        ) {
          if (value2 === undefined || value2 === "none") {
            this.warnAt(
              value,
              "text-decoration style/color without a line (underline | line-through) — dropped",
            );
          } else {
            if (options["text-decoration-style"] !== undefined) {
              input.textDecorationStyle = options["text-decoration-style"];
            }
            if (options["text-decoration-color"] !== undefined) {
              input.textDecorationColor = options["text-decoration-color"];
            }
          }
        }
        if (options["font-variant-numeric"] !== undefined) {
          input.fontVariantNumeric = options["font-variant-numeric"];
        }
        if (options["text-stroke-width"] !== undefined) {
          input.textStrokeWidth = options["text-stroke-width"];
        }
        if (options["text-stroke-color"] !== undefined) {
          input.textStrokeColor = options["text-stroke-color"];
        }
      }
      place(
        input: ParsedInlineStyle,
        options: StyleTargetKind,
        context: HtmlNodeContext,
        value: HtmlElementNode,
        extra: Set<string>,
      ): NodePlacement {
        let state: NodePlacement = {},
          callback = <K extends keyof ParsedInlineStyle>(
            input2: K,
          ): ParsedInlineStyle[K] => {
            extra.add(input2);
            return input[input2];
          },
          value2 = callback("flex-grow"),
          value3 = callback("flex-shrink"),
          value4 = callback("flex-basis"),
          value5 = callback("align-self"),
          value6 = callback("justify-self"),
          value7 = callback("min-width"),
          value8 = callback("min-width-fit"),
          value9 = callback("min-height"),
          value10 = callback("max-width"),
          value11 = callback("max-height"),
          value12 = callback("aspect-ratio"),
          value13 = callback("grid-column"),
          value14 = callback("grid-row");
        if (!context.inContainer) {
          if (
            [
              value2,
              value3,
              value4,
              value5,
              value6,
              value7,
              value8,
              value9,
              value10,
              value11,
              value13,
              value14,
            ].some((input2) => input2 !== undefined)
          ) {
            this.rejectAt(
              value,
              "flex/align-self/justify-self/min-*/max-*/grid-column apply to a div's flow children only (this element is pinned)",
            );
          }
          if (value12 !== undefined) {
            this.rejectAt(
              value,
              "aspect-ratio applies to a div's flow children only — give a pinned element width and height",
            );
          }
          return state;
        }
        if (value2 !== undefined) {
          state.grow = value2;
        }
        if (value3 !== undefined && value3 !== 1) {
          state.shrink = value3;
        }
        if (value4 !== undefined && value4 !== "auto") {
          state.basis = value4;
        }
        if (value5 !== undefined) {
          state.alignSelf = value5;
        }
        if (value6 !== undefined) {
          state.justifySelf = value6 as NodePlacement["justifySelf"];
        }
        let callback2 = (
          input2: CssSizeValue | undefined,
          options2: string,
        ): number | undefined => {
          if (input2 === undefined) {
            return;
          }
          if ("pct" in input2) {
            this.warnAt(
              value,
              options2 +
                ":" +
                String(input2.pct) +
                "% inside a div is dropped (the box may size differently) — use px, or flex:1 for a share",
            );
            return;
          }
          return input2.px;
        };
        if (value7 !== undefined) {
          state.minW = callback2(value7, "min-width");
        }
        if (value8 !== undefined) {
          state.minWFit = value8 as NodePlacement["minWFit"];
        }
        if (value9 !== undefined) {
          state.minH = callback2(value9, "min-height");
        }
        if (value10 !== undefined) {
          state.maxW = callback2(value10, "max-width");
        }
        if (value11 !== undefined) {
          state.maxH = callback2(value11, "max-height");
        }
        if (value12 !== undefined) {
          state.aspect = value12;
        }
        if (value13 !== undefined) {
          state.colSpan = value13;
        }
        if (value14 !== undefined) {
          state.rowSpan = value14;
        }
        if (options === "text" || options === "stack" || options === "table") {
          let value15 = callback("width"),
            value16 = callback("height"),
            callback3 = (
              input2: CssSizeValue,
              options2: "width" | "height",
              context2: boolean,
            ): boolean => {
              if (!("pct" in input2)) {
                return false;
              }
              if (options === "table" && options2 === "height") {
                this.warnAt(
                  value,
                  diagnosticHtmlTagLabel(value) +
                    "height is ignored — a table is as tall as its rows",
                );
                return true;
              }
              if (context2) {
                if (state.grow === 0) {
                  this.warnAt(
                    value,
                    options2 +
                      ":" +
                      String(input2.pct) +
                      "% is dropped (flex-grow is 0, so there is no share to take) — the box keeps its content size; give it px",
                  );
                  return true;
                }
                if (state.grow === undefined) {
                  state.grow = input2.pct;
                }
                if (state.basis === undefined) {
                  state.basis = 0;
                }
                if (context.flowCount === 1 && input2.pct < 100) {
                  this.warnAt(
                    value,
                    options2 +
                      ":" +
                      String(input2.pct) +
                      "% is dropped and the child stretches to the FULL " +
                      options2 +
                      " of its parent (100%, not " +
                      String(input2.pct) +
                      "% — a lone child's share is the whole axis); give it px",
                  );
                } else {
                  this.warnAt(
                    value,
                    options2 +
                      ": % of the parent is not supported inside a div — healed to a proportional share (flex-grow " +
                      String(input2.pct) +
                      ")",
                  );
                }
              } else if (options === "table") {
                if (options2 === "width" && input2.pct < 100) {
                  this.rejectAt(
                    value,
                    "<table> width:" +
                      String(input2.pct) +
                      "% — a table is always its container's width; give the table px, or wrap it in a div of that width",
                  );
                } else {
                  this.warnAt(
                    value,
                    options2 +
                      ": % of the parent is not supported inside a div — ignored (a table is " +
                      (options2 === "width"
                        ? "its container's width"
                        : "as tall as its rows") +
                      ")",
                  );
                }
              } else {
                let value17 = nonStretchAxisExplanation(
                  context,
                  options2,
                  value5,
                  value6,
                );
                if (value17 === undefined && input2.pct >= 100) {
                  this.warnAt(
                    value,
                    options2 +
                      ": % of the parent is not supported inside a div — ignored across the axis (the child stretches to fill it)",
                  );
                } else if (
                  value17 !== undefined &&
                  input2.pct === 100 &&
                  options2 === "width" &&
                  state.minW === undefined &&
                  state.maxW === undefined &&
                  state.minWFit === undefined &&
                  !inlineStyleHasUnsafeSizing(value.attrs?.style, "width")
                ) {
                  let value18 =
                    context.parentGrid === true ? "justify-self" : "align-self";
                  if (value18 === "justify-self") {
                    state.justifySelf = "stretch";
                  } else {
                    state.alignSelf = "stretch";
                  }
                  let value19 = value17.startsWith("the parent's ")
                    ? "width:100% in a parent with " + value17.slice(13) + " is"
                    : "has " +
                      value17.replace(/^its /, "") +
                      " and width:100%:";
                  this.warnAt(
                    value,
                    diagnosticHtmlTagLabel(value) +
                      value19 +
                      " kept as " +
                      value18 +
                      ":stretch, which draws the same full-width box. Nothing to change.",
                  );
                } else if (value17 === undefined) {
                  this.rejectAt(
                    value,
                    diagnosticHtmlTagLabel(value) +
                      options2 +
                      ": " +
                      String(input2.pct) +
                      "% across the parent's axis — a flow child stretches (100%); for less use " +
                      options2 +
                      " in px, or align-self so it sizes to its content",
                  );
                } else {
                  this.rejectAt(
                    value,
                    diagnosticHtmlTagLabel(value) +
                      options2 +
                      ":" +
                      String(input2.pct) +
                      "% across the parent's axis — " +
                      value17 +
                      " stops the child stretching, so it would shrink to its content; give it px",
                  );
                }
              }
              return true;
            };
          if (
            value15 !== undefined &&
            value15 !== "auto" &&
            !callback3(
              value15,
              "width",
              context.parentGrid !== true && context.parentDir === "h",
            )
          ) {
            let value17 = callback2(value15, "width");
            if (value17 !== undefined) {
              state.minW = value17;
              state.maxW = value17;
            }
          }
          if (
            value16 !== undefined &&
            value16 !== "auto" &&
            !callback3(
              value16,
              "height",
              context.parentGrid !== true && context.parentDir === "v",
            )
          ) {
            let value17 = callback2(value16, "height");
            if (value17 !== undefined) {
              state.minH = value17;
              state.maxH = value17;
            }
          }
        }
        if (
          options === "table" &&
          (state.minH !== undefined ||
            state.maxH !== undefined ||
            state.aspect !== undefined)
        ) {
          delete state.minH;
          delete state.maxH;
          delete state.aspect;
          this.warnAt(
            value,
            diagnosticHtmlTagLabel(value) +
              "height is ignored — a table is as tall as its rows",
          );
        }
        for (let value15 of Object.keys(state) as Array<keyof NodePlacement>)
          if (state[value15] === undefined) {
            delete state[value15];
          }
        return state;
      }
      leftovers(
        input: ParsedInlineStyle,
        options: Set<string>,
        context: HtmlElementNode,
        value: string,
      ): void {
        let flag = false;
        for (let value2 of Object.keys(input) as Array<keyof ParsedInlineStyle>) {
          if (options.has(value2) || input[value2] === undefined) {
            continue;
          }
          if (value2 === "position") {
            continue;
          }
          if (
            value2 === "top" ||
            value2 === "right" ||
            value2 === "bottom" ||
            value2 === "left"
          ) {
            if (!flag) {
              this.rejectAt(
                context,
                "left/top/right/bottom apply to position:absolute elements only (position:relative makes a div a pin host; it does not offset) — on " +
                  value,
              );
            }
            flag = true;
          } else if (
            value2 === "background-image-src" ||
            value2 === "background-size" ||
            value2 === "background-position" ||
            value2 === "background-repeat"
          ) {
            this.rejectAt(
              context,
              diagnosticCssPropertyName(value2) +
                " does not apply to " +
                value +
                " — a box's picture is an <img> with object-fit; url() fills text only, with background-clip: text",
            );
          } else {
            this.rejectAt(
              context,
              diagnosticCssPropertyName(value2) +
                " does not apply to " +
                value +
                (value2 === "display"
                  ? " (only a section or div lays children out)"
                  : ""),
            );
          }
        }
      }
      inline(
        input: HtmlElementNode,
        options?: HtmlElementNode,
        context: boolean = false,
      ): InlineBlock {
        let items: InlineRun[] = [],
          items2: InlineRun[] = [],
          items3: Array<() => void> = [],
          callback = (input2: HtmlElementNode): boolean =>
            input2.tag === "mark" ||
            inlineStyleHasUnsafeBackground(input2.attrs.style),
          value: Set<HtmlElementNode> | undefined,
          callback2 = (input2: HtmlElementNode): boolean => {
            if (value === undefined) {
              htmlCompilerCounters.fillWalks++;
              value = new Set();
              let items4: HtmlElementNode[] = [],
                entries = new Map<HtmlElementNode, HtmlElementNode>(),
                items5: HtmlElementNode[] = [input];
              for (
                let value2 = items5.pop();
                value2 !== undefined;
                value2 = items5.pop()
              ) {
                items4.push(value2);
                for (let value3 of value2.children)
                  if (value3.kind === "el") {
                    entries.set(value3, value2);
                    items5.push(value3);
                  }
              }
              for (let value2 of items4.reverse())
                if (
                  value2 !== input &&
                  (value.has(value2) || callback(value2))
                ) {
                  value.add(value2);
                  value.add(entries.get(value2)!);
                }
            }
            return value.has(input2);
          },
          callback3 = (
            source: HtmlTreeNode,
            options2: InlineFormat,
            context2: InlineFormat,
            value2?: boolean,
          ): void => {
            if (source.kind === "text") {
              items.push({
                ...options2,
                text: source.text,
              });
              items2.push({
                ...context2,
                text: source.text,
              });
              return;
            }
            let tag = source.tag;
            if (tag === "br") {
              items.push({
                text: `
`,
              });
              items2.push({
                text: `
`,
              });
              return;
            }
            let state: InlineFormat = {};
            if (tag === "b" || tag === "strong") {
              state.bold = true;
            } else if (tag === "i" || tag === "em") {
              state.italic = true;
            } else if (tag === "u") {
              state.underline = true;
            } else if (tag === "a") {
              let value5 = source.attrs.href ?? "";
              if ((0, runtime.isSafeHyperlink)(value5)) {
                state.href = value5.replace(
                  /^https?:\/\//i,
                  (input2) => input2.toLowerCase(),
                );
              } else {
                this.warnAt(
                  source,
                  '<a href="' +
                    (0, runtime.compactDiagnosticValue)(value5) +
                    '"> — only http(s) links are kept (text stays)',
                );
              }
              if (source.attrs.style !== undefined) {
                this.inlineStyle(source, state);
              }
            } else if (tag === "span") {
              if (source.attrs.style !== undefined) {
                this.inlineStyle(source, state);
              }
            } else if (flattenableInlineElementNames.has(tag)) {
              this.warnAt(
                source,
                "<" +
                  tag +
                  "> is not in this format — its text is kept unstyled",
              );
            } else if (
              supportedSlideHtmlElementNames.has(tag) ||
              tag === "li"
            ) {
              this.errorAt(
                source,
                "<" +
                  tag +
                  "> cannot sit inside a text block (<" +
                  input.tag +
                  "> at " +
                  String(input.line) +
                  ":" +
                  String(input.col) +
                  ") — close the block first",
              );
            } else {
              this.errorAt(source, "<" + tag + "> is not a tag in this format");
            }
            let state2: InlineFormat = {
                ...options2,
                ...state,
              },
              state3: InlineFormat = {
                ...context2,
                ...state,
              },
              value3 =
                inlineFormatElementNames.has(tag) &&
                source.attrs.style !== undefined,
              value4 = value2 || callback(source);
            if (value3 && !value4 && !callback2(source)) {
              this.inlineStyle(source, state2, items3);
            }
            for (let value5 of source.children)
              callback3(value5, state2, state3, value4);
          };
        for (let value2 of input.children)
          callback3(value2, {}, {}, context);
        return {
          ...parseInlineTextTree(items),
          plain: parseInlineTextTree(items2).marks,
          say: () =>
            items3.forEach((input2) => input2()),
        };
      }
      cappedMarks(input: InlineBlock[]): TextMark[][] {
        let callback = (input2: "marks" | "plain"): number =>
          input.reduce(
            (input3: number, options: InlineBlock): number =>
              input3 + options[input2].length,
            0,
          );
        if (
          callback("marks") > runtime.maxTextMarks &&
          callback("plain") <= runtime.maxTextMarks
        ) {
          return input.map((input2) => input2.plain);
        }
        for (let value of input) value.say();
        return input.map((input2) => input2.marks);
      }
      inlineStyle(
        input: HtmlElementNode,
        options: InlineFormat,
        context?: Array<() => void>,
      ): void {
        let callback = (input2: () => void): void =>
            context !== undefined ? void context.push(input2) : input2(),
          value = this.warner(input, "<" + input.tag + "> "),
          value2 = this.rejecter(input, "<" + input.tag + "> "),
          callback2 = (input2: string): void =>
            callback(() => this.rejectAt(input, input2)),
          value3 = parseInlineStyle(
            input.attrs.style,
            (input2) =>
              callback(() => value(input2)),
            (input2) =>
              callback(() => value2(input2)),
          );
        for (let value4 of Object.keys(value3))
          if (value4 === "color") {
            options.color = value3.color;
          } else if (value4 === "text-fill-current") {
            continue;
          } else if (
            value4 === "font-weight" &&
            (value3["font-weight"] ?? 0) >= 600
          ) {
            options.bold = true;
          } else if (
            value4 === "font-style" &&
            value3["font-style"] === "italic"
          ) {
            options.italic = true;
          } else if (
            (value4 === "font-weight" && /^(b|strong)$/.test(input.tag)) ||
            (value4 === "font-style" && /^(i|em)$/.test(input.tag))
          ) {
            callback2(
              "inline <" +
                input.tag +
                "> " +
                value4 +
                ": a style cannot undo what the tag adds — leave the declaration out, or remove the <" +
                input.tag +
                "> itself",
            );
          } else if (value4 === "font-weight" || value4 === "font-style") {
            callback2(
              "inline <" +
                input.tag +
                "> " +
                value4 +
                ": only bold (≥600) / italic can be ADDED to a phrase — a lighter or upright phrase is a separate <p>",
            );
          } else if (value4.startsWith("text-decoration")) {
            let value5 =
              value3["text-decoration-style"] === undefined &&
              value3["text-decoration-color"] === undefined;
            if (value3["text-decoration-line"] === "underline" && value5) {
              if (input.tag !== "a") {
                options.underline = true;
              }
            } else if (
              input.tag === "u" &&
              value3["text-decoration-line"] === "none" &&
              value5
            ) {
              if (value4 === "text-decoration-line") {
                callback2(
                  "inline <u> text-decoration:none cannot remove the underline the tag adds — leave the declaration out, or remove the <u> itself",
                );
              }
            } else if (
              value4 === "text-decoration-line" ||
              value3["text-decoration-line"] === undefined
            ) {
              callback2(
                "inline <" +
                  input.tag +
                  "> text-decoration: a plain underline only (<u>) — a strikethrough or a styled/coloured line goes on the block",
              );
            }
          } else {
            callback2(
              "inline <" +
                input.tag +
                "> takes color, font-weight, font-style and a plain underline only (" +
                diagnosticCssPropertyName(value4) +
                " belongs on the block; a different size or face is a separate <p>)",
            );
          }
      }
      tableHeightHeal(
        input: Axis,
        options: number | undefined,
        context: HtmlElementNode,
      ): Axis {
        let value = input;
        if (value.anchor !== "fill" && value.size === undefined) {
          return input;
        }
        let value2 = (0, runtime.normalizeTableYAxis)(value, options),
          bottom = parseInlineStyle(
            context.attrs.style,
            () => {
              return;
            },
            () => {
              return;
            },
          ).bottom,
          value3 = bottom !== undefined && bottom !== "auto",
          value4 =
            value.anchor === "fill" && value3 ? "bottom" : "height";
        this.styleWarner(context)(
          value4 +
            " is ignored — a table is as tall as its rows" +
            (value2.anchor === "leading"
              ? " (pinned at top:" + String(value2.margin) + "px)"
              : ""),
        );
        return value2;
      }
      styleWarner(input: HtmlElementNode): HtmlDiagnosticReporter {
        return this.warner(input, "<" + input.tag + "> ");
      }
      styleRejecter(input: HtmlElementNode): HtmlDiagnosticReporter {
        return this.rejecter(input, "<" + input.tag + "> ");
      }
      nodeEl = new WeakMap<SlideNode, HtmlElementNode>();
      node(input: HtmlElementNode, options: HtmlNodeContext): SlideNode | undefined {
        let value = this.nodeInner(input, options);
        this.connectorFrom = undefined;
        if (value !== undefined) {
          this.nodeEl.set(value, input);
        }
        return value;
      }
      nodeInner(input: HtmlElementNode, options: HtmlNodeContext): SlideNode | undefined {
        let tag = input.tag,
          value = this.styleWarner(input),
          value2 =
            this.parseOverride ??
            parseInlineStyle(
              input.attrs.style,
              value,
              this.styleRejecter(input),
              undefined,
              this.listEm(input, options),
            );
        this.parseOverride = undefined;
        if (this.frameFill !== undefined) {
          options = {
            ...options,
            fill: this.frameFill,
          };
          this.frameFill = undefined;
        }
        let values = new Set<string>();
        this.attrs(input, options);
        if (
          value2["background-clip"] === "text" &&
          value2.color !== undefined &&
          /^#[0-9a-f]{6}00$/.test(value2.color)
        ) {
          delete value2.color;
          value2["text-fill-transparent"] = true;
        }
        if (value2.display === "none") {
          value(
            "display:none — the element is removed (delete it, or use hidden on a section)",
          );
          return;
        }
        if (!this.countNode(input)) {
          return;
        }
        if (
          tag === "h1" ||
          tag === "h2" ||
          tag === "h3" ||
          tag === "p" ||
          tag === "span"
        ) {
          if (tag === "span") {
            values.add("display");
          }
          let { eff: value4 } = this.typography(
              value2,
              options.inh,
              tag,
              input,
            ),
            value5 = this.inline(input, input),
            { text: value6 } = value5,
            value7 = this.cappedMarks([value5])[0]!;
          this.textCaps(input, value6, value7);
          let state: TextNode = {
            kind: "text",
            role: htmlTagTextRoles[tag]!,
            text: value6,
          };
          if (value7.length > 0) {
            state.marks = value7;
          }
          if (value4.color !== undefined) {
            state.color = value4.color;
          }
          if (value4.noWrap === true) {
            state.wrap = "nowrap";
          }
          let value8 = (0, runtime.normalizeShapeVariant)(
            input.attrs["data-fit"],
          );
          if (value8 !== undefined) {
            state.fit = value8;
          }
          if (value4.textAlign !== undefined && value4.textAlign !== "left") {
            state.align =
              value4.textAlign === "center"
                ? "center"
                : value4.textAlign === "justify"
                  ? "justify"
                  : "end";
          }
          let value9 = this.textFill(value2, input, values);
          if (value9 !== undefined) {
            state.fill = value9;
          }
          let value10 = this.textBag(value2, value4, input, values);
          if (Object.keys(value10).length > 0) {
            state.style = value10;
          }
          let value11 = this.place(
            value2,
            "text",
            options,
            input,
            values,
          );
          if (Object.keys(value11).length > 0) {
            state.place = value11;
          }
          this.leftovers(value2, values, input, "<" + tag + ">");
          return state;
        }
        if (tag === "ul" || tag === "ol") {
          let { eff: value4 } = this.typography(
              value2,
              options.inh,
              "p",
              input,
            ),
            items: string[] = [],
            items2: TextMark[] = [],
            index = 0,
            items3: InlineBlock[] = [],
            callback = (
              input2: HtmlElementNode,
              options2: boolean,
            ): void => {
              let value9 = this.inline(input2, input2, options2);
              if (
                value9.text.includes(`
`)
              ) {
                this.warnAt(
                  input2,
                  "<br> inside <li> — a list item is one line here; use another <li>",
                );
              }
              items3.push(value9);
            },
            callback2 = (
              input2: HtmlElementNode,
              options2: number,
              context: boolean,
            ): void => {
              for (let value9 of input2.children) {
                if (value9.kind === "text") {
                  if (value9.text.trim() !== "") {
                    this.errorAt(
                      value9,
                      "text directly inside <" +
                        input2.tag +
                        "> — wrap it in <li>",
                    );
                  }
                  continue;
                }
                if (value9.tag === "li") {
                  let value10 = value9.children.filter(
                      (source: HtmlTreeNode): source is HtmlElementNode =>
                        source.kind === "el" &&
                        (source.tag === "ul" || source.tag === "ol"),
                    ),
                    value11 =
                      context ||
                      inlineStyleHasUnsafeBackground(value9.attrs.style);
                  if (value10.length > 0) {
                    this.warnAt(
                      value9,
                      "nested lists are flattened (one level here)",
                    );
                    let state2: HtmlElementNode = {
                      ...value9,
                      children: value9.children.filter(
                        (source: HtmlTreeNode): boolean =>
                          !(
                            source.kind === "el" &&
                            (source.tag === "ul" || source.tag === "ol")
                          ),
                      ),
                    };
                    callback(state2, value11);
                    for (let value12 of value10)
                      callback2(
                        value12,
                        options2 + 1,
                        value11 ||
                          inlineStyleHasUnsafeBackground(value12.attrs.style),
                      );
                  } else {
                    callback(value9, value11);
                  }
                  if (value9.attrs.style !== undefined) {
                    this.rejectAt(
                      value9,
                      "style on <li> is not in this format — style the <" +
                        input2.tag +
                        ">",
                    );
                  }
                  continue;
                }
                this.errorAt(
                  value9,
                  "<" +
                    value9.tag +
                    "> inside <" +
                    input2.tag +
                    "> — only <li> items",
                );
              }
            };
          callback2(input, 0, false);
          this.cappedMarks(items3).forEach(
            (input2: TextMark[], options2: number): void => {
              let value9 = items3[options2]!.text.replace(/\n/g, " ");
              for (let value10 of input2)
                items2.push({
                  ...value10,
                  start: value10.start + index,
                  end: value10.end + index,
                });
              items.push(value9);
              index += value9.length + 1;
            },
          );
          this.textCaps(
            input,
            items.join(`
`),
            items2,
          );
          let state: TextNode = {
            kind: "text",
            role: "body",
            text: items.join(`
`),
            list: tag === "ul" ? "bullet" : "number",
          };
          if (items2.length > 0) {
            state.marks = items2;
          }
          if (value4.color !== undefined) {
            state.color = value4.color;
          }
          if (value4.noWrap === true) {
            state.wrap = "nowrap";
          }
          let value5 = (0, runtime.normalizeShapeVariant)(
            input.attrs["data-fit"],
          );
          if (value5 !== undefined) {
            state.fit = value5;
          }
          if (value4.textAlign !== undefined && value4.textAlign !== "left") {
            state.align =
              value4.textAlign === "center"
                ? "center"
                : value4.textAlign === "justify"
                  ? "justify"
                  : "end";
          }
          let value6 = this.textFill(value2, input, values);
          if (value6 !== undefined) {
            state.fill = value6;
          }
          let value7 = this.textBag(value2, value4, input, values);
          if (Object.keys(value7).length > 0) {
            state.style = value7;
          }
          let value8 = this.place(
            value2,
            "text",
            options,
            input,
            values,
          );
          if (Object.keys(value8).length > 0) {
            state.place = value8;
          }
          this.leftovers(value2, values, input, "<" + tag + ">");
          return state;
        }
        if (tag === "img" || tag === "video") {
          return this.image(input, value2, options, values);
        }
        if (tag === "x-shape" || tag === "hr") {
          return this.shape(input, value2, options, values);
        }
        if (tag === "x-connector") {
          return this.connector(input, value2, options, values);
        }
        if (tag === "x-icon") {
          return this.icon(input, value2, options, values);
        }
        if (tag === "table") {
          return this.table(input, value2, options, values);
        }
        if (tag === "svg") {
          return this.svg(input, value2, options, values);
        }
        if (tag === "x-embed") {
          return this.embed(input, value2, options, values);
        }
        if (tag === "div") {
          return this.container(input, value2, options, values);
        }
        if (tag === "aside") {
          this.errorAt(
            input,
            "<aside> (speaker notes) must be a direct child of <section>",
          );
          return;
        }
        let value3 = (
          {
            h4: '<p style="font-size:36px; font-weight:600">',
            h5: '<p style="font-size:32px; font-weight:600">',
            h6: '<p style="font-size:28px; font-weight:600">',
            blockquote:
              '<div style="border-left…"> is not available — use <div style="padding; background"> with a <p>',
            figure: "<div>",
            header: "<div>",
            footer: "<div>",
            nav: "<div>",
            main: "<div>",
            article: "<div>",
            pre: '<p style="font-family: monospace">',
            code: '<p style="font-family: monospace">',
            iframe:
              '<x-embed style="position:absolute; …; width; height">…html…</x-embed>',
            canvas: "an <x-embed>",
            button:
              '<div style="background; padding; border-radius"><p>label</p></div>',
            input: "nothing (no forms here)",
            form: "nothing (no forms here)",
            script: "nothing — scripts never run here",
            style:
              'inline style="" attributes (the only <style> allowed is @font-face in <head>)',
          } as Record<string, string>
        )[tag];
        this.errorAt(
          input,
          "<" +
            tag +
            "> is not a tag in this format" +
            (value3 !== undefined ? " — use " + value3 : "") +
            "; allowed: section, h1-h3, p, ul/ol/li, div, img, svg, x-embed, table/tr/th/td, x-shape, x-connector, x-icon, hr, aside, b/i/u/a/span/br",
        );
        return;
      }
      attrs(input: HtmlElementNode, options: HtmlNodeContext): void {
        for (let value of Object.keys(input.attrs)) {
          if (value === "style") {
            continue;
          }
          if (
            value === "id" ||
            value === "data-build-in" ||
            value === "data-build-out"
          ) {
            if (options.inContainer) {
              this.warnAt(
                input,
                value +
                  " applies to a section's position:absolute children only (builds and magic move key on positioned elements) — dropped on this flow child",
              );
            }
            continue;
          }
          if (value === "data-fit") {
            if (!blockTextElementNames.has(input.tag)) {
              this.warnAt(
                input,
                "data-fit applies to text (h1–h3, p, ul, ol) and <table> only — dropped",
              );
            } else if (
              (0, runtime.normalizeShapeVariant)(input.attrs[value]) ===
              undefined
            ) {
              this.warnAt(
                input,
                'data-fit="' +
                  (0, runtime.compactDiagnosticValue)(
                    input.attrs[value] ?? "",
                  ) +
                  '" — one of shrink | none | grow; using the default (' +
                  runtime.defaultTextFit +
                  ")",
              );
            }
            continue;
          }
          if (
            input.tag === "img" &&
            (value === "src" ||
              value === "alt" ||
              value === "width" ||
              value === "height" ||
              value === "loading" ||
              value === "decoding" ||
              value === "data-crop" ||
              imageVideoAttributeNames.has(value))
          ) {
            continue;
          }
          if (input.tag === "video" && videoAttributeNames.has(value)) {
            continue;
          }
          if (input.tag === "x-shape" && value === "kind") {
            continue;
          }
          if (
            input.tag === "x-connector" &&
            connectorAttributeNames.has(value)
          ) {
            continue;
          }
          if (input.tag === "x-icon" && value === "name") {
            continue;
          }
          if (input.tag === "svg") {
            continue;
          }
          if (input.tag === "div" && value === "data-group") {
            continue;
          }
          if (value.startsWith("on")) {
            this.warnAt(input, value + " is dropped (scripts never run here)");
            continue;
          }
          if (
            value === "class" ||
            value === "title" ||
            value === "role" ||
            value.startsWith("aria-") ||
            value === "lang" ||
            value === "dir" ||
            value.startsWith("data-") ||
            value === "tabindex" ||
            value === "draggable" ||
            value === "contenteditable"
          ) {
            this.warnAt(
              input,
              value +
                " attribute is not in this format — dropped" +
                (value === "class" ? ' (inline style="" only)' : ""),
            );
            continue;
          }
          this.warnAt(
            input,
            value + " attribute is not in this format — dropped",
          );
        }
      }
      imageRef(
        input: string,
        options: HtmlSourcePosition,
        context: (text: string) => string,
      ): string | undefined {
        let value = this.collectFiles || this.fileMap !== undefined;
        if (
          (0, runtime.isAllowedImageSource)(input) &&
          !(value && runtime.designSystemImagePathPattern.test(input))
        ) {
          return input;
        }
        if (/^data:/i.test(input)) {
          this.errorAt(
            options,
            context("data:…") +
              " — only png/jpeg/gif/webp/avif/svg data URIs ≤70 KB (SVG: write # as %23)",
          );
        } else if (
          /^[a-z][a-z0-9+.-]*:/i.test(input) ||
          input.startsWith("//")
        ) {
          this.errorAt(
            options,
            context((0, runtime.compactDiagnosticValue)(input)) +
              ' — URLs are not fetched: save the image beside the deck and reference the file (src="photo.jpg")',
          );
        } else if (
          input.startsWith("/") ||
          (!this.collectFiles && input.split(/[\\/]/).includes(".."))
        ) {
          this.errorAt(
            options,
            context((0, runtime.compactDiagnosticValue)(input)) +
              " — a relative path under the deck's folder (the build may reach --assets-from roots), no absolute paths",
          );
        } else {
          let value2 = this.fileRef(input, "image", options);
          if (value2 !== undefined) {
            return value2;
          }
          if (this.collectFiles) {
            return input;
          }
          this.errorAt(
            options,
            context((0, runtime.compactDiagnosticValue)(input)) +
              " is a file reference with no data — build the deck with scripts/make.ts (it uploads or inlines the file)",
          );
        }
        return;
      }
      textFill(
        input: ParsedInlineStyle,
        options: HtmlElementNode,
        context: Set<string>,
      ): TextFill | undefined {
        for (let value5 of [
          "background-clip",
          "text-fill-transparent",
          "text-fill-current",
        ] as const)
          context.add(value5);
        let value = this.styleWarner(options),
          value2 = this.styleRejecter(options),
          value3 = input["background-image-src"];
        if (input["text-fill-current"]) {
          value2(
            "-webkit-text-fill-color: currentcolor belongs on a coloured <span> INSIDE gradient/image text — dropped here",
          );
        }
        if (input["background-clip"] !== "text") {
          if (input["text-fill-transparent"]) {
            value2(
              "-webkit-text-fill-color without background-clip: text — dropped",
            );
          }
          return;
        }
        for (let value5 of [
          "background-image-src",
          "background-size",
          "background-position",
          "background-repeat",
        ] as const)
          context.add(value5);
        if (!input["text-fill-transparent"]) {
          value(
            "background-clip: text needs -webkit-text-fill-color: transparent (or color: transparent) to show the fill — the text paints solid without it; clip ignored",
          );
          delete input["background-gradient"];
          return;
        }
        let value4 = input["background-gradient"];
        delete input["background-gradient"];
        if (input["background-color"] !== undefined) {
          value2(
            'background-color beside background-clip: text is dropped — the glyphs take the whole background; for a box behind them wrap the text in a <div style="background">',
          );
          delete input["background-color"];
        }
        if (input["text-shadow"] !== undefined) {
          value(
            "text-shadow is not drawn on gradient/image text (it would paint over the fill) — kept for when the text is a plain colour",
          );
        }
        if (value3 !== undefined) {
          let value5 = this.imageRef(
            value3,
            options,
            (input2: string): string =>
              "<" + options.tag + "> background: url(" + input2 + ")",
          );
          if (value5 === undefined) {
            return;
          }
          if (
            (0, runtime.isAllowedImageSource)(value5) &&
            !(0, runtime.isRenderableImageSource)(value5)
          ) {
            value2(
              "background: url(data:…) — a text fill's data URI must be ;base64 (no text-form SVG here)",
            );
            return;
          }
          return {
            kind: "image",
            src: value5,
            ...(input["background-size"] === "contain"
              ? {
                  size: "contain",
                }
              : {}),
          };
        }
        for (let value5 of [
          "background-size",
          "background-position",
          "background-repeat",
        ] as const)
          if (input[value5] !== undefined) {
            value2(
              diagnosticCssPropertyName(value5) +
                " applies to a url() text fill only — dropped",
            );
          }
        if (value4 !== undefined) {
          return {
            kind: "gradient",
            gradient: value4,
          };
        }
        value(
          "background-clip: text without a gradient or url() background — ignored",
        );
        return;
      }
      image(
        input: HtmlElementNode,
        options: ParsedInlineStyle,
        context: HtmlNodeContext,
        value: Set<string>,
      ): ImageNode {
        let value2 = input.tag === "video",
          value3: string | undefined = value2
            ? (input.attrs["aria-label"] ??
              input.attrs.title ??
              input.attrs.alt)
            : input.attrs.alt,
          state = {
            kind: "img",
            alt: (value3 ?? "").replace(/\s+/g, " ").trim().slice(0, 500),
          } as ImageNode;
        if (value3 === undefined) {
          this.warnAt(
            input,
            input.wrote === "iframe"
              ? '<iframe> without title — add a short description (title="")'
              : value2
                ? '<video> without aria-label — add a short description (aria-label="")'
                : '<img> without alt — add a short description (alt="")',
          );
        }
        if (
          value2 &&
          input.children.some(
            (source: HtmlTreeNode): boolean => source.kind === "el",
          )
        ) {
          this.warnAt(
            input,
            "<video> holds no elements here (<source>, <track>) — what is inside it is dropped; name the clip in src",
          );
        }
        let value4: VideoLink | undefined,
          value5 = value2 ? "src" : "data-video",
          value6 = (input.attrs[value5] ?? "").trim();
        if (value6 !== "") {
          let value21 = value2
            ? (0, runtime.parseVideoLinkUrl)(value6)
            : null;
          if ((0, runtime.isModelBlobReference)(value6)) {
            state.video = value6;
          } else if (value21 !== null) {
            value4 = value21;
          } else {
            this.rejectAt(
              input,
              "<" +
                input.tag +
                " " +
                value5 +
                '="' +
                (0, runtime.compactDiagnosticValue)(value6) +
                '"> — a clip is an uploaded .mp4 or .webm (URLs and files beside the deck are not fetched); dropped, the picture stays. Upload it with upload_asset and use the /_blob/<id> it returns',
            );
          }
        } else if (value2) {
          this.warnAt(
            input,
            "<video> without src — give it the uploaded clip's /_blob/<id> reference",
          );
        }
        for (let value21 of value2 ? [] : runtime.videoProviders) {
          let value22 = input.attrs["data-video-" + value21];
          if (value22 === undefined) {
            continue;
          }
          let value23 = (0, runtime.normalizeVideoLink)({
            provider: value21,
            id: value22.trim(),
          });
          if (state.video !== undefined || value4 !== undefined) {
            this.warnAt(
              input,
              "data-video-" +
                value21 +
                " beside another video — dropped (a picture names one video)",
            );
          } else if (value23 !== undefined) {
            value4 = value23;
          } else {
            this.rejectAt(
              input,
              "<img data-video-" +
                value21 +
                '="' +
                (0, runtime.compactDiagnosticValue)(value22) +
                `"> — write only the video's id (the 11 characters after v= or youtu.be/), not the address; dropped, the picture stays`,
            );
          }
        }
        let value7 = input.attrs["data-video-at"];
        if (value7 !== undefined) {
          let value21 = (0, runtime.normalizeVideoStartSeconds)(
            value7,
          );
          if (value4 === undefined) {
            this.warnAt(
              input,
              "data-video-at applies only with a linked video (data-video-" +
                runtime.videoProviders[0] +
                ") — dropped",
            );
          } else if (value21 !== undefined) {
            value4 = {
              ...value4,
              start: value21,
            };
          } else if (Number(value7) !== 0) {
            this.warnAt(
              input,
              'data-video-at="' +
                (0, runtime.compactDiagnosticValue)(value7) +
                '" — whole seconds into the video; starting at the beginning',
            );
          }
        }
        if (value4 !== undefined) {
          state.videoLink = value4;
        }
        let value8 = input.attrs["data-video-start"],
          value9 = input.attrs["data-video-delay"],
          value10 = input.attrs["data-video-sound"];
        if (state.video !== undefined) {
          if (value10 !== undefined) {
            if (value10.trim() === "on") {
              state.videoSound = "on";
            } else if (value10.trim() !== "off") {
              this.warnAt(
                input,
                'data-video-sound="' +
                  (0, runtime.compactDiagnosticValue)(value10) +
                  '" — one of on | off; using off (muted)',
              );
            }
          }
          if (value8 !== undefined) {
            if (value8.trim() === "click") {
              state.videoStart = "click";
            } else if (value8.trim() !== "auto") {
              this.warnAt(
                input,
                'data-video-start="' +
                  (0, runtime.compactDiagnosticValue)(value8) +
                  '" — one of auto | click; using auto',
              );
            }
          }
          if (value9 !== undefined) {
            let value21 = (0, runtime.normalizeVideoDelay)(value9);
            if (state.videoStart === "click") {
              this.warnAt(
                input,
                "data-video-delay applies to a clip that starts by itself — dropped (this one starts on a click)",
              );
            } else if (value21 !== undefined) {
              state.videoDelay = value21;
              if (Number(value9) > runtime.maxVideoDelaySeconds) {
                this.warnAt(
                  input,
                  'data-video-delay="' +
                    (0, runtime.compactDiagnosticValue)(value9) +
                    '" — ' +
                    String(runtime.maxVideoDelaySeconds) +
                    " seconds at most; using " +
                    String(runtime.maxVideoDelaySeconds),
                );
              }
            } else if (Number(value9) !== 0) {
              this.warnAt(
                input,
                'data-video-delay="' +
                  (0, runtime.compactDiagnosticValue)(value9) +
                  '" — seconds from 0 to ' +
                  String(runtime.maxVideoDelaySeconds) +
                  "; using none",
              );
            }
          }
        } else if (
          value8 !== undefined ||
          value9 !== undefined ||
          value10 !== undefined
        ) {
          this.warnAt(
            input,
            "data-video-start / data-video-delay / data-video-sound apply only with a clip (data-video, or <video src>) — dropped",
          );
        }
        let value11 = value2 ? "poster" : "src",
          value12 = (input.attrs[value11] ?? "").trim();
        if (value12 === "") {
          if (state.video === undefined && value4 === undefined && !value2) {
            this.warnAt(
              input,
              '<img> without src — an empty image frame; give it src="photo.jpg"',
            );
          }
        } else {
          let value21 = this.imageRef(
            value12,
            input,
            (input2) =>
              "<" + input.tag + " " + value11 + '="' + input2 + '">',
          );
          if (value21 !== undefined) {
            state.src = value21;
          }
        }
        value.add("object-fit");
        let value13 = options["object-fit"];
        if (value13 !== undefined) {
          state.fit = value13 === "contain" ? "contain" : "cover";
        } else {
          state.fit = "cover";
        }
        if (input.attrs["data-crop"] !== undefined) {
          let value21 = (0, runtime.parseImageCrop)(
              input.attrs["data-crop"],
            ),
            value22 =
              'data-crop="' +
              (0, runtime.compactDiagnosticValue)(input.attrs["data-crop"]) +
              '"';
          if (value21 === undefined) {
            this.warnAt(
              input,
              value22 +
                ' — write ZOOM X% Y% (zoom 1–50, then the object-position), e.g. data-crop="1.5 50% 30%"; dropped',
            );
          } else if (state.fit === "contain") {
            this.warnAt(
              input,
              value22 + " applies to object-fit:cover only — dropped",
            );
          } else if (
            typeof state.src === "string" &&
            state.src.startsWith("data:image/svg+xml")
          ) {
            this.warnAt(input, value22 + " does not apply to an svg — dropped");
          } else if (state.src === undefined) {
            this.warnAt(
              input,
              value22 +
                " on a <" +
                input.tag +
                "> with no still picture — dropped",
            );
          } else if (value21 !== null) {
            state.crop = value21;
          }
        }
        value.add("width");
        value.add("height");
        let value14 =
            options.width ??
            (input.attrs.width !== undefined
              ? {
                  px: Number(input.attrs.width),
                }
              : undefined),
          value15 =
            options.height ??
            (input.attrs.height !== undefined
              ? {
                  px: Number(input.attrs.height),
                }
              : undefined),
          value16: { pct: number; prop: "width" | "height" } | undefined,
          callback = (
            input2: "auto" | CssSizeValue | undefined,
            options2: "width" | "height",
          ): number | undefined => {
            if (input2 === undefined || input2 === "auto") {
              return;
            }
            if ("pct" in input2) {
              if (context.inContainer) {
                if (
                  context.parentGrid !== true &&
                  (options2 === "width") === (context.parentDir === "h")
                ) {
                  value16 = {
                    pct: input2.pct,
                    prop: options2,
                  };
                } else {
                  this.rejectAt(
                    input,
                    "<" +
                      input.tag +
                      "> " +
                      options2 +
                      ":" +
                      String(input2.pct) +
                      "% — an image inside a div keeps its own size (it never stretches); give it px",
                  );
                }
              }
              return;
            }
            if (Number.isFinite(input2.px) && input2.px > 0) {
              return input2.px;
            } else {
              return undefined;
            }
          },
          value17 = callback(value14, "width"),
          value18 = callback(value15, "height");
        if (value17 !== undefined) {
          state.w = value17;
        }
        if (value18 !== undefined) {
          state.h = value18;
        }
        if (
          context.inContainer &&
          value17 === undefined &&
          value18 === undefined &&
          options["flex-grow"] === undefined &&
          options["align-self"] === undefined &&
          options["aspect-ratio"] === undefined
        ) {
          this.warnAt(
            input,
            "<" +
              input.tag +
              "> inside a div without width/height (or flex:1 / aspect-ratio) — it renders at its natural size",
          );
        }
        let value19 = this.paintBag(options, "img", input, value);
        if (Object.keys(value19).length > 0) {
          state.style = value19;
        }
        let value20 = this.place(
          options,
          "img",
          context,
          input,
          value,
        );
        if (value16 !== undefined) {
          let { pct: value21, prop: value22 } = value16;
          if (value20.grow === 0) {
            this.warnAt(
              input,
              value22 +
                ":" +
                String(value21) +
                "% is dropped (flex-grow is 0, so there is no share to take) — the image keeps its own size; give it px",
            );
          } else {
            if (value20.grow === undefined) {
              value20.grow = value21;
            }
            if (value20.basis === undefined) {
              value20.basis = 0;
            }
            if (context.flowCount === 1 && value21 < 100) {
              this.warnAt(
                input,
                value22 +
                  ":" +
                  String(value21) +
                  "% is dropped and the image stretches to the FULL " +
                  value22 +
                  " of its parent (100%, not " +
                  String(value21) +
                  "% — a lone child's share is the whole axis); give it px",
              );
            } else {
              this.warnAt(
                input,
                value22 +
                  ": % of the parent is not supported inside a div — healed to a proportional share (flex-grow " +
                  String(value21) +
                  ")",
              );
            }
          }
        }
        if (Object.keys(value20).length > 0) {
          state.place = value20;
        }
        this.leftovers(options, value, input, "<" + input.tag + ">");
        return state;
      }
      noContent(input: HtmlElementNode): void {
        if (
          input.children.some(
            (source: HtmlTreeNode): boolean =>
              source.kind === "text" ? source.text.trim() !== "" : true,
          )
        ) {
          this.warnAt(
            input,
            "<" +
              input.tag +
              "> holds no content — what is inside it is dropped (put text in a <p> over it, inside a position:relative div)",
          );
        }
      }
      shape(
        input: HtmlElementNode,
        options: ParsedInlineStyle,
        context: HtmlNodeContext,
        value: Set<string>,
      ): ShapeNode | undefined {
        this.noContent(input);
        let value2 = input.tag === "hr",
          value3: string = value2
            ? "line"
            : (input.attrs.kind ?? "").trim().toLowerCase();
        if (value3 === "connector") {
          this.errorAt(
            input,
            '<x-shape kind="connector"> — a connector is its own tag: <x-connector x1 y1 x2 y2 head="end|both|none" route="straight|elbow|hv|vh">',
          );
          return;
        }
        if (!runtime.shapeVariants.includes(value3)) {
          this.errorAt(
            input,
            '<x-shape kind="' +
              (0, runtime.compactDiagnosticValue)(input.attrs.kind ?? "") +
              '"> — kind is one of ' +
              runtime.shapeVariants
                .filter((input2: string): boolean => input2 !== "connector")
                .join(", ") +
              " (a painted <div> is a rectangle; a line with an arrowhead is <x-connector>)",
          );
          return;
        }
        let state: ShapeNode = {
            kind: "shape",
            shape: (value3 === "rounded" ? "rect" : value3) as ShapeVariant,
          },
          value4 =
            value2 && context.inContainer
              ? unwrapTransparentContainer(input, options, context)
              : undefined,
          value5 = "<" + input.tag + "> ";
        value.add("width");
        value.add("height");
        let state2: ParsedInlineStyle = {
            ...options,
          },
          value6 = state2["background-gradient"];
        if (value6 !== undefined) {
          value.add("background-gradient");
          state2["background-color"] ??= value6.stops[0]!.color;
          delete state2["background-gradient"];
          this.rejectAt(
            input,
            "<x-shape> background is one flat COLOR (no gradient)",
          );
        }
        let value7: ParsedInlineBorder | undefined =
          state2.border !== undefined
            ? {
                ...state2.border,
              }
            : undefined;
        if (value7 !== undefined && value7.style !== "none") {
          value7.style ??= "solid";
          if (state.shape === "line" && value7.style !== "solid") {
            this.rejectAt(
              input,
              value5 +
                "is a solid line (" +
                value7.style +
                ") — dashes are for x-connector",
            );
            value7.style = "solid";
          }
          if (value7.widths !== undefined) {
            value7.width = Math.max(
              ...Object.values(value7.widths).map(
                (input2: number | undefined): number => input2 ?? 0,
              ),
            );
            delete value7.widths;
            this.rejectAt(
              input,
              value5 + "border is the stroke: one width all round",
            );
          }
          if (value7.sides !== undefined) {
            if (
              !(
                value2 &&
                value7.sides.length === 1 &&
                (value7.sides[0] === "top" || value7.sides[0] === "bottom")
              )
            ) {
              this.rejectAt(
                input,
                value5 +
                  "border is the stroke: all sides (no border-top/right/bottom/left)" +
                  (value2 ? " — or border-top alone for the line" : ""),
              );
            }
            delete value7.sides;
          }
          value7.color ??= context.inh.color ?? "#000000";
          state2.border = value7;
        }
        let value8 =
          state2.height !== undefined &&
          state2.height !== "auto" &&
          "px" in state2.height
            ? state2.height.px
            : undefined;
        if (value2) {
          value.add("color");
        }
        if (value2 && (value7 === undefined || value7.style === "none")) {
          let value13 = state2["background-color"];
          state2.border = {
            style: "solid",
            color: value13 ?? state2.color ?? context.inh.color ?? "#000000",
            width:
              value13 !== undefined && value8 !== undefined
                ? Math.min(runtime.maxShapeStrokeWidth, Math.max(1, value8))
                : 1,
          };
          delete state2["background-color"];
        }
        if (state.shape !== "rect" && state2["border-radius"] !== undefined) {
          value.add("border-radius");
          delete state2["border-radius"];
          this.rejectAt(
            input,
            "border-radius rounds a rectangle — not <" +
              input.tag +
              (value2 ? ">" : ' kind="' + value3 + '">'),
          );
        }
        let value9 = this.paintBag(state2, "shape", input, value);
        if (
          value3 === "rounded" &&
          value9.borderRadius === undefined &&
          value9.borderTopLeftRadius === undefined
        ) {
          value9.borderRadius = runtime.maxShapeCornerRadius;
        }
        if (
          value9.backgroundColor === undefined &&
          !(0, runtime.shapeHasOutline)(value9) &&
          (0, runtime.shapeZeroWidthOutlineColor)(value9) === undefined
        ) {
          value9.backgroundColor = context.inh.color ?? "#808080";
          this.warnAt(
            input,
            "<x-shape> without background or border — filled with the text color",
          );
        }
        let boxShadow = value9.boxShadow;
        if (boxShadow !== undefined && boxShadow.length === 1) {
          let value13 = boxShadow[0]!;
          for (let value14 of runtime.shadowPresetNames as readonly ShadowPresetName[]) {
            let value15 = neutralHtmlShadowPresets[value14];
            if (
              value13.inset !== true &&
              value13.x === 0 &&
              value13.y === value15.y &&
              value13.blur === value15.blur &&
              (value13.spread ?? 0) === 0 &&
              value13.color === value15.color
            ) {
              value9.boxShadow = [
                {
                  ...runtime.shadowPresets[value14],
                },
              ];
            }
          }
        }
        let transform = value9.transform;
        delete value9.transform;
        if (transform !== undefined) {
          let { rotate: value13, ...value14 } = transform;
          if (Object.keys(value14).length > 0) {
            this.rejectAt(
              input,
              "transform on <" +
                input.tag +
                "> is rotate(ANGLE) only — dropped (it has " +
                Object.keys(value14).join("/") +
                ")",
            );
          } else if (
            value13 !== undefined &&
            (0, runtime.normalizeRotation)(value13) !== undefined
          ) {
            state.rotate = (0, runtime.normalizeRotation)(value13);
          }
        }
        if (Object.keys(value9).length > 0) {
          state.style = value9;
        }
        let callback = (
            input2: "auto" | CssSizeValue | undefined,
            options2: "width" | "height",
          ): number | undefined => {
            if (input2 === undefined || input2 === "auto") {
              return;
            }
            if ("pct" in input2) {
              this.rejectAt(
                input,
                value5 +
                  options2 +
                  ":" +
                  String(input2.pct) +
                  "% — only px here",
              );
              return;
            }
            if (input2.px > 0) {
              return input2.px;
            } else {
              return undefined;
            }
          },
          value10 = callback(state2.width, "width"),
          value11 = callback(state2.height, "height");
        if (value10 !== undefined) {
          state.w = value10;
        }
        if (value11 !== undefined) {
          state.h = value11;
        }
        if (value2 && state.h === undefined) {
          state.h = state2.border?.width ?? 1;
        }
        if (
          !value2 &&
          !context.inContainer &&
          ((value10 === undefined && context.fill?.x !== true) ||
            (value11 === undefined && context.fill?.y !== true))
        ) {
          this.warnAt(
            input,
            "<x-shape> on the slide needs width and height (or left+right / top+bottom)",
          );
        }
        let value12 = this.place(
          state2,
          "shape",
          context,
          input,
          value,
        );
        if (value4 !== undefined) {
          migrateThinBorderToFill(state, value9, value12, context, value4);
        }
        if (Object.keys(value12).length > 0) {
          state.place = value12;
        }
        this.leftovers(state2, value, input, "<" + input.tag + ">");
        return state;
      }
      connectorFrom: ConnectorCorner | undefined;
      connectorFrame(
        input: HtmlElementNode,
        options: ParsedInlineStyle,
        context: number | undefined,
        value: number | undefined,
      ): boolean {
        let callback = (input2: "x1" | "y1" | "x2" | "y2"): number | undefined => {
            let value8 = (input.attrs[input2] ?? "")
              .trim()
              .replace(/px$/i, "");
            if (value8 === "") {
              return;
            }
            let value9 = /^(-?[\d.]+)%$/.exec(value8);
            if (value9 !== null) {
              let value11 = Number(value9[1]);
              if (!Number.isFinite(value11)) {
                return;
              }
              let value12 =
                input2 === "x1" || input2 === "x2" ? context : value;
              if (value12 === undefined) {
                this.rejectAt(
                  input,
                  "<x-connector> " +
                    input2 +
                    ": % inside a position:relative div whose size is not known — give the div width/height, or use px",
                );
                return value11;
              }
              return (value11 / 100) * value12;
            }
            let value10 = Number(value8);
            if (Number.isFinite(value10)) {
              return value10;
            } else {
              return undefined;
            }
          },
          value2 = callback("x1"),
          value3 = callback("y1"),
          value4 = callback("x2"),
          value5 = callback("y2");
        if (
          value2 === undefined ||
          value3 === undefined ||
          value4 === undefined ||
          value5 === undefined
        ) {
          this.errorAt(
            input,
            '<x-connector> needs x1 y1 x2 y2 (design px from the top-left of the slide or of its position:relative div), e.g. <x-connector x1="200" y1="540" x2="900" y2="540">',
          );
          return false;
        }
        for (let value8 of [
          "left",
          "top",
          "right",
          "bottom",
          "width",
          "height",
        ] as const) {
          if (options[value8] !== undefined) {
            this.rejectAt(
              input,
              value8 +
                " does not apply to <x-connector> — its x1 y1 x2 y2 place it",
            );
          }
          delete options[value8];
        }
        if (
          options.transform !== undefined &&
          Object.keys(options.transform.value).length > 0
        ) {
          this.rejectAt(
            input,
            "transform does not apply to <x-connector> — its x1 y1 x2 y2 place it",
          );
        }
        delete options.transform;
        let value6 = clampShapeOutlineWidth(options.border),
          value7 = (0, runtime.connectorBoundsFromEndpoints)(
            [value2, value3],
            [value4, value5],
            value6,
          );
        if (value7.left < 0 || value7.top < 0) {
          this.warnAt(
            input,
            "<x-connector> runs past the top/left edge of its box (including the " +
              String((0, runtime.connectorArrowInset)(value6)) +
              "px head margin) — moved in to the edge",
          );
        }
        options.left = {
          px: Math.max(0, value7.left),
        };
        options.top = {
          px: Math.max(0, value7.top),
        };
        options.width = {
          px: value7.w,
        };
        options.height = {
          px: value7.h,
        };
        options.position = "absolute";
        this.connectorFrom = value7.from;
        return true;
      }
      connector(
        input: HtmlElementNode,
        options: ParsedInlineStyle,
        context: HtmlNodeContext,
        value: Set<string>,
      ): ShapeNode {
        this.noContent(input);
        let state: ShapeNode = {
          kind: "shape",
          shape: "connector",
        };
        for (let value6 of [
          "border",
          "color",
          "width",
          "height",
          "transform",
        ] as const)
          value.add(value6);
        let value2 = this.connectorFrom !== undefined;
        if (!value2) {
          let flag = false,
            callback = (
              input2: "auto" | CssSizeValue | undefined,
              options2: "width" | "height",
            ): number | undefined => {
              if (input2 === undefined || input2 === "auto") {
                return;
              }
              if ("pct" in input2) {
                flag = true;
                this.rejectAt(
                  input,
                  "<x-connector> " +
                    options2 +
                    ":" +
                    String(input2.pct) +
                    "% — only px here",
                );
                return;
              }
              if (input2.px > 0) {
                return input2.px;
              } else {
                return undefined;
              }
            },
            value6 = callback(options.width, "width"),
            value7 = callback(options.height, "height");
          if (value6 !== undefined) {
            state.w = value6;
          }
          if (value7 !== undefined) {
            state.h = value7;
          }
          if (context.inContainer) {
            if (
              value6 === undefined &&
              value7 === undefined &&
              !flag &&
              (options["flex-grow"] ?? 0) === 0
            ) {
              this.warnAt(
                input,
                "flow <x-connector> without width/height (or flex:1) — drawn 240px wide",
              );
            }
          } else if (
            (value6 === undefined && context.fill?.x !== true) ||
            (value7 === undefined && context.fill?.y !== true)
          ) {
            this.warnAt(
              input,
              "pinned <x-connector> without x1 y1 x2 y2 needs width and height (or left+right / top+bottom)",
            );
          }
          let value8 = (input.attrs.from ?? "tl").trim().toLowerCase();
          if (runtime.connectorCornerValues.includes(value8)) {
            if (value8 !== "tl") {
              state.from = value8 as ConnectorCorner;
            }
          } else {
            this.warnAt(
              input,
              'from="' +
                (0, runtime.compactDiagnosticValue)(input.attrs.from ?? "") +
                '" — from is tl, tr, bl or br (the corner the line starts at; using tl)',
            );
          }
          if (
            options.transform !== undefined &&
            Object.keys(options.transform.value).length > 0
          ) {
            this.rejectAt(input, "transform does not apply to <x-connector>");
          }
        } else if (input.attrs.from !== undefined) {
          this.warnAt(
            input,
            "from is dropped when x1 y1 x2 y2 are given — the line runs from x1,y1 to x2,y2",
          );
        }
        let border = options.border;
        if (border !== undefined && border.style !== "none") {
          state.stroke =
            border.color ?? options.color ?? context.inh.color ?? "#000000";
          state.strokeWidth = clampShapeOutlineWidth(border);
          if (border.style === "dashed" || border.style === "dotted") {
            state.dashed = true;
          } else if (border.style !== undefined && border.style !== "solid") {
            this.rejectAt(
              input,
              "<x-connector> lines are solid | dashed | dotted (" +
                border.style +
                ")",
            );
          }
          if (border.sides !== undefined) {
            this.rejectAt(
              input,
              "<x-connector> border is the stroke: all sides (no border-top/right/bottom/left)",
            );
          }
        } else {
          state.stroke = options.color ?? context.inh.color ?? "#000000";
          state.strokeWidth = runtime.defaultShapeStrokeWidth;
        }
        let state2: ConnectorHeadFields = {},
          value3 = (input.attrs.head ?? "end").trim().toLowerCase();
        if (runtime.connectorHeadValues.includes(value3)) {
          state2.head = value3 as ConnectorHead;
        } else {
          this.warnAt(
            input,
            'head="' +
              (0, runtime.compactDiagnosticValue)(input.attrs.head ?? "") +
              '" — head is end, both or none (using end)',
          );
        }
        for (let [value6, value7] of [
          ["head-start", "headStart"],
          ["head-end", "headEnd"],
        ] as const) {
          let value8 = input.attrs[value6]?.trim().toLowerCase();
          if (value8 === undefined) {
            continue;
          }
          if (runtime.arrowHeadKindValues.includes(value8)) {
            state2[value7] = value8 as ArrowHeadKind;
          } else {
            this.warnAt(
              input,
              value6 +
                '="' +
                (0, runtime.compactDiagnosticValue)(input.attrs[value6] ?? "") +
                '" — ' +
                value6 +
                " is none, open or filled (using what head gives this end)",
            );
          }
        }
        Object.assign(
          state,
          (0, runtime.setConnectorArrowHeads)(
            {},
            (0, runtime.connectorArrowHeads)(state2),
          ),
        );
        let value4 = (input.attrs.route ?? "straight")
          .trim()
          .toLowerCase();
        if (runtime.connectorRoutingValues.includes(value4)) {
          if (value4 !== "straight") {
            state.route = value4 as ConnectorRouting;
          }
        } else {
          this.warnAt(
            input,
            'route="' +
              (0, runtime.compactDiagnosticValue)(input.attrs.route ?? "") +
              '" — route is straight, elbow, hv or vh (using straight)',
          );
        }
        if (value2 && this.connectorFrom !== "tl") {
          state.from = this.connectorFrom;
        }
        this.connectorFrom = undefined;
        for (let value6 of [
          "background-color",
          "background-gradient",
          "box-shadow",
          "border-radius",
          "opacity",
          "filter",
          "padding-top",
          "padding-right",
          "padding-bottom",
          "padding-left",
          "overflow",
        ] as const)
          if ((value.add(value6), options[value6] !== undefined)) {
            this.rejectAt(
              input,
              diagnosticCssPropertyName(value6) +
                " does not apply to <x-connector> (it carries color, border-width, border-style, head, route)",
            );
          }
        let value5 = this.place(
          options,
          "shape",
          context,
          input,
          value,
        );
        if (Object.keys(value5).length > 0) {
          state.place = value5;
        }
        this.leftovers(options, value, input, "<x-connector>");
        return state;
      }
      icon(
        input: HtmlElementNode,
        options: ParsedInlineStyle,
        context: HtmlNodeContext,
        value: Set<string>,
      ): SlideNode {
        this.noContent(input);
        let value2 = (input.attrs.name ?? "").trim(),
          value3 = slideHtmlIconNames.find(
            (input2: string): boolean =>
              input2.toLowerCase() ===
              value2.toLowerCase().replace(/[-_\s]/g, ""),
          );
        if (value3 === undefined) {
          let value9 =
            value2 === ""
              ? genericIconPlaceholderLabel
              : iconPlaceholderLabel(value2);
          this.rejectAt(
            input,
            (value2 === ""
              ? "<x-icon> has no name"
              : '<x-icon name="' +
                (0, runtime.compactDiagnosticValue)(value2) +
                '"> is not an icon in this format') +
              ", so it is shown as the text " +
              value9 +
              " — use one of: " +
              slideHtmlIconNames.join(", "),
          );
          let value10 = options.color ?? context.inh.color,
            state2: TextNode = {
              kind: "text",
              role: "body",
              text: value9,
              ...(value10 !== undefined
                ? {
                    color: value10,
                  }
                : {}),
            };
          for (let value13 of ["color", "width", "height"] as const)
            value.add(value13);
          let value11 = this.paintBag(options, "text", input, value);
          if (Object.keys(value11).length > 0) {
            state2.style = value11;
          }
          let value12 = this.place(
            options,
            "icon",
            context,
            input,
            value,
          );
          if (Object.keys(value12).length > 0) {
            state2.place = value12;
          }
          this.leftovers(options, value, input, "<x-icon>");
          return state2;
        }
        let state: IconNode = {
          kind: "icon",
          icon: value3,
        };
        value.add("color");
        value.add("width");
        value.add("height");
        let value4 = options.color ?? context.inh.color;
        if (value4 !== undefined) {
          state.color = value4;
        }
        let callback = (
            input2: "auto" | CssSizeValue | undefined,
            options2: "width" | "height",
          ): number | undefined => {
            if (input2 === undefined || input2 === "auto") {
              return;
            }
            if ("pct" in input2) {
              this.rejectAt(
                input,
                "<x-icon> " +
                  options2 +
                  ":" +
                  String(input2.pct) +
                  "% — only px here",
              );
              return;
            }
            if (input2.px > 0) {
              return input2.px;
            } else {
              return undefined;
            }
          },
          value5 = callback(options.width, "width"),
          value6 = callback(options.height, "height");
        if (value5 !== undefined) {
          state.w = value5;
        }
        if (value6 !== undefined) {
          state.h = value6;
        }
        if (value5 === undefined && value6 !== undefined) {
          state.w = value6;
        } else if (value6 === undefined && value5 !== undefined) {
          state.h = value5;
        }
        let value7 = this.paintBag(options, "icon", input, value);
        if (Object.keys(value7).length > 0) {
          state.style = value7;
        }
        let value8 = this.place(
          options,
          "icon",
          context,
          input,
          value,
        );
        if (Object.keys(value8).length > 0) {
          state.place = value8;
        }
        this.leftovers(options, value, input, "<x-icon>");
        this.queueIcon(
          input,
          diagnosticHtmlTagLabel(input),
          state,
          context.faded === true,
        );
        return state;
      }
      svg(
        dataset: HtmlElementNode,
        options: ParsedInlineStyle,
        context: HtmlNodeContext,
        value: Set<string>,
      ): ImageNode | undefined {
        if (dataset.source === undefined) {
          this.errorAt(
            dataset,
            '<svg> is empty — an inline graphic needs content (or use <img src="file.svg">)',
          );
          return;
        }
        if (dataset.source.length > runtime.maxInlineSvgBytes) {
          this.errorAt(
            dataset,
            "<svg> is " +
              String(Math.round(dataset.source.length / 1024)) +
              " KB — inline graphics stay under " +
              String(Math.round((runtime.maxInlineSvgBytes * 3) / 4 / 1024)) +
              " KB; simplify it or export a PNG",
          );
          return;
        }
        let value2 = stripHtmlMarkup(dataset.source),
          value3 = validateSvgMarkup(value2, true);
        if (value3 !== undefined) {
          this.errorAt(dataset, "<svg> " + value3);
          return;
        }
        let value4 = parseSvgDimensions(value2),
          value5 = value2,
          items: string[] = [];
        if (value4 !== undefined) {
          let callback3 = (input: "auto" | CssSizeValue | undefined): number | undefined =>
              input !== undefined &&
              input !== "auto" &&
              "px" in input &&
              input.px > 0
                ? input.px
                : undefined,
            state2: Record<string, string> = {
              xmlns: svgNamespace,
            };
          if (
            value4.attrs["xmlns:xlink"] !== undefined ||
            /\bxlink:/.test(value2)
          ) {
            state2["xmlns:xlink"] = xlinkNamespace;
          } else if (
            Object.keys(value4.attrs).some(
              (input: string): boolean => input.startsWith("xlink:"),
            )
          ) {
            state2["xmlns:xlink"] = xlinkNamespace;
          }
          if (
            (value4.attrs.xmlns ?? svgNamespace) !== svgNamespace ||
            (value4.attrs["xmlns:xlink"] ?? xlinkNamespace) !== xlinkNamespace
          ) {
            items.push("a namespace an HTML page ignores");
          }
          for (let [value18, value19] of Object.entries(
            value4.attrs,
          )) {
            let value20 = value18.toLowerCase();
            if (
              value20 === "style" ||
              value20 === "id" ||
              value20.startsWith("data-build-") ||
              value20 === "xmlns" ||
              value20 === "xmlns:xlink"
            ) {
              continue;
            }
            let value21 = value18.indexOf(":"),
              value22 = value18.startsWith("xmlns:");
            if (
              !/^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/.test(value18) ||
              (value22 && (value19 === "" || value18 === "xmlns:xmlns")) ||
              (value21 > 0 &&
                !value22 &&
                value18.slice(0, value21) !== "xml" &&
                value18.slice(0, value21) !== "xlink" &&
                (value4.attrs["xmlns:" + value18.slice(0, value21)] ?? "") ===
                  "")
            ) {
              items.push(
                "an attribute on the root that XML cannot read (" +
                  value18 +
                  ")",
              );
              continue;
            }
            state2[value18] = value19.replace(
              /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,
              String.fromCharCode(65533),
            );
          }
          let value15 = callback3(options.width),
            value16 = callback3(options.height);
          if (state2.width === undefined && value15 !== undefined) {
            state2.width = String(value15);
          }
          if (state2.height === undefined && value16 !== undefined) {
            state2.height = String(value16);
          }
          let callback4 = (input: string): string =>
              input
                .replace(/&/g, "&amp;")
                .replace(/"/g, "&quot;")
                .replace(/</g, "&lt;"),
            values = new Set([
              "xml",
              ...Object.keys(state2)
                .filter(
                  (input: string): boolean =>
                    input.startsWith("xmlns:") && state2[input] !== "",
                )
                .map((input: string): string => input.slice(6)),
            ]),
            value17 = sanitizeSvgMarkup(value4.inner, values);
          items.push(...value17.said);
          value5 =
            "<svg" +
            Object.entries(state2)
              .map(
                ([input, input2]: [string, string]): string =>
                  " " + input + '="' + callback4(input2) + '"',
              )
              .join("") +
            ">" +
            value17.xml +
            "</svg>";
          if (items.length > 0) {
            this.warnAt(
              dataset,
              "<svg> is drawn as an image, which is read as XML — respelled for it, meaning the same: " +
                [...new Set(items)].join(", "),
            );
          }
          if (value17.open.length > 0) {
            this.warnAt(
              dataset,
              "<svg> will not draw: an image is read as XML, where " +
                value17.open.join("; ") +
                (value17.open.some(
                  (input: string): boolean =>
                    input.endsWith("is never closed"),
                )
                  ? " — close every element (<line … />, with a space before /> after an unquoted value)"
                  : ""),
            );
          }
        }
        let value6 =
          "data:image/svg+xml;base64," + utf8ToBase64(value5);
        if (value6.length > runtime.maxInlineSvgBytes) {
          this.errorAt(
            dataset,
            "<svg> is " +
              String(Math.round(value2.length / 1024)) +
              " KB — inline graphics stay under " +
              String(Math.round((runtime.maxInlineSvgBytes * 3) / 4 / 1024)) +
              " KB; simplify it or export a PNG",
          );
          return;
        }
        let state: ImageNode = {
          kind: "img",
          alt: (dataset.attrs["aria-label"] ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 500),
          src: value6,
          fit: "contain",
        };
        value.add("object-fit");
        value.add("width");
        value.add("height");
        let callback = (input: string | undefined): number | undefined => {
            if (input === undefined) {
              return;
            }
            let value15 = /^\s*([\d.]+)(px)?\s*$/.exec(input);
            if (value15 && Number(value15[1]) > 0) {
              return Number(value15[1]);
            } else {
              return undefined;
            }
          },
          callback2 = (input: "auto" | CssSizeValue | undefined): number | undefined =>
            input !== undefined &&
            input !== "auto" &&
            "px" in input &&
            input.px > 0
              ? input.px
              : undefined,
          value7 =
            callback2(options.width) ?? callback(dataset.attrs.width),
          value8 =
            callback2(options.height) ?? callback(dataset.attrs.height),
          value9 =
            /viewBox\s*=\s*["']\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(
              value2,
            ),
          value10 =
            value9 && Number(value9[1]) > 0 && Number(value9[2]) > 0
              ? Number(value9[2]) / Number(value9[1])
              : undefined,
          value11 = context.fill?.x === true,
          value12 = context.fill?.y === true;
        if (
          value7 === undefined &&
          value8 !== undefined &&
          value10 !== undefined &&
          !value11
        ) {
          value7 = Math.round(value8 / value10);
        } else if (
          value8 === undefined &&
          value7 !== undefined &&
          value10 !== undefined &&
          !value12
        ) {
          value8 = Math.round(value7 * value10);
        }
        if (
          value7 === undefined &&
          value8 === undefined &&
          !(value11 && value12)
        ) {
          if (value10 !== undefined) {
            if (!value11) {
              value7 = 400;
            }
            if (!value12) {
              value8 = Math.round((value7 ?? 400) * value10);
            }
            this.warnAt(
              dataset,
              "<svg> without width/height — sized " +
                (value7 !== undefined ? "400px wide" : "to its frame") +
                " from its viewBox",
            );
          } else {
            this.warnAt(
              dataset,
              "<svg> without width/height or viewBox — give it width and height",
            );
          }
        }
        if (value7 !== undefined) {
          state.w = value7;
        }
        if (value8 !== undefined) {
          state.h = value8;
        }
        let value13 = this.paintBag(options, "img", dataset, value);
        if (Object.keys(value13).length > 0) {
          state.style = value13;
        }
        let value14 = this.place(
          options,
          "img",
          context,
          dataset,
          value,
        );
        if (Object.keys(value14).length > 0) {
          state.place = value14;
        }
        this.leftovers(options, value, dataset, "<svg>");
        return state;
      }
      embed(
        input: HtmlElementNode,
        options: ParsedInlineStyle,
        context: HtmlNodeContext,
        value: Set<string>,
      ): SlideNode | undefined {
        if (context.inContainer) {
          this.errorAt(
            input,
            "<x-embed> sits at the slide level: give it position:absolute with left/top (or right/bottom), width and height",
          );
          return;
        }
        let value2 = input.children
          .map(
            (source: HtmlTreeNode): string =>
              source.kind === "text" ? source.text : "",
          )
          .join("");
        if (value2.trim() === "") {
          this.warnAt(
            input,
            "<x-embed> is empty and was left out — put the embed's HTML inside it",
          );
          return;
        }
        if (value2.length > runtime.maxHtmlEmbedBytes) {
          this.errorAt(
            input,
            "<x-embed> is " +
              String(Math.round(value2.length / 1024)) +
              " KB — an embed holds at most " +
              String(Math.round(runtime.maxHtmlEmbedBytes / 1024)) +
              " KB of HTML",
          );
          return;
        }
        if (context.fill?.x !== true && options.width === undefined) {
          this.warnAt(input, "<x-embed> needs width (or left and right)");
        }
        if (context.fill?.y !== true && options.height === undefined) {
          this.warnAt(input, "<x-embed> needs height (or top and bottom)");
        }
        value.add("width");
        value.add("height");
        for (let value3 of Object.keys(options) as Array<keyof ParsedInlineStyle>) {
          if (
            value3 === "position" ||
            value3 === "width" ||
            value3 === "height" ||
            value3 === "display"
          ) {
            continue;
          }
          if (options[value3] !== undefined) {
            this.rejectAt(
              input,
              diagnosticCssPropertyName(value3) +
                " does not apply to <x-embed> (position, left/top/right/bottom, width, height only)",
            );
          }
          value.add(value3);
        }
        this.leftovers(options, value, input, "<x-embed>");
        return {
          kind: "html",
          html: value2,
        };
      }
      cellContent(input: HtmlElementNode): HtmlElementNode {
        let callback = (input2: string): boolean =>
            input2 === "x-shape" ||
            input2 === "x-icon" ||
            input2 === "x-connector",
          callback2 = (source: HtmlTreeNode): boolean =>
            source.kind === "text"
              ? source.text.trim() !== ""
              : source.tag === "x-icon" &&
                  (source.attrs.name ?? "").trim() !== ""
                ? true
                : source.tag === "img"
                  ? (source.attrs.alt ?? "").trim() !== ""
                  : mediaHtmlElementNames.has(source.tag) &&
                      !callback(source.tag)
                    ? false
                    : source.children.some(callback2),
          value =
            " inside <" +
            input.tag +
            "> — a table cell holds text only, so it is ",
          callback3 = (source: HtmlTreeNode): HtmlTreeNode[] => {
            if (source.kind === "text") {
              return [source];
            }
            let callback4 = (input2: string): HtmlTextNode => ({
              kind: "text",
              text: " " + input2 + " ",
              line: source.line,
              col: source.col,
            });
            if (source.tag === "x-icon") {
              let value5 = (source.attrs.name ?? "").trim(),
                value6 = source.children.flatMap(callback3);
              this.cellRemovals++;
              let value7 =
                value5 !== ""
                  ? iconPlaceholderLabel(value5)
                  : value6.some(callback2)
                    ? ""
                    : genericIconPlaceholderLabel;
              this.rejectAt(
                source,
                "<x-icon>" +
                  value +
                  (value7 === ""
                    ? "left out (what is inside it is kept)"
                    : "shown as the text " +
                      value7 +
                      "; write " +
                      (value5 === "" ? "a" : "the") +
                      " word, or a character such as ✓, in the cell"),
              );
              return [callback4(value7), ...value6, callback4("")];
            }
            if (!mediaHtmlElementNames.has(source.tag)) {
              return [
                {
                  ...source,
                  children: source.children.flatMap(callback3),
                },
              ];
            }
            let value2 = callback(source.tag)
              ? source.children.flatMap(callback3)
              : [];
            this.cellRemovals++;
            let value3 =
                source.tag === "img"
                  ? (0, runtime.truncateUtf16Safely)(
                      (source.attrs.alt ?? "").trim(),
                      120,
                    )
                  : "",
              value4 =
                value3 !== ""
                  ? "[image: " + value3 + "]"
                  : value2.some(callback2)
                    ? ""
                    : elementPlaceholderLabel(source);
            this.rejectAt(
              source,
              "<" +
                source.tag +
                ">" +
                value +
                (value4 !== ""
                  ? "shown as the text " + value4
                  : "left out (what is inside it is kept)") +
                "; put it outside the table",
            );
            return [callback4(value4), ...value2, callback4("")];
          };
        return {
          ...input,
          children: input.children.flatMap(callback3),
        };
      }
      table(
        input: HtmlElementNode,
        options: ParsedInlineStyle,
        context: HtmlNodeContext,
        value: Set<string>,
      ): TableNode | undefined {
        let items: string[][] = [],
          items2: HtmlElementNode[] = [],
          callback = (input2: HtmlElementNode): void => {
            for (let value8 of input2.children) {
              if (value8.kind === "text") {
                if (value8.text.trim() !== "") {
                  this.errorAt(
                    value8,
                    "text directly inside <" + input2.tag + "> — use <tr><td>",
                  );
                }
                continue;
              }
              if (value8.tag === "tr") {
                items2.push(value8);
              } else if (
                value8.tag === "thead" ||
                value8.tag === "tbody" ||
                value8.tag === "tfoot"
              ) {
                callback(value8);
              } else if (
                value8.tag === "caption" ||
                value8.tag === "colgroup" ||
                value8.tag === "col"
              ) {
                this.warnAt(
                  value8,
                  "<" + value8.tag + "> is not in this format — dropped",
                );
              } else {
                this.errorAt(
                  value8,
                  "<" +
                    value8.tag +
                    "> inside <table> — rows are <tr> of <th>/<td>",
                );
              }
            }
          };
        callback(input);
        if (items2.length === 0) {
          this.errorAt(input, "<table> has no <tr> rows");
          return;
        }
        let items3: HtmlElementNode[][] = [],
          flag = true,
          count = 1,
          entries = new Map<number, TextAlignValue>(),
          entries2 = new Map<number, CssSizeValue>(),
          state: Record<string, { color: SlideColor }> = {},
          state2: Record<string, { background: SlideColor }> = {},
          items4: TableCellPadding[] = [],
          value2: number | undefined,
          state3: { n: number; cell?: HtmlElementNode } = {
            n: 0,
          },
          values = new Set<string>(),
          entries3 = new Map<HtmlElementNode, string>(),
          flag2 = false,
          entries4 = new Map<string, { n: number; cell: HtmlElementNode }>(),
          callback2 = (
            input2: HtmlElementNode,
            options2: string,
          ): void => {
            let entry = entries4.get(options2);
            if (entry !== undefined) {
              entry.n++;
            } else {
              entries4.set(options2, {
                n: 1,
                cell: input2,
              });
            }
          };
        items2
          .slice(0, 100)
          .forEach((input2: HtmlElementNode, options2: number): void => {
            let items5: HtmlElementNode[] = [];
            for (let value8 of input2.children) {
              if (value8.kind === "text") {
                if (value8.text.trim() !== "") {
                  this.errorAt(value8, "text directly inside <tr> — use <td>");
                }
                continue;
              }
              if (value8.tag === "td" || value8.tag === "th") {
                items5.push(value8);
              } else {
                this.errorAt(
                  value8,
                  "<" + value8.tag + "> inside <tr> — cells are <th>/<td>",
                );
              }
            }
            if (input2.attrs.style !== undefined) {
              let value8 = parseInlineStyle(
                input2.attrs.style,
                this.warner(input2, "<tr> "),
                this.rejecter(input2, "<tr> "),
              );
              if (typeof value8["background-color"] === "string") {
                state2[String(options2)] = {
                  background: value8["background-color"],
                };
              }
              let value9 = (
                Object.keys(value8) as Array<keyof ParsedInlineStyle>
              ).filter(
                (input3: keyof ParsedInlineStyle): boolean =>
                  input3 !== "background-color" && value8[input3] !== undefined,
              );
              for (let value10 of value9)
                values.add(diagnosticCssPropertyName(value10));
              if (value9.length > 0) {
                callback2(input2, "tr-style");
              }
            }
            if (
              options2 === 0 &&
              !items5.every((input3: HtmlElementNode): boolean => input3.tag === "th")
            ) {
              flag = false;
            }
            items5.forEach((input3: HtmlElementNode, options3: number): void => {
              if (
                input3.attrs.colspan !== undefined ||
                input3.attrs.rowspan !== undefined
              ) {
                this.rejectAt(
                  input3,
                  "<" +
                    input3.tag +
                    "> colspan/rowspan are not in this format (the cell would be unmerged; split the table or repeat the text)",
                );
              }
              let value8 = this.warner(
                  input3,
                  "<" + input3.tag + "> ",
                ),
                value9 = parseInlineStyle(
                  input3.attrs.style,
                  value8,
                  this.rejecter(input3, "<" + input3.tag + "> "),
                );
              if (value9["text-align"] === "justify") {
                value8(
                  "text-align: justify — table columns align left | center | right; kept left",
                );
              } else if (value9["text-align"] !== undefined) {
                if (!entries.has(options3)) {
                  entries.set(options3, value9["text-align"]);
                } else if (entries.get(options3) !== value9["text-align"]) {
                  value8(
                    "text-align differs from the first cell in this column (" +
                      String(entries.get(options3)) +
                      ") — alignment is per column; the first wins",
                  );
                }
              }
              if (
                value9.width !== undefined &&
                value9.width !== "auto" &&
                options2 === 0
              ) {
                entries2.set(options3, value9.width);
              }
              if (
                input3.attrs.width !== undefined &&
                options2 === 0 &&
                !entries2.has(options3)
              ) {
                let value15 = /^(\d+(?:\.\d+)?)(%?)$/.exec(
                  input3.attrs.width.trim(),
                );
                if (value15) {
                  entries2.set(
                    options3,
                    value15[2] === "%"
                      ? {
                          pct: Number(value15[1]),
                        }
                      : {
                          px: Number(value15[1]),
                        },
                  );
                }
              }
              if (value9.color !== undefined) {
                state[String(options2) + "." + String(options3)] = {
                  color: value9.color,
                };
              }
              let callback3 = (
                  input4: number | undefined,
                  options4: number | undefined,
                ): number | undefined =>
                  input4 === undefined && options4 === undefined
                    ? undefined
                    : Math.max((input4 ?? options4)!, (options4 ?? input4)!),
                value10 = callback3(
                  value9["padding-top"],
                  value9["padding-bottom"],
                ),
                value11 = callback3(
                  value9["padding-left"],
                  value9["padding-right"],
                );
              if (value10 !== undefined || value11 !== undefined) {
                if (Math.max(value10 ?? 0, value11 ?? 0) > runtime.maxGridGap) {
                  callback2(input3, "padding-max");
                } else {
                  items4.push({
                    cell: input3,
                    ...(value11 !== undefined
                      ? {
                          x: value11,
                        }
                      : {}),
                    ...(value10 !== undefined
                      ? {
                          y: value10,
                        }
                      : {}),
                  });
                }
              }
              if (
                options2 === 0 &&
                input3.tag === "th" &&
                typeof value9["font-weight"] === "number"
              ) {
                if (value2 === undefined) {
                  value2 = value9["font-weight"];
                } else if (value9["font-weight"] !== value2) {
                  state3.n++;
                  state3.cell ??= input3;
                }
              }
              for (let value15 of Object.keys(value9) as Array<keyof ParsedInlineStyle>) {
                if (
                  value15 === "text-align" ||
                  value15 === "width" ||
                  value15 === "color" ||
                  value15.startsWith("padding-")
                ) {
                  continue;
                }
                if (value9[value15] === undefined) {
                  continue;
                }
                if (value15 === "font-weight" && input3.tag === "th") {
                  continue;
                }
                callback2(input3, value15);
              }
              let value12 = this.inline(
                this.cellContent(input3),
                input3,
              );
              value12.say();
              let { text: value13, marks: value14 } = value12;
              if (value14.length > 0 && !flag2) {
                flag2 = true;
                this.warnAt(
                  input3,
                  "bold/italic/underline/links inside table cells are not kept (plain text) — emphasise a cell with color, or pull the row out as its own element",
                );
              }
              this.textCaps(input3, value13, []);
              entries3.set(input3, value13);
            });
            count = Math.max(count, items5.length);
            items3.push(items5);
          });
        let value3 =
          items4.find(
            (input2: TableCellPadding): boolean => input2.cell.tag === "td",
          ) ?? items4[0];
        if (
          value3 !== undefined &&
          (value3.x === 0 || value3.y === 0) &&
          [...entries3.values()].some(
            (input2: string): boolean => input2.trim() !== "",
          )
        ) {
          let callback3 = (
            input2: number | undefined,
            options2: string,
          ): string =>
            input2 === undefined
              ? options2
              : input2 === 0
                ? "0"
                : String(input2) + "px";
          this.lintAt(
            value3.cell,
            "<" +
              value3.cell.tag +
              "> padding " +
              callback3(value3.y, "0.35em") +
              " " +
              callback3(value3.x, "0.6em") +
              " is this table's cell padding, and every cell is ruled on all four sides here, so its text sits on a rule — drop the padding (cells pad 0.35em 0.6em by default) or give both axes some",
          );
        }
        let value4 =
          value3 !== undefined
            ? {
                ...(value3.x !== undefined
                  ? {
                      x: value3.x,
                    }
                  : {}),
                ...(value3.y !== undefined
                  ? {
                      y: value3.y,
                    }
                  : {}),
              }
            : undefined;
        if (value3 !== undefined) {
          let value8 = items4.filter(
              (input2: TableCellPadding): boolean =>
                input2.x !== value3.x || input2.y !== value3.y,
            ),
            value9 =
              (value3.y !== undefined ? String(value3.y) + "px" : "0.35em") +
              " " +
              (value3.x !== undefined ? String(value3.x) + "px" : "0.6em");
          if (value8.length > 0) {
            this.warnAt(
              value8[0]!.cell,
              "<" +
                value8[0]!.cell.tag +
                "> padding differs from the table's cell padding (" +
                value9 +
                ", one per table, from the first padded <" +
                value3.cell.tag +
                ">)" +
                (value8.length > 1
                  ? " (×" + String(value8.length) + " cells in this table)"
                  : ""),
            );
          }
        }
        if (state3.cell !== undefined && flag) {
          this.warnAt(
            state3.cell,
            "<th> font-weight differs from the first <th> (" +
              String(value2) +
              ") — one weight per header row" +
              (state3.n > 1
                ? " (×" + String(state3.n) + " cells in this table)"
                : ""),
          );
        }
        for (let [value8, value9] of entries4) {
          let value10 =
              value9.n > 1
                ? " (×" + String(value9.n) + " cells in this table)"
                : "",
            value11 =
              value8 === "tr-style"
                ? "style on <tr> takes background: COLOR only — dropped " +
                  [...values].slice(0, 4).join(", ") +
                  " (style the table for the rest)"
                : value8 === "padding-max"
                  ? "padding above " +
                    String(runtime.maxGridGap) +
                    "px is not supported on table cells (they pad 0–" +
                    String(runtime.maxGridGap) +
                    "px)"
                  : value8 === "font-family" || value8 === "font-size"
                    ? value8 +
                      " on a cell is not supported — set it on the <table> (cells inherit)"
                    : diagnosticCssPropertyName(value8) +
                      " is not supported on table cells (only text-align, width, color, padding; font-weight on <th>); emphasise a cell with color, or pull the row out as its own element";
          this.rejectAt(
            value9.cell,
            (value8 === "tr-style" ? "" : "<" + value9.cell.tag + "> ") +
              value11 +
              (value8 === "tr-style"
                ? value10.replace("cells", "rows")
                : value10),
          );
        }
        if (items2.length > runtime.maxTableRows) {
          this.warnAt(
            input,
            "tables keep at most " +
              String(runtime.maxTableRows) +
              " rows — the rest are dropped",
          );
        }
        if (count > runtime.maxTableColumns) {
          this.warnAt(
            input,
            "tables keep at most " +
              String(runtime.maxTableColumns) +
              " columns — the rest are dropped",
          );
        }
        count = Math.min(runtime.maxTableColumns, count);
        this.countCells(
          input,
          Math.min(items3.length, runtime.maxTableRows) * count,
        );
        for (let value8 of items3) {
          let items5: string[] = [];
          for (let index = 0; index < count; index++)
            items5.push(
              value8[index] !== undefined
                ? (entries3.get(value8[index]!) ?? "")
                : "",
            );
          items.push(items5);
        }
        let state4: TableNode = {
            kind: "table",
            rows: items,
            cols: count,
            header: flag,
          },
          value5 = (0, runtime.normalizeShapeVariant)(
            input.attrs["data-fit"],
          );
        if (value5 !== undefined) {
          state4.fit = value5;
        }
        if (entries2.size === count) {
          let value8 = Array.from<unknown, CssSizeValue>(
              {
                length: count,
              },
              (input2: unknown, options2: number): CssSizeValue =>
                entries2.get(options2)!,
            ).map(
              (input2: CssSizeValue): number =>
                "pct" in input2 ? input2.pct : input2.px,
            ),
            value9 = value8.reduce(
              (input2: number, options2: number): number =>
                input2 + options2,
              0,
            );
          if (value9 > 0) {
            state4.colWidths = value8.map(
              (input2: number): number =>
                Math.max(1, Math.min(100, Math.round((input2 / value9) * 100))),
            );
          }
        } else if (entries2.size > 0) {
          this.warnAt(
            input,
            "column widths apply only when EVERY cell in the first row has a width — equal columns used",
          );
        }
        if (entries.size > 0) {
          state4.colAligns = Array.from<unknown, Alignment>(
            {
              length: count,
            },
            (input2: unknown, options2: number): Alignment =>
              (
                ({
                  left: "start",
                  center: "center",
                  right: "end",
                }) as Record<string, Alignment>
              )[entries.get(options2) ?? "left"]!,
          );
        }
        if (Object.keys(state).length > 0) {
          state4.cellStyles = state;
        }
        if (Object.keys(state2).length > 0) {
          state4.rowStyles = state2;
        }
        if (value4 !== undefined) {
          state4.cellPadding = value4;
        }
        if (value2 !== undefined && flag) {
          state4.headerWeight = value2;
        }
        let { eff: value6 } = this.typography(
            options,
            context.inh,
            "p",
            input,
          ),
          value7 = this.paintBag(options, "table", input, value);
        for (let value8 of [
          "font-family",
          "font-size",
          "font-weight",
          "font-style",
          "line-height",
          "letter-spacing",
          "text-align",
          "text-transform",
          "color",
          "text-decoration-line",
          "text-decoration-style",
          "text-decoration-color",
          "font-variant-numeric",
          "text-stroke-width",
          "text-stroke-color",
        ] as const)
          value.add(value8);
        value.add("white-space");
        if (options["white-space"] === "nowrap") {
          this.rejectAt(
            input,
            "white-space does not apply to <table> (cells wrap) — widen the column or shorten the word",
          );
        }
        this.typeKeys(value7, options, value6, input);
        if (value6.color !== undefined) {
          value7.color = value6.color;
        }
        if (options["text-align"] !== undefined) {
          this.warnAt(
            input,
            "text-align on <table> — align cells instead (text-align on a cell sets its column)",
          );
        }
        if (Object.keys(value7).length > 0) {
          state4.style = value7;
        }
        value.add("width");
        value.add("height");
        if (context.inContainer) {
          let value8 = this.place(
            options,
            "table",
            context,
            input,
            value,
          );
          if (Object.keys(value8).length > 0) {
            state4.place = value8;
          }
        }
        this.leftovers(options, value, input, "<table>");
        return state4;
      }
      dedupeDiags(): void {
        let values = new Set<string>(),
          callback = (input: CompileDiagnostic): boolean => {
            let value3 =
              String(input.line) +
              ":" +
              String(input.col) +
              ":" +
              input.message;
            if (values.has(value3)) {
              return false;
            }
            values.add(value3);
            return true;
          },
          value = this.warnings.filter(callback);
        this.warnings.length = 0;
        this.warnings.push(...value);
        values.clear();
        let value2 = this.errors.filter(callback);
        this.errors.length = 0;
        this.errors.push(...value2);
      }
      container(
        input: HtmlElementNode,
        options: ParsedInlineStyle,
        context: HtmlNodeContext,
        value: Set<string>,
      ): SlideNode | undefined {
        let value2 = this.warner(input, "<div> "),
          value3 = this.inherit(options, context.inh, input);
        for (let value17 of [
          "font-family",
          "font-size",
          "font-weight",
          "font-style",
          "line-height",
          "letter-spacing",
          "text-align",
          "text-transform",
          "white-space",
          "color",
        ] as const)
          value.add(value17);
        let items: HtmlElementNode[] = [],
          items2: HtmlElementNode[] = [];
        for (let value17 of input.children) {
          if (value17.kind === "text") {
            if (value17.text.trim() !== "") {
              this.warnAt(
                value17,
                "text directly inside <div> — wrapped in <p>",
              );
              items.push({
                kind: "el",
                tag: "p",
                attrs: Object.create(null),
                children: [value17],
                line: value17.line,
                col: value17.col,
              });
            }
            continue;
          }
          if (value17.tag === "aside") {
            this.errorAt(
              value17,
              "<aside> (speaker notes) must be a direct child of <section>",
            );
            continue;
          }
          if (
            inlineStyleIsAbsolute(value17.attrs.style) ||
            (value17.tag === "x-connector" &&
              connectorHasExplicitEndpoints(value17))
          ) {
            items2.push(value17);
          } else {
            items.push(value17);
          }
        }
        let { layout: value4, isGrid: value5 } = this.layout(
          options,
          value,
          value2,
          this.styleRejecter(input),
        );
        value.add("position");
        value.add("display");
        let value6 =
          options.position !== undefined && (options.position as string) !== "static";
        if (items2.length > 0 && !value6) {
          value2(
            "has position:absolute children but is not position:relative — treated as position:relative (the children pin to this div)",
          );
        }
        let value7: "h" | "v" = !value5 && value4.dir === "h" ? "h" : "v",
          value8 =
            context.faded === true ||
            (typeof options.opacity === "number" && options.opacity <= 0.5),
          value9 = this.paintBag(options, "stack", input, value),
          value10 =
            value9.backgroundColor !== undefined ||
            value9.backgroundGradient !== undefined ||
            value9.borderWidth !== undefined ||
            value9.borderTopWidth !== undefined ||
            value9.borderRightWidth !== undefined ||
            value9.borderBottomWidth !== undefined ||
            value9.borderLeftWidth !== undefined ||
            value9.boxShadow !== undefined;
        if (
          context.depth >= runtime.maxNodeTreeDepth &&
          !(items.length === 0 && items2.length === 0 && !value10)
        ) {
          this.errorAt(
            input,
            "<div> nested too deep — at most " +
              String(runtime.maxNodeTreeDepth - 1) +
              " levels of <div> inside a slide or positioned element",
          );
          return;
        }
        let callback = (input2: "auto" | CssSizeValue | undefined): number | undefined =>
            input2 !== undefined &&
            input2 !== "auto" &&
            "px" in input2 &&
            input2.px > 0
              ? input2.px
              : undefined,
          value11 = context.inContainer
            ? {
                w: callback(options.width),
                h: callback(options.height),
              }
            : {
                w: context.box?.w ?? callback(options.width),
                h: context.box?.h ?? callback(options.height),
              },
          callback2 = (
            input2: "auto" | CssSizeValue | undefined,
            options2: "h" | "v",
          ): boolean =>
            input2 !== undefined &&
            input2 !== "auto" &&
            "pct" in input2 &&
            context.parentGrid !== true &&
            context.parentDir === options2 &&
            (options["flex-grow"] === undefined || options["flex-grow"] > 0),
          callback3 = (input2: "auto" | CssSizeValue | undefined): boolean =>
            input2 !== undefined &&
            input2 !== "auto" &&
            (!("px" in input2) || input2.px > 0),
          value12 =
            !context.inContainer ||
            value11.w !== undefined ||
            value11.h !== undefined ||
            (options["flex-grow"] ?? 0) > 0 ||
            callback3(options["min-height"]) ||
            callback3(options["min-width"]) ||
            options["min-width-fit"] !== undefined ||
            callback2(options.width, "h") ||
            callback2(options.height, "v"),
          length = this.errors.length,
          items3: PinnedNode[] = [];
        for (let value17 of items2) {
          let state2: HtmlNodeContext = {
            inh: value3,
            depth: context.depth + 1,
            inContainer: false,
            faded: value8,
            nestedHost: context.layerGeom !== undefined,
          };
          this.lifted = [];
          let value18 = this.frame(
            value17,
            state2,
            value11.w,
            value11.h,
            true,
          );
          if (value18 !== undefined) {
            items3.push({
              node: value18.node,
              x: value18.x,
              y: value18.y,
              el: value17,
            });
          }
          items3.push(...this.lifted);
          this.lifted = [];
        }
        let value13 =
            items3.length > 0 && context.layerGeom === undefined,
          state: HtmlNodeContext = {
            inh: value3,
            depth: context.depth + 1,
            parentDir: value7,
            parentGrid: value5,
            inContainer: true,
            parentAlign: inheritedContainerStretchSources(value5, value4),
            parentBlock: inlineStyleSuppressesFlowLayout(
              elementInlineStyle(input),
            ),
            flowCount: items.length,
            parentJustify: value4.justify,
            faded: value8,
          },
          items4: SlideNode[] = [],
          items5: HtmlElementNode[] = [];
        for (let value17 of items) {
          let value18 = this.node(value17, state);
          if (value18 !== undefined) {
            items4.push(value18);
            items5.push(value17);
          }
        }
        this.loneShareAfterDrops(items, items5, items4, value7, value5);
        let value14 =
            items2.length > 0 && context.layerGeom !== undefined,
          value15: StackNode | GridNode | SpacerNode;
        if (items4.length === 0 && !value13 && !value14) {
          if (
            !value10 &&
            (options["flex-grow"] ?? 0) > 0 &&
            this.errors.length === length
          ) {
            value15 = {
              kind: "spacer",
            };
            let value17 = this.place(
              options,
              "spacer",
              context,
              input,
              value,
            );
            if (Object.keys(value17).length > 0) {
              value15.place = value17;
            }
            this.leftovers(options, value, input, "an empty <div>");
            return value15;
          }
          if (!value10) {
            if (this.errors.length === length) {
              let callback4 = (
                  input2: "auto" | number | CssSizeValue | undefined,
                ): boolean =>
                  input2 !== undefined &&
                  input2 !== "auto" &&
                  (typeof input2 === "number"
                    ? input2 > 0
                    : "px" in input2
                      ? input2.px > 0
                      : input2.pct > 0),
                value17 =
                  callback4(options.width) ||
                  callback4(options.height) ||
                  callback4(options["min-width"]) ||
                  callback4(options["min-height"]) ||
                  callback4(options["flex-basis"]) ||
                  callback4(options["aspect-ratio"]) ||
                  callback4(options["padding-top"]) ||
                  callback4(options["padding-bottom"]) ||
                  callback4(options["padding-left"]) ||
                  callback4(options["padding-right"]),
                value18 =
                  items.length > 0 ? " (its children were all dropped)" : "";
              if (value17) {
                value2(
                  "empty, unpainted and sized" +
                    value18 +
                    " — dropped, the gap it held closes: a spacer is flex:1, a rule or block is a painted div (give it a background), space between items is gap",
                );
              } else if (context.parentGrid === true) {
                value2(
                  "empty and unpainted grid cell" +
                    value18 +
                    " — dropped, so the cells after it move back a track: give it a background to keep the cell, or remove it",
                );
              } else if (
                context.parentJustify === "between" ||
                context.parentJustify === "around" ||
                context.parentJustify === "evenly"
              ) {
                value2(
                  "empty and unpainted, spaced by the parent's justify-content" +
                    value18 +
                    " — dropped, so the other items respace: give it flex:1 to make a spacer, or a background",
                );
              } else {
                value2(
                  "empty and unpainted — dropped (give it flex:1 to make a spacer, or a background to make a box)",
                );
              }
            }
            return;
          }
        }
        if (value5) {
          value15 = {
            kind: "grid",
            columns: value4.columns!,
            gap: value4.gap,
            children: items4,
          };
          if (value4.rows !== undefined) {
            value15.rows = value4.rows;
          }
          if (value4.alignItems !== undefined) {
            value15.alignItems = value4.alignItems;
          }
          if (value4.justifyItems !== undefined) {
            value15.justifyItems = value4.justifyItems;
          }
        } else {
          value15 = {
            kind: "stack",
            dir: value7,
            align: value4.align ?? "stretch",
            gap: value4.gap,
            children: items4,
          };
          if (value4.justify !== undefined && value4.justify !== "start") {
            value15.justify = value4.justify;
          }
          if (value4.wrap === true && value7 === "h") {
            value15.wrap = true;
          }
          if (value4.reverse) {
            items4.reverse();
          }
        }
        if (Object.keys(value9).length > 0) {
          value15.style = value9;
        }
        if (value13 || value14) {
          let value17: SlideNode;
          if (
            value13 &&
            items4.length === 1 &&
            Object.keys(value9).length === 0 &&
            !value5 &&
            !value12 &&
            items4[0]!.kind !== "overlay"
          ) {
            value17 = items4[0]!;
            if (value4.gap !== 0 || value4.justify !== undefined) {
              value2(
                "gap/justify on an overlay host with one child are ignored",
              );
            }
          } else if (
            ((value17 = value15),
            items4.length === 0 &&
              context.inContainer &&
              value11.w === undefined &&
              value11.h === undefined &&
              (options["flex-grow"] ?? 0) === 0 &&
              options["min-height"] === undefined)
          ) {
            value2(
              "position:relative host with no flow child — the positioned children sit over an empty box; give the div width and height",
            );
          }
          if (context.layerGeom === undefined) {
            for (let value20 of items3)
              if (value20.node.kind === "table") {
                value20.y = this.tableHeightHeal(
                  value20.y,
                  value11.h,
                  value20.el,
                );
              }
          }
          let value18 =
            typeof value9.opacity === "number" && value9.opacity <= 0.25;
          if (context.layerGeom === undefined && !value18) {
            this.lintPinned(
              items3.map(
                (input2: PinnedNode): PinnedNode => ({
                  el: input2.el,
                  x: input2.x,
                  y: input2.y,
                  node: input2.node,
                }),
              ),
              value11.w,
              value11.h,
              value9.backgroundGradient !== undefined
                ? undefined
                : typeof value9.backgroundColor === "string" &&
                    hexColorAlpha(value9.backgroundColor) > 0.1
                  ? hexColorAlpha(value9.backgroundColor) >= 0.8
                    ? value9.backgroundColor
                    : undefined
                  : this.slideBg,
            );
          }
          if ((value17 as SlideNode).kind === "overlay") {
            this.errorAt(
              input,
              "a position:relative div cannot sit directly inside another one (overlay in overlay)",
            );
            return;
          }
          if (context.layerGeom !== undefined) {
            for (let value20 of items3) {
              let value21 = combineNestedAxisSpecs(
                  context.layerGeom.x,
                  value20.x,
                ),
                value22 = combineNestedAxisSpecs(
                  context.layerGeom.y,
                  value20.y,
                );
              if (value21 === "outer" || value22 === "outer") {
                this.errorAt(
                  input,
                  "position:absolute div inside a position:relative div: its positioned children are re-pinned to that div, which needs this div's " +
                    (value21 === "outer" ? "width" : "height") +
                    " — add it, or put them directly in the position:relative div",
                );
                continue;
              }
              if (value21 === "inner" || value22 === "inner") {
                this.errorAt(
                  value20.el,
                  "pinned inside a position:absolute div that is itself inside a position:relative div — it is re-pinned to that div, which needs this element's " +
                    (value21 === "inner" ? "width" : "height") +
                    " when it uses right/bottom/centering; add it, pin it with left/top, or put it directly in the position:relative div",
                );
                continue;
              }
              if (value21.margin < 0 || value22.margin < 0) {
                this.warnAt(
                  value20.el,
                  "re-pinned to the position:relative div, it starts " +
                    String(
                      Math.round(-Math.min(value21.margin, value22.margin)),
                    ) +
                    "px outside that div — clamped to its edge",
                );
                value21.margin = Math.max(0, value21.margin);
                value22.margin = Math.max(0, value22.margin);
              }
              this.lifted.push({
                node: value20.node,
                x: value21,
                y: value22,
                el: value20.el,
              });
            }
            this.warnAt(
              input,
              "position:absolute div inside a position:relative div — its positioned children are pinned to that div directly (flattened)",
            );
            if (
              value17 === value15 &&
              Object.keys(value9).length === 0 &&
              !value5 &&
              items4.every(
                (source: SlideNode): boolean => source.kind === "spacer",
              )
            ) {
              return;
            }
            this.place(options, "stack", context, input, value);
            this.leftovers(options, value, input, "<div>");
            return value17;
          }
          for (
            let value20 = items3.length - 1;
            value20 >= 0 && items3.length > runtime.maxTextLineSpacing;
            value20--
          ) {
            let el2 = items3[value20]!.el;
            if (el2.tag !== "x-icon" || (el2.attrs.name ?? "").trim() !== "") {
              continue;
            }
            this.rejectAt(
              el2,
              "<x-icon> has no name and its box already holds " +
                String(runtime.maxTextLineSpacing) +
                " positioned children, so it is left out",
            );
            items3.splice(value20, 1);
          }
          if (items3.length > runtime.maxTextLineSpacing) {
            this.errorAt(
              input,
              "more than " +
                String(runtime.maxTextLineSpacing) +
                " positioned children in one div (" +
                String(items3.length) +
                ") — split them across sibling position:relative divs, or pin some to the slide",
            );
            return;
          }
          let state2: OverlayNode = {
            kind: "overlay",
            base: value17,
            layers: items3.map(
              (input2: PinnedNode): OverlayLayer => ({
                node: input2.node,
                x: input2.x,
                y: input2.y,
              }),
            ),
          };
          if (input.attrs["data-group"] !== undefined) {
            state2.group = true;
            let value20 = value17;
            if (
              value17 === value15 &&
              value20.kind === "stack" &&
              value20.children?.length === 0 &&
              value20.style !== undefined
            ) {
              state2.style = value20.style;
              delete value20.style;
            }
          }
          let value19 = this.place(
            options,
            "stack",
            context,
            input,
            value,
          );
          if (value17 === value15 && context.inContainer) {
            let value20 = context.parentGrid === true,
              callback4 = (
                input2: "width" | "height",
                options2: string | undefined,
              ): boolean => {
                let value21 =
                  input2 === "width" ? value19.minW : value19.minH;
                return (
                  options2 === undefined ||
                  context.parentBlock === true ||
                  inlineStyleHasPercentSize(input.attrs.style, input2) ||
                  (!(typeof value21 === "number" && value21 > 0) &&
                    !nodeHasExplicitAxisSize(
                      value15,
                      input2 === "width" ? "x" : "y",
                    ))
                );
              };
            if (
              value19.alignSelf === undefined &&
              callback4(
                value20 || context.parentDir === "h" ? "height" : "width",
                value20
                  ? context.parentAlign?.h
                  : (context.parentAlign?.w ?? context.parentAlign?.h),
              )
            ) {
              value19.alignSelf = "stretch";
            }
            if (
              value20 &&
              value19.justifySelf === undefined &&
              callback4("width", context.parentAlign?.w)
            ) {
              value19.justifySelf = "stretch";
            }
          }
          if (Object.keys(value19).length > 0) {
            state2.place = value19;
          }
          this.leftovers(options, value, input, "<div>");
          return state2;
        }
        if (input.attrs["data-group"] !== undefined) {
          value15.group = true;
        }
        let value16 = this.place(
          options,
          "stack",
          context,
          input,
          value,
        );
        if (Object.keys(value16).length > 0) {
          value15.place = value16;
        }
        this.leftovers(options, value, input, "<div>");
        return value15;
      }
      layout(
        input: ParsedInlineStyle,
        options: Set<string>,
        context: HtmlDiagnosticReporter,
        value: HtmlDiagnosticReporter,
      ): LayoutResult {
        for (let value5 of [
          "display",
          "flex-direction",
          "flex-wrap",
          "gap",
          "align-items",
          "justify-content",
          "justify-items",
          "grid-template-columns",
          "grid-template-rows",
        ] as const)
          options.add(value5);
        let display = input.display,
          flag = false;
        if (display === "grid") {
          flag = true;
        }
        let value2 = input.gap ?? 0;
        if (flag) {
          let value5 = input["grid-template-columns"];
          if (value5 === undefined) {
            value(
              "display:grid needs a grid-template-columns this format reads (e.g. repeat(3, 1fr))",
            );
            value5 = [
              {
                fr: 1,
              },
            ];
          }
          if (input["flex-direction"] !== undefined) {
            value("flex-direction does not apply to a grid");
          }
          if (input["flex-wrap"] === true) {
            value("flex-wrap does not apply to a grid");
          }
          if (input["justify-content"] !== undefined) {
            value(
              "justify-content does not apply to a grid (justify-items aligns cells; tracks size the row)",
            );
          }
          let state2: ContainerLayout = {
            gap: value2,
            columns: value5,
          };
          if (input["grid-template-rows"] !== undefined) {
            state2.rows = input["grid-template-rows"];
          }
          if (
            input["align-items"] !== undefined &&
            input["align-items"] !== "stretch"
          ) {
            state2.alignItems = input["align-items"];
          }
          if (
            input["justify-items"] !== undefined &&
            input["justify-items"] !== "stretch"
          ) {
            state2.justifyItems = input["justify-items"] as GridNode["justifyItems"];
          }
          return {
            isGrid: true,
            layout: state2,
          };
        }
        let value3 = input["flex-direction"],
          value4: "h" | "v",
          flag2 = false;
        if (display === "flex") {
          value4 =
            value3 === "column" || value3 === "column-reverse" ? "v" : "h";
        } else {
          value4 = value3 === "row" || value3 === "row-reverse" ? "h" : "v";
        }
        if (value3 === "row-reverse" || value3 === "column-reverse") {
          flag2 = true;
          context(
            "flex-direction: *-reverse — children are reordered in the file instead (reverse is not stored)",
          );
        }
        if (
          input["grid-template-columns"] !== undefined ||
          input["grid-template-rows"] !== undefined
        ) {
          value(
            "grid-template-columns/rows need display:grid on the same element",
          );
        }
        if (input["justify-items"] !== undefined) {
          value(
            "justify-items applies to display:grid only (align-items / justify-content on a flex box)",
          );
        }
        let state: ContainerLayout = {
          dir: value4,
          reverse: flag2,
          gap: value2,
        };
        if (input["flex-wrap"] === true) {
          if (value4 === "h" && flag2) {
            context(
              "flex-wrap with flex-direction: row-reverse is not in this format — reordered children wrap in a different line order; use flex-direction: row with justify-content: flex-end, or keep one line (wrapping kept, order reversed)",
            );
          }
          if (value4 === "h") {
            state.wrap = true;
          } else {
            value(
              "flex-wrap applies to a row (flex-direction: row), not a column",
            );
          }
        }
        if (input["align-items"] !== undefined) {
          state.align = input["align-items"];
        }
        if (input["justify-content"] !== undefined) {
          state.justify = input["justify-content"];
        }
        return {
          isGrid: false,
          layout: state,
        };
      }
      frame(
        input: HtmlElementNode,
        options: HtmlNodeContext,
        context: number | undefined,
        value: number | undefined,
        extra?: boolean,
      ): Frame | undefined {
        let value2 = this.styleWarner(input),
          value3 = parseInlineStyle(
            input.attrs.style,
            value2,
            this.styleRejecter(input),
            undefined,
            this.listEm(input, options),
          );
        if (
          input.tag === "x-connector" &&
          connectorHasExplicitEndpoints(input) &&
          !this.connectorFrame(input, value3, context, value)
        ) {
          return;
        }
        let transform = value3.transform,
          callback = (
            input2: "left" | "top",
            options2: "right" | "bottom",
            context2: "width" | "height",
            value12: number | undefined,
            extra2: boolean,
          ): ResolvedAxis => {
            let value13 = value3[input2],
              value14 = value3[options2],
              value15 = value3[context2],
              callback3 = (input3: CssOffsetValue | undefined): boolean =>
                input3 === undefined ||
                input3 === "auto" ||
                ("px" in input3 && !("calcPct" in input3) && input3.px === 0) ||
                ("pct" in input3 && input3.pct === 0);
            if (
              value12 === undefined &&
              options.nestedHost !== true &&
              !extra2 &&
              callback3(value13) &&
              callback3(value14) &&
              !inlineStyleHasUnsafeSizing(input.attrs.style, context2) &&
              value15 !== undefined &&
              value15 !== "auto" &&
              "pct" in value15 &&
              value15.pct === 100
            ) {
              return {
                spec: {
                  anchor: "fill",
                  margin: 0,
                  offset: 0,
                },
                sizeless: false,
              };
            }
            let callback4 = (input3: string): void => {
                this.rejectAt(
                  input,
                  "<" +
                    input.tag +
                    "> " +
                    input3 +
                    ": % inside a position:relative div whose " +
                    context2 +
                    " is not known — give the div " +
                    context2 +
                    ", or use px",
                );
              },
              callback5 = (
                input3: CssOffsetValue | undefined,
                options3: string,
              ): number | undefined => {
                if (input3 === undefined || input3 === "auto") {
                  return;
                }
                if ("calcPct" in input3) {
                  if (value12 === undefined) {
                    callback4(options3);
                    return input3.px;
                  }
                  return (input3.calcPct / 100) * value12 + input3.px;
                }
                if ("pct" in input3) {
                  if (value12 === undefined) {
                    callback4(options3);
                    return input3.pct;
                  }
                  return (input3.pct / 100) * value12;
                }
                return input3.px;
              },
              value16: number | undefined;
            if (value15 !== undefined && value15 !== "auto") {
              if ("pct" in value15) {
                if (value12 === undefined) {
                  callback4(context2);
                  value16 = value15.pct;
                } else {
                  value16 = (value15.pct / 100) * value12;
                }
              } else {
                value16 = value15.px;
              }
            }
            if (extra2) {
              let index = 0;
              if (value13 !== undefined && value13 !== "auto") {
                if ("calcPct" in value13) {
                  if (value13.calcPct !== 50) {
                    value2(
                      input2 +
                        ": calc(" +
                        String(value13.calcPct) +
                        "% …) with translate(-50%) — only 50% centers; offset kept",
                    );
                  }
                  index = value13.px;
                } else if ("pct" in value13) {
                  if (value13.pct !== 50) {
                    if (value12 === undefined) {
                      callback4(input2);
                    } else {
                      value2(
                        input2 +
                          ": " +
                          String(value13.pct) +
                          "% with translate(-50%) — treated as an offset from center",
                      );
                      index = ((value13.pct - 50) / 100) * value12;
                    }
                  }
                } else if (value12 === undefined) {
                  value2(
                    input2 +
                      ": " +
                      String(value13.px) +
                      "px with translate(-50%) — centering needs the div's " +
                      context2 +
                      " to place it; centered in the div instead",
                  );
                } else {
                  value2(
                    input2 +
                      ": " +
                      String(value13.px) +
                      "px with translate(-50%) centers the element at " +
                      String(value13.px) +
                      "px (not on the slide center) — kept as an offset",
                  );
                  index = value13.px - value12 / 2;
                }
              }
              if (value14 !== undefined) {
                value2(
                  options2 + " is ignored when centering with translate(-50%)",
                );
              }
              let state5: Axis = {
                anchor: "center",
                margin: 0,
                offset: index,
              };
              if (value16 !== undefined) {
                state5.size = value16;
              }
              return {
                spec: state5,
                sizeless: value16 === undefined,
              };
            }
            let value17 = callback5(value13, input2),
              value18 = callback5(value14, options2);
            if (value17 !== undefined && value17 < 0) {
              value2(
                input2 +
                  ": " +
                  String(value17) +
                  "px — negative offsets are not in this format; clamped to 0 (the element starts at the edge)",
              );
              value17 = 0;
            }
            if (value18 !== undefined && value18 < 0) {
              value2(
                options2 +
                  ": " +
                  String(value18) +
                  "px — negative offsets are not in this format; clamped to 0 (the element starts at the edge)",
              );
              value18 = 0;
            }
            if (value17 !== undefined && value18 !== undefined) {
              if (value16 !== undefined) {
                value2(
                  context2 +
                    " is ignored when both " +
                    input2 +
                    " and " +
                    options2 +
                    " are set (they define the size)",
                );
              }
              if (value17 === value18) {
                return {
                  spec: {
                    anchor: "fill",
                    margin: value17,
                    offset: 0,
                  },
                  sizeless: false,
                  ...(value12 !== undefined
                    ? {
                        resolved: value12 - 2 * value17,
                      }
                    : {}),
                };
              }
              if (value12 === undefined) {
                value2(
                  input2 +
                    " and " +
                    options2 +
                    " inside a position:relative div whose " +
                    context2 +
                    " is not known — " +
                    options2 +
                    " dropped (give the div " +
                    context2 +
                    ", or set " +
                    context2 +
                    ")",
                );
                let state5: Axis = {
                  anchor: "leading",
                  margin: value17,
                  offset: 0,
                };
                if (value16 !== undefined) {
                  state5.size = value16;
                }
                return {
                  spec: state5,
                  sizeless: value16 === undefined,
                };
              }
              let value19 = value12 - value17 - value18;
              if (value19 < 1) {
                value2(
                  input2 +
                    "/" +
                    options2 +
                    " leave no room (" +
                    String(value19) +
                    "px)",
                );
              }
              return {
                spec: {
                  anchor: "leading",
                  margin: value17,
                  offset: 0,
                  size: Math.max(1, value19),
                },
                sizeless: false,
              };
            }
            if (value18 !== undefined) {
              let state5: Axis = {
                anchor: "trailing",
                margin: value18,
                offset: 0,
              };
              if (value16 !== undefined) {
                state5.size = value16;
              }
              return {
                spec: state5,
                sizeless: value16 === undefined,
              };
            }
            let state4: Axis = {
              anchor: "leading",
              margin: value17 ?? 0,
              offset: 0,
            };
            if (value16 !== undefined) {
              state4.size = value16;
            }
            return {
              spec: state4,
              sizeless: value16 === undefined,
            };
          },
          value4 = transform?.centerX === true,
          value5 = transform?.centerY === true,
          value6 = callback("left", "right", "width", context, value4),
          value7 = callback("top", "bottom", "height", value, value5),
          state: ParsedInlineStyle = {
            ...value3,
          };
        delete state.top;
        delete state.right;
        delete state.bottom;
        delete state.left;
        let tag = input.tag,
          value8 =
            tag === "img" ||
            tag === "video" ||
            tag === "x-shape" ||
            tag === "x-connector" ||
            tag === "x-icon" ||
            tag === "hr" ||
            tag === "svg" ||
            tag === "x-embed";
        this.frameFill = {
          x: value6.spec.anchor === "fill",
          y: value7.spec.anchor === "fill",
        };
        if (!value8) {
          delete state.width;
          delete state.height;
        } else {
          if (
            state.width !== undefined &&
            state.width !== "auto" &&
            "pct" in state.width
          ) {
            state.width =
              value6.spec.size !== undefined
                ? {
                    px: value6.spec.size,
                  }
                : "auto";
          }
          if (
            state.height !== undefined &&
            state.height !== "auto" &&
            "pct" in state.height
          ) {
            state.height =
              value7.spec.size !== undefined
                ? {
                    px: value7.spec.size,
                  }
                : "auto";
          }
          if (value6.spec.size !== undefined && state.width === undefined) {
            state.width = {
              px: value6.spec.size,
            };
          }
          if (value7.spec.size !== undefined && state.height === undefined) {
            state.height = {
              px: value7.spec.size,
            };
          }
          if (value6.spec.anchor === "fill") {
            delete state.width;
          }
          if (value7.spec.anchor === "fill") {
            delete state.height;
          }
        }
        let state2: HtmlElementNode = {
          ...input,
          attrs: {
            ...input.attrs,
          },
        };
        delete state2.attrs.style;
        if (input.attrs.style !== undefined) {
          inheritedInlineStyles.set(state2, input.attrs.style);
        }
        let parseOverride = this.parseOverride;
        this.parseOverride = state;
        if (extra && input.tag === "x-embed") {
          this.errorAt(
            input,
            "<x-embed> sits at the slide level, not inside a position:relative div",
          );
          this.parseOverride = parseOverride;
          this.frameFill = undefined;
          return;
        }
        let callback2 = (
            input2: ResolvedAxis,
            options2: number | undefined,
          ): number | undefined =>
            input2.spec.anchor === "fill"
              ? options2 !== undefined
                ? options2 - 2 * input2.spec.margin
                : undefined
              : (input2.spec.size ?? input2.resolved),
          value9 = this.node(state2, {
            ...options,
            depth: options.depth,
            inContainer: false,
            box: {
              w: callback2(value6, context),
              h: callback2(value7, value),
            },
            ...(extra
              ? {
                  layerGeom: {
                    x: value6.spec,
                    y: value7.spec,
                  },
                }
              : {}),
          });
        this.parseOverride = parseOverride;
        if (value9 === undefined) {
          return;
        }
        if (input.tag === "x-icon" && value9.kind === "text") {
          Object.assign(value9, {
            wrap: "nowrap",
            fit: "none",
          });
        }
        if (value9.kind === "shape" && value9.shape === "line") {
          if (
            value6.spec.anchor !== "fill" &&
            value6.spec.size === undefined &&
            typeof value9.w !== "number"
          ) {
            let value12 = context ?? runtime.SLIDE_WIDTH,
              value13 = value6.spec.margin ?? 0,
              value14 = Math.max(
                1,
                Math.round(
                  value6.spec.anchor === "center" ? value12 : value12 - value13,
                ),
              );
            value9.w = value14;
            value2(
              "<hr> without width — drawn to the right edge (" +
                String(value14) +
                "px); set width to size it",
            );
          }
          if (
            value6.spec.anchor !== "fill" &&
            value6.spec.size === undefined &&
            typeof value9.w === "number"
          ) {
            value6.spec.size = value9.w;
          }
          if (
            value7.spec.anchor !== "fill" &&
            value7.spec.size === undefined &&
            typeof value9.h === "number"
          ) {
            value7.spec.size = value9.h;
          }
        }
        if (value9.kind === "table" && !extra) {
          value7.spec = this.tableHeightHeal(value7.spec, value, input);
        }
        let state3: Frame = {
            id: "",
            x: value6.spec,
            y: value7.spec,
            node: value9,
          },
          value10 = (input.attrs.id ?? "").trim();
        if (value10 !== "") {
          if (/^[\w-]{1,64}$/.test(value10)) {
            state3.id = value10;
          } else {
            value2(
              'id="' +
                (0, runtime.compactDiagnosticValue)(value10) +
                '" — letters, digits, - and _ only (up to 64) — a generated id is used',
            );
          }
        }
        let value11 = this.build(input, extra);
        if (value11 !== undefined) {
          state3.build = value11;
        }
        return state3;
      }
      parseOverride: ParsedInlineStyle | undefined;
      frameFill: { x: boolean; y: boolean } | undefined;
      build(input: HtmlElementNode, options?: boolean): FrameBuild | undefined {
        let callback = (
            input2: string | undefined,
            options2: string,
          ): BuildEffect | undefined => {
            if (input2 === undefined) {
              return;
            }
            if (options) {
              this.warnAt(
                input,
                options2 +
                  " applies to a slide's own positioned children, not inside a div — dropped",
              );
              return;
            }
            let value3 = input2.trim().toLowerCase().split(/\s+/),
              value4 = value3[0] ?? "";
            if (!runtime.buildEffectValues.includes(value4)) {
              this.warnAt(
                input,
                options2 +
                  '="' +
                  (0, runtime.compactDiagnosticValue)(input2) +
                  '" — effects: ' +
                  runtime.buildEffectValues.join(", ") +
                  " [order 1–" +
                  String(runtime.maxBuildOrder) +
                  "] [auto] — dropped",
              );
              return;
            }
            let state2 = {
              effect: value4 as BuildEffectName,
            } as BuildEffect;
            for (let value5 of value3.slice(1))
              if (value5 === "auto") {
                state2.auto = true;
              } else if (/^\d+$/.test(value5)) {
                state2.order = Math.max(
                  1,
                  Math.min(runtime.maxBuildOrder, Number(value5)),
                );
              } else {
                this.warnAt(
                  input,
                  options2 +
                    ': "' +
                    value5 +
                    '" ignored (effect [order] [auto])',
                );
              }
            return state2;
          },
          value = callback(
            input.attrs["data-build-in"],
            "data-build-in",
          ),
          value2 = callback(
            input.attrs["data-build-out"],
            "data-build-out",
          );
        if (value === undefined && value2 === undefined) {
          return;
        }
        let state: FrameBuild = {};
        if (value !== undefined) {
          state.in = value;
        }
        if (value2 !== undefined) {
          state.out = value2;
        }
        return state;
      }
    };
    diagnosticCssPropertyName = (input) =>
      diagnosticCssPropertyNames[input] ?? input;
    diagnosticHtmlTagLabel = (input) =>
      "tag" in input && typeof input.tag === "string"
        ? "<" + String(input.tag) + "> "
        : "";
    svgTagTokenPattern = (input) =>
      input
        ? /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[A-Za-z_:][\w:.-]*(?:\s*=\s*(?:"[^"<]*"|'[^'<]*'|[^\s"'<>=`]+))?)*)\s*(\/?)>/y
        : /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[A-Za-z_:][\w:.-]*(?:\s*=\s*(?:"[^"<>]*"|'[^'<>]*'|[^\s"'<>=`]+))?)*)\s*(\/?)>/y;
    svgAttributeTokenPattern = (input) =>
      input
        ? /(\s+)([A-Za-z_:][\w:.-]*)(?:\s*=\s*(?:"([^"<]*)"|'([^'<]*)'|([^\s"'<>=`]+)))?/g
        : /(\s+)([A-Za-z_:][\w:.-]*)(?:\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)'|([^\s"'<>=`]+)))?/g;
    svgNamespace = "http://www.w3.org/2000/svg";
    xlinkNamespace = "http://www.w3.org/1999/xlink";
    isInvalidXmlCodePoint = (input) =>
      input < 32
        ? input !== 9 && input !== 10 && input !== 13
        : input === 65534 ||
          input === 65535 ||
          (input >= 55296 && input <= 57343) ||
          input > 1114111;
    elementInlineStyle = (input) =>
      input.attrs.style ?? inheritedInlineStyles.get(input);
    estimatedGlyphWidthFactor = 0.5;
    estimatedLongWordWidthFactor = 0.55;
    iconPlaceholderLabel = (input) =>
      "[icon: " + (0, runtime.truncateUtf16Safely)(input, 40) + "]";
    genericIconPlaceholderLabel = "[icon]";
    elementPlaceholderLabel = (input) =>
      input.tag === "x-shape"
        ? "[shape: " +
          ((0, runtime.truncateUtf16Safely)(
            (input.attrs.kind ?? "").trim(),
            20,
          ) || "rect") +
          "]"
        : input.tag === "img"
          ? "[image]"
          : input.tag === "svg"
            ? "[drawing]"
            : input.tag === "x-connector"
              ? "[line]"
              : input.tag === "hr"
                ? "[rule]"
                : "[" + input.tag.replace(/^x-/, "") + "]";
    simpleCssColorSource =
      "(#[0-9a-f]{3,8}|rgba?\\([0-9., %]{1,40}\\)|[a-z]{3,24})";
    initializeHtmlCompiler = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeVideoLinks)();
      (0, runtime.initializeStyleSchema)();
      (0, runtime.initializeSlideTypeScales)();
      (0, runtime.initializeCssValueParser)();
      slideHtmlPrefixPattern = /^\s*(?:<!doctype|<html|<section|<\!--)/i;
      htmlVoidElementNames = new Set([
        "br",
        "img",
        "hr",
        "link",
        "meta",
        "input",
        "source",
        "wbr",
        "col",
        "embed",
        "param",
        "track",
        "area",
        "base",
      ]);
      htmlRawTextElementNames = new Set([
        "style",
        "script",
        "title",
        "textarea",
        "x-embed",
      ]);
      htmlBlockElementNames = new Set([
        "p",
        "div",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "table",
        "section",
        "hr",
        "aside",
        "x-shape",
        "x-icon",
        "x-connector",
        "blockquote",
        "pre",
        "figure",
        "header",
        "footer",
        "nav",
        "main",
        "article",
      ]);
      htmlOptionalClosingElementNames = new Set([
        "p",
        "li",
        "td",
        "th",
        "tr",
        "thead",
        "tbody",
        "tfoot",
        "option",
        "dt",
        "dd",
      ]);
      htmlNamedEntities = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: " ",
        ensp: " ",
        emsp: " ",
        thinsp: " ",
        ndash: "–",
        mdash: "—",
        lsquo: "‘",
        rsquo: "’",
        sbquo: "‚",
        ldquo: "“",
        rdquo: "”",
        bdquo: "„",
        hellip: "…",
        bull: "•",
        middot: "·",
        copy: "©",
        reg: "®",
        trade: "™",
        deg: "°",
        times: "×",
        divide: "÷",
        plusmn: "±",
        laquo: "«",
        raquo: "»",
        lsaquo: "‹",
        rsaquo: "›",
        euro: "€",
        pound: "£",
        yen: "¥",
        cent: "¢",
        sect: "§",
        para: "¶",
        dagger: "†",
        Dagger: "‡",
        permil: "‰",
        prime: "′",
        Prime: "″",
        larr: "←",
        rarr: "→",
        uarr: "↑",
        darr: "↓",
        harr: "↔",
        rArr: "⇒",
        lArr: "⇐",
        hArr: "⇔",
        check: "✓",
        minus: "−",
        frac12: "½",
        frac14: "¼",
        frac34: "¾",
        sup2: "²",
        sup3: "³",
        micro: "µ",
        ne: "≠",
        le: "≤",
        ge: "≥",
        infin: "∞",
        asymp: "≈",
        equiv: "≡",
        shy: "­",
        zwj: "‍",
        zwnj: "‌",
        iexcl: "¡",
        iquest: "¿",
        szlig: "ß",
        eacute: "é",
        egrave: "è",
        ecirc: "ê",
        agrave: "à",
        aacute: "á",
        acirc: "â",
        atilde: "ã",
        auml: "ä",
        aring: "å",
        ccedil: "ç",
        iacute: "í",
        igrave: "ì",
        icirc: "î",
        iuml: "ï",
        ntilde: "ñ",
        oacute: "ó",
        ograve: "ò",
        ocirc: "ô",
        otilde: "õ",
        ouml: "ö",
        oslash: "ø",
        uacute: "ú",
        ugrave: "ù",
        ucirc: "û",
        uuml: "ü",
        yacute: "ý",
        yuml: "ÿ",
        Eacute: "É",
        Agrave: "À",
        Aacute: "Á",
        Auml: "Ä",
        Ouml: "Ö",
        Uuml: "Ü",
        Ccedil: "Ç",
        Ntilde: "Ñ",
        aelig: "æ",
        AElig: "Æ",
        oelig: "œ",
        OElig: "Œ",
        alpha: "α",
        beta: "β",
        gamma: "γ",
        delta: "δ",
        pi: "π",
        sigma: "σ",
        omega: "ω",
        Delta: "Δ",
        Sigma: "Σ",
        Omega: "Ω",
        lambda: "λ",
        mu: "μ",
        theta: "θ",
        star: "☆",
        starf: "★",
        hearts: "♥",
        spades: "♠",
        clubs: "♣",
        diams: "♦",
        loz: "◊",
      };
      HtmlParseError = class value extends Error {
        line: number;
        col: number;
        constructor(input: string, options: number, context: number) {
          super(input);
          this.line = options;
          this.col = context;
        }
      };
      cssBoxSideNames = ["top", "right", "bottom", "left"];
      cssBorderSideWidthFields = {
        top: "borderTopWidth",
        right: "borderRightWidth",
        bottom: "borderBottomWidth",
        left: "borderLeftWidth",
      };
      containerPaddingBounds = {
        lo: 0,
        hi: 512,
      };
      slideBoxShadowBounds = (0, runtime.shadowSchemaBounds)(
        runtime.stylePropertyRegistry.boxShadow.slidesValue,
      );
      shapeStrokeBounds = {
        lo: 0,
        hi: runtime.maxShapeStrokeWidth,
      };
      diagnosticCssPropertyNames = {
        "min-width-fit": "min-width",
        "background-gradient": "background",
        "background-image-src": "background: url()",
        "text-fill-transparent": "-webkit-text-fill-color",
        "text-fill-current": "-webkit-text-fill-color",
        "text-stroke-width": "-webkit-text-stroke",
        "text-stroke-color": "-webkit-text-stroke",
      };
      connectorAttributeNames = new Set([
        "x1",
        "y1",
        "x2",
        "y2",
        "head",
        "head-start",
        "head-end",
        "route",
        "from",
      ]);
      videoAttributeNames = new Set([
        "src",
        "poster",
        "aria-label",
        "title",
        "alt",
        "width",
        "height",
        "autoplay",
        "loop",
        "muted",
        "playsinline",
        "preload",
        "data-video-start",
        "data-video-delay",
        "data-video-sound",
        "data-video-at",
        "data-crop",
      ]);
      imageVideoAttributeNames = new Set([
        "data-video",
        "data-video-start",
        "data-video-delay",
        "data-video-sound",
        "data-video-at",
        ...runtime.videoProviders.map(
          (input) => "data-video-" + input,
        ),
      ]);
      blockTextElementNames = new Set([
        "h1",
        "h2",
        "h3",
        "p",
        "ul",
        "ol",
        "table",
      ]);
      cssAlignmentMap = {
        "flex-start": "start",
        start: "start",
        center: "center",
        "flex-end": "end",
        end: "end",
        stretch: "stretch",
        baseline: "baseline",
        normal: "stretch",
        "self-start": "start",
        "self-end": "end",
        left: "start",
        right: "end",
      };
      cssJustificationMap = {
        "flex-start": "start",
        start: "start",
        left: "start",
        center: "center",
        "flex-end": "end",
        end: "end",
        right: "end",
        "space-between": "between",
        "space-around": "around",
        "space-evenly": "evenly",
        normal: "start",
      };
      genericFontFallbackKinds = {
        serif: "serif",
        "ui-serif": "serif",
        "sans-serif": "sans",
        "system-ui": "sans",
        "ui-sans-serif": "sans",
        monospace: "mono",
        "ui-monospace": "mono",
        "ui-rounded": "sans",
        cursive: "serif",
        fantasy: "sans",
        math: "serif",
        emoji: "sans",
        "-apple-system": "sans",
        blinkmacsystemfont: "sans",
      };
      webSafeFontAliases = {
        georgia: {
          family: "Georgia",
          fallback: "serif",
          basic: true,
        },
        "times new roman": {
          family: "Times New Roman",
          fallback: "serif",
          basic: true,
        },
        times: {
          family: "Times New Roman",
          fallback: "serif",
          basic: true,
        },
        palatino: {
          family: "Palatino",
          fallback: "serif",
        },
        "palatino linotype": {
          family: "Palatino",
          fallback: "serif",
        },
        garamond: {
          family: "Garamond",
          fallback: "serif",
        },
        baskerville: {
          family: "Baskerville",
          fallback: "serif",
        },
        didot: {
          family: "Didot",
          fallback: "serif",
        },
        "book antiqua": {
          family: "Book Antiqua",
          fallback: "serif",
        },
        cambria: {
          family: "Cambria",
          fallback: "serif",
        },
        arial: {
          family: "Arial",
          fallback: "helvetica",
          basic: true,
        },
        helvetica: {
          family: "Helvetica",
          fallback: "helvetica",
        },
        "helvetica neue": {
          family: "Helvetica Neue",
          fallback: "helvetica",
        },
        verdana: {
          family: "Verdana",
          fallback: "sans",
          basic: true,
        },
        tahoma: {
          family: "Tahoma",
          fallback: "sans",
          basic: true,
        },
        "trebuchet ms": {
          family: "Trebuchet MS",
          fallback: "sans",
          basic: true,
        },
        "gill sans": {
          family: "Gill Sans",
          fallback: "sans",
        },
        futura: {
          family: "Futura",
          fallback: "sans",
        },
        avenir: {
          family: "Avenir",
          fallback: "sans",
        },
        "avenir next": {
          family: "Avenir Next",
          fallback: "sans",
        },
        optima: {
          family: "Optima",
          fallback: "sans",
        },
        calibri: {
          family: "Calibri",
          fallback: "sans",
        },
        "segoe ui": {
          family: "Segoe UI",
          fallback: "sans",
        },
        roboto: {
          family: "Roboto",
          fallback: "sans",
        },
        impact: {
          family: "Impact",
          fallback: "sans",
          basic: true,
        },
        "comic sans ms": {
          family: "Comic Sans MS",
          fallback: "sans",
          basic: true,
        },
        "brush script mt": {
          family: "Brush Script MT",
          fallback: "serif",
          basic: true,
        },
        "courier new": {
          family: "Courier New",
          fallback: "mono",
          basic: true,
        },
        courier: {
          family: "Courier New",
          fallback: "mono",
          basic: true,
        },
        menlo: {
          family: "Menlo",
          fallback: "mono",
        },
        monaco: {
          family: "Monaco",
          fallback: "mono",
        },
        consolas: {
          family: "Consolas",
          fallback: "mono",
        },
        "lucida console": {
          family: "Lucida Console",
          fallback: "mono",
        },
        "sf mono": {
          family: "SF Mono",
          fallback: "mono",
        },
      };
      webSafeFallbackFaces = {
        sans: "Arial",
        helvetica: "Arial",
        serif: "Georgia",
        mono: "Courier New",
      };
      specialGenericFontFaces = {
        cursive: "Brush Script MT",
        fantasy: "Impact",
      };
      supportedSlideHtmlElementNames = new Set([
        "h1",
        "h2",
        "h3",
        "p",
        "div",
        "ul",
        "ol",
        "table",
        "img",
        "video",
        "x-shape",
        "x-icon",
        "x-connector",
        "hr",
        "span",
        "aside",
        "section",
        "svg",
        "x-embed",
        "h4",
        "h5",
        "h6",
        "blockquote",
        "figure",
        "pre",
        "header",
        "footer",
        "nav",
        "main",
        "article",
      ]);
      supportedInlineElementNames = new Set([
        "b",
        "strong",
        "i",
        "em",
        "u",
        "a",
        "span",
        "br",
      ]);
      inlineFormatElementNames = new Set(["b", "strong", "i", "em", "u"]);
      flattenableInlineElementNames = new Set([
        "s",
        "code",
        "small",
        "sup",
        "sub",
        "mark",
        "del",
        "ins",
        "abbr",
        "cite",
        "q",
        "kbd",
        "var",
        "time",
        "label",
        "font",
        "big",
        "tt",
        "dfn",
        "samp",
        "wbr",
        "nobr",
      ]);
      unsafeSvgMarkupRules = [
        [/<script\b/i, "may not contain <script>"],
        [/<foreignObject\b/i, "may not contain <foreignObject>"],
        [/javascript:/i, "may not reference javascript:"],
        [
          /<(iframe|embed|object|video|audio)\b/i,
          "may not contain iframe/embed/object/video/audio",
        ],
        [
          /(?<![\w-])(?:xlink:)?href\s*=\s*(?:["']\s*(?!#|data:image\/(?:png|jpe?g|gif|webp|avif|bmp)[;,])|(?!["'\s])(?!#|data:image\/(?:png|jpe?g|gif|webp|avif|bmp)[;,]))/i,
          'may only reference local ids (href="#…") or data:image/png|jpeg|gif|webp|avif — no URLs',
        ],
        [
          /@import|(?:-webkit-)?image-set\s*\(|\bsrc\s*\(|cross-fade\s*\(|url\(\s*(?:["']\s*(?!#|data:image\/(?:png|jpe?g|gif|webp|avif|bmp)[;,])|(?!["'\s])(?!#|data:image\/(?:png|jpe?g|gif|webp|avif|bmp)[;,]))/i,
          "styles may not import or reference URLs",
        ],
        [
          /&[a-z][a-z0-9]{1,31};/i,
          "may not use a named character reference this format does not know (write &#…; instead)",
        ],
        [
          /<!ENTITY|<!DOCTYPE/i,
          "may not declare entities, or a doctype that has an internal subset",
        ],
      ];
      unsupportedSvgAnimationRules = [
        [
          /<(animate|set|animateMotion|animateTransform|animateColor)\b/i,
          "may not contain SMIL animation elements",
        ],
      ];
      nonRenderingSvgElementNames = new Set([
        "style",
        "animate",
        "set",
        "animatemotion",
        "animatetransform",
        "animatecolor",
      ]);
      forbiddenSvgElementNames = new Set([
        "style",
        "script",
        "foreignobject",
        "iframe",
        "embed",
        "object",
        "video",
        "audio",
        "animate",
        "set",
        "animatemotion",
        "animatetransform",
        "animatecolor",
        "discard",
        "handler",
        "listener",
        "prefetch",
        "tref",
        "cursor",
        "b",
        "big",
        "blockquote",
        "body",
        "br",
        "center",
        "code",
        "dd",
        "div",
        "dl",
        "dt",
        "em",
        "embed",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "head",
        "hr",
        "i",
        "img",
        "li",
        "listing",
        "menu",
        "meta",
        "nobr",
        "ol",
        "p",
        "pre",
        "ruby",
        "s",
        "small",
        "span",
        "strong",
        "strike",
        "sub",
        "sup",
        "table",
        "tt",
        "u",
        "ul",
        "var",
        "font",
        "math",
        "template",
        "html",
        "frame",
        "frameset",
        "form",
        "input",
        "button",
        "link",
        "base",
        "noscript",
        "xmp",
        "plaintext",
      ]);
      svgExternalResourceAttributes = new Set([
        "src",
        "srcset",
        "srcdoc",
        "data",
        "action",
        "formaction",
        "poster",
        "ping",
        "codebase",
        "background",
        "longdesc",
        "manifest",
        "cite",
        "profile",
        "usemap",
        "dynsrc",
        "lowsrc",
      ]);
      htmlWindows1252CodePoints = {
        128: 8364,
        130: 8218,
        131: 402,
        132: 8222,
        133: 8230,
        134: 8224,
        135: 8225,
        136: 710,
        137: 8240,
        138: 352,
        139: 8249,
        140: 338,
        142: 381,
        145: 8216,
        146: 8217,
        147: 8220,
        148: 8221,
        149: 8226,
        150: 8211,
        151: 8212,
        152: 732,
        153: 8482,
        154: 353,
        155: 8250,
        156: 339,
        158: 382,
        159: 376,
      };
      htmlCompilerCounters = {
        fillWalks: 0,
        commentScans: 0,
      };
      inheritedInlineStyles = new WeakMap();
      compileWarningCodes = [
        [/% of the parent is not supported inside a div/, "percent-width"],
        [/width:100%.* kept as (align|justify)-self:stretch/, "width-stretch"],
        [/px converted to/, "line-height-px"],
        [/pt converted to px/, "font-size-pt"],
        [/text directly inside <(div|section)> — wrapped in <p>/, "bare-text"],
        [
          /is not position:relative — treated as position:relative/,
          "overlay-host",
        ],
        [
          /its positioned children are pinned to that div directly/,
          "nested-layer-flattened",
        ],
        [/<hr> without width — drawn to the right edge/, "hr-width"],
        [/is ignored — a table is as tall as its rows/, "table-height"],
        [/\*-reverse — children are reordered/, "flex-reverse"],
        [/<img> without alt/, "img-alt"],
        [
          /<svg> is drawn as an image, which is read as XML — respelled for it/,
          "svg-xml",
        ],
        [/<video> without aria-label|<iframe> without title/, "video-label"],
        [/<img> without src/, "img-src"],
        [/<(img|video)> inside a div without width\/height/, "img-size"],
        [/flow <x-connector> without width\/height/, "connector-size"],
        [/gap\/justify on an overlay host/, "overlay-host"],
        [/empty and unpainted — dropped/, "empty-div"],
        [
          /^(class|title|role|lang|dir|tabindex|draggable|contenteditable|aria-[\w-]+|data-[\w-]+) attribute is not in this format/,
          "attribute",
        ],
        [/ applies to a section's position:absolute children only/, "flow-id"],
        [/<br> inside <li>/, "li-br"],
        [
          /is ignored when both .* are set \(they define the size\)/,
          "size-with-edges",
        ],
        [
          /layout properties \(display\/gap\/padding\) do nothing/,
          "section-layout",
        ],
        [/table font-size/, "table-size"],
        [/text-align on <table>/, "table-align"],
        [
          /text-align differs from the first cell in this column/,
          "table-align",
        ],
        [/padding differs from the table's cell padding/, "table-padding"],
        [/font-weight differs from the first <th>/, "table-header-weight"],
        [/column widths apply only when EVERY/, "table-widths"],
        [/display:none — the element is removed/, "display-none"],
        [/text-decoration style\/color without a line/, "text-decoration"],
        [/is dropped \(scripts never run here\)/, "event-attribute"],
        [/<link rel="\w+"> is not in this format/, "head-link"],
        [/style on <aside> is ignored/, "aside-style"],
        [/duplicate id .* on this slide/, "duplicate-id"],
        [/id=".*" — letters, digits/, "bad-id"],
        [/is not a usable family name/, "font-family-name"],
        [/is declared twice/, "font-declared-twice"],
        [/names no basic face/, "font-web-safe"],
        [/: % of the parent is not supported/, "percent-width"],
        [
          /text-shadow is not drawn on gradient\/image text/,
          "text-fill-shadow",
        ],
      ];
      importedHtmlTypeScale = {
        h1: {
          size: 96,
          weight: 600,
          lh: 1.1,
        },
        h2: {
          size: 64,
          weight: 600,
          lh: 1.15,
        },
        h3: {
          size: 44,
          weight: 600,
          lh: 1.2,
        },
        p: {
          size: 32,
          weight: 400,
          lh: 1.4,
        },
      };
      htmlHeadingNames = new Set(["h1", "h2", "h3"]);
      slideHtmlIconNames = runtime.slideIconNames.filter(
        (input) => input !== "Ant" && input !== "Owl",
      );
      mediaHtmlElementNames = new Set([
        "x-shape",
        "x-connector",
        "img",
        "video",
        "svg",
        "x-embed",
        "hr",
      ]);
      neutralHtmlShadowPresets = {
        subtle: {
          y: 2,
          blur: 8,
          color: "#0000001f",
        },
        medium: {
          y: 6,
          blur: 20,
          color: "#00000029",
        },
        strong: {
          y: 12,
          blur: 40,
          color: "#0000003d",
        },
      };
      htmlTagTextRoles = {
        h1: "h1",
        h2: "h2",
        h3: "h3",
        p: "body",
        span: "body",
        li: "body",
        ul: "body",
        ol: "body",
      };
      transparentContainerBorderPattern = new RegExp(
        "^(none|0|0px|\\d{1,2}(\\.\\d{1,2})?px solid " +
          simpleCssColorSource +
          ")$",
        "i",
      );
      noBorderPattern = /^(none|0|0px)$/i;
      transparentContainerFillPattern = new RegExp(
        "^" + simpleCssColorSource + "$",
        "i",
      );
      transparentContainerStylePatterns = new Map([
        ["width", /^\d{1,4}(\.\d{1,2})?px$/i],
        ["height", /^(0|\d{1,4}(\.\d{1,2})?px)$/i],
        ["border", noBorderPattern],
        ["border-top", transparentContainerBorderPattern],
        ["border-bottom", transparentContainerBorderPattern],
        ["border-left", noBorderPattern],
        ["border-right", noBorderPattern],
        ["background", transparentContainerFillPattern],
        ["background-color", transparentContainerFillPattern],
      ]);
      fontFaceRulesPattern = /@font-face\s*\{([^{}]*)\}/gi;
    });
  };
}
