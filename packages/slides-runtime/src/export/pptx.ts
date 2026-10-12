/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  Alignment,
  BlendModeValue,
  BorderStyleValue,
  FontFamilyValue,
  GradientStop,
  GradientValue,
  ImageCrop,
  ShadowValue,
  TextAlignment,
  TextDecorationStyleValue,
  TextFill,
  TextFit,
  TextMark,
  TextRole,
  TextTransformValue,
} from "../deck-contracts";

/** The pptxgenjs presentation class (patched at build time) that `runtime.PptxPresentation` constructs. */
type PptxPresentationInstance = InstanceType<
  RuntimeBindings["PptxPresentation"]
>;

// ---------------------------------------------------------------------------
// Geometry (slide pixels unless a name says otherwise).
// ---------------------------------------------------------------------------

/** Rectangle in slide pixels; `rotate` is a clockwise angle in degrees. */
export interface PptxRect {
  x: number;
  y: number;
  w: number;
  h: number;
  rotate?: number;
}
export interface PptxCornerRadii {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}
export type PptxBorderSide = "top" | "right" | "bottom" | "left";
/** Per-side offsets; absent sides count as 0. */
export type PptxSideInsets = Partial<Record<PptxBorderSide, number>>;
export type PptxSideWidths = Record<PptxBorderSide, number>;
/** A rectangle drawn in a canvas of at least the shape size, as used for corner cut-outs. */
export interface PptxCutoutCanvas {
  /** Canvas width and height. */
  W: number;
  H: number;
  /** Offset of the shape inside the canvas. */
  x: number;
  y: number;
}
/** A point as an [x, y] pair. */
type PptxPointPair = [number, number];
/** Four values in top, right, bottom, left (or corner) order. */
type PptxQuad<T> = [T, T, T, T];
/** Outer corner arc of a border band: where it starts and ends, and its start angle. */
interface PptxArcSegment {
  s: PptxPointPair;
  e: PptxPointPair;
  st: number;
}
/** Inner corner arc of a border band: where it starts and ends, and its start angle. */
interface PptxInsetSegment {
  a: PptxPointPair;
  b: PptxPointPair;
  st: number;
}
/** One corner arc of a rounded cut-out: its end points, radius and angles (degrees). */
interface PptxCutoutArc {
  from: PptxPointPair;
  to: PptxPointPair;
  r: number;
  stAng: number;
  swAng: number;
}
export interface PptxArcCurve {
  type: "arc";
  wR: number;
  hR: number;
  stAng: number;
  swAng: number;
}
/** The step that closes a custom geometry path. */
export interface PptxClosePoint {
  close: true;
}
/** A straight-line or move-to point of a custom geometry path. */
export interface PptxLinePoint {
  x: number;
  y: number;
  moveTo?: boolean;
}
/** A point reached along an arc. */
export interface PptxArcPoint {
  x: number;
  y: number;
  curve: PptxArcCurve;
}
export type PptxDrawPoint = PptxLinePoint | PptxArcPoint;
export type PptxPathPoint = PptxClosePoint | PptxDrawPoint;

// ---------------------------------------------------------------------------
// Measured deck consumed by the exporter (produced by deck measurement).
// ---------------------------------------------------------------------------

/** Corner rounding of a measured leaf: one uniform radius, per-corner radii, or a clipped (rounded) outline. */
export interface PptxCornerRounding {
  radius?: number;
  corners?: PptxCornerRadii;
  clipRounded?: boolean;
}
export interface PptxBorder {
  style: BorderStyleValue;
  width?: number;
  color?: string;
  /** Space-separated list of the sides that carry the border. */
  sides?: string;
  widths?: Record<string, number | undefined>;
}
export interface PptxUnderline {
  style?: TextDecorationStyleValue;
  color?: string;
}
export type PptxAlign = "left" | "center" | "right" | "justify";
export type PptxVerticalAlign = "top" | "middle" | "bottom";
export interface PptxBoxLeaf extends PptxCornerRounding {
  kind: "box";
  rect: PptxRect;
  fill?: string;
  gradient?: GradientValue;
  border?: PptxBorder;
  shadow?: ShadowValue;
  opacity?: number;
  blend?: BlendModeValue;
}
export interface PptxTextLeaf {
  kind: "text";
  rect: PptxRect;
  role: TextRole;
  text: string;
  color?: string;
  align?: TextAlignment;
  /** The box the text sits in, exported together with it. */
  box?: PptxBoxLeaf;
  /** Inner (content) rectangle of `box`. */
  boxInner?: PptxRect;
  boxAnchor?: PptxVerticalAlign;
  /** Width of the widest laid-out line. */
  lineWidth?: number;
  /** Side the text keeps when its box hugs the text. */
  heldSide?: PptxAlign;
  linesHeight?: number;
  marks?: TextMark[];
  list?: "bullet" | "number";
  listGutter?: number;
  listHang?: number;
  listNumberWidth?: number;
  listOutside?: boolean;
  fontSize?: number;
  fontWeight?: number;
  italic?: boolean;
  underline?: PptxUnderline;
  strike?: boolean;
  fontFamily?: FontFamilyValue;
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: TextTransformValue;
  nowrap?: boolean;
  opacity?: number;
  fit?: TextFit;
  fitScale?: number;
  textFill?: TextFill;
  /** A web embed that could not be rendered, shown as placeholder text. */
  embedPlaceholder?: boolean;
}
export interface PptxImageLeaf extends PptxCornerRounding {
  kind: "img";
  rect: PptxRect;
  dataUri?: string;
  fit: "cover" | "contain";
  alt?: string;
  crop?: ImageCrop;
  naturalW?: number;
  naturalH?: number;
  opacity?: number;
  border?: PptxBorder;
  shadow?: ShadowValue;
}
/** The frame (box) a table sits in. */
export interface PptxTableFrame extends PptxCornerRounding {
  rect: PptxRect;
  borders: PptxSideWidths;
}
/** A colour (with optional opacity) painted behind a table. */
export interface PptxTableGround {
  color: string;
  opacity?: number;
}
export interface PptxTableLeaf {
  kind: "table";
  rect: PptxRect;
  frame?: PptxTableFrame;
  openTopLeft?: boolean;
  rowHeights?: number[];
  rows: string[][];
  cols: number;
  header: boolean;
  colWidths?: number[];
  colAligns?: Alignment[];
  cellStyles?: Record<string, { color: string }>;
  rowStyles?: Record<string, { background: string }>;
  cellPadding?: { x?: number; y?: number };
  headerWeight?: number;
  role?: TextRole;
  fontFamily?: FontFamilyValue;
  fontSize?: number;
  color?: string;
  backgrounds?: PptxTableGround[];
  fitScale?: number;
}
export type PptxLeaf = PptxTextLeaf | PptxImageLeaf | PptxBoxLeaf | PptxTableLeaf;
export interface PptxSlideData {
  /** Slide background colour (name or hex). */
  bg?: string;
  /** Data URI of a slide background picture shared with other slides. */
  backdrop?: string;
  /** Flattened colour behind `backdrop`. */
  ground?: string;
  leaves: PptxLeaf[];
  notes?: string;
}
export interface PptxExportDeck {
  title: string;
  slides: PptxSlideData[];
  /** Warnings collected while measuring the deck. */
  exportNotes?: string[];
}
export interface PptxExportOptions {
  /** Infer a PowerPoint theme and slide master from the deck. */
  theme?: boolean;
  /** Write each slide title into a title placeholder (needs `theme`). */
  titlePlaceholders?: boolean;
}

// ---------------------------------------------------------------------------
// What the exporter hands to PptxGenJS (pixel and point values are already converted).
// ---------------------------------------------------------------------------

/** A PPTX colour (hex without `#`) with optional transparency in percent. */
export interface PptxColor {
  color: string;
  transparency?: number;
}
export interface PptxGradientStop extends PptxColor {
  /** Stop position in percent. */
  position: number;
}
export interface PptxTextGradient {
  stops: PptxGradientStop[];
  angle: number;
}
export interface PptxShapeGradient {
  type: "gradient";
  stops: PptxGradientStop[];
  angle?: number;
  gradientPath?: "circle";
  focus?: { x: number; y: number };
}
export type PptxFill = PptxColor | PptxShapeGradient;
export interface PptxLine extends PptxColor {
  /** Width in points. */
  width: number;
  dashType?: "dash" | "sysDot" | "solid";
}
export interface PptxShadow {
  type: "inner" | "outer";
  color: string;
  opacity: number;
  blur: number;
  offset: number;
  angle: number;
}
/** What `pptxBorderOptions` derives from a border: widths, drawn sides and (when visible) the line. */
export interface PptxBorderOptions {
  /** Widest side width in px. */
  w: number;
  widthOf: (side: string) => number;
  sides: string[] | undefined;
  line?: PptxLine;
}
export interface PptxPositionOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  rotate?: number;
}
export interface PptxShapeOptions extends PptxPositionOptions {
  points?: PptxPathPoint[];
  rectRadius?: number;
  fill?: PptxFill;
  line?: PptxLine;
  shadow?: PptxShadow;
}
export interface PptxBullet {
  type?: "number";
  indent?: number;
  hanging?: number;
}
export interface PptxTextRunOptions {
  bold?: boolean;
  italic?: boolean;
  underline?: PptxTextUnderline;
  color?: string;
  transparency?: number;
  gradientFill?: PptxTextGradient;
  hyperlink?: { url: string };
  bullet?: true | PptxBullet;
  breakLine?: boolean;
}
export interface PptxTextUnderline {
  style: string;
  color?: string | PptxColor;
}
export interface PptxTextDecoration {
  underline?: PptxTextUnderline;
}
export interface PptxTextRun {
  text: string;
  options: PptxTextRunOptions;
}
/** A text run of a leaf: its text plus the marks that cover it. */
export type PptxMarkedRun = Omit<TextMark, "start" | "end"> & { text: string };
/** Position and shape of a text box; text inside a shape also carries the shape's own options. */
export interface PptxTextBoxOptions extends PptxShapeOptions {
  margin: number | number[];
  shape?: string;
}
export interface PptxTextOptions extends PptxTextBoxOptions {
  fontFace: string;
  fontPitchFamily: number;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline?: PptxTextUnderline;
  strike?: "sngStrike";
  charSpacing?: number;
  color: string;
  transparency?: number;
  gradientFill?: PptxTextGradient;
  align: PptxAlign;
  valign: PptxVerticalAlign;
  fit: "none" | "resize" | "shrink";
  wrap: boolean;
  lineSpacing: number;
  placeholderType?: "title";
}
/** How text laid over a box is written: padding, alignment and whether the shape's own path is needed. */
export interface PptxTextInShape {
  ins: PptxSideWidths;
  align: PptxAlign;
  valign: PptxVerticalAlign;
  wrap: boolean;
  path: boolean;
}
/** Left and right room reserved around a text box. */
export interface PptxHorizontalPadding {
  left: number;
  right: number;
}
export interface PptxListIndent {
  marL: number;
  hang: number;
  overhang: number;
}
export interface PptxImageSizing {
  type: "cover" | "contain" | "crop";
  w: number;
  h: number;
  x?: number;
  y?: number;
}
export interface PptxImageOptions extends PptxShapeOptions {
  data: string;
  altText?: string;
  sizing?: PptxImageSizing;
  transparency?: number;
  rounding?: boolean;
}
export type PptxTableBorder =
  | { type: "solid"; color: string; pt: number }
  | { type: "none" };
export interface PptxTableCellOptions {
  lineSpacing: number;
  align?: PptxAlign;
  color?: string;
  bold: boolean;
  fill?: { color: string };
  /** Top, right, bottom, left. */
  border?: [PptxTableBorder, PptxTableBorder, PptxTableBorder, PptxTableBorder];
}
export interface PptxTableCell {
  _type: "tablecell";
  text: string;
  options: PptxTableCellOptions;
}
export interface PptxTableOptions {
  x: number;
  y: number;
  w: number;
  h?: number;
  colW: number[];
  rowH?: number[];
  fontFace: string;
  fontPitchFamily: number;
  fontSize: number;
  color: string;
  valign: PptxVerticalAlign;
  border: PptxTableBorder;
  margin: number | number[];
  autoPage: boolean;
}
/** Text styling for a master placeholder. */
export interface PptxPlaceholderTextOptions extends PptxPositionOptions {
  objectName: string;
  fontFace: string;
  fontSize: number;
  color: string;
  align: "left";
  valign: "top";
  margin: number;
  wrap: boolean;
  lineSpacingMultiple: number;
}
export interface PptxSlideMasterObject {
  placeholder: {
    options: PptxPlaceholderTextOptions & {
      name: string;
      type: "title" | "body";
    };
    text: string;
  };
}
export interface PptxSlideMasterBody {
  emptyPlaceholders: boolean;
  objects: PptxSlideMasterObject[];
}
export interface PptxSlideMasterDefinition extends Partial<PptxSlideMasterBody> {
  title: string;
  background: { color: string } | { data: string };
}
export interface PptxThemeColors {
  dk1: string;
  lt1: string;
  dk2: string;
  lt2: string;
  accent1: string;
  accent2: string;
  accent3: string;
  accent4: string;
  accent5: string;
  accent6: string;
  hlink: string;
  folHlink: string;
}
export interface PptxThemeDefinition {
  name: string;
  headFontFace: string;
  bodyFontFace: string;
  colors: PptxThemeColors;
  dark: boolean;
}
/** The slide surface the exporter writes to (PptxGenJS's `Slide` plus the patched options this exporter passes). */
export interface PptxSlideWriter {
  background?: { color: string };
  addText(text: string | PptxTextRun[], options: PptxTextOptions): unknown;
  addShape(shape: string, options: PptxShapeOptions): unknown;
  addImage(options: PptxImageOptions): unknown;
  addTable(rows: PptxTableCell[][], options: PptxTableOptions): unknown;
  addNotes(notes: string): unknown;
}
/** The presentation surface the exporter writes to (PptxGenJS plus the patched master-object methods). */
export interface PptxPresentationWriter {
  title: string;
  layout: string;
  theme: PptxThemeDefinition;
  masterSlide: { background?: { color: string } };
  defineLayout(layout: { name: string; width: number; height: number }): void;
  defineSlideMaster(master: PptxSlideMasterDefinition): void;
  addMasterObjects(objects: PptxSlideMasterObject[]): void;
  addSlide(props?: { masterName: string }): PptxSlideWriter;
  write(props: { outputType: "blob"; compression: boolean }): Promise<Blob>;
}
export interface PptxBuildResult {
  pptx: PptxPresentationWriter;
  warnings: string[];
}
export interface PptxBlobResult {
  blob: Blob;
  warnings: string[];
}
/** Hook called with the shape that is about to be added for a box; returns true when it wrote the shape itself. */
export type PptxBoxShapeHook = (
  shape: string,
  options: PptxShapeOptions,
  rect: PptxRect,
  radius: number,
) => boolean;

// ---------------------------------------------------------------------------
// Deck-wide theme inference.
// ---------------------------------------------------------------------------

/** Counts keys (and the area they cover) so the most prominent one can be picked. */
export interface PptxWeightedCounter<K> {
  add(key: K | undefined, count?: number, weight?: number): void;
  /** Keys by count, then weight, highest first. */
  ranked(): K[];
  count(key: K): number;
}
/** Typography of one master placeholder. */
export interface PptxPlaceholderStyle {
  rect: PptxRect;
  face: string;
  fontSize: number;
  lineHeight: number;
  color: string;
}
export interface PptxDeckTheme {
  colors: PptxThemeColors;
  dark: boolean;
  headFace: string;
  bodyFace: string;
  background: string;
  title: PptxPlaceholderStyle;
  body: PptxPlaceholderStyle;
}
/** The slice of a rendering type-scale entry the exporter reads. */
interface PptxTypeScale {
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  serifDisplay?: boolean;
}
/** An sRGB colour in 0-1 channels, as the contrast helpers parse it. */
interface PptxContrastColor {
  r: number;
  g: number;
  b: number;
  a: number;
}
/** A title candidate collected while inferring the theme. */
interface PptxTitleSample {
  leaf: PptxTextLeaf;
  ink: string;
  bg: string;
}

export interface PptxGeometryExports {
  unturnedWithin: RuntimeBindings["unrotateRectWithinParent"];
  turnedWithin: RuntimeBindings["rotateRectWithinParent"];
  textInShape: RuntimeBindings["textInShapeOptions"];
  pxToPt: RuntimeBindings["pxToPoints"];
  pxToIn: RuntimeBindings["pxToInches"];
  pptxFontFace: RuntimeBindings["pptxFontFace"];
  pptxFilename: RuntimeBindings["pptxFilename"];
  pptxAlign: RuntimeBindings["pptxTextAlignment"];
  newPresentation: RuntimeBindings["createPptxPresentation"];
  insetRect: RuntimeBindings["insetRect"];
  hexToPptx: RuntimeBindings["hexToPptxColor"];
  deckToPptxBlob: RuntimeBindings["exportPptxBlob"];
  cssColorToPptx: RuntimeBindings["cssToPptxColor"];
  capitalized: RuntimeBindings["capitalizePptxText"];
  buildPptx: RuntimeBindings["buildPptxPresentation"];
  blendOver: RuntimeBindings["blendPptxColors"];
  _test: PptxExportInternals;
  PX_PER_IN: number;
}
export interface PptxExportInternals {
  cornerPath: RuntimeBindings["roundedCornerPath"];
  borderBandPath: RuntimeBindings["roundedBorderBandPath"];
  cornerCut: RuntimeBindings["roundedCornerCutout"];
  letterboxCut: RuntimeBindings["letterboxCutout"];
  slideTitle: RuntimeBindings["exportedSlideTitle"];
  deckLook: RuntimeBindings["inferPptxDeckTheme"];
  textBoxRoom: RuntimeBindings["pptxTextBoxPadding"];
  writtenAlign: RuntimeBindings["writtenPptxAlignment"];
  pptxPitchFamily: RuntimeBindings["pptxFontFamilyPitch"];
}

declare module "../bindings" {
  interface RuntimeBindings {
    pptxGeometryExports: PptxGeometryExports;
    pptxExportInternals: PptxExportInternals;
    /** Slide pixels per inch of the exported presentation. */
    exportPixelsPerInch: number;
    defaultMasterName: string;
    maxMasterNameLength: number;
    /** Text roles tried in order when looking for a slide's title. */
    titleRolePriority: TextRole[];
    maxInferredFontSize: number;
    maxInferredBodyFontSize: number;
    minThemeColorSamples: number;
    chromaticColorThreshold: number;
    themeColorSimilarityThreshold: number;
    capitalizationWordCharacterPattern: RegExp;
    capitalizationApostrophePattern: RegExp;
    capitalizationCjkCharacterPattern: RegExp;
    pptxTextPaddingRatio: number;
    pptxListNumberWidthFactor: number;
    pptxMaximumTextWidth: number;
    pptxTextHugTolerancePx: number;
    pptxTextAlignmentTolerancePx: number;
    pptxShapeTextMarginTolerancePx: number;
    pptxShapeInsetTolerancePx: number;
    pptxTextHeightTolerancePx: number;
    pptxRoundedCornerInsetRatio: number;
    pptxMinimumShapeTextRoom: number;
    pptxTextHugRoomRatio: number;
    pptxTextFillWidthRatio: number;
    pptxTextRoomAllowance: (width: number) => number;
    pptxBoxOverlapTolerancePx: number;
    pptxTextBoxGapTolerancePx: number;
    pptxPaddingByAlignment: (
      alignment: PptxAlign,
      room: number,
    ) => PptxHorizontalPadding;
    pptxPaddingByLeaf: (leaf: PptxTextLeaf) => PptxHorizontalPadding;
    exportBorderSides: PptxBorderSide[];
    initializePptxExport: () => void;
    rotateRectWithinParent: (rect: PptxRect, parent: PptxRect) => PptxRect;
    insetRect: (rect: PptxRect, insets: PptxSideInsets) => PptxRect;
    unrotateRectWithinParent: (rect: PptxRect, parent: PptxRect) => PptxRect;
    pptxPositionEmu: (inches: number) => number;
    pptxLengthEmu: (inches: number) => number;
    pptxRectOptions: (rect: PptxRect) => PptxPositionOptions;
    roundedCornerPath: (
      width: number,
      height: number,
      radii: PptxCornerRadii,
    ) => PptxPathPoint[];
    roundedBorderBandPath: (
      width: number,
      height: number,
      radii: PptxCornerRadii,
      borderWidths: PptxSideWidths,
    ) => PptxPathPoint[];
    insetCornerRadii: (
      radii: PptxCornerRadii,
      insets: number | PptxCornerRadii,
    ) => PptxCornerRadii;
    roundedCornerCutout: (
      width: number,
      height: number,
      inner: PptxRect,
      radii: PptxCornerRadii,
    ) => PptxPathPoint[] | undefined;
    oversizedCornerCutout: (
      width: number,
      height: number,
      radii: PptxCornerRadii,
    ) => PptxPathPoint[] | undefined;
    cornerCutoutCanvas: (
      width: number,
      height: number,
      radii: PptxCornerRadii,
    ) => PptxCutoutCanvas;
    borderBandRects: (
      width: number,
      height: number,
      radii: PptxCornerRadii,
      widths: PptxSideWidths,
    ) => PptxPathPoint[];
    borderSidesHaveRoundedCorners: (
      sides: string[],
      radii: PptxCornerRadii,
    ) => boolean;
    translatePptxPath: (
      path: PptxPathPoint[],
      deltaX: number,
      deltaY: number,
    ) => PptxPathPoint[];
    pptxPathToEmu: (path: PptxPathPoint[]) => PptxPathPoint[];
    letterboxCutout: (
      width: number,
      height: number,
      inset: { x: number; y: number },
      radii: PptxCornerRadii,
    ) => PptxPathPoint[] | undefined;
    pxToInches: (px: number) => number;
    pxToPoints: (px: number) => number;
    hexToPptxColor: (color: string) => PptxColor;
    readHexColorByte: (hex: string, offset: number) => number;
    blendPptxColors: (
      color: string,
      background: string,
      opacity: number,
    ) => string;
    flattenedSlideBackground: (color?: string) => string;
    pptxTextDecoration: (decoration?: PptxUnderline) => PptxTextDecoration;
    cssToPptxColor: (color: string) => PptxColor | undefined;
    pptxFontFace: (role: TextRole, font?: FontFamilyValue) => string;
    pptxFontFamilyPitch: (role: TextRole, font?: FontFamilyValue) => number;
    pptxTextAlignment: (alignment?: TextAlignment) => PptxAlign;
    pptxFilename: (title: string) => string;
    exportedSlideTitle: (slide: PptxSlideData) => PptxTextLeaf | undefined;
    createWeightedCounter: <K = string>() => PptxWeightedCounter<K>;
    pptxColorLuminance: (color: string) => number;
    pptxColorIsChromatic: (color: string) => boolean;
    medianNumber: (values: Iterable<number>) => number;
    pptxColorsNear: (color: string, otherColor: string) => boolean;
    pptxLargeTextHasContrast: (color: string, background: string) => boolean;
    exportLeafPaintsBackground: (leaf: PptxLeaf) => boolean;
    textLeafOverlapsPaint: (
      leaf: PptxTextLeaf,
      painted: readonly { rect: PptxRect }[],
    ) => boolean;
    inferPptxDeckTheme: (
      deck: { slides: PptxSlideData[] },
      ground?: string,
    ) => PptxDeckTheme;
    visiblePptxColor: (color?: PptxColor) => string | undefined;
    mostFrequentPptxValue: <T>(values: Iterable<T>) => T | undefined;
    pptxPlaceholderTextOptions: (
      placeholder: PptxPlaceholderStyle,
      objectName: string,
    ) => PptxPlaceholderTextOptions;
    pptxSlideMaster: (
      theme: Pick<PptxDeckTheme, "title" | "body">,
    ) => PptxSlideMasterBody;
    pptxMasterForBackdrop: (
      theme: PptxDeckTheme,
      deck: { slides: PptxSlideData[] },
      slide: PptxSlideData,
    ) => PptxDeckTheme;
    createPptxPresentation: (title: string) => PptxPresentationInstance;
    buildPptxPresentation: (
      deck: PptxExportDeck,
      options?: PptxExportOptions,
    ) => PptxBuildResult;
    pptxGradientStops: (
      stops: GradientStop[],
      opacity: number,
    ) => PptxGradientStop[] | undefined;
    applyPptxTextFill: (
      fill: TextFill | undefined,
      textOptions: number,
      leaf: boolean,
      warnings: string[],
      location2: string,
    ) => PptxTextGradient | undefined;
    capitalizePptxText: (text: string) => string;
    pptxListOptions: (
      leaf: PptxTextLeaf,
      fontSize: number,
    ) => PptxListIndent | undefined;
    textBoxHugsOrFills: (leaf: PptxTextLeaf) => "hugs" | "full" | undefined;
    writtenPptxAlignment: (leaf: PptxTextLeaf) => PptxAlign;
    textBoxAvailableRoom: (
      leaf: PptxTextLeaf,
      slide: PptxLeaf[],
    ) => PptxHorizontalPadding;
    pptxTextBoxPadding: (
      leaf: PptxTextLeaf,
      slide: PptxLeaf[],
    ) => PptxHorizontalPadding;
    textInShapeOptions: (
      leaf: PptxTextLeaf,
      shape: PptxRect,
      fontSize: number,
      lineHeight: number,
      warnings: number,
      location2: PptxAlign,
    ) => PptxTextInShape | undefined;
    writePptxText: (
      slide: PptxSlideWriter,
      leaf: PptxTextLeaf,
      warnings: string | undefined,
      assets: string[],
      background: string,
      theme: PptxLeaf[],
      inShape?: boolean,
    ) => void;
    writePptxImage: (
      slide: PptxSlideWriter,
      leaf: PptxImageLeaf,
      warnings: string[],
    ) => void;
    applyPptxOpacity: (color: PptxColor, opacity: number) => PptxColor;
    exportedBorderSideWidth: (
      border: PptxBorder | undefined,
      side: string,
    ) => number;
    pptxBorderOptions: (
      border: PptxBorder | undefined,
      color: string[],
      rect: string,
      warnings: string,
      opacity?: number,
    ) => PptxBorderOptions;
    writePptxBorderSides: (
      slide: PptxSlideWriter,
      rect: PptxRect,
      sideWidth: (side: string) => number,
      sides: string[],
      color: PptxColor,
    ) => void;
    pptxShadowOptions: (
      shadow: ShadowValue,
      warnings: string[],
      kind: string,
      location2: string,
      allowInset: boolean,
      opacity?: number,
    ) => PptxShadow | undefined;
    writePptxBox: (
      slide: PptxSlideWriter,
      leaf: PptxBoxLeaf,
      location2: string,
      warnings: string[],
      assets?: PptxBoxShapeHook,
    ) => void;
    writePptxTable: (
      slide: PptxSlideWriter,
      leaf: PptxTableLeaf,
      background: string | undefined,
      warnings: string[],
    ) => void;
    exportPptxBlob: (
      deck: PptxExportDeck,
      options?: PptxExportOptions,
    ) => Promise<PptxBlobResult>;
  }
}

export function installExportPptx(runtime: RuntimeBindings): () => void {
  var pptxGeometryExports: RuntimeBindings["pptxGeometryExports"];
  var pptxExportInternals: RuntimeBindings["pptxExportInternals"];
  var exportPixelsPerInch: RuntimeBindings["exportPixelsPerInch"];
  var defaultMasterName: RuntimeBindings["defaultMasterName"];
  var maxMasterNameLength: RuntimeBindings["maxMasterNameLength"];
  var titleRolePriority: RuntimeBindings["titleRolePriority"];
  var maxInferredFontSize: RuntimeBindings["maxInferredFontSize"];
  var maxInferredBodyFontSize: RuntimeBindings["maxInferredBodyFontSize"];
  var minThemeColorSamples: RuntimeBindings["minThemeColorSamples"];
  var chromaticColorThreshold: RuntimeBindings["chromaticColorThreshold"];
  var themeColorSimilarityThreshold: RuntimeBindings["themeColorSimilarityThreshold"];
  var capitalizationWordCharacterPattern: RuntimeBindings["capitalizationWordCharacterPattern"];
  var capitalizationApostrophePattern: RuntimeBindings["capitalizationApostrophePattern"];
  var capitalizationCjkCharacterPattern: RuntimeBindings["capitalizationCjkCharacterPattern"];
  var pptxTextPaddingRatio: RuntimeBindings["pptxTextPaddingRatio"];
  var pptxListNumberWidthFactor: RuntimeBindings["pptxListNumberWidthFactor"];
  var pptxMaximumTextWidth: RuntimeBindings["pptxMaximumTextWidth"];
  var pptxTextHugTolerancePx: RuntimeBindings["pptxTextHugTolerancePx"];
  var pptxTextAlignmentTolerancePx: RuntimeBindings["pptxTextAlignmentTolerancePx"];
  var pptxShapeTextMarginTolerancePx: RuntimeBindings["pptxShapeTextMarginTolerancePx"];
  var pptxShapeInsetTolerancePx: RuntimeBindings["pptxShapeInsetTolerancePx"];
  var pptxTextHeightTolerancePx: RuntimeBindings["pptxTextHeightTolerancePx"];
  var pptxRoundedCornerInsetRatio: RuntimeBindings["pptxRoundedCornerInsetRatio"];
  var pptxMinimumShapeTextRoom: RuntimeBindings["pptxMinimumShapeTextRoom"];
  var pptxTextHugRoomRatio: RuntimeBindings["pptxTextHugRoomRatio"];
  var pptxTextFillWidthRatio: RuntimeBindings["pptxTextFillWidthRatio"];
  var pptxTextRoomAllowance: RuntimeBindings["pptxTextRoomAllowance"];
  var pptxBoxOverlapTolerancePx: RuntimeBindings["pptxBoxOverlapTolerancePx"];
  var pptxTextBoxGapTolerancePx: RuntimeBindings["pptxTextBoxGapTolerancePx"];
  var pptxPaddingByAlignment: RuntimeBindings["pptxPaddingByAlignment"];
  var pptxPaddingByLeaf: RuntimeBindings["pptxPaddingByLeaf"];
  var exportBorderSides: RuntimeBindings["exportBorderSides"];
  var initializePptxExport: RuntimeBindings["initializePptxExport"];
  function rotateRectWithinParent(rect: PptxRect, parent: PptxRect): PptxRect {
    if (parent.rotate === undefined || parent.rotate % 360 === 0) {
      return rect;
    }
    let angle = (parent.rotate * Math.PI) / 180,
      centerX = parent.x + parent.w / 2,
      centerY = parent.y + parent.h / 2,
      relativeX = rect.x + rect.w / 2 - centerX,
      relativeY = rect.y + rect.h / 2 - centerY,
      rotatedCenterX =
        centerX + relativeX * Math.cos(angle) - relativeY * Math.sin(angle),
      rotatedCenterY =
        centerY + relativeX * Math.sin(angle) + relativeY * Math.cos(angle);
    return {
      x: rotatedCenterX - rect.w / 2,
      y: rotatedCenterY - rect.h / 2,
      w: rect.w,
      h: rect.h,
      rotate: parent.rotate,
    };
  }
  function insetRect(rect: PptxRect, insets: PptxSideInsets): PptxRect {
    let leftInset = insets.left ?? 0,
      topInset = insets.top ?? 0;
    return rotateRectWithinParent(
      {
        x: rect.x + leftInset,
        y: rect.y + topInset,
        w: Math.max(0, rect.w - leftInset - (insets.right ?? 0)),
        h: Math.max(0, rect.h - topInset - (insets.bottom ?? 0)),
      },
      rect,
    );
  }
  function unrotateRectWithinParent(rect: PptxRect, parent: PptxRect): PptxRect {
    if (parent.rotate === undefined || parent.rotate % 360 === 0) {
      return {
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
      };
    }
    let angle = (-parent.rotate * Math.PI) / 180,
      centerX = parent.x + parent.w / 2,
      centerY = parent.y + parent.h / 2,
      relativeX = rect.x + rect.w / 2 - centerX,
      relativeY = rect.y + rect.h / 2 - centerY,
      rotatedCenterX =
        centerX + relativeX * Math.cos(angle) - relativeY * Math.sin(angle),
      rotatedCenterY =
        centerY + relativeX * Math.sin(angle) + relativeY * Math.cos(angle);
    return {
      x: rotatedCenterX - rect.w / 2,
      y: rotatedCenterY - rect.h / 2,
      w: rect.w,
      h: rect.h,
    };
  }
  function pptxPositionEmu(inches: number): number {
    if (inches >= 100) {
      return Math.round(inches * runtime.PPTX_EMU);
    } else {
      return inches;
    }
  }
  function pptxLengthEmu(inches: number): number {
    if (inches * runtime.PPTX_EMU < 100) {
      return 0;
    } else {
      return Math.round(inches * runtime.PPTX_EMU);
    }
  }
  function pptxRectOptions(rect: PptxRect): PptxPositionOptions {
    return {
      x: pptxPositionEmu(pxToInches(rect.x)),
      y: pptxPositionEmu(pxToInches(rect.y)),
      w: pptxPositionEmu(pxToInches(rect.w)),
      h: pptxPositionEmu(pxToInches(rect.h)),
      ...(rect.rotate !== undefined && rect.rotate % 360 !== 0
        ? {
            rotate: ((rect.rotate % 360) + 360) % 360,
          }
        : {}),
    };
  }
  function roundedCornerPath(
    width: number,
    height: number,
    radii: PptxCornerRadii,
  ): PptxPathPoint[] {
    let callback = (input: number): number =>
        Number.isFinite(input) && input > 0 ? input : 0,
      value = Math.min(
        1,
        width / (callback(radii.tl) + callback(radii.tr) || 1),
        width / (callback(radii.bl) + callback(radii.br) || 1),
        height / (callback(radii.tl) + callback(radii.bl) || 1),
        height / (callback(radii.tr) + callback(radii.br) || 1),
      ),
      callback2 = (input: number): number =>
        pxToInches(callback(input) * value),
      {
        tl: state,
        tr: state2,
        br: state3,
        bl: state4,
      } = {
        tl: callback2(radii.tl),
        tr: callback2(radii.tr),
        br: callback2(radii.br),
        bl: callback2(radii.bl),
      },
      value2 = pxToInches(width),
      value3 = pxToInches(height),
      callback3 = (
        input: number,
        options: number,
        context: number,
        value4: number,
      ): PptxDrawPoint[] =>
        context > 0
          ? [
              {
                x: input,
                y: options,
                curve: {
                  type: "arc",
                  hR: context,
                  wR: context,
                  stAng: value4,
                  swAng: 90,
                },
              },
            ]
          : [];
    return [
      {
        x: state,
        y: 0,
        moveTo: true,
      },
      {
        x: value2 - state2,
        y: 0,
      },
      ...callback3(value2, state2, state2, 270),
      {
        x: value2,
        y: value3 - state3,
      },
      ...callback3(value2 - state3, value3, state3, 0),
      {
        x: state4,
        y: value3,
      },
      ...callback3(0, value3 - state4, state4, 90),
      {
        x: 0,
        y: state,
      },
      ...callback3(state, 0, state, 180),
      {
        close: true,
      },
    ];
  }
  function roundedBorderBandPath(
    width: number,
    height: number,
    radii: PptxCornerRadii,
    borderWidths: PptxSideWidths,
  ): PptxPathPoint[] {
    let callback = (input: number): number =>
        Number.isFinite(input) && input > 0 ? input : 0,
      value = Math.min(
        1,
        width / (callback(radii.tl) + callback(radii.tr) || 1),
        width / (callback(radii.bl) + callback(radii.br) || 1),
        height / (callback(radii.tl) + callback(radii.bl) || 1),
        height / (callback(radii.tr) + callback(radii.br) || 1),
      ),
      items: PptxQuad<number> = [
        callback(borderWidths.top),
        callback(borderWidths.right),
        callback(borderWidths.bottom),
        callback(borderWidths.left),
      ],
      [items2, items3, items4, items5] = [
        items[3],
        items[0],
        width - items[1],
        height - items[2],
      ];
    if (!(items4 > items2 && items5 > items3)) {
      return roundedCornerPath(width, height, radii);
    }
    let items6: PptxQuad<number> = [
        callback(radii.tl) * value,
        callback(radii.tr) * value,
        callback(radii.br) * value,
        callback(radii.bl) * value,
      ],
      items7: PptxQuad<PptxArcSegment> = [
        {
          s: [0, items6[0]],
          e: [items6[0], 0],
          st: 180,
        },
        {
          s: [width - items6[1], 0],
          e: [width, items6[1]],
          st: 270,
        },
        {
          s: [width, height - items6[2]],
          e: [width - items6[2], height],
          st: 0,
        },
        {
          s: [items6[3], height],
          e: [0, height - items6[3]],
          st: 90,
        },
      ],
      callback2 = (
        input: number,
        options: number,
        context: number,
      ): PptxPointPair =>
        input - options > 0 && input - context > 0
          ? [input - options, input - context]
          : [0, 0],
      items8: PptxQuad<PptxPointPair> = [
        callback2(items6[0], items2, items3),
        callback2(items6[1], width - items4, items3),
        callback2(items6[2], width - items4, height - items5),
        callback2(items6[3], items2, height - items5),
      ],
      items9: PptxQuad<PptxInsetSegment> = [
        {
          a: [items2, items3 + items8[0][1]],
          b: [items2 + items8[0][0], items3],
          st: 270,
        },
        {
          a: [items4 - items8[1][0], items3],
          b: [items4, items3 + items8[1][1]],
          st: 0,
        },
        {
          a: [items4, items5 - items8[2][1]],
          b: [items4 - items8[2][0], items5],
          st: 90,
        },
        {
          a: [items2 + items8[3][0], items5],
          b: [items2, items5 - items8[3][1]],
          st: 180,
        },
      ],
      callback3 = (input: PptxPointPair, options = false): PptxDrawPoint => ({
        x: pxToInches(input[0]),
        y: pxToInches(input[1]),
        ...(options
          ? {
              moveTo: true,
            }
          : {}),
      }),
      callback4 = (
        input: PptxPointPair,
        options: number,
        context: number,
        value3: number,
        extra: number,
      ): PptxDrawPoint[] =>
        options > 0 && context > 0
          ? [
              {
                x: pxToInches(input[0]),
                y: pxToInches(input[1]),
                curve: {
                  type: "arc",
                  wR: pxToInches(options),
                  hR: pxToInches(context),
                  stAng: value3,
                  swAng: extra,
                },
              },
            ]
          : [],
      value2 = items.map((input) => input > 0);
    if (value2.every(Boolean)) {
      let items11: PptxPathPoint[] = [
        ...roundedCornerPath(width, height, radii),
        callback3(items9[0].b, true),
      ];
      for (let value3 of [0, 3, 2, 1] as const)
        items11.push(
          ...callback4(
            items9[value3].a,
            items8[value3][0],
            items8[value3][1],
            items9[value3].st,
            -90,
          ),
          callback3(items9[(value3 + 3) % 4]!.b),
        );
      return [
        ...items11.slice(0, -1),
        {
          close: true,
        },
      ];
    }
    let items10: PptxPathPoint[] = [];
    for (let index = 0; index < 4; index++) {
      if (!value2[index] || value2[(index + 3) % 4]) {
        continue;
      }
      let value3 = index;
      while (value2[(value3 + 1) % 4]) value3 = (value3 + 1) % 4;
      items10.push(callback3(items9[index]!.a, true));
      let items11: number[] = [];
      for (let value4 = index; ; value4 = (value4 + 1) % 4)
        if ((items11.push(value4), value4 === (value3 + 1) % 4)) {
          break;
        }
      for (let value4 of items11)
        items10.push(
          callback3(items7[value4]!.s),
          ...callback4(
            items7[value4]!.e,
            items6[value4]!,
            items6[value4]!,
            items7[value4]!.st,
            90,
          ),
        );
      for (let value4 of [...items11].reverse())
        items10.push(
          callback3(items9[value4]!.b),
          ...callback4(
            items9[value4]!.a,
            items8[value4]![0],
            items8[value4]![1],
            items9[value4]!.st,
            -90,
          ),
        );
      items10.push({
        close: true,
      });
    }
    return items10;
  }
  function insetCornerRadii(
    radii: PptxCornerRadii,
    insets: number | PptxCornerRadii,
  ): PptxCornerRadii {
    let cornerInsets =
      typeof insets === "number"
        ? {
            tl: insets,
            tr: insets,
            br: insets,
            bl: insets,
          }
        : insets;
    return {
      tl: Math.max(0, radii.tl - cornerInsets.tl),
      tr: Math.max(0, radii.tr - cornerInsets.tr),
      br: Math.max(0, radii.br - cornerInsets.br),
      bl: Math.max(0, radii.bl - cornerInsets.bl),
    };
  }
  function roundedCornerCutout(
    width: number,
    height: number,
    inner: PptxRect,
    radii: PptxCornerRadii,
  ): PptxPathPoint[] | undefined {
    let callback = (input: number): number =>
        Number.isFinite(input) && input > 0 ? input : 0,
      value = Math.min(
        1,
        width / (callback(radii.tl) + callback(radii.tr) || 1),
        width / (callback(radii.bl) + callback(radii.br) || 1),
        height / (callback(radii.tl) + callback(radii.bl) || 1),
        height / (callback(radii.tr) + callback(radii.br) || 1),
      ),
      [items, items2, items3, items4] = [
        callback(inner.x),
        callback(inner.y),
        inner.w,
        inner.h,
      ];
    if (!(items3 > 0 && items4 > 0)) {
      return;
    }
    let callback2 = (input: number): number => (input * 180) / Math.PI,
      callback3 = (input: number): number =>
        Math.min(1, Math.max(-1, input)),
      callback4 = (
        input: number,
        options: boolean,
        context: boolean,
      ): PptxCutoutArc | undefined => {
        let value4 = callback(input) * value,
          [value5, value6] = options
            ? [width - items - items3, width - items]
            : [items, items + items3],
          [value7, value8] = context
            ? [height - items2 - items4, height - items2]
            : [items2, items2 + items4];
        if (!(value4 > value5 && value4 > value7)) {
          return;
        }
        let value9 =
            180 +
            Math.max(
              callback2(
                Math.acos(callback3((value4 - Math.max(0, value5)) / value4)),
              ),
              callback2(Math.asin(callback3((value4 - value8) / value4))),
              0,
            ),
          value10 =
            180 +
            Math.min(
              callback2(Math.acos(callback3((value4 - value6) / value4))),
              callback2(
                Math.asin(callback3((value4 - Math.max(0, value7)) / value4)),
              ),
              90,
            );
        if (!(value10 - value9 > 0.000001)) {
          return;
        }
        let callback6 = (input2: number): PptxPointPair => {
            let [items7, items8] = [
              value4 + value4 * Math.cos((input2 * Math.PI) / 180),
              value4 + value4 * Math.sin((input2 * Math.PI) / 180),
            ];
            return [
              (options ? width - items7 : items7) - items,
              (context ? height - items8 : items8) - items2,
            ];
          },
          value11 = options !== context,
          value12 =
            options && context
              ? value9 + 180
              : options
                ? 180 - value10
                : context
                  ? -value10
                  : value9;
        return {
          from: callback6(value11 ? value10 : value9),
          to: callback6(value11 ? value9 : value10),
          r: value4,
          stAng: ((value12 % 360) + 360) % 360,
          swAng: value10 - value9,
        };
      },
      value2 = [
        callback4(radii.tl, false, false),
        callback4(radii.tr, true, false),
        callback4(radii.br, true, true),
        callback4(radii.bl, false, true),
      ].flatMap(
        (input) => (input !== undefined ? [input] : []),
      );
    if (value2.length === 0) {
      let [items7, items8] = [items + items3 / 2, items2 + items4 / 2],
        callback6 = (
          input: number,
          options: number,
          context: number,
          value4: boolean,
        ): boolean =>
          value4 &&
          Math.hypot(items7 - options, items8 - context) >
            callback(input) * value,
        [items9, items10, items11, items12] = [
          callback(radii.tl) * value,
          callback(radii.tr) * value,
          callback(radii.br) * value,
          callback(radii.bl) * value,
        ];
      if (
        callback6(
          radii.tl,
          items9,
          items9,
          items7 < items9 && items8 < items9,
        ) ||
        callback6(
          radii.tr,
          width - items10,
          items10,
          items7 > width - items10 && items8 < items10,
        ) ||
        callback6(
          radii.br,
          width - items11,
          height - items11,
          items7 > width - items11 && items8 > height - items11,
        ) ||
        callback6(
          radii.bl,
          items12,
          height - items12,
          items7 < items12 && items8 > height - items12,
        )
      ) {
        return [];
      } else {
        return undefined;
      }
    }
    let callback5 = (input: PptxPointPair): number =>
        Math.abs(input[1]) < 0.000001
          ? input[0]
          : Math.abs(input[0] - items3) < 0.000001
            ? items3 + input[1]
            : Math.abs(input[1] - items4) < 0.000001
              ? items3 + items4 + (items3 - input[0])
              : 2 * items3 + items4 + (items4 - input[1]),
      value3 = 2 * (items3 + items4),
      items5: [number, PptxPointPair][] = [
        [0, [0, 0]],
        [items3, [items3, 0]],
        [items3 + items4, [items3, items4]],
        [2 * items3 + items4, [0, items4]],
      ],
      items6: PptxPathPoint[] = [
        {
          x: pxToInches(value2[0]!.from[0]),
          y: pxToInches(value2[0]!.from[1]),
          moveTo: true,
        },
      ];
    value2.forEach((input, options) => {
      items6.push({
        x: pxToInches(input.to[0]),
        y: pxToInches(input.to[1]),
        curve: {
          type: "arc",
          wR: pxToInches(input.r),
          hR: pxToInches(input.r),
          stAng: input.stAng,
          swAng: input.swAng,
        },
      });
      let value4 = value2[(options + 1) % value2.length]!,
        value5 = callback5(input.to),
        value6 =
          callback5(value4.from) +
          (callback5(value4.from) < value5 - 0.000001 ||
          (value2.length === 1 && callback5(value4.from) <= value5)
            ? value3
            : 0);
      for (let [value7, value8] of [
        ...items5,
        ...items5.map(
          ([input2, input3]): [number, PptxPointPair] => [
            input2 + value3,
            input3,
          ],
        ),
      ])
        if (value7 > value5 + 0.000001 && value7 < value6 - 0.000001) {
          items6.push({
            x: pxToInches(value8[0]),
            y: pxToInches(value8[1]),
          });
        }
      if (options < value2.length - 1) {
        items6.push({
          x: pxToInches(value4.from[0]),
          y: pxToInches(value4.from[1]),
        });
      }
    });
    return [
      ...items6,
      {
        close: true,
      },
    ];
  }
  function oversizedCornerCutout(
    width: number,
    height: number,
    radii: PptxCornerRadii,
  ): PptxPathPoint[] | undefined {
    if (
      radii.tl === radii.tr &&
      radii.tr === radii.br &&
      radii.br === radii.bl &&
      Math.min(width, height) >= 2 * radii.tl
    ) {
      return;
    }
    let value = cornerCutoutCanvas(width, height, radii);
    return roundedCornerCutout(
      value.W,
      value.H,
      {
        x: value.x,
        y: value.y,
        w: width,
        h: height,
      },
      radii,
    );
  }
  function cornerCutoutCanvas(
    width: number,
    height: number,
    radii: PptxCornerRadii,
  ): PptxCutoutCanvas {
    let [items, items2] = [
      Math.max(width, radii.tl + radii.tr, radii.bl + radii.br),
      Math.max(height, radii.tl + radii.bl, radii.tr + radii.br),
    ];
    return {
      W: items,
      H: items2,
      x: radii.tl > 0 || radii.bl > 0 ? 0 : items - width,
      y: radii.tl > 0 || radii.tr > 0 ? 0 : items2 - height,
    };
  }
  function borderBandRects(
    width: number,
    height: number,
    radii: PptxCornerRadii,
    widths: PptxSideWidths,
  ): PptxPathPoint[] {
    let value = cornerCutoutCanvas(width, height, radii);
    return [
      {
        x: 0,
        y: 0,
        w: widths.left,
        h: height,
      },
      {
        x: width - widths.right,
        y: 0,
        w: widths.right,
        h: height,
      },
      {
        x: widths.left,
        y: 0,
        w: width - widths.left - widths.right,
        h: widths.top,
      },
      {
        x: widths.left,
        y: height - widths.bottom,
        w: width - widths.left - widths.right,
        h: widths.bottom,
      },
    ]
      .filter((input) => input.w > 0 && input.h > 0)
      .flatMap(
        (input) =>
          translatePptxPath(
            roundedCornerCutout(
              value.W,
              value.H,
              {
                x: value.x + input.x,
                y: value.y + input.y,
                w: input.w,
                h: input.h,
              },
              radii,
            ) ??
              roundedCornerPath(input.w, input.h, {
                tl: 0,
                tr: 0,
                br: 0,
                bl: 0,
              }),
            input.x,
            input.y,
          ),
      );
  }
  function borderSidesHaveRoundedCorners(sides: string[], radii: PptxCornerRadii): boolean {
    return sides.some(
      (input) =>
        input === "top"
          ? radii.tl > 0 || radii.tr > 0
          : input === "right"
            ? radii.tr > 0 || radii.br > 0
            : input === "bottom"
              ? radii.br > 0 || radii.bl > 0
              : radii.tl > 0 || radii.bl > 0,
    );
  }
  function translatePptxPath(
    path: PptxPathPoint[],
    deltaX: number,
    deltaY: number,
  ): PptxPathPoint[] {
    return path.map(
      (input) =>
        "close" in input
          ? input
          : {
              ...input,
              x: input.x + pxToInches(deltaX),
              y: input.y + pxToInches(deltaY),
            },
    );
  }
  function pptxPathToEmu(path: PptxPathPoint[]): PptxPathPoint[] {
    let callback = (input: PptxDrawPoint): { curve?: PptxArcCurve } =>
      "curve" in input
        ? {
            curve: {
              ...input.curve,
              wR: pptxPositionEmu(input.curve.wR),
              hR: pptxPositionEmu(input.curve.hR),
            },
          }
        : {};
    return path.map(
      (input) =>
        "close" in input
          ? input
          : {
              ...input,
              x: pptxPositionEmu(input.x),
              y: pptxPositionEmu(input.y),
              ...callback(input),
            },
    );
  }
  function letterboxCutout(
    width: number,
    height: number,
    inset: { x: number; y: number },
    radii: PptxCornerRadii,
  ): PptxPathPoint[] | undefined {
    let [items, items2] = [
      Number.isFinite(inset.x) && inset.x > 0 ? inset.x : 0,
      Number.isFinite(inset.y) && inset.y > 0 ? inset.y : 0,
    ];
    return roundedCornerCutout(
      width,
      height,
      {
        x: items,
        y: items2,
        w: width - 2 * items,
        h: height - 2 * items2,
      },
      radii,
    );
  }
  function pxToInches(px: number): number {
    return px / exportPixelsPerInch;
  }
  function pxToPoints(px: number): number {
    return px / 2;
  }
  function hexToPptxColor(color: string): PptxColor {
    let hex = color.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = [...hex].map((input) => input + input).join("");
    }
    let color2 = hex.slice(0, 6).toUpperCase();
    if (hex.length === 8) {
      let value = parseInt(hex.slice(6, 8), 16) / 255,
        value2 = Math.round((1 - value) * 100);
      if (value2 > 0) {
        return {
          color: color2,
          transparency: value2,
        };
      }
    }
    return {
      color: color2,
    };
  }
  function readHexColorByte(hex: string, offset: number): number {
    let value = parseInt(hex.slice(offset, offset + 2), 16);
    if (Number.isFinite(value)) {
      return value;
    } else {
      return 0;
    }
  }
  function blendPptxColors(
    color: string,
    background: string,
    opacity: number,
  ): string {
    let foregroundHex: string = (0, runtime.stripHexAlpha)(color),
      backgroundHex: string = (0, runtime.stripHexAlpha)(background),
      color2 = "";
    for (let value of [1, 3, 5]) {
      let value2 = Math.round(
        readHexColorByte(foregroundHex, value) * opacity +
          readHexColorByte(backgroundHex, value) * (1 - opacity),
      );
      color2 += Math.min(255, Math.max(0, value2))
        .toString(16)
        .padStart(2, "0");
    }
    return color2.toUpperCase();
  }
  function flattenedSlideBackground(color?: string): string {
    let resolved: string =
        (0, runtime.resolveSlideColor)(color) ?? "#F5F4ED",
      alphaHex =
        resolved.length === 9
          ? resolved.slice(7)
          : resolved.length === 5
            ? resolved[4]! + resolved[4]!
            : "ff";
    return (
      "#" + blendPptxColors(resolved, "#ffffff", parseInt(alphaHex, 16) / 255)
    );
  }
  function pptxTextDecoration(decoration?: PptxUnderline): PptxTextDecoration {
    if (decoration === undefined) {
      return {};
    }
    let style = (
        {
          solid: "sng",
          double: "dbl",
          dotted: "dotted",
          dashed: "dash",
          wavy: "wavy",
        } as Record<TextDecorationStyleValue, string>
      )[decoration.style ?? "solid"],
      color =
        decoration.color !== undefined
          ? cssToPptxColor(decoration.color)
          : undefined;
    if (color?.transparency !== undefined && color.transparency >= 100) {
      return {};
    }
    let value =
      color === undefined
        ? undefined
        : color.transparency !== undefined
          ? {
              color: color.color,
              transparency: color.transparency,
            }
          : color.color;
    return {
      underline: {
        style: style,
        ...(value !== undefined
          ? {
              color: value,
            }
          : {}),
      },
    };
  }
  function cssToPptxColor(color: string): PptxColor | undefined {
    let normalized = color.trim().toLowerCase();
    if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(normalized)) {
      return hexToPptxColor(normalized);
    }
    if (normalized === "transparent") {
      return {
        color: "000000",
        transparency: 100,
      };
    }
    let value = /^(rgba?|hsla?)\((.*)\)$/.exec(normalized);
    if (value === null || value[1] === undefined || value[2] === undefined) {
      return;
    }
    let items: { n: number; pct: boolean }[] = [];
    for (let value10 of value[2].split(/[,\s/]+/)) {
      if (value10.length === 0) {
        continue;
      }
      let value11 = value10.endsWith("%"),
        value12 = parseFloat(
          value11 ? value10.slice(0, -1) : value10.replace(/deg$/, ""),
        );
      if (!Number.isFinite(value12)) {
        return;
      }
      items.push({
        n: value12,
        pct: value11,
      });
    }
    let [value2, value3, value4, value5] = items;
    if (
      value2 === undefined ||
      value3 === undefined ||
      value4 === undefined ||
      items.length > 4
    ) {
      return;
    }
    let value6 =
        value5 === undefined
          ? 1
          : Math.min(1, Math.max(0, value5.pct ? value5.n / 100 : value5.n)),
      value7: number[];
    if (value[1].startsWith("rgb")) {
      let callback = (input: { n: number; pct: boolean }): number =>
        Math.min(
          255,
          Math.max(0, Math.round(input.pct ? input.n * 2.55 : input.n)),
        );
      value7 = [callback(value2), callback(value3), callback(value4)];
    } else {
      let value10 = ((value2.n % 360) + 360) % 360,
        value11 = Math.min(1, Math.max(0, value3.n / 100)),
        value12 = Math.min(1, Math.max(0, value4.n / 100)),
        callback = (input: number): number => {
          let value13 = (input + value10 / 30) % 12;
          return (
            value12 -
            value11 *
              Math.min(value12, 1 - value12) *
              Math.max(-1, Math.min(value13 - 3, 9 - value13, 1))
          );
        };
      value7 = [
        Math.round(callback(0) * 255),
        Math.round(callback(8) * 255),
        Math.round(callback(4) * 255),
      ];
    }
    let value8 = value7
        .map((input) => input.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase(),
      value9 = Math.round((1 - value6) * 100);
    if (value9 > 0) {
      return {
        color: value8,
        transparency: value9,
      };
    } else {
      return {
        color: value8,
      };
    }
  }
  function pptxFontFace(role: TextRole, font?: FontFamilyValue): string {
    if (font !== undefined && typeof font !== "string") {
      return font.family;
    }
    let family =
      font ??
      ((0, runtime.renderingTypeScaleForRole)(role).serifDisplay
        ? "serif"
        : "sans");
    if (family === "serif") {
      return "Georgia";
    } else {
      if (family === "mono") {
        return "Courier New";
      } else {
        return "Arial";
      }
    }
  }
  function pptxFontFamilyPitch(role: TextRole, font?: FontFamilyValue): number {
    let family =
      font === undefined
        ? (0, runtime.renderingTypeScaleForRole)(role).serifDisplay
          ? "serif"
          : "sans"
        : typeof font === "string"
          ? font
          : font.fallback;
    if (family === "serif") {
      return 18;
    } else {
      if (family === "mono") {
        return 49;
      } else {
        return 34;
      }
    }
  }
  function pptxTextAlignment(alignment?: TextAlignment): PptxAlign {
    if (alignment === "center") {
      return "center";
    } else {
      if (alignment === "end") {
        return "right";
      } else {
        if (alignment === "justify") {
          return "justify";
        } else {
          return "left";
        }
      }
    }
  }
  function pptxFilename(title: string): string {
    return (0, runtime.exportFilename)(title, "pptx");
  }
  function exportedSlideTitle(slide: Pick<PptxSlideData, "leaves">): PptxTextLeaf | undefined {
    let roleCandidates = (input: TextRole): PptxTextLeaf[] =>
      slide.leaves.filter(
        (source): source is PptxTextLeaf =>
          source.kind === "text" &&
          source.role === input &&
          source.list === undefined &&
          source.embedPlaceholder !== true &&
          /\p{L}/u.test(source.text) &&
          (source.opacity ?? 1) > 0.5,
      );
    for (let value of titleRolePriority) {
      let value2 = roleCandidates(value);
      if (value2.length === 0) {
        continue;
      }
      if (
        value === "display" &&
        value2.every(
          (input) =>
            input.text.trim().length <= minThemeColorSamples,
        ) &&
        titleRolePriority
          .slice(1)
          .some((input) => roleCandidates(input).length > 0)
      ) {
        continue;
      }
      if (value2.length === 1) {
        return value2[0];
      } else {
        return undefined;
      }
    }
    return;
  }
  function createWeightedCounter<K = string>(): PptxWeightedCounter<K> {
    let counts = new Map<K, { n: number; w: number }>();
    return {
      add: (input?: K, options = 1, context = 0): void => {
        if (input === undefined) {
          return;
        }
        let value = counts.get(input) ?? {
          n: 0,
          w: 0,
        };
        counts.set(input, {
          n: value.n + options,
          w: value.w + context,
        });
      },
      ranked: (): K[] =>
        [...counts]
          .sort(
            (input, options) =>
              options[1].n - input[1].n || options[1].w - input[1].w,
          )
          .map(([input]) => input),
      count: (input: K): number => counts.get(input)?.n ?? 0,
    };
  }
  function pptxColorLuminance(color: string): number {
    let channels: PptxContrastColor | undefined = (0,
    runtime.parseContrastColor)("#" + color);
    if (channels === undefined) {
      return 0;
    } else {
      return (0, runtime.relativeLuminance)(channels);
    }
  }
  function pptxColorIsChromatic(color: string): boolean {
    let channels: PptxContrastColor | undefined = (0,
    runtime.parseContrastColor)("#" + color);
    return (
      channels !== undefined &&
      Math.max(channels.r, channels.g, channels.b) -
        Math.min(channels.r, channels.g, channels.b) >=
        chromaticColorThreshold
    );
  }
  function medianNumber(values: Iterable<number>): number {
    let sorted = [...values].sort(
        (input, options) => input - options,
      ),
      middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) {
      return sorted[middle]!;
    } else {
      return (sorted[middle - 1]! + sorted[middle]!) / 2;
    }
  }
  function pptxColorsNear(color: string, otherColor: string): boolean {
    return [0, 2, 4].every(
      (input) =>
        Math.abs(
          parseInt(color.slice(input, input + 2), 16) -
            parseInt(otherColor.slice(input, input + 2), 16),
        ) <= themeColorSimilarityThreshold,
    );
  }
  function pptxLargeTextHasContrast(color: string, background: string): boolean {
    let [foreground, background2]: (PptxContrastColor | undefined)[] = [
      (0, runtime.parseContrastColor)("#" + color),
      (0, runtime.parseContrastColor)("#" + background),
    ];
    return (
      foreground !== undefined &&
      background2 !== undefined &&
      (0, runtime.contrastRatio)(foreground, background2) >=
        runtime.CONTRAST_MINIMUMS.largeText
    );
  }
  function exportLeafPaintsBackground(leaf: PptxLeaf): boolean {
    return (
      (leaf.kind === "img" ||
        (leaf.kind === "box" &&
          leaf.blend === undefined &&
          ((leaf.fill !== undefined &&
            visiblePptxColor(cssToPptxColor(leaf.fill)) !== undefined) ||
            leaf.gradient !== undefined))) &&
      (leaf.opacity ?? 1) > 0.5
    );
  }
  function textLeafOverlapsPaint(
    leaf: PptxTextLeaf,
    painted: readonly { rect: PptxRect }[],
  ): boolean {
    let [centerX, centerY] = [
      leaf.rect.x + leaf.rect.w / 2,
      leaf.rect.y + leaf.rect.h / 2,
    ];
    return (
      (leaf.box !== undefined && exportLeafPaintsBackground(leaf.box)) ||
      painted.some(
        ({ rect: rect }) =>
          rect.x <= centerX &&
          centerX <= rect.x + rect.w &&
          rect.y <= centerY &&
          centerY <= rect.y + rect.h,
      )
    );
  }
  function inferPptxDeckTheme(
    deck: { slides: PptxSlideData[] },
    ground?: string,
  ): PptxDeckTheme {
    let hexColor = (input: string): string => hexToPptxColor(input).color,
      backgrounds = createWeightedCounter(),
      titleColors = createWeightedCounter(),
      fontCounts = new Map<string, PptxWeightedCounter<string>>(),
      bodyColors = createWeightedCounter(),
      accentColors = createWeightedCounter(),
      fontFaces = createWeightedCounter(),
      fontSizes: PptxTitleSample[] = [];
    for (let value20 of deck.slides) {
      let value21 = hexColor(
          ground ?? flattenedSlideBackground(value20.bg),
        ),
        value22 = value20.leaves.reduce(
          (input, source) =>
            input +
            (source.kind === "text" ? source.rect.w * source.rect.h : 0),
          0,
        );
      backgrounds.add(value21, 1, value22);
      let value23 = exportedSlideTitle(value20),
        items4: PptxLeaf[] = [];
      for (let value24 of value20.leaves) {
        if (value24.kind === "text") {
          let value26 = hexToPptxColor(
              (0, runtime.resolveSlideColor)(value24.color) ??
                (0, runtime.slideTextColor)(value20.bg),
            ),
            color = value26.color;
          titleColors.add(color);
          if (
            !textLeafOverlapsPaint(value24, items4) &&
            (value24.opacity ?? 1) > 0.5 &&
            visiblePptxColor(value26) !== undefined
          ) {
            if (!fontCounts.has(value21)) {
              fontCounts.set(value21, createWeightedCounter());
            }
            fontCounts
              .get(value21)!
              .add(color, value24.rect.w * value24.rect.h);
          }
          (titleRolePriority.includes(value24.role)
            ? accentColors
            : fontFaces
          ).add(pptxFontFace(value24.role, value24.fontFamily));
          if (value24.textFill?.kind === "gradient") {
            for (let value27 of value24.textFill.gradient.stops)
              bodyColors.add(visiblePptxColor(cssToPptxColor(value27.color)));
          }
          if (value24 === value23) {
            fontSizes.push({
              leaf: value24,
              ink: color,
              bg: value21,
            });
          }
        } else if (value24.kind === "table") {
          titleColors.add(
            hexColor(
              (0, runtime.resolveSlideColor)(value24.color) ??
                (0, runtime.slideTextColor)(value20.bg),
            ),
          );
          fontFaces.add(
            pptxFontFace(value24.role ?? "body", value24.fontFamily),
          );
        }
        let value25 =
          value24.kind === "box"
            ? value24
            : value24.kind === "text"
              ? value24.box
              : undefined;
        if (
          value25 !== undefined &&
          (value25.opacity ?? 1) > 0.5 &&
          value25.blend === undefined
        ) {
          if (value25.fill !== undefined) {
            bodyColors.add(visiblePptxColor(cssToPptxColor(value25.fill)));
          }
          for (let value26 of (value25.gradient?.stops ?? []))
            bodyColors.add(visiblePptxColor(cssToPptxColor(value26.color)));
        }
        if (exportLeafPaintsBackground(value24)) {
          items4.push(value24);
        } else if (
          value24.kind === "text" &&
          value24.box !== undefined &&
          exportLeafPaintsBackground(value24.box)
        ) {
          items4.push(value24.box);
        }
      }
    }
    let value = backgrounds.ranked()[0] ?? "F5F4ED",
      value2 = hexColor((0, runtime.slideTextColor)("#" + value)),
      value3 =
        fontCounts
          .get(value)
          ?.ranked()
          .find(
            (input) =>
              pptxLargeTextHasContrast(input, value),
          ) ?? value2,
      value4 = pptxColorLuminance(value) < pptxColorLuminance(value3),
      [value5, value6] = value4 ? [value, value3] : [value3, value],
      callback = (input: number): string =>
        blendPptxColors("#" + value3, "#" + value, input),
      [value7, value8] = value4
        ? [callback(0.1), callback(0.75)]
        : [callback(0.75), callback(0.1)],
      value9 = createWeightedCounter();
    for (let value20 of [bodyColors, titleColors, backgrounds])
      for (let value21 of value20.ranked())
        value9.add(value21, value20.count(value21));
    let value10: ReturnType<RuntimeBindings["getRenderingTheme"]> = (0,
        runtime.getRenderingTheme
      )(),
      value11: string[] = [
        (0, runtime.themeAccentColor)(value10),
        ...(value10 === "anthropic" ? ["oat", "text-tertiary"] : []),
      ].map((input: string) =>
        hexColor((0, runtime.resolveSlideColor)(input) ?? input),
      ),
      value12 = [0.6, 0.45, 0.3, 0.2, 0.85, 0.7].map(callback),
      value13 = value9.ranked(),
      items: string[] = [];
    for (let value20 of [
      ...value13.filter(pptxColorIsChromatic),
      ...value13.filter(
        (input) => !pptxColorIsChromatic(input),
      ),
      ...value11,
      ...value12,
    ])
      if (
        items.length < 6 &&
        !items.includes(value20) &&
        !["FFFFFF", "000000", value5, value6].some(
          (input) => pptxColorsNear(value20, input),
        )
      ) {
        items.push(value20);
      }
    while (items.length < 6) items.push(items[items.length - 1] ?? value7);
    let value14: PptxTitleSample[] = fontSizes.some(
        (input) => input.bg === value,
      )
        ? fontSizes.filter((input) => input.bg === value)
        : fontSizes,
      value15 =
        mostFrequentPptxValue(
          value14.map((input) => input.leaf.role),
        ) ?? "h2",
      value16 = value14.filter(
        (input) => input.leaf.role === value15,
      ),
      [items2, items3]: [PptxTypeScale, PptxTypeScale] = [
        (0, runtime.renderingTypeScaleForRole)(value15),
        (0, runtime.renderingTypeScaleForRole)("body"),
      ],
      value17 =
        value16.length > 0
          ? medianNumber(
              value16.map(
                (input) =>
                  (input.leaf.fontSize ?? items2.fontSize) *
                  (input.leaf.fitScale ?? 1),
              ),
            )
          : items2.fontSize,
      callback2 = (input: PptxRect): PptxRect => {
        let value20 =
            input.y + input.h / 2 <= runtime.SLIDE_HEIGHT / 2,
          value21 = value20
            ? input.y + input.h + maxInferredBodyFontSize
            : maxInferredFontSize;
        return {
          x: input.x,
          y: value21,
          w: runtime.SLIDE_WIDTH - maxInferredFontSize - input.x,
          h:
            (value20
              ? runtime.SLIDE_HEIGHT - maxInferredFontSize
              : input.y - maxInferredBodyFontSize) - value21,
        };
      },
      state = {
        w: (runtime.SLIDE_WIDTH - 2 * maxInferredFontSize) / 4,
        h: 2 * items3.fontSize * items3.lineHeight,
      },
      state2 = {
        x: maxInferredFontSize,
        y: maxInferredFontSize,
        w: runtime.SLIDE_WIDTH - 2 * maxInferredFontSize,
        h: Math.min(
          value17 * items2.lineHeight,
          runtime.SLIDE_HEIGHT -
            2 * maxInferredFontSize -
            maxInferredBodyFontSize -
            state.h,
        ),
      },
      value18 =
        value16.length > 0
          ? {
              x: medianNumber(
                value16.map((input) => input.leaf.rect.x),
              ),
              y: medianNumber(
                value16.map((input) => input.leaf.rect.y),
              ),
              w: medianNumber(
                value16.map((input) => input.leaf.rect.w),
              ),
              h: medianNumber(
                value16.map((input) => input.leaf.rect.h),
              ),
            }
          : state2,
      value19 =
        value18.w > 0 &&
        value18.h > 0 &&
        callback2(value18).w >= state.w &&
        callback2(value18).h >= state.h
          ? value18
          : state2,
      state3: PptxPlaceholderStyle = {
        rect: value19,
        face:
          mostFrequentPptxValue(
            value16.map(
              (input) =>
                pptxFontFace(input.leaf.role, input.leaf.fontFamily),
            ),
          ) ??
          accentColors.ranked()[0] ??
          pptxFontFace("h1"),
        fontSize: value17,
        lineHeight: items2.lineHeight,
        color:
          [
            mostFrequentPptxValue(
              value16.map((input) => input.ink),
            ),
            value3,
          ].find(
            (input) =>
              input !== undefined && pptxLargeTextHasContrast(input, value),
          ) ?? value2,
      },
      state4: PptxPlaceholderStyle = {
        rect: callback2(value19),
        face: fontFaces.ranked()[0] ?? pptxFontFace("body"),
        fontSize: items3.fontSize,
        lineHeight: items3.lineHeight,
        color: value3,
      };
    return {
      colors: {
        dk1: value5,
        lt1: value6,
        dk2: value7,
        lt2: value8,
        accent1: items[0]!,
        accent2: items[1]!,
        accent3: items[2]!,
        accent4: items[3]!,
        accent5: items[4]!,
        accent6: items[5]!,
        hlink: "0563C1",
        folHlink: "954F72",
      },
      dark: value4,
      headFace: accentColors.ranked()[0] ?? pptxFontFace("h1"),
      bodyFace: state4.face,
      background: value,
      title: state3,
      body: state4,
    };
  }
  function visiblePptxColor(color?: PptxColor): string | undefined {
    if (color !== undefined && (color.transparency ?? 0) <= 50) {
      return color.color;
    } else {
      return undefined;
    }
  }
  function mostFrequentPptxValue<T>(values: Iterable<T>): T | undefined {
    let counts = createWeightedCounter<T>();
    for (let value of values) counts.add(value);
    return counts.ranked()[0];
  }
  function pptxPlaceholderTextOptions(
    placeholder: PptxPlaceholderStyle,
    objectName: string,
  ): PptxPlaceholderTextOptions {
    return {
      objectName: objectName,
      ...pptxRectOptions(placeholder.rect),
      fontFace: placeholder.face,
      fontSize: pxToPoints(placeholder.fontSize),
      color: placeholder.color,
      align: "left",
      valign: "top",
      margin: 0,
      wrap: true,
      lineSpacingMultiple: placeholder.lineHeight,
    };
  }
  function pptxSlideMaster(
    theme: Pick<PptxDeckTheme, "title" | "body">,
  ): PptxSlideMasterBody {
    return {
      emptyPlaceholders: false,
      objects: [
        {
          placeholder: {
            options: {
              name: "title",
              type: "title",
              ...pptxPlaceholderTextOptions(theme.title, "Title Placeholder 1"),
            },
            text: "",
          },
        },
        {
          placeholder: {
            options: {
              name: "body",
              type: "body",
              ...pptxPlaceholderTextOptions(theme.body, "Text Placeholder 2"),
            },
            text: "",
          },
        },
      ],
    };
  }
  function pptxMasterForBackdrop(
    theme: PptxDeckTheme,
    deck: { slides: PptxSlideData[] },
    slide: PptxSlideData,
  ): PptxDeckTheme {
    let value = inferPptxDeckTheme(
      {
        ...deck,
        slides: deck.slides.filter(
          (input) => input.backdrop === slide.backdrop,
        ),
      },
      slide.ground,
    );
    return {
      ...theme,
      title: {
        ...theme.title,
        color: value.title.color,
      },
      body: {
        ...theme.body,
        color: value.body.color,
      },
    };
  }
  function createPptxPresentation(title: string): PptxPresentationInstance {
    let presentation = new runtime.PptxPresentation();
    presentation.title = title;
    presentation.author = "";
    presentation.company = "";
    presentation.subject = "";
    return presentation;
  }
  function buildPptxPresentation(
    deck: PptxExportDeck,
    options: PptxExportOptions = {},
  ): PptxBuildResult {
    let warnings: string[] = [],
      presentation = createPptxPresentation(
        deck.title,
      ) as unknown as PptxPresentationWriter;
    presentation.defineLayout({
      name: "APPIFACT",
      width: pxToInches(runtime.SLIDE_WIDTH),
      height: pxToInches(runtime.SLIDE_HEIGHT),
    });
    presentation.layout = "APPIFACT";
    let inferTheme = options.theme === true,
      theme = inferTheme ? inferPptxDeckTheme(deck) : undefined;
    if (theme !== undefined) {
      presentation.theme = {
        name:
          (0, runtime.truncateUtf16Safely)(
            deck.title.trim(),
            maxMasterNameLength,
          ) || "Presentation",
        headFontFace: theme.headFace,
        bodyFontFace: theme.bodyFace,
        colors: theme.colors,
        dark: theme.dark,
      };
      presentation.masterSlide.background = {
        color: theme.background,
      };
      presentation.defineSlideMaster({
        title: defaultMasterName,
        background: {
          color: theme.background,
        },
        ...pptxSlideMaster(theme),
      });
      presentation.addMasterObjects(pptxSlideMaster(theme).objects);
    }
    let entries = new Map();
    for (let [value, value2] of deck.slides.entries()) {
      let value3 =
        value2.backdrop === undefined
          ? inferTheme
            ? defaultMasterName
            : undefined
          : entries.get(value2.backdrop);
      if (value2.backdrop !== undefined && value3 === undefined) {
        value3 = "Slide background " + String(entries.size + 1);
        presentation.defineSlideMaster({
          title: value3,
          background: {
            data: value2.backdrop,
          },
          ...(theme !== undefined
            ? pptxSlideMaster(pptxMasterForBackdrop(theme, deck, value2))
            : {}),
        });
        entries.set(value2.backdrop, value3);
      }
      let value4 = presentation.addSlide(
          value3 !== undefined
            ? {
                masterName: value3,
              }
            : undefined,
        ),
        value5 =
          inferTheme && options.titlePlaceholders === true
            ? exportedSlideTitle(value2)
            : undefined;
      if (value2.backdrop === undefined) {
        value4.background = {
          color: flattenedSlideBackground(value2.bg).slice(1),
        };
      }
      for (let value6 of value2.leaves)
        if (value6.kind === "text") {
          if (value6.embedPlaceholder === true) {
            warnings.push(
              "a web embed could not be rendered and exported as a placeholder",
            );
          }
          writePptxText(
            value4,
            value6,
            value2.bg,
            warnings,
            " (slide " + String(value + 1) + ")",
            value2.leaves,
            value6 === value5,
          );
        } else if (value6.kind === "img") {
          writePptxImage(value4, value6, warnings);
        } else if (value6.kind === "box") {
          writePptxBox(
            value4,
            value6,
            " (slide " + String(value + 1) + ")",
            warnings,
          );
        } else {
          writePptxTable(value4, value6, value2.bg, warnings);
        }
      if (value2.notes !== undefined) {
        value4.addNotes(value2.notes);
      }
    }
    warnings.push(...(deck.exportNotes ?? []));
    return {
      pptx: presentation,
      warnings: warnings,
    };
  }
  function pptxGradientStops(
    stops: GradientStop[],
    opacity: number,
  ): PptxGradientStop[] | undefined {
    let colors = stops.map(
      (input) => cssToPptxColor(input.color),
    );
    if (colors.length < 2 || colors.includes(undefined)) {
      return;
    }
    let transparent = (input: PptxColor | undefined): boolean =>
      input === undefined || (input.transparency ?? 0) >= 100;
    return stops.flatMap((input, options): PptxGradientStop[] => {
      let value = colors[options];
      if (!transparent(value)) {
        return [
          {
            position: input.pos,
            ...applyPptxOpacity(value!, opacity),
          },
        ];
      }
      let items = [
        ...new Set(
          [colors[options - 1], colors[options + 1]]
            .filter((input2): input2 is PptxColor => !transparent(input2))
            .map((input2) => input2.color),
        ),
      ];
      return (items.length > 0 ? items : [value!.color]).map(
        (input2) => ({
          position: input.pos,
          color: input2,
          transparency: 100,
        }),
      );
    });
  }
  function applyPptxTextFill(
    fill: TextFill | undefined,
    textOptions: number,
    leaf: boolean,
    warnings: string[],
    location2: string,
  ): PptxTextGradient | undefined {
    if (fill === undefined) {
      return;
    }
    let warnOnce = {
      push: (input: string): void => {
        if (!warnings.includes(input)) {
          warnings.push(input);
        }
      },
    };
    if (fill.kind === "image") {
      warnOnce.push(
        "image-filled text exported in its plain colour (PowerPoint text takes no picture fill here)" +
          location2,
      );
      return;
    }
    let gradient = fill.gradient,
      value = pptxGradientStops(gradient.stops, textOptions);
    if (value === undefined) {
      warnOnce.push(
        "text gradient exported in its plain colour (a stop color is not converted by the PPTX export)" +
          location2,
      );
      return;
    }
    if (gradient.radial === true) {
      warnOnce.push(
        "radial text gradient exported as a linear ramp (PowerPoint text gradients are linear)" +
          location2,
      );
    } else if (gradient.repeat !== undefined) {
      warnOnce.push(
        "repeating text gradient exported as one stretched ramp (PPTX gradients do not repeat)" +
          location2,
      );
    }
    if (leaf) {
      warnOnce.push(
        "gradient text with styled spans or list lines: PowerPoint restarts the ramp in each run, so it reads slightly differently there" +
          location2,
      );
    }
    return {
      stops: value,
      angle:
        gradient.radial === true
          ? 90
          : (((gradient.angle - 90) % 360) + 360) % 360,
    };
  }
  function capitalizePptxText(text: string): string {
    let text2 = "",
      atWordStart = true;
    for (let value of text) {
      if (capitalizationApostrophePattern.test(value)) {
        text2 += value;
        continue;
      }
      if (
        capitalizationCjkCharacterPattern.test(value) ||
        !capitalizationWordCharacterPattern.test(value)
      ) {
        atWordStart = true;
        text2 += value;
        continue;
      }
      let value2 = atWordStart ? value.toUpperCase() : value;
      text2 += value2.length === value.length ? value2 : value;
      atWordStart = false;
    }
    return text2;
  }
  function pptxListOptions(
    leaf: PptxTextLeaf,
    fontSize: number,
  ): PptxListIndent | undefined {
    let positive = (input?: number): number =>
        input !== undefined && input > 0 && Number.isFinite(input) ? input : 0,
      gutter = positive(leaf.listGutter);
    if (
      leaf.list === undefined ||
      (gutter === 0 && leaf.listOutside !== true)
    ) {
      return;
    }
    let hanging = positive(leaf.listHang),
      indent =
        leaf.list === "bullet"
          ? hanging > 0
            ? hanging + pptxTextPaddingRatio * fontSize
            : gutter
          : Math.max(
              gutter,
              hanging,
              pptxListNumberWidthFactor * positive(leaf.listNumberWidth),
            ),
      value = Math.min(indent, pptxMaximumTextWidth);
    if (value === 0) {
      return;
    }
    return {
      marL: Math.min(Math.max(gutter, value), pptxMaximumTextWidth),
      hang: value,
      overhang: Math.max(0, value - gutter),
    };
  }
  function textBoxHugsOrFills(leaf: PptxTextLeaf): "hugs" | "full" | undefined {
    let [width, lineWidth] = [leaf.rect.w, leaf.lineWidth];
    if (
      lineWidth === undefined ||
      leaf.box !== undefined ||
      leaf.list !== undefined ||
      leaf.nowrap === true ||
      leaf.fit === "grow" ||
      leaf.textFill !== undefined
    ) {
      return;
    }
    if ((leaf.rect.rotate ?? 0) % 360 !== 0) {
      return;
    }
    if (Math.abs(width - lineWidth) <= pptxTextHugTolerancePx) {
      return "hugs";
    } else {
      if (
        lineWidth >
        pptxTextFillWidthRatio * (width + pptxTextRoomAllowance(width))
      ) {
        return "full";
      } else {
        return undefined;
      }
    }
  }
  function writtenPptxAlignment(leaf: PptxTextLeaf): PptxAlign {
    if (textBoxHugsOrFills(leaf) === "hugs" && leaf.heldSide !== undefined) {
      return leaf.heldSide;
    } else {
      return pptxTextAlignment(leaf.align);
    }
  }
  function textBoxAvailableRoom(
    leaf: PptxTextLeaf,
    slide: PptxLeaf[],
  ): PptxHorizontalPadding {
    let rect = leaf.rect,
      state = {
        left: rect.x,
        right: runtime.SLIDE_WIDTH - rect.x - rect.w,
      },
      callback = (input: PptxRect): PptxRect => {
        let value = ((input.rotate ?? 0) * Math.PI) / 180,
          [items, items2] = [
            input.w * Math.abs(Math.cos(value)) +
              input.h * Math.abs(Math.sin(value)),
            input.w * Math.abs(Math.sin(value)) +
              input.h * Math.abs(Math.cos(value)),
          ];
        return {
          x: input.x + (input.w - items) / 2,
          y: input.y + (input.h - items2) / 2,
          w: items,
          h: items2,
        };
      };
    for (let value of slide) {
      if (value === leaf) {
        continue;
      }
      let value2 =
          value.kind === "box"
            ? value
            : value.kind === "text"
              ? value.box
              : undefined,
        value3 =
          value.kind === "text" && textBoxHugsOrFills(value) !== undefined
            ? writtenPptxAlignment(value)
            : undefined,
        value4 =
          value.kind === "text" && value.box === undefined
            ? pptxPaddingByLeaf(value)
            : {
                left: 0,
                right: 0,
              },
        value5 =
          value.kind === "text"
            ? (pptxListOptions(
                value,
                (value.fontSize ??
                  (0, runtime.renderingTypeScaleForRole)(value.role).fontSize) *
                  (value.fitScale ?? 1),
              )?.overhang ?? 0)
            : 0;
      for (let value6 of (value.kind === "text" && value.box !== undefined
        ? [value.rect, value.box.rect]
        : [value.rect])) {
        let value7 = callback(value6);
        if (
          Math.min(rect.y + rect.h, value7.y + value7.h) -
            Math.max(rect.y, value7.y) <=
          pptxBoxOverlapTolerancePx
        ) {
          continue;
        }
        let [items, items2] = [
            rect.x - value7.x - value7.w,
            value7.x - rect.x - rect.w,
          ],
          value8 =
            value7.x <= rect.x + 1 &&
            value7.x + value7.w >= rect.x + rect.w - 1;
        if (value8 && value2 !== undefined && value6 === value2.rect) {
          state.left = Math.min(
            state.left,
            rect.x - value7.x - exportedBorderSideWidth(value2.border, "left"),
          );
          state.right = Math.min(
            state.right,
            -items - rect.w - exportedBorderSideWidth(value2.border, "right"),
          );
        } else if (
          value8 &&
          value7.y <= rect.y + 1 &&
          value7.y + value7.h >= rect.y + rect.h - 1
        ) {
          continue;
        } else if (items2 >= -pptxTextBoxGapTolerancePx) {
          state.right = Math.min(
            state.right,
            items2 -
              (value3 === "right" || value3 === "center"
                ? Math.max(items2 / 2, value4.left + value5)
                : value4.left + value5),
          );
        } else if (items >= -pptxTextBoxGapTolerancePx) {
          state.left = Math.min(
            state.left,
            items -
              (value3 !== undefined && value3 !== "right"
                ? Math.max(items / 2, value4.right)
                : value4.right),
          );
        }
      }
    }
    return state;
  }
  function pptxTextBoxPadding(
    leaf: PptxTextLeaf,
    slide: PptxLeaf[],
  ): PptxHorizontalPadding {
    let padding = pptxPaddingByLeaf(leaf);
    if (textBoxHugsOrFills(leaf) === undefined) {
      return padding;
    }
    let desiredRoom = pptxPaddingByAlignment(
        writtenPptxAlignment(leaf),
        Math.max(
          pptxTextRoomAllowance(leaf.rect.w),
          leaf.rect.w * pptxTextHugRoomRatio,
        ),
      ),
      availableRoom = textBoxAvailableRoom(leaf, slide),
      left = Math.max(
        padding.left,
        Math.min(desiredRoom.left, availableRoom.left),
      ),
      right = Math.max(
        padding.right,
        Math.min(desiredRoom.right, availableRoom.right),
      );
    if (writtenPptxAlignment(leaf) === "center") {
      return {
        left: Math.min(left, right),
        right: Math.min(left, right),
      };
    } else {
      return {
        left: left,
        right: right,
      };
    }
  }
  function textInShapeOptions(
    leaf: PptxTextLeaf,
    shape: PptxRect,
    fontSize: number,
    lineHeight: number,
    warnings: number,
    location2: PptxAlign,
  ): PptxTextInShape | undefined {
    let callback = (input: PptxRect, options: PptxRect): PptxSideWidths => ({
        left: input.x - options.x,
        top: input.y - options.y,
        right: options.x + options.w - input.x - input.w,
        bottom: options.y + options.h - input.y - input.h,
      }),
      value = unrotateRectWithinParent(leaf.rect, shape),
      value2 =
        leaf.boxInner !== undefined
          ? unrotateRectWithinParent(leaf.boxInner, shape)
          : value,
      value3 = callback(value, shape),
      value4 = callback(value2, shape);
    if (
      Math.min(value3.left, value3.top, value3.right, value3.bottom) <
      -pptxShapeInsetTolerancePx
    ) {
      return;
    }
    if (
      leaf.linesHeight !== undefined &&
      leaf.linesHeight - value.h > pptxTextHeightTolerancePx
    ) {
      return;
    }
    let value5 = callback(value, value2),
      callback2 = (input: number, options: number): boolean =>
        Math.abs(input - options) <= pptxTextAlignmentTolerancePx,
      value6 =
        leaf.lineWidth !== undefined &&
        Math.abs(value.w - leaf.lineWidth) <= pptxTextHugTolerancePx,
      value7 =
        value6 &&
        Math.abs(value2.w - (leaf.lineWidth ?? 0)) <= pptxTextHugTolerancePx,
      value8 = location2,
      value9 = leaf.nowrap !== true,
      [items, items2, items3] = [value3.left, value3.right, false];
    if (value7) {
      if (((value9 = false), callback2(items, items2))) {
        [value8, items3] = ["center", true];
      } else if (items < items2) {
        [value8, items2] = ["left", 0];
      } else {
        [value8, items] = ["right", 0];
      }
    } else {
      let value19: PptxAlign | undefined =
        value6 && leaf.boxInner !== undefined
          ? callback2(value5.left, value5.right)
            ? "center"
            : Math.abs(value5.left) <= pptxTextAlignmentTolerancePx
              ? "left"
              : Math.abs(value5.right) <= pptxTextAlignmentTolerancePx
                ? "right"
                : undefined
          : undefined;
      if (value19 !== undefined) {
        [value8, items, items2] = [value19, value4.left, value4.right];
      }
      let value20 =
        value19 !== undefined
          ? Math.max(0, warnings - (value2.w - value.w))
          : warnings;
      if (value8 === "right") {
        items -= value20;
      } else if (value8 === "center") {
        [items, items2] = [items - value20 / 2, items2 - value20 / 2];
      } else {
        items2 -= value20;
      }
    }
    let value10 =
        value7 &&
        Math.abs(value2.h - lineHeight) <= pptxTextAlignmentTolerancePx,
      value11 = leaf.boxAnchor ?? "top",
      value12 =
        leaf.boxInner !== undefined &&
        (value11 === "middle"
          ? callback2(value5.top, value5.bottom)
          : value11 === "bottom"
            ? Math.abs(value5.bottom) <= pptxTextAlignmentTolerancePx
            : Math.abs(value5.top) <= pptxTextAlignmentTolerancePx),
      text: PptxVerticalAlign = "top",
      [items4, items5, items6] = [value3.top, value3.bottom, false];
    if (value10) {
      [text, items4, items5, items6] = [
        "middle",
        value4.top,
        value4.bottom,
        true,
      ];
    } else {
      if (value12) {
        [text, items4, items5] = [value11, value4.top, value4.bottom];
      }
      let value19 = value12
        ? Math.max(0, 4 - (value2.h - value.h))
        : 4;
      if (text === "bottom") {
        items4 -= value19;
      } else if (text === "middle") {
        [items4, items5] = [items4 - value19 / 2, items5 - value19 / 2];
      } else {
        items5 -= value19;
      }
    }
    let callback3 = (input: number): PptxSideWidths => {
        let callback6 = (
            input2: number,
            options: number,
            context: boolean,
          ): [number, number] => {
            let value23 = Math.min(input2, options);
            if (context || input > value23) {
              return [input2 - value23, options - value23];
            } else {
              return [input2 - input, options - input];
            }
          },
          [value19, value20] =
            value8 === "center"
              ? callback6(items, items2, items3)
              : [items - input, items2 - input],
          [value21, value22] =
            text === "middle"
              ? callback6(items4, items5, items6)
              : [items4 - input, items5 - input];
        return {
          left: Math.max(0, value19),
          top: Math.max(0, value21),
          right: Math.max(0, value20),
          bottom: Math.max(0, value22),
        };
      },
      callback4 = (input: PptxSideWidths, options: number): boolean =>
        (["left", "top", "right", "bottom"] as const).every(
          (input2) =>
            options + input[input2] <=
            value3[input2] +
              (options > 0 && input[input2] <= pptxShapeInsetTolerancePx
                ? pptxShapeTextMarginTolerancePx
                : pptxShapeInsetTolerancePx),
        ),
      callback5 = (input: PptxSideWidths, options: number): boolean =>
        !value7 ||
        shape.w - 2 * options - input.left - input.right - value.w >= warnings,
      value13 = fontSize * pptxRoundedCornerInsetRatio,
      value14 =
        value8 === "right"
          ? value3.left
          : value8 === "center"
            ? Math.min(value3.left, value3.right)
            : value3.right,
      value15 = callback3(value13),
      value16 =
        value13 > 0 &&
        (!callback4(value15, value13) ||
          !callback5(value15, value13) ||
          (value9 && value14 - value13 < pptxMinimumShapeTextRoom)),
      [value17, value18] = value16
        ? [callback3(0), 0]
        : [value15, value13];
    if (callback4(value17, value18) && callback5(value17, value18)) {
      return {
        ins: value17,
        align: value8,
        valign: text,
        wrap: value9,
        path: value16,
      };
    } else {
      return undefined;
    }
  }
  function writePptxText(
    slide: PptxSlideWriter,
    leaf: PptxTextLeaf,
    warnings: string | undefined,
    assets: string[],
    background: string,
    theme: PptxLeaf[],
    inShape: boolean = false,
  ): void {
    let value: PptxTypeScale = (0, runtime.renderingTypeScaleForRole)(
        leaf.role,
      ),
      callback = (input: string): string =>
        leaf.textTransform === "uppercase"
          ? input.toUpperCase()
          : leaf.textTransform === "lowercase"
            ? input.toLowerCase()
            : input,
      value2 =
        leaf.textTransform === "capitalize"
          ? capitalizePptxText(leaf.text)
          : leaf.text,
      value3 =
        (leaf.fontSize ?? value.fontSize) * (leaf.fitScale ?? 1),
      value4 = leaf.fontWeight ?? value.fontWeight,
      value5 = writtenPptxAlignment(leaf),
      value6 = leaf.opacity ?? 1,
      { color: value7, transparency: value8 } = applyPptxOpacity(
        hexToPptxColor(
          (0, runtime.resolveSlideColor)(leaf.color) ??
            (0, runtime.slideTextColor)(warnings),
        ),
        value6,
      ),
      items: string[] = [],
      value9 = applyPptxTextFill(
        leaf.textFill,
        value6,
        leaf.marks !== undefined || leaf.list !== undefined,
        items,
        background,
      ),
      value10 = pptxTextRoomAllowance(leaf.rect.w),
      value11 = pptxTextBoxPadding(leaf, theme),
      value12 = pptxListOptions(leaf, value3),
      value13 =
        value12 !== undefined
          ? {
              indent: pxToPoints(value12.marL),
              hanging: pxToPoints(value12.hang),
            }
          : undefined,
      value14 = insetRect(leaf.rect, {
        left: -value11.left - (value12?.overhang ?? 0),
        right: -value11.right,
        bottom: -4,
      }),
      value15 = ((): string | PptxTextRun[] => {
        if (leaf.marks === undefined && leaf.list === undefined) {
          return callback(value2);
        }
        let value18 = (0, runtime.textLinesAsRuns)({
            text: value2,
            marks: leaf.marks,
          }),
          items2: PptxTextRun[] = [];
        value18.forEach((items3, options) => {
          let value19: PptxMarkedRun[] =
            items3.length > 0
              ? items3
              : [
                  {
                    text: "",
                  },
                ];
          value19.forEach((input, options2) => {
            let state: PptxTextRunOptions = {};
            if (input.bold) {
              state.bold = true;
            }
            if (input.italic) {
              state.italic = true;
            }
            if (input.underline) {
              state.underline = {
                style: "sng",
              };
            }
            if (input.color !== undefined) {
              let value20 = applyPptxOpacity(
                hexToPptxColor(
                  (0, runtime.resolveSlideColor)(input.color) ?? "#141413",
                ),
                value6,
              );
              state.color = value20.color;
              if (value20.transparency !== undefined) {
                state.transparency = value20.transparency;
              }
            } else if (value9 !== undefined) {
              state.gradientFill = value9;
            }
            if (
              input.href !== undefined &&
              (0, runtime.isSafeHyperlink)(input.href)
            ) {
              state.hyperlink = {
                url: input.href,
              };
            }
            if (leaf.list !== undefined && options2 === 0) {
              state.bullet =
                leaf.list === "bullet"
                  ? (value13 ?? true)
                  : {
                      type: "number",
                      ...value13,
                    };
            }
            if (
              options2 === value19.length - 1 &&
              options < value18.length - 1
            ) {
              state.breakLine = true;
            }
            items2.push({
              text: callback(input.text),
              options: state,
            });
          });
        });
        return items2;
      })(),
      callback2 = (
        input: PptxTextBoxOptions,
        options: Partial<
          Pick<PptxTextInShape, "align" | "valign" | "wrap">
        > = {},
      ): void => {
        let { points: value18, ...value19 } = input;
        slide.addText(value15, {
          ...value19,
          ...(value18 !== undefined
            ? {
                points: value18,
              }
            : {}),
          fontFace: pptxFontFace(leaf.role, leaf.fontFamily),
          fontPitchFamily: pptxFontFamilyPitch(leaf.role, leaf.fontFamily),
          fontSize: pxToPoints(value3),
          bold: value4 >= 600,
          italic: leaf.italic === true,
          ...pptxTextDecoration(leaf.underline),
          ...(leaf.strike === true
            ? {
                strike: "sngStrike",
              }
            : {}),
          ...(leaf.letterSpacing !== undefined
            ? {
                charSpacing: pxToPoints(leaf.letterSpacing),
              }
            : {}),
          color: value7,
          transparency: value8,
          ...(value9 !== undefined && typeof value15 === "string"
            ? {
                gradientFill: value9,
              }
            : {}),
          align: options.align ?? value5,
          valign: options.valign ?? "top",
          fit:
            leaf.fit === "none"
              ? "none"
              : leaf.fit === "grow"
                ? "resize"
                : "shrink",
          wrap: options.wrap ?? leaf.nowrap !== true,
          lineSpacing: pxToPoints(
            value3 * (leaf.lineHeight ?? value.lineHeight),
          ),
          ...(inShape
            ? {
                placeholderType: "title",
              }
            : {}),
        });
      },
      value16: string | undefined,
      callback3: PptxBoxShapeHook = (input, options, context, value18) => {
        try {
          let value19 = textInShapeOptions(
            leaf,
            context,
            input === "roundRect" ? value18 : 0,
            value3 * (leaf.lineHeight ?? value.lineHeight),
            value10,
            value5,
          );
          if (value19 === undefined) {
            return false;
          }
          let { rectRadius: value20, ...value21 } = options,
            value22 = value19.path
              ? {
                  ...value21,
                  shape: "custGeom",
                  points: pptxPathToEmu(
                    roundedCornerPath(context.w, context.h, {
                      tl: value18,
                      tr: value18,
                      br: value18,
                      bl: value18,
                    }),
                  ),
                }
              : {
                  ...options,
                  shape: input,
                };
          callback2(
            {
              ...value22,
              margin: [
                pxToPoints(value19.ins.left),
                pxToPoints(value19.ins.right),
                pxToPoints(value19.ins.bottom),
                pxToPoints(value19.ins.top),
              ],
            },
            {
              align: value19.align,
              valign: value19.valign,
              wrap: value19.wrap,
            },
          );
          return true;
        } catch (value19: unknown) {
          value16 =
            value19 instanceof Error ? value19.message : String(value19);
          return false;
        }
      },
      flag = false,
      value17: PptxRect | undefined;
    if (leaf.box !== undefined) {
      let value18: PptxBoxShapeHook | undefined = !(
        leaf.list === undefined &&
        leaf.fit !== "grow" &&
        (leaf.rect.rotate ?? 0) === (leaf.box.rect.rotate ?? 0)
      )
        ? undefined
        : inShape
          ? (input, options, context) => {
              value17 = context;
              return false;
            }
          : (...input: Parameters<PptxBoxShapeHook>): boolean =>
              (flag = callback3(...input));
      writePptxBox(slide, leaf.box, background, assets, value18);
    }
    for (let value18 of items)
      if (!assets.includes(value18)) {
        assets.push(value18);
      }
    if (flag) {
      return;
    }
    try {
      let value18: PptxTextInShape | undefined;
      try {
        value18 =
          value17 !== undefined
            ? textInShapeOptions(
                leaf,
                value17,
                0,
                value3 * (leaf.lineHeight ?? value.lineHeight),
                value10,
                value5,
              )
            : undefined;
      } catch (value19: unknown) {
        assets.push(
          "a title laid over its box as a plain text box instead" +
            background +
            ": " +
            (value19 instanceof Error ? value19.message : String(value19)),
        );
      }
      if (value17 !== undefined && value18 !== undefined) {
        let { ins: value19 } = value18;
        callback2(
          {
            ...pptxRectOptions(value17),
            margin: [
              pxToPoints(value19.left),
              pxToPoints(value19.right),
              pxToPoints(value19.bottom),
              pxToPoints(value19.top),
            ],
          },
          {
            align: value18.align,
            valign: value18.valign,
            wrap: value18.wrap,
          },
        );
      } else {
        callback2({
          ...pptxRectOptions(value14),
          margin: 0,
        });
      }
      if (value16 !== undefined) {
        assets.push(
          "a text and its box exported as two objects, not one" +
            background +
            ": " +
            value16,
        );
      }
    } catch (value18: unknown) {
      assets.push(
        "addText failed: " +
          (value18 instanceof Error ? value18.message : String(value18)),
      );
    }
  }
  function writePptxImage(
    slide: PptxSlideWriter,
    leaf: PptxImageLeaf,
    warnings: string[],
  ): void {
    if (leaf.dataUri === undefined) {
      warnings.push(
        "image skipped (missing asset): " + (leaf.alt || "(no alt text)"),
      );
      return;
    }
    if (leaf.dataUri.startsWith("data:image/svg+xml")) {
      warnings.push(
        "SVG image skipped (could not rasterize for PowerPoint): " +
          (leaf.alt || "(no alt text)"),
      );
      return;
    }
    let value = leaf.opacity ?? 1,
      {
        w: value2,
        widthOf: value3,
        line: value4,
        sides: value5,
      } = pptxBorderOptions(
        leaf.border,
        warnings,
        "image",
        ": " + (leaf.alt || "(no alt text)"),
        value,
      ),
      value6 =
        value5 ??
        (leaf.clipRounded === true &&
        value4 !== undefined &&
        (value4.dashType ?? "solid") === "solid"
          ? [...exportBorderSides]
          : undefined),
      value7 = insetRect(leaf.rect, {
        left: value3("left"),
        top: value3("top"),
        right: value3("right"),
        bottom: value3("bottom"),
      }),
      state = {
        ...value7,
        w: Math.max(1, value7.w),
        h: Math.max(1, value7.h),
      },
      value8 = pxToInches(state.w),
      value9 = pxToInches(state.h),
      value10 = pptxPositionEmu(value8),
      value11 = pptxPositionEmu(value9),
      state2: PptxImageSizing = {
        type: leaf.fit,
        w: value10,
        h: value11,
      };
    if (
      leaf.naturalW !== undefined &&
      leaf.naturalH !== undefined &&
      leaf.naturalW > 0 &&
      leaf.naturalH > 0
    ) {
      value11 = pptxPositionEmu((value8 * leaf.naturalH) / leaf.naturalW);
      if (leaf.crop !== undefined && leaf.fit === "cover") {
        let value27 = (0, runtime.imageCropNormalizedViewport)(
          {
            w: state.w,
            h: state.h,
          },
          {
            w: leaf.naturalW,
            h: leaf.naturalH,
          },
          leaf.crop,
        );
        value10 = pptxLengthEmu(value8 / value27.w);
        value11 = pptxLengthEmu(value9 / value27.h);
        state2 = {
          type: "crop",
          x: pptxLengthEmu((value8 * value27.x) / value27.w),
          y: pptxLengthEmu((value9 * value27.y) / value27.h),
          w: pptxLengthEmu(value8),
          h: pptxLengthEmu(value9),
        };
      }
    } else {
      warnings.push(
        leaf.fit +
          " exported as stretch — natural dimensions unavailable: " +
          (leaf.alt || "(no alt text)"),
      );
    }
    let value12 = Math.min(leaf.rect.w, leaf.rect.h),
      value13 = Math.min(leaf.radius ?? 0, value12 / 2),
      value14 = value13 > 0,
      value15 =
        value14 &&
        Math.abs(leaf.rect.w - leaf.rect.h) <= 1 &&
        value13 >= value12 / 2 - 0.5,
      value16 = Math.min(
        value3("left"),
        value3("top"),
        value3("right"),
        value3("bottom"),
      ),
      value17 =
        leaf.corners !== undefined
          ? insetCornerRadii(leaf.corners, {
              tl: Math.min(value3("top"), value3("left")),
              tr: Math.min(value3("top"), value3("right")),
              br: Math.min(value3("bottom"), value3("right")),
              bl: Math.min(value3("bottom"), value3("left")),
            })
          : insetCornerRadii(
              {
                tl: value13,
                tr: value13,
                br: value13,
                bl: value13,
              },
              value16,
            ),
      value18 =
        leaf.fit === "contain" &&
        leaf.crop === undefined &&
        leaf.naturalW !== undefined &&
        leaf.naturalH !== undefined &&
        leaf.naturalW > 0 &&
        leaf.naturalH > 0
          ? Math.min(state.w / leaf.naturalW, state.h / leaf.naturalH)
          : 0,
      value19 =
        value18 > 0
          ? {
              x: Math.max(0, (state.w - leaf.naturalW! * value18) / 2),
              y: Math.max(0, (state.h - leaf.naturalH! * value18) / 2),
            }
          : {
              x: 0,
              y: 0,
            },
      state3 = {
        w: state.w - 2 * value19.x,
        h: state.h - 2 * value19.y,
      },
      value20 =
        (Math.max(value17.tl, value17.tr, value17.br, value17.bl) > 0 &&
          (value19.x > state3.w / 200 || value19.y > state3.h / 200)) ||
        value19.x > 1000 * state3.w ||
        value19.y > 1000 * state3.h,
      value21 =
        value < 1
          ? {
              transparency: Math.round((1 - value) * 100),
            }
          : {},
      value22: PptxImageOptions = value20
        ? {
            data: leaf.dataUri,
            ...pptxRectOptions(
              insetRect(state, {
                left: value19.x,
                top: value19.y,
                right: value19.x,
                bottom: value19.y,
              }),
            ),
            altText: leaf.alt,
            ...value21,
          }
        : {
            data: leaf.dataUri,
            ...pptxRectOptions(state),
            w: value10,
            h: value11,
            altText: leaf.alt,
            sizing: state2,
            ...value21,
          },
      value23 = leaf.corners ?? {
        tl: value13,
        tr: value13,
        br: value13,
        bl: value13,
      },
      callback = (
        input: number,
        options: number,
        context: number,
        value27: number,
      ): PptxPathPoint[] | undefined => {
        let value28 = cornerCutoutCanvas(
          leaf.rect.w,
          leaf.rect.h,
          value23,
        );
        return roundedCornerCutout(
          value28.W,
          value28.H,
          {
            x: value28.x + input,
            y: value28.y + options,
            w: context,
            h: value27,
          },
          value23,
        );
      },
      value24: PptxPathPoint[] | undefined;
    if (value20) {
      value24 =
        leaf.clipRounded === true
          ? callback(
              value3("left") + value19.x,
              value3("top") + value19.y,
              state.w - 2 * value19.x,
              state.h - 2 * value19.y,
            )
          : letterboxCutout(state.w, state.h, value19, value17);
    } else if (leaf.clipRounded === true) {
      value24 =
        value2 > 0
          ? callback(value3("left"), value3("top"), state.w, state.h)
          : oversizedCornerCutout(state.w, state.h, value23);
    } else if (leaf.corners !== undefined) {
      value24 = roundedCornerPath(state.w, state.h, value17);
    }
    let value25 = value24?.length === 0,
      value26 = !value20 && (leaf.clipRounded !== true || value2 <= 0);
    if (value24 !== undefined) {
      value22.points = value24;
    } else if (value26 && value15) {
      value22.rounding = true;
    } else if (value26 && value13 > value16) {
      value22.rectRadius = pxToInches(value13 - value16);
    }
    if (leaf.shadow !== undefined) {
      let value27 = pptxShadowOptions(
        leaf.shadow,
        warnings,
        "image",
        ": " + (leaf.alt || "(no alt text)"),
        true,
        value,
      );
      if (value27 !== undefined) {
        value22.shadow = value27;
      }
    }
    try {
      if (!value25) {
        slide.addImage(value22);
      }
    } catch (value27: unknown) {
      warnings.push(
        "addImage failed: " +
          (value27 instanceof Error ? value27.message : String(value27)),
      );
    }
    if (value4 !== undefined) {
      try {
        if (value6 === undefined) {
          let value27 = insetRect(leaf.rect, {
              left: value2 / 2,
              top: value2 / 2,
              right: value2 / 2,
              bottom: value2 / 2,
            }),
            state4 = {
              ...value27,
              w: Math.max(1, value27.w),
              h: Math.max(1, value27.h),
            },
            value28 = value15 ? 0 : Math.max(0, value13 - value2 / 2);
          if (leaf.corners !== undefined) {
            slide.addShape("custGeom", {
              ...pptxRectOptions(state4),
              points: pptxPathToEmu(
                roundedCornerPath(
                  state4.w,
                  state4.h,
                  insetCornerRadii(leaf.corners, value2 / 2),
                ),
              ),
              line: value4,
            });
          } else {
            slide.addShape(
              value15 ? "ellipse" : value28 > 0 ? "roundRect" : "rect",
              {
                ...pptxRectOptions(state4),
                ...(value28 > 0
                  ? {
                      rectRadius: pxToInches(value28),
                    }
                  : {}),
                line: value4,
              },
            );
          }
        } else {
          let value27 = leaf.corners ?? {
              tl: value13,
              tr: value13,
              br: value13,
              bl: value13,
            },
            value28 =
              leaf.clipRounded === true &&
              (value4.dashType ?? "solid") === "solid";
          if (
            (value14 || leaf.corners !== undefined) &&
            !value28 &&
            (leaf.clipRounded !== true ||
              borderSidesHaveRoundedCorners(value6, value27))
          ) {
            warnings.push(
              "a border that is not the same on all four sides of a picture with rounded or clipped corners exported as straight lines: " +
                (leaf.alt || "(no alt text)"),
            );
          }
          let value29 = value28
            ? borderBandRects(leaf.rect.w, leaf.rect.h, value27, {
                left: value3("left"),
                top: value3("top"),
                right: value3("right"),
                bottom: value3("bottom"),
              })
            : [];
          if (value29.length > 0) {
            slide.addShape("custGeom", {
              ...pptxRectOptions(leaf.rect),
              points: pptxPathToEmu(value29),
              fill: {
                color: value4.color,
                ...(value4.transparency !== undefined
                  ? {
                      transparency: value4.transparency,
                    }
                  : {}),
              },
            });
          } else if (!value28) {
            writePptxBorderSides(slide, leaf.rect, value3, value6, value4);
          }
        }
      } catch (value27: unknown) {
        warnings.push(
          "addShape failed: " +
            (value27 instanceof Error ? value27.message : String(value27)),
        );
      }
    }
  }
  function applyPptxOpacity(color: PptxColor, opacity: number): PptxColor {
    if (opacity >= 1) {
      return color;
    }
    let transparency = Math.round(
      100 - (100 - (color.transparency ?? 0)) * opacity,
    );
    if (transparency > 0) {
      return {
        color: color.color,
        transparency: transparency,
      };
    } else {
      return {
        color: color.color,
      };
    }
  }
  function exportedBorderSideWidth(border: PptxBorder | undefined, side: string): number {
    if (border === undefined || border.style === "none") {
      return 0;
    }
    let enabledSide =
        border.sides === undefined || border.sides.split(" ").includes(side),
      widths = border.widths;
    if (widths !== undefined) {
      return (
        widths[side] ??
        (border.width !== undefined && enabledSide ? border.width : 0)
      );
    } else {
      if (enabledSide) {
        return border.width ?? 3;
      } else {
        return 0;
      }
    }
  }
  function pptxBorderOptions(
    border: PptxBorder | undefined,
    color: string[],
    rect: string,
    warnings: string,
    opacity: number = 1,
  ): PptxBorderOptions {
    let value =
        border !== undefined && border.style !== "none" ? border : undefined,
      value2 = value?.sides?.split(" "),
      value3 = value?.widths,
      callback = (input: string): number =>
        exportedBorderSideWidth(border, input),
      value4 =
        value3 !== undefined
          ? exportBorderSides.filter(
              (input) => callback(input) > 0,
            )
          : value2,
      value5 =
        value === undefined
          ? 0
          : value3 !== undefined
            ? Math.max(0, ...exportBorderSides.map(callback))
            : (value.width ?? 3);
    if (value === undefined || value5 <= 0) {
      return {
        w: value5,
        widthOf: callback,
        sides: value4,
      };
    }
    if (value.color === undefined) {
      color.push(
        rect +
          " border skipped (currentcolor is not converted by the PPTX export)" +
          warnings,
      );
      return {
        w: value5,
        widthOf: callback,
        sides: value4,
      };
    }
    let value6 = cssToPptxColor(value.color);
    if (value6 === undefined) {
      color.push(
        rect +
          ' border skipped (color "' +
          value.color +
          '" is not converted by the PPTX export)' +
          warnings,
      );
      return {
        w: value5,
        widthOf: callback,
        sides: value4,
      };
    }
    let value7 = applyPptxOpacity(value6, opacity);
    if (value7.transparency === 100) {
      return {
        w: value5,
        widthOf: callback,
        sides: value4,
      };
    }
    if (value.style === "double") {
      color.push(
        "double border exported as solid (PPTX lines have no double style)" +
          warnings,
      );
    }
    let value8: PptxLine["dashType"] =
      value.style === "dashed"
        ? "dash"
        : value.style === "dotted"
          ? "sysDot"
          : "solid";
    return {
      w: value5,
      widthOf: callback,
      sides: value4,
      line: {
        ...value7,
        width: pxToPoints(value5),
        dashType: value8,
      },
    };
  }
  function writePptxBorderSides(
    slide: PptxSlideWriter,
    rect: PptxRect,
    sideWidth: (side: string) => number,
    sides: string[],
    color: PptxColor,
  ): void {
    let { x: value, y: value2, w: value3, h: value4 } = rect;
    for (let value5 of sides) {
      let value6 = sideWidth(value5),
        value7 = value6 / 2,
        value8: PptxQuad<number> | undefined =
          value5 === "top"
            ? [value, value2 + value7, value3, 0]
            : value5 === "bottom"
              ? [value, value2 + value4 - value7, value3, 0]
              : value5 === "left"
                ? [value + value7, value2, 0, value4]
                : value5 === "right"
                  ? [value + value3 - value7, value2, 0, value4]
                  : undefined;
      if (value8 !== undefined) {
        slide.addShape("line", {
          ...pptxRectOptions(
            rotateRectWithinParent(
              {
                x: value8[0],
                y: value8[1],
                w: value8[2],
                h: value8[3],
              },
              rect,
            ),
          ),
          line: {
            ...color,
            width: pxToPoints(value6),
          },
        });
      }
    }
  }
  function pptxShadowOptions(
    shadow: ShadowValue,
    warnings: string[],
    kind: string,
    location2: string,
    allowInset: boolean,
    opacity: number = 1,
  ): PptxShadow | undefined {
    if (shadow.inset === true && !allowInset) {
      warnings.push(
        "inset " +
          kind +
          " shadow skipped (PPTX shapes carry outer shadows only)" +
          location2,
      );
      return;
    }
    let color = cssToPptxColor(shadow.color);
    if (color === undefined) {
      warnings.push(
        kind +
          ' shadow skipped (color "' +
          shadow.color +
          '" is not converted by the PPTX export)' +
          location2,
      );
      return;
    }
    let value = (1 - (color.transparency ?? 0) / 100) * opacity;
    if (value <= 0) {
      return;
    }
    let value2 = pxToPoints(
        Math.max(0, shadow.blur + (shadow.spread ?? 0)),
      ),
      value3 = pxToPoints(Math.hypot(shadow.x, shadow.y)),
      value4 = (Math.atan2(shadow.y, shadow.x) * 180) / Math.PI;
    return {
      type: shadow.inset === true ? "inner" : "outer",
      color: color.color,
      opacity: value,
      blur: value2 > 0 ? value2 : 0.000000001,
      offset: value3 > 0 ? value3 : 0.000000001,
      angle: Math.max(1, Math.round(((value4 % 360) + 360) % 360) % 360),
    };
  }
  function writePptxBox(
    slide: PptxSlideWriter,
    leaf: PptxBoxLeaf,
    location2: string,
    warnings: string[],
    assets?: PptxBoxShapeHook,
  ): void {
    if (leaf.blend !== undefined) {
      warnings.push(
        "box paint skipped (mix-blend-mode " +
          leaf.blend +
          " has no PowerPoint equivalent)" +
          location2,
      );
      return;
    }
    let value = leaf.opacity ?? 1;
    if (value <= 0) {
      return;
    }
    let value2: PptxShapeGradient | undefined;
    if (leaf.gradient !== undefined) {
      let value22 = pptxGradientStops(leaf.gradient.stops, value);
      if (value22 !== undefined) {
        value2 =
          leaf.gradient.radial === true
            ? {
                type: "gradient",
                stops: value22,
                gradientPath: "circle",
                ...(leaf.gradient.at !== undefined
                  ? {
                      focus: {
                        x: Math.max(0, Math.min(100, leaf.gradient.at.x)),
                        y: Math.max(0, Math.min(100, leaf.gradient.at.y)),
                      },
                    }
                  : {}),
              }
            : {
                type: "gradient",
                stops: value22,
                angle: (((leaf.gradient.angle - 90) % 360) + 360) % 360,
              };
        if (
          leaf.gradient.repeat !== undefined &&
          leaf.gradient.radial !== true
        ) {
          warnings.push(
            "repeating box gradient exported as one stretched ramp (PPTX gradients do not repeat)" +
              location2,
          );
        }
        if (
          leaf.gradient.radial === true &&
          leaf.gradient.extent !== undefined
        ) {
          warnings.push(
            "a radial gradient's " +
              leaf.gradient.extent +
              " size is not kept in PowerPoint" +
              location2,
          );
        }
      } else {
        warnings.push(
          "box gradient skipped (a stop color is not converted by the PPTX export)" +
            location2,
        );
      }
    }
    let value3: PptxColor | undefined;
    if (leaf.fill !== undefined) {
      let value22 = cssToPptxColor(leaf.fill);
      if (value22 === undefined) {
        warnings.push(
          'box fill skipped (color "' +
            leaf.fill +
            '" is not converted by the PPTX export)' +
            location2,
        );
      } else if (applyPptxOpacity(value22, value).transparency !== 100) {
        value3 = applyPptxOpacity(value22, value);
      }
    }
    let value4 = value2 ?? value3,
      value5 = value2 !== undefined ? value3 : undefined,
      {
        w: value6,
        widthOf: value7,
        line: value8,
        sides: value9,
      } = pptxBorderOptions(
        leaf.border,
        warnings,
        "box",
        location2,
        value,
      ),
      value10 =
        value9 ??
        (leaf.clipRounded === true &&
        value8 !== undefined &&
        (value8.dashType ?? "solid") === "solid"
          ? [...exportBorderSides]
          : undefined),
      value11 =
        value8 !== undefined && value10 === undefined ? value8 : undefined,
      value12 =
        value4 === undefined && value9 === undefined && value10 !== undefined;
    if (
      value4 === undefined &&
      value11 === undefined &&
      leaf.shadow !== undefined &&
      !value12
    ) {
      warnings.push(
        "box shadow skipped (no fill or outline to cast it)" + location2,
      );
    }
    if (value4 === undefined && value8 === undefined) {
      return;
    }
    let value13 =
        leaf.shadow !== undefined &&
        (value4 !== undefined || value11 !== undefined)
          ? pptxShadowOptions(
              leaf.shadow,
              warnings,
              "box",
              location2,
              false,
              value,
            )
          : undefined,
      value14 = value11 !== undefined ? value6 / 2 : 0,
      value15 = insetRect(leaf.rect, {
        left: value14,
        top: value14,
        right: value14,
        bottom: value14,
      }),
      state = {
        ...value15,
        w: Math.max(1, value15.w),
        h: Math.max(1, value15.h),
      },
      value16 = Math.min(
        Math.max(0, (leaf.radius ?? 0) - value14),
        state.w / 2,
        state.h / 2,
      ),
      value17 =
        leaf.corners !== undefined
          ? insetCornerRadii(leaf.corners, value14)
          : undefined,
      value18 = Math.max(0, (leaf.radius ?? 0) - value14),
      value19 =
        leaf.clipRounded === true
          ? oversizedCornerCutout(
              state.w,
              state.h,
              value17 ?? {
                tl: value18,
                tr: value18,
                br: value18,
                bl: value18,
              },
            )
          : undefined;
    if (value19?.length === 0) {
      return;
    }
    let value20 =
        value19 ??
        (value17 !== undefined
          ? roundedCornerPath(state.w, state.h, value17)
          : undefined),
      value21 =
        value20 !== undefined ? "custGeom" : value16 > 0 ? "roundRect" : "rect",
      state2 = {
        ...pptxRectOptions(state),
        ...(value20 !== undefined
          ? {
              points: pptxPathToEmu(value20),
            }
          : value16 > 0
            ? {
                rectRadius: pxToInches(value16),
              }
            : {}),
      };
    if (value4 !== undefined || value11 !== undefined) {
      try {
        if (value5 !== undefined) {
          slide.addShape(value21, {
            ...state2,
            fill: value5,
            ...(value13 !== undefined
              ? {
                  shadow: value13,
                }
              : {}),
          });
        }
        let state3 = {
          ...state2,
          ...(value4 !== undefined
            ? {
                fill: value4,
              }
            : {}),
          ...(value11 !== undefined
            ? {
                line: value11,
              }
            : {}),
          ...(value13 !== undefined && value5 === undefined
            ? {
                shadow: value13,
              }
            : {}),
        };
        if (
          !(
            assets !== undefined &&
            (value4 !== undefined || value13 === undefined) &&
            assets(
              value21,
              state3,
              state,
              value21 === "roundRect" ? value16 : 0,
            )
          )
        ) {
          slide.addShape(value21, state3);
        }
      } catch (value22: unknown) {
        warnings.push(
          "addShape failed: " +
            (value22 instanceof Error ? value22.message : String(value22)),
        );
      }
    }
    if (value8 !== undefined && value10 !== undefined) {
      let value22 = value16 > 0 || leaf.corners !== undefined,
        value23 = (value8.dashType ?? "solid") === "solid",
        value24 = leaf.corners ?? {
          tl: value16,
          tr: value16,
          br: value16,
          bl: value16,
        };
      if (
        value22 &&
        !value23 &&
        (leaf.clipRounded !== true ||
          borderSidesHaveRoundedCorners(value10, value24))
      ) {
        warnings.push(
          "a dashed or dotted border that is not the same on all four sides of a box with rounded or clipped corners exported as straight lines" +
            location2,
        );
      }
      try {
        let state3 = {
            left: value7("left"),
            top: value7("top"),
            right: value7("right"),
            bottom: value7("bottom"),
          },
          state4 = {
            color: value8.color,
            ...(value8.transparency !== undefined
              ? {
                  transparency: value8.transparency,
                }
              : {}),
          };
        if (value22 && value23 && leaf.clipRounded === true) {
          let value25 = borderBandRects(
              leaf.rect.w,
              leaf.rect.h,
              value24,
              state3,
            ),
            value26 =
              value12 && leaf.shadow !== undefined
                ? pptxShadowOptions(
                    leaf.shadow,
                    warnings,
                    "box",
                    location2,
                    false,
                    value,
                  )
                : undefined;
          if (value25.length > 0) {
            slide.addShape("custGeom", {
              ...pptxRectOptions(leaf.rect),
              points: pptxPathToEmu(value25),
              fill: state4,
              ...(value26 !== undefined
                ? {
                    shadow: value26,
                  }
                : {}),
            });
          }
        } else if (value22 && value23) {
          let value25 = roundedBorderBandPath(
            leaf.rect.w,
            leaf.rect.h,
            value24,
            state3,
          );
          if (value25.length > 0) {
            slide.addShape("custGeom", {
              ...pptxRectOptions(leaf.rect),
              points: pptxPathToEmu(value25),
              fill: state4,
            });
          }
        } else {
          writePptxBorderSides(slide, leaf.rect, value7, value10, value8);
        }
      } catch (value25: unknown) {
        warnings.push(
          "addShape failed: " +
            (value25 instanceof Error ? value25.message : String(value25)),
        );
      }
    }
  }
  function writePptxTable(
    slide: PptxSlideWriter,
    leaf: PptxTableLeaf,
    background: string | undefined,
    warnings: string[],
  ): void {
    if (leaf.rows.length === 0) {
      warnings.push("table skipped (no rows after truncation)");
      return;
    }
    if (leaf.rect.rotate !== undefined) {
      warnings.push(
        "rotated table exported unrotated (PPTX tables do not turn)",
      );
    }
    let value = leaf.role ?? "body",
      value2: PptxTypeScale = (0, runtime.renderingTypeScaleForRole)(value),
      state = {
        ...value2,
        fontSize: (leaf.fontSize ?? value2.fontSize) * (leaf.fitScale ?? 1),
      },
      value3 = flattenedSlideBackground(background),
      value4 = [...(leaf.backgrounds ?? [])]
        .reverse()
        .reduce((input, options) => {
          let value21 = cssToPptxColor(options.color),
            value22 =
              (1 - (value21?.transparency ?? 0) / 100) *
              Math.min(1, Math.max(0, options.opacity ?? 1));
          if (value21 === undefined) {
            return input;
          } else {
            return (
              "#" +
              (value22 >= 1
                ? value21.color
                : blendPptxColors("#" + value21.color, input, value22))
            );
          }
        }, value3),
      value5: string =
        (leaf.color !== undefined
          ? (0, runtime.resolveSlideColor)(leaf.color)
          : undefined) ?? (0, runtime.slideTextColor)(background),
      value6 = pxToInches(leaf.rect.w),
      value7 =
        leaf.colWidths !== undefined && leaf.colWidths.length === leaf.cols
          ? leaf.colWidths
          : Array.from<unknown, number>(
              {
                length: leaf.cols,
              },
              () => 1,
            ),
      value8 = value7.reduce(
        (input, options) => input + options,
        0,
      ),
      value9 = value7.map(
        (input) =>
          value8 > 0 ? (input / value8) * value6 : value6 / value7.length,
      ),
      value10: string = (0, runtime.slideTextColor)(background),
      value11 = blendPptxColors(value10, value4, 0.08),
      state2: PptxTableBorder = {
        type: "solid",
        color: blendPptxColors(value10, value4, 0.22),
        pt: 1,
      },
      state3: PptxTableBorder = {
        type: "none",
      },
      value12 = pxToPoints(state.fontSize * state.lineHeight),
      callback = (input: number, options: number): string | undefined => {
        let value21 =
          leaf.cellStyles?.[String(input) + "." + String(options)]?.color;
        if (value21 === undefined) {
          return;
        }
        let value22 = (0, runtime.resolveSlideColor)(value21);
        if (value22 === undefined) {
          return undefined;
        } else {
          return hexToPptxColor(value22).color;
        }
      },
      callback2 = (input: number): string | undefined => {
        let value21 = leaf.rowStyles?.[String(input)]?.background,
          value22 =
            value21 !== undefined
              ? (0, runtime.resolveSlideColor)(value21)
              : undefined;
        if (value22 === undefined) {
          return;
        }
        let { color: value23, transparency: value24 = 0 } =
          hexToPptxColor(value22);
        if (value24 === 0) {
          return value23;
        } else {
          return blendPptxColors("#" + value23, value4, 1 - value24 / 100);
        }
      },
      frame = leaf.frame,
      value13 =
        leaf.rowHeights?.length === leaf.rows.length
          ? leaf.rowHeights[0]
          : undefined,
      value14: PptxPathPoint[] | undefined;
    if (
      frame !== undefined &&
      value13 !== undefined &&
      leaf.header &&
      callback2(0) === undefined
    ) {
      let value21 = frame.corners ?? {
        tl: frame.radius ?? 0,
        tr: frame.radius ?? 0,
        br: frame.radius ?? 0,
        bl: frame.radius ?? 0,
      };
      if (frame.clipRounded === true) {
        let value22 = cornerCutoutCanvas(
          frame.rect.w,
          frame.rect.h,
          value21,
        );
        value14 = roundedCornerCutout(
          value22.W,
          value22.H,
          {
            x: value22.x + leaf.rect.x - frame.rect.x,
            y: value22.y + leaf.rect.y - frame.rect.y,
            w: leaf.rect.w,
            h: value13,
          },
          value21,
        );
      } else {
        let borders = frame.borders,
          value22 = Math.min(
            1,
            frame.rect.w / (value21.tl + value21.tr || 1),
            frame.rect.w / (value21.bl + value21.br || 1),
            frame.rect.h / (value21.tl + value21.bl || 1),
            frame.rect.h / (value21.tr + value21.br || 1),
          ),
          value23 = insetCornerRadii(
            {
              tl: value21.tl * value22,
              tr: value21.tr * value22,
              br: value21.br * value22,
              bl: value21.bl * value22,
            },
            {
              tl: Math.min(borders.top, borders.left),
              tr: Math.min(borders.top, borders.right),
              br: Math.min(borders.bottom, borders.right),
              bl: Math.min(borders.bottom, borders.left),
            },
          ),
          [items, items2] = [
            frame.rect.w - borders.left - borders.right,
            frame.rect.h - borders.top - borders.bottom,
          ],
          callback4 = (input: number, options: number, context: number): number =>
            input + options > context ? context / (input + options) : 1,
          [items3, items4, items5, items6] = [
            callback4(value23.tl, value23.tr, items),
            callback4(value23.bl, value23.br, items),
            callback4(value23.tl, value23.bl, items2),
            callback4(value23.tr, value23.br, items2),
          ],
          state5 = {
            tl: value23.tl * Math.min(items3, items5),
            tr: value23.tr * Math.min(items3, items6),
            br: value23.br * Math.min(items4, items6),
            bl: value23.bl * Math.min(items4, items5),
          };
        value14 = roundedCornerCutout(
          items,
          items2,
          {
            x: leaf.rect.x - frame.rect.x - borders.left,
            y: leaf.rect.y - frame.rect.y - borders.top,
            w: leaf.rect.w,
            h: value13,
          },
          state5,
        );
      }
      if (value14 !== undefined && value14.length > 0) {
        slide.addShape("custGeom", {
          ...pptxRectOptions({
            x: leaf.rect.x,
            y: leaf.rect.y,
            w: leaf.rect.w,
            h: value13,
          }),
          points: pptxPathToEmu(value14),
          fill: {
            color: value11,
          },
        });
      }
    }
    let value15 = leaf.rows.map(
        (input, options) =>
          "#" +
          (callback2(options) ??
            (leaf.header && options === 0 ? value11 : value4.slice(1))),
      ),
      callback3 = (input: string): PptxTableBorder => ({
        type: "solid",
        color: blendPptxColors(value10, input, 0.22),
        pt: 1,
      }),
      value16 =
        leaf.openTopLeft === true ||
        value15.some(
          (input) =>
            input.toUpperCase() !== value4.toUpperCase(),
        ),
      value17: PptxTableCell[][] = leaf.rows.map(
        (input, options): PptxTableCell[] => {
          let value21 = callback2(options);
          return input.map((input2, options2): PptxTableCell => {
            let value22 = leaf.colAligns?.[options2],
              value23 = callback(options, options2),
              state5: PptxTableCellOptions = {
                lineSpacing: value12,
                ...(value22 !== undefined && value22 !== "start"
                  ? {
                      align: pptxTextAlignment(value22),
                    }
                  : {}),
                ...(value23 !== undefined
                  ? {
                      color: value23,
                    }
                  : {}),
                bold:
                  leaf.header && options === 0
                    ? (leaf.headerWeight ?? 600) >= 600
                    : state.fontWeight >= 600,
                ...(leaf.header && options === 0 && value14 === undefined
                  ? {
                      fill: {
                        color: value11,
                      },
                    }
                  : {}),
                ...(value21 !== undefined
                  ? {
                      fill: {
                        color: value21,
                      },
                    }
                  : {}),
                ...(value16
                  ? {
                      border: [
                        options === 0
                          ? leaf.openTopLeft === true
                            ? state3
                            : state2
                          : callback3(value15[options - 1]!),
                        callback3(value15[options]!),
                        callback3(value15[options]!),
                        options2 === 0
                          ? leaf.openTopLeft === true
                            ? state3
                            : state2
                          : callback3(value15[options]!),
                      ],
                    }
                  : {}),
              };
            return {
              _type: "tablecell",
              text: input2,
              options: state5,
            };
          });
        },
      ),
      value18 = pxToInches(leaf.rect.x),
      value19 = pxToInches(leaf.rect.y);
    if (value18 < 0 || value19 < 0) {
      warnings.push(
        "table at a negative position exported clamped to the slide edge",
      );
    }
    let value20 =
        leaf.rowHeights !== undefined &&
        leaf.rowHeights.length === leaf.rows.length
          ? leaf.rowHeights.map(pxToInches)
          : undefined,
      state4: PptxTableOptions = {
        x: pptxLengthEmu(value18),
        y: pptxLengthEmu(value19),
        w: pptxPositionEmu(value6),
        colW: value9.map(pptxPositionEmu),
        ...(value20 !== undefined
          ? {
              rowH: value20.map(pptxPositionEmu),
              h: pptxPositionEmu(
                value20.reduce(
                  (input, options) =>
                    input + options,
                  0,
                ),
              ),
            }
          : {}),
        fontFace: pptxFontFace(value, leaf.fontFamily),
        fontPitchFamily: pptxFontFamilyPitch(value, leaf.fontFamily),
        fontSize: pxToPoints(state.fontSize),
        color: hexToPptxColor(value5).color,
        valign: "top",
        border: state2,
        margin:
          leaf.cellPadding !== undefined
            ? [0, 1, 2, 3].map(
                (input) =>
                  pxToInches(
                    (input % 2 === 0
                      ? leaf.cellPadding!.y
                      : leaf.cellPadding!.x) ?? state.fontSize * 0.35,
                  ),
              )
            : pxToInches(state.fontSize * 0.35),
        autoPage: false,
      };
    try {
      slide.addTable(value17, state4);
    } catch (value21: unknown) {
      warnings.push(
        "addTable failed: " +
          (value21 instanceof Error ? value21.message : String(value21)),
      );
    }
  }
  async function exportPptxBlob(
    deck: PptxExportDeck,
    options?: PptxExportOptions,
  ): Promise<PptxBlobResult> {
    let { pptx: presentation, warnings: warnings } =
      buildPptxPresentation(deck, options);
    return {
      blob: await presentation.write({
        outputType: "blob",
        compression: true,
      }),
      warnings: warnings,
    };
  }
  bindRuntimeValue(
    runtime,
    "pptxGeometryExports",
    () => pptxGeometryExports,
    (value) => {
      pptxGeometryExports = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rotateRectWithinParent",
    () => rotateRectWithinParent,
  );
  bindRuntimeValue(runtime, "insetRect", () => insetRect);
  bindRuntimeValue(
    runtime,
    "unrotateRectWithinParent",
    () => unrotateRectWithinParent,
  );
  bindRuntimeValue(runtime, "pptxPositionEmu", () => pptxPositionEmu);
  bindRuntimeValue(runtime, "pptxLengthEmu", () => pptxLengthEmu);
  bindRuntimeValue(runtime, "pptxRectOptions", () => pptxRectOptions);
  bindRuntimeValue(runtime, "roundedCornerPath", () => roundedCornerPath);
  bindRuntimeValue(
    runtime,
    "roundedBorderBandPath",
    () => roundedBorderBandPath,
  );
  bindRuntimeValue(runtime, "insetCornerRadii", () => insetCornerRadii);
  bindRuntimeValue(runtime, "roundedCornerCutout", () => roundedCornerCutout);
  bindRuntimeValue(
    runtime,
    "oversizedCornerCutout",
    () => oversizedCornerCutout,
  );
  bindRuntimeValue(runtime, "cornerCutoutCanvas", () => cornerCutoutCanvas);
  bindRuntimeValue(runtime, "borderBandRects", () => borderBandRects);
  bindRuntimeValue(
    runtime,
    "borderSidesHaveRoundedCorners",
    () => borderSidesHaveRoundedCorners,
  );
  bindRuntimeValue(runtime, "translatePptxPath", () => translatePptxPath);
  bindRuntimeValue(runtime, "pptxPathToEmu", () => pptxPathToEmu);
  bindRuntimeValue(runtime, "letterboxCutout", () => letterboxCutout);
  bindRuntimeValue(runtime, "pxToInches", () => pxToInches);
  bindRuntimeValue(runtime, "pxToPoints", () => pxToPoints);
  bindRuntimeValue(runtime, "hexToPptxColor", () => hexToPptxColor);
  bindRuntimeValue(runtime, "readHexColorByte", () => readHexColorByte);
  bindRuntimeValue(runtime, "blendPptxColors", () => blendPptxColors);
  bindRuntimeValue(
    runtime,
    "flattenedSlideBackground",
    () => flattenedSlideBackground,
  );
  bindRuntimeValue(runtime, "pptxTextDecoration", () => pptxTextDecoration);
  bindRuntimeValue(runtime, "cssToPptxColor", () => cssToPptxColor);
  bindRuntimeValue(runtime, "pptxFontFace", () => pptxFontFace);
  bindRuntimeValue(runtime, "pptxFontFamilyPitch", () => pptxFontFamilyPitch);
  bindRuntimeValue(runtime, "pptxTextAlignment", () => pptxTextAlignment);
  bindRuntimeValue(runtime, "pptxFilename", () => pptxFilename);
  bindRuntimeValue(runtime, "exportedSlideTitle", () => exportedSlideTitle);
  bindRuntimeValue(
    runtime,
    "createWeightedCounter",
    () => createWeightedCounter,
  );
  bindRuntimeValue(runtime, "pptxColorLuminance", () => pptxColorLuminance);
  bindRuntimeValue(runtime, "pptxColorIsChromatic", () => pptxColorIsChromatic);
  bindRuntimeValue(runtime, "medianNumber", () => medianNumber);
  bindRuntimeValue(runtime, "pptxColorsNear", () => pptxColorsNear);
  bindRuntimeValue(
    runtime,
    "pptxLargeTextHasContrast",
    () => pptxLargeTextHasContrast,
  );
  bindRuntimeValue(
    runtime,
    "exportLeafPaintsBackground",
    () => exportLeafPaintsBackground,
  );
  bindRuntimeValue(
    runtime,
    "textLeafOverlapsPaint",
    () => textLeafOverlapsPaint,
  );
  bindRuntimeValue(runtime, "inferPptxDeckTheme", () => inferPptxDeckTheme);
  bindRuntimeValue(runtime, "visiblePptxColor", () => visiblePptxColor);
  bindRuntimeValue(
    runtime,
    "mostFrequentPptxValue",
    () => mostFrequentPptxValue,
  );
  bindRuntimeValue(
    runtime,
    "pptxPlaceholderTextOptions",
    () => pptxPlaceholderTextOptions,
  );
  bindRuntimeValue(runtime, "pptxSlideMaster", () => pptxSlideMaster);
  bindRuntimeValue(
    runtime,
    "pptxMasterForBackdrop",
    () => pptxMasterForBackdrop,
  );
  bindRuntimeValue(
    runtime,
    "createPptxPresentation",
    () => createPptxPresentation,
  );
  bindRuntimeValue(
    runtime,
    "buildPptxPresentation",
    () => buildPptxPresentation,
  );
  bindRuntimeValue(runtime, "pptxGradientStops", () => pptxGradientStops);
  bindRuntimeValue(runtime, "applyPptxTextFill", () => applyPptxTextFill);
  bindRuntimeValue(runtime, "capitalizePptxText", () => capitalizePptxText);
  bindRuntimeValue(runtime, "pptxListOptions", () => pptxListOptions);
  bindRuntimeValue(runtime, "textBoxHugsOrFills", () => textBoxHugsOrFills);
  bindRuntimeValue(runtime, "writtenPptxAlignment", () => writtenPptxAlignment);
  bindRuntimeValue(runtime, "textBoxAvailableRoom", () => textBoxAvailableRoom);
  bindRuntimeValue(runtime, "pptxTextBoxPadding", () => pptxTextBoxPadding);
  bindRuntimeValue(runtime, "textInShapeOptions", () => textInShapeOptions);
  bindRuntimeValue(runtime, "writePptxText", () => writePptxText);
  bindRuntimeValue(runtime, "writePptxImage", () => writePptxImage);
  bindRuntimeValue(runtime, "applyPptxOpacity", () => applyPptxOpacity);
  bindRuntimeValue(
    runtime,
    "exportedBorderSideWidth",
    () => exportedBorderSideWidth,
  );
  bindRuntimeValue(runtime, "pptxBorderOptions", () => pptxBorderOptions);
  bindRuntimeValue(runtime, "writePptxBorderSides", () => writePptxBorderSides);
  bindRuntimeValue(runtime, "pptxShadowOptions", () => pptxShadowOptions);
  bindRuntimeValue(runtime, "writePptxBox", () => writePptxBox);
  bindRuntimeValue(runtime, "writePptxTable", () => writePptxTable);
  bindRuntimeValue(runtime, "exportPptxBlob", () => exportPptxBlob);
  bindRuntimeValue(
    runtime,
    "pptxExportInternals",
    () => pptxExportInternals,
    (value) => {
      pptxExportInternals = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportPixelsPerInch",
    () => exportPixelsPerInch,
    (value) => {
      exportPixelsPerInch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultMasterName",
    () => defaultMasterName,
    (value) => {
      defaultMasterName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxMasterNameLength",
    () => maxMasterNameLength,
    (value) => {
      maxMasterNameLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "titleRolePriority",
    () => titleRolePriority,
    (value) => {
      titleRolePriority = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxInferredFontSize",
    () => maxInferredFontSize,
    (value) => {
      maxInferredFontSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxInferredBodyFontSize",
    () => maxInferredBodyFontSize,
    (value) => {
      maxInferredBodyFontSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "minThemeColorSamples",
    () => minThemeColorSamples,
    (value) => {
      minThemeColorSamples = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "chromaticColorThreshold",
    () => chromaticColorThreshold,
    (value) => {
      chromaticColorThreshold = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "themeColorSimilarityThreshold",
    () => themeColorSimilarityThreshold,
    (value) => {
      themeColorSimilarityThreshold = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "capitalizationWordCharacterPattern",
    () => capitalizationWordCharacterPattern,
    (value) => {
      capitalizationWordCharacterPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "capitalizationApostrophePattern",
    () => capitalizationApostrophePattern,
    (value) => {
      capitalizationApostrophePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "capitalizationCjkCharacterPattern",
    () => capitalizationCjkCharacterPattern,
    (value) => {
      capitalizationCjkCharacterPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxTextPaddingRatio",
    () => pptxTextPaddingRatio,
    (value) => {
      pptxTextPaddingRatio = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxListNumberWidthFactor",
    () => pptxListNumberWidthFactor,
    (value) => {
      pptxListNumberWidthFactor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxMaximumTextWidth",
    () => pptxMaximumTextWidth,
    (value) => {
      pptxMaximumTextWidth = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxTextHugTolerancePx",
    () => pptxTextHugTolerancePx,
    (value) => {
      pptxTextHugTolerancePx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxTextAlignmentTolerancePx",
    () => pptxTextAlignmentTolerancePx,
    (value) => {
      pptxTextAlignmentTolerancePx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxShapeTextMarginTolerancePx",
    () => pptxShapeTextMarginTolerancePx,
    (value) => {
      pptxShapeTextMarginTolerancePx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxShapeInsetTolerancePx",
    () => pptxShapeInsetTolerancePx,
    (value) => {
      pptxShapeInsetTolerancePx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxTextHeightTolerancePx",
    () => pptxTextHeightTolerancePx,
    (value) => {
      pptxTextHeightTolerancePx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxRoundedCornerInsetRatio",
    () => pptxRoundedCornerInsetRatio,
    (value) => {
      pptxRoundedCornerInsetRatio = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxMinimumShapeTextRoom",
    () => pptxMinimumShapeTextRoom,
    (value) => {
      pptxMinimumShapeTextRoom = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxTextHugRoomRatio",
    () => pptxTextHugRoomRatio,
    (value) => {
      pptxTextHugRoomRatio = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxTextFillWidthRatio",
    () => pptxTextFillWidthRatio,
    (value) => {
      pptxTextFillWidthRatio = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxTextRoomAllowance",
    () => pptxTextRoomAllowance,
    (value) => {
      pptxTextRoomAllowance = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxBoxOverlapTolerancePx",
    () => pptxBoxOverlapTolerancePx,
    (value) => {
      pptxBoxOverlapTolerancePx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxTextBoxGapTolerancePx",
    () => pptxTextBoxGapTolerancePx,
    (value) => {
      pptxTextBoxGapTolerancePx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxPaddingByAlignment",
    () => pptxPaddingByAlignment,
    (value) => {
      pptxPaddingByAlignment = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pptxPaddingByLeaf",
    () => pptxPaddingByLeaf,
    (value) => {
      pptxPaddingByLeaf = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportBorderSides",
    () => exportBorderSides,
    (value) => {
      exportBorderSides = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePptxExport",
    () => initializePptxExport,
    (value) => {
      initializePptxExport = value;
    },
  );
  return () => {
    pptxGeometryExports = {} as PptxGeometryExports;
    (0, runtime.defineLiveExports)(pptxGeometryExports, {
      unturnedWithin: () => unrotateRectWithinParent,
      turnedWithin: () => rotateRectWithinParent,
      textInShape: () => textInShapeOptions,
      pxToPt: () => pxToPoints,
      pxToIn: () => pxToInches,
      pptxFontFace: () => pptxFontFace,
      pptxFilename: () => pptxFilename,
      pptxAlign: () => pptxTextAlignment,
      newPresentation: () => createPptxPresentation,
      insetRect: () => insetRect,
      hexToPptx: () => hexToPptxColor,
      deckToPptxBlob: () => exportPptxBlob,
      cssColorToPptx: () => cssToPptxColor,
      capitalized: () => capitalizePptxText,
      buildPptx: () => buildPptxPresentation,
      blendOver: () => blendPptxColors,
      _test: () => pptxExportInternals,
      PX_PER_IN: () => exportPixelsPerInch,
    });
    exportPixelsPerInch = 144;
    defaultMasterName = "Title and body";
    maxMasterNameLength = 80;
    maxInferredFontSize = 128;
    maxInferredBodyFontSize = 48;
    minThemeColorSamples = 3;
    chromaticColorThreshold = 0.15;
    themeColorSimilarityThreshold = 24;
    pptxTextPaddingRatio = 0.06;
    pptxListNumberWidthFactor = 1.1;
    pptxMaximumTextWidth = 8064;
    pptxTextHugTolerancePx = 1.5;
    pptxTextAlignmentTolerancePx = 2;
    pptxShapeTextMarginTolerancePx = 0.5;
    pptxShapeInsetTolerancePx = 0.05;
    pptxTextHeightTolerancePx = 0.5;
    pptxRoundedCornerInsetRatio = 0.29289;
    pptxMinimumShapeTextRoom = 8;
    pptxTextHugRoomRatio = 0.2;
    pptxTextFillWidthRatio = 0.94;
    pptxTextRoomAllowance = (input: number): number =>
      Math.max(8, input * 0.03);
    pptxBoxOverlapTolerancePx = 1;
    pptxTextBoxGapTolerancePx = 2;
    pptxPaddingByAlignment = (
      input: PptxAlign,
      options: number,
    ): PptxHorizontalPadding =>
      input === "right"
        ? {
            left: options,
            right: 0,
          }
        : input === "center"
          ? {
              left: options / 2,
              right: options / 2,
            }
          : {
              left: 0,
              right: options,
            };
    pptxPaddingByLeaf = (input: PptxTextLeaf): PptxHorizontalPadding =>
      pptxPaddingByAlignment(
        writtenPptxAlignment(input),
        pptxTextRoomAllowance(input.rect.w),
      );
    initializePptxExport = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeImageCrop)();
      (0, runtime.initializeRichTextDom)();
      (0, runtime.initializeUiContrast)();
      (0, runtime.initializeRenderingTheme)();
      pptxExportInternals = {
        cornerPath: roundedCornerPath,
        borderBandPath: roundedBorderBandPath,
        cornerCut: roundedCornerCutout,
        letterboxCut: letterboxCutout,
        slideTitle: exportedSlideTitle,
        deckLook: inferPptxDeckTheme,
        textBoxRoom: pptxTextBoxPadding,
        writtenAlign: writtenPptxAlignment,
        pptxPitchFamily: pptxFontFamilyPitch,
      };
      titleRolePriority = ["display", "h1", "h2", "h3"];
      capitalizationWordCharacterPattern =
        /^[\p{Alphabetic}\p{Nd}\p{Pc}\p{M}]$/u;
      capitalizationApostrophePattern = /^['\u2019\u00B7\u2027]$/u;
      capitalizationCjkCharacterPattern =
        /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]$/u;
      exportBorderSides = ["top", "right", "bottom", "left"];
    });
  };
}
