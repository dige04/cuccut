/** Public document contracts reconstructed from parsers and serializers. */
import type { VideoLink } from "./media/video-links";

export type SlideId = string;

// ---------------------------------------------------------------------------
// Shared enumerations (the allowed values live in the model modules).
// ---------------------------------------------------------------------------

/** Typographic role of a text node (`textRoles`). */
export type TextRole =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "lead"
  | "eyebrow"
  | "body"
  | "caption";
/** Palette names a slide colour may use instead of a hex literal (`namedSlideColors`). */
export type SlideColorName =
  | "slate"
  | "ivory"
  | "ivory-warm"
  | "clay"
  | "oat"
  | "white"
  | "text-secondary"
  | "text-tertiary";
/** A slide colour is either a `#hex` literal or a palette name; kept as `string` because both are plain strings in the model. */
export type SlideColor = string;
/** Fit behaviour of text and tables inside their box (`textFitValues`). */
export type TextFit = "shrink" | "none" | "grow";
export type Alignment = "start" | "center" | "end";
export type TextAlignment = Alignment | "justify";
export type ContainerAlignment = Alignment | "stretch" | "baseline";
export type Justification =
  | Alignment
  | "between"
  | "around"
  | "evenly";
export type SlideTransition = "fade" | "push" | "magic";
export type BuildEffectName =
  | "fade"
  | "rise"
  | "drop"
  | "left"
  | "right"
  | "scale"
  | "pop";
/** How lists are rendered: only the CSS mode is stored, absence means the default. */
export type ListRenderingMode = "css";
export type ShapeVariant =
  | "rect"
  | "rounded"
  | "ellipse"
  | "diamond"
  | "arrow-right"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "line"
  | "connector";
export type ConnectorCorner = "tl" | "tr" | "bl" | "br";
export type ConnectorHead = "end" | "both" | "none";
export type ArrowHeadKind = "none" | "open" | "filled";
export type ConnectorRouting = "straight" | "elbow" | "hv" | "vh";
export type ShadowPresetName = "subtle" | "medium" | "strong";

// ---------------------------------------------------------------------------
// Style bag (normalised by `normalizeStyleBag` in model/style-schema.ts).
// ---------------------------------------------------------------------------

export type FontStyleValue = "normal" | "italic";
export type TextAlignValue = "left" | "center" | "right" | "justify";
export type TextTransformValue =
  | "none"
  | "uppercase"
  | "lowercase"
  | "capitalize";
export type TextDecorationLineValue = "none" | "underline" | "line-through";
export type TextDecorationStyleValue =
  | "solid"
  | "double"
  | "dotted"
  | "dashed"
  | "wavy";
export type FontFamilyFallback = "sans" | "serif" | "mono" | "helvetica";
/** A custom font family with the generic family used when it is unavailable. */
export interface CustomFontFamilyValue {
  family: string;
  fallback: FontFamilyFallback;
  webSafe?: string;
}
export type FontFamilyValue = FontFamilyFallback | CustomFontFamilyValue;
export type FontVariantNumericValue = "normal" | "tabular-nums";
export type BorderStyleValue = "none" | "solid" | "dashed" | "dotted" | "double";
export type BorderSidesValue =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top right"
  | "top bottom"
  | "top left"
  | "right bottom"
  | "right left"
  | "bottom left"
  | "top right bottom"
  | "top right left"
  | "top bottom left"
  | "right bottom left";
export type BlendModeValue =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten";
export type PositionValue =
  | "static"
  | "relative"
  | "absolute"
  | "sticky"
  | "fixed";
export type FloatValue = "none" | "left" | "right";
export type DisplayValue = "block" | "inline-block" | "flex" | "grid" | "none";
export type VisibilityValue = "visible" | "hidden";
export type OverflowValue = "visible" | "hidden" | "clip" | "auto" | "scroll";
export type PointerEventsValue = "auto" | "none";
export type CursorValue =
  | "default"
  | "pointer"
  | "text"
  | "move"
  | "grab"
  | "grabbing"
  | "crosshair"
  | "not-allowed"
  | "zoom-in"
  | "zoom-out"
  | "help"
  | "wait";
export type EasingValue =
  | "linear"
  | "ease"
  | "ease-in"
  | "ease-out"
  | "ease-in-out";
export type AnimationDirectionValue = "normal" | "reverse" | "alternate";
export type RadialGradientExtent =
  | "closest-side"
  | "closest-corner"
  | "farthest-side";

/** One `box-shadow` / `text-shadow` layer; `spread` and `inset` only exist for box shadows. */
export interface ShadowValue {
  x: number;
  y: number;
  blur: number;
  spread?: number;
  inset?: true;
  color: string;
}
export interface GradientStop {
  color: string;
  pos: number;
}
export interface GradientValue {
  angle: number;
  radial?: true;
  shape?: "ellipse";
  extent?: RadialGradientExtent;
  at?: { x: number; y: number };
  repeat?: number;
  stops: GradientStop[];
}
/** CSS filter functions by name (`blur` in px, `hueRotate` in deg, the rest unitless). */
export interface FilterValue {
  blur?: number;
  brightness?: number;
  contrast?: number;
  saturate?: number;
  grayscale?: number;
  sepia?: number;
  invert?: number;
  hueRotate?: number;
}
export interface TransformValue {
  translateX?: number;
  translateY?: number;
  rotate?: number;
  scale?: number;
  skewX?: number;
  skewY?: number;
}
export type CssSizeValue = { px: number } | { pct: number };
/** Style properties that can be animated or transitioned. */
export type AnimatableStyleProperty =
  | "transform"
  | "opacity"
  | "color"
  | "backgroundColor"
  | "filter"
  | "boxShadow";
export interface TransitionValue {
  properties: AnimatableStyleProperty[];
  duration: number;
  delay: number;
  easing: EasingValue;
}
/** The animatable subset of the style bag used inside keyframes. */
export interface AnimationStyle {
  transform?: TransformValue;
  opacity?: number;
  color?: string;
  backgroundColor?: string;
  filter?: FilterValue;
  boxShadow?: ShadowValue[];
}
export interface AnimationKeyframe {
  at: number;
  style: AnimationStyle;
}
export interface AnimationValue {
  keyframes: AnimationKeyframe[];
  duration: number;
  delay: number;
  iterations: number | "infinite";
  direction: AnimationDirectionValue;
  easing: EasingValue;
}
/** Style properties that may also be set for the hover state. */
export interface HoverStyle {
  color?: string;
  backgroundColor?: string;
  backgroundGradient?: GradientValue;
  borderColor?: string;
  textDecorationLine?: TextDecorationLineValue;
  textDecorationStyle?: TextDecorationStyleValue;
  textDecorationColor?: string;
  opacity?: number;
  boxShadow?: ShadowValue[];
  textShadow?: ShadowValue[];
  filter?: FilterValue;
  cursor?: CursorValue;
}
/** Validated per-node style properties; every key is optional and absent keys are inherited defaults. */
export interface StyleBag {
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: FontStyleValue;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: TextAlignValue;
  textTransform?: TextTransformValue;
  textDecorationLine?: TextDecorationLineValue;
  textDecorationStyle?: TextDecorationStyleValue;
  textDecorationColor?: string;
  fontFamily?: FontFamilyValue;
  fontVariantNumeric?: FontVariantNumericValue;
  color?: string;
  backgroundColor?: string;
  backgroundGradient?: GradientValue;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  borderWidth?: number;
  borderStyle?: BorderStyleValue;
  borderColor?: string;
  borderSides?: BorderSidesValue;
  borderTopWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomRightRadius?: number;
  borderBottomLeftRadius?: number;
  opacity?: number;
  boxShadow?: ShadowValue[];
  textShadow?: ShadowValue[];
  textStrokeWidth?: number;
  textStrokeColor?: string;
  filter?: FilterValue;
  backdropFilter?: FilterValue;
  transform?: TransformValue;
  mixBlendMode?: BlendModeValue;
  position?: PositionValue;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  zIndex?: number;
  float?: FloatValue;
  display?: DisplayValue;
  visibility?: VisibilityValue;
  overflow?: OverflowValue;
  pointerEvents?: PointerEventsValue;
  cursor?: CursorValue;
  width?: CssSizeValue;
  height?: CssSizeValue;
  minWidth?: CssSizeValue;
  minHeight?: CssSizeValue;
  maxWidth?: CssSizeValue;
  maxHeight?: CssSizeValue;
  transition?: TransitionValue;
  animation?: AnimationValue;
  hover?: HoverStyle;
}
/** Names of the style properties the schema knows (the keys of `StyleBag` except `hover`). */
export type StylePropertyName = Exclude<keyof StyleBag, "hover">;

// ---------------------------------------------------------------------------
// Slide nodes.
// ---------------------------------------------------------------------------

export type AxisAnchor = "leading" | "trailing" | "center" | "fill";
export interface Axis {
  anchor: AxisAnchor;
  margin: number;
  offset: number;
  size?: number;
}
/** Flow placement of a node inside a stack or grid (`normalizeNodePlacement`). */
export interface NodePlacement {
  grow?: number;
  shrink?: number;
  basis?: number;
  alignSelf?: ContainerAlignment;
  minW?: number;
  minWFit?: "min-content" | "max-content";
  minH?: number;
  maxW?: number;
  maxH?: number;
  aspect?: number;
  colSpan?: number;
  rowSpan?: number;
  justifySelf?: Alignment | "stretch";
}
/** Properties every slide node can carry. */
export interface NodeBase {
  place?: NodePlacement;
  style?: StyleBag;
}
export interface TextMark {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  href?: string;
}
/** Text painted with a gradient or an image instead of a flat colour. */
export type TextFill =
  | { kind: "gradient"; gradient: GradientValue }
  | { kind: "image"; src: string; size?: "contain" };
export interface TextNode extends NodeBase {
  kind: "text";
  text: string;
  role: TextRole;
  color?: SlideColor;
  align?: TextAlignment;
  wrap?: "nowrap";
  fit?: TextFit;
  hangingIndent?: number;
  marks?: TextMark[];
  list?: "bullet" | "number";
  fill?: TextFill;
}
export interface ImageCrop {
  zoom: number;
  x: number;
  y: number;
}
export interface ImageNode extends NodeBase {
  kind: "img";
  alt: string;
  fit: "cover" | "contain";
  src?: string;
  asset?: string;
  crop?: ImageCrop;
  video?: string;
  videoStart?: "click";
  videoDelay?: number;
  videoSound?: "on";
  /** Hosted video link (provider, id and optional start offset). */
  videoLink?: VideoLink;
  w?: number;
  h?: number;
}
export interface IconNode extends NodeBase {
  kind: "icon";
  icon: string;
  color?: SlideColor;
  w?: number;
  h?: number;
}
export interface ShapeNode extends NodeBase {
  kind: "shape";
  shape: ShapeVariant;
  w?: number;
  h?: number;
  rotate?: number;
  /** Connector-only properties. */
  stroke?: SlideColor;
  strokeWidth?: number;
  from?: ConnectorCorner;
  head?: ConnectorHead;
  headStart?: ArrowHeadKind;
  headEnd?: ArrowHeadKind;
  route?: ConnectorRouting;
  dashed?: boolean;
}
export interface TableNode extends NodeBase {
  kind: "table";
  rows: string[][];
  cols: number;
  header: boolean;
  colWidths?: number[];
  colAligns?: Alignment[];
  /** Cell colours keyed by `"row.column"`. */
  cellStyles?: Record<string, { color: SlideColor }>;
  /** Row backgrounds keyed by row index. */
  rowStyles?: Record<string, { background: SlideColor }>;
  cellPadding?: { x?: number; y?: number };
  headerWeight?: number;
  role?: TextRole;
  fit?: TextFit;
}
export interface StackNode extends NodeBase {
  kind: "stack";
  dir: "h" | "v";
  align: ContainerAlignment;
  justify?: Justification;
  gap: number;
  wrap?: true;
  group?: true;
  children: SlideNode[];
}
export type GridTrack = "auto" | { fr: number } | { px: number };
export interface GridNode extends NodeBase {
  kind: "grid";
  columns: GridTrack[];
  rows?: GridTrack[];
  gap: number;
  alignItems?: ContainerAlignment;
  justifyItems?: Alignment | "stretch";
  group?: true;
  children: SlideNode[];
}
export interface OverlayLayer {
  node: SlideNode;
  x: Axis;
  y: Axis;
}
export interface OverlayNode extends NodeBase {
  kind: "overlay";
  base: SlideNode;
  layers: OverlayLayer[];
  group?: true;
}
export interface HtmlNode extends NodeBase {
  kind: "html";
  html: string;
}
export interface SpacerNode extends NodeBase {
  kind: "spacer";
}
export type SlideNode =
  | TextNode
  | ImageNode
  | ShapeNode
  | TableNode
  | StackNode
  | GridNode
  | OverlayNode
  | HtmlNode
  | IconNode
  | SpacerNode;
/** Nodes that lay their children out in flow (stack and grid). */
export type FlowContainerNode = StackNode | GridNode;
export type SlideNodeKind = SlideNode["kind"];

export interface BuildEffect {
  effect: BuildEffectName;
  order: number;
  auto?: true;
}
/** Build animations of a frame: how it enters and leaves during the presentation. */
export interface FrameBuild {
  in?: BuildEffect;
  out?: BuildEffect;
}
export interface Frame {
  id: string;
  x: Axis;
  y: Axis;
  node: SlideNode;
  build?: FrameBuild;
}
export interface Slide {
  v: 1;
  id: SlideId;
  bg: SlideColor;
  frames: Frame[];
  skipped?: true;
  lists?: ListRenderingMode;
  notes?: string;
  transition?: SlideTransition;
}

// ---------------------------------------------------------------------------
// Deck.
// ---------------------------------------------------------------------------

export interface FontFace {
  family: string;
  src?: string;
  href?: string;
}
/** The two theme font slots a deck can override. */
export interface ThemeFonts {
  sans?: FontFace;
  serif?: FontFace;
}
/** A section is anchored on its first slide (`start`) or stands empty before a slide (`before`). */
export interface DeckSection {
  id: string;
  title?: string;
  description: string;
  start?: SlideId;
  before?: SlideId | null;
  seq?: number;
}
export interface DeckContent {
  theme: "neutral" | "anthropic";
  format?: "html";
  order: SlideId[];
  slides: Record<SlideId, Slide>;
  assets: Record<string, string>;
  fonts?: ThemeFonts;
  faces?: FontFace[];
  sections?: DeckSection[];
  cover?: SlideId;
  lists?: ListRenderingMode;
}
export interface DeckIndex {
  v: number;
  title: string;
  order: SlideId[];
  cover?: SlideId;
  sections: Record<string, unknown>;
  faces: Record<string, FontFace>;
  designSystems: Record<string, unknown>[];
  attachments: Record<string, unknown>;
  [key: string]: unknown;
}
export interface NormalizationDiagnostics {
  droppedStyles: number;
  degradedNodes: number;
}
export interface CompileDiagnostic {
  line: number;
  col: number;
  message: string;
  [key: string]: unknown;
}
export interface HtmlCompileResult {
  content: DeckContent;
  title?: string;
  warnings: CompileDiagnostic[];
  errors: CompileDiagnostic[];
  hoisted: number;
  notes: unknown;
  unsupported: unknown;
  cellRemovals: unknown;
  lints: unknown;
  files: unknown;
}
export type FileSha = string | null;
export type PublishResult =
  | { ok: true; preconditionsChecked?: boolean; [key: string]: unknown }
  | {
      ok: false;
      code: string;
      paths?: { path: string; actual?: FileSha }[];
      [key: string]: unknown;
    };
export interface FilesPort {
  canWrite?: boolean;
  mayWrite?: boolean;
  list(): Promise<{ path: string; sha?: FileSha }[]>;
  read(path: string): Promise<unknown>;
  publish(
    files: Record<string, string | null>,
    options?: { ifMatch?: Record<string, FileSha> },
  ): Promise<PublishResult>;
}
/** Callable names are exposed by the runtime registry; dynamic internals remain in RuntimeBindings. */
export interface SlidesRuntime {
  normalizeDeckMetadata(input?: unknown): DeckIndex;
  normalizeDeck(
    input?: unknown,
    diagnostics?: NormalizationDiagnostics,
  ): DeckContent;
  normalizeAxisSpec(input?: unknown): Axis;
  normalizeRotation(input?: unknown): number | undefined;
  slideIdFromFilePath(path: string): SlideId | undefined;
  slideFilePath(id: SlideId): string;
  compileSlideHtml(
    html: string,
    options?: { fileMap?: unknown; collectFiles?: boolean; lists?: unknown },
  ): HtmlCompileResult;
  serializeSlideHtml(deck: DeckContent, slide: Slide): string;
  [name: string]: unknown;
}
