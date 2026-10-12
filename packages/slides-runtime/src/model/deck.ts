/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  Alignment,
  ArrowHeadKind,
  Axis,
  BorderStyleValue,
  BuildEffect,
  BuildEffectName,
  ContainerAlignment,
  ConnectorCorner,
  ConnectorHead,
  ConnectorRouting,
  DeckContent,
  FontFace,
  Frame,
  FlowContainerNode,
  FrameBuild,
  GridNode,
  GridTrack,
  IconNode,
  ImageNode,
  ImageCrop,
  Justification,
  ListRenderingMode,
  NodeBase,
  NodePlacement,
  NormalizationDiagnostics,
  OverlayLayer,
  OverlayNode,
  ShadowPresetName,
  ShadowValue,
  ShapeNode,
  ShapeVariant,
  Slide,
  SlideNode,
  SlideTransition,
  SpacerNode,
  StackNode,
  StyleBag,
  TableNode,
  TextAlignment,
  TextFill,
  TextFit,
  TextMark,
  TextNode,
  TextRole,
  ThemeFonts,
} from "../deck-contracts";

/** Display names by text role; arbitrary (unvalidated) keys may be absent. */
export interface TextRoleLabels extends Record<TextRole, string> {
  [role: string]: string | undefined;
}
/** Display names by shape variant; arbitrary (unvalidated) keys may be absent. */
export interface ShapeVariantLabels extends Record<ShapeVariant, string> {
  [variant: string]: string | undefined;
}
/** Display names by slide transition; arbitrary (unvalidated) keys may be absent. */
export interface SlideTransitionLabels
  extends Record<"none" | SlideTransition, string> {
  [transition: string]: string | undefined;
}
/** Shadow presets by name; arbitrary (unvalidated) keys may be absent. */
export interface ShadowPresets extends Record<ShadowPresetName, ShadowValue> {
  [name: string]: ShadowValue | undefined;
}

/** Untrusted JSON-like record read during normalization. */
type RawRecord = Record<string, unknown>;
/** A point in slide units. */
export type ConnectorPoint = [x: number, y: number];
/** An axis-aligned box in slide units. */
export interface ModelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Start and end point of a connector inside its box. */
export interface ConnectorEndpoints {
  start: ConnectorPoint;
  end: ConnectorPoint;
}
/** Arrow head kinds at both ends of a connector. */
export interface ConnectorArrowHeads {
  start: ArrowHeadKind;
  end: ArrowHeadKind;
}
/** The connector fields that decide arrow heads. */
export type ConnectorHeadFields = Pick<
  ShapeNode,
  "head" | "headStart" | "headEnd"
>;
/** The connector fields that decide its geometry. */
export type ConnectorRouteFields = Pick<
  ShapeNode,
  "from" | "route" | "strokeWidth" | "head" | "headStart" | "headEnd"
>;
/** Box (and corner) that encloses a connector between two points. */
export interface ConnectorBounds {
  left: number;
  top: number;
  w: number;
  h: number;
  from: ConnectorCorner;
}
/** One arrow head: tip position, unit direction and kind. */
export interface ConnectorArrowHead {
  tip: ConnectorPoint;
  dir: ConnectorPoint;
  kind: ArrowHeadKind;
}
/** Polyline of a connector plus its arrow heads. */
export interface ConnectorGeometry {
  points: ConnectorPoint[];
  heads: ConnectorArrowHead[];
}
/** Box and rotation of a line shape rebuilt from two endpoints. */
export interface LineShapeBounds {
  left: number;
  top: number;
  w: number;
  h: number;
  rotate: number | undefined;
}
/** Visible outline of a shape (`shapeOutline`). */
export interface ShapeOutline {
  color: string;
  width: number;
  line: Exclude<BorderStyleValue, "none">;
}
/** Connector node (`shape: "connector"`). */
export type ConnectorNode = ShapeNode & { shape: "connector" };
/** Line node (`shape: "line"`). */
export type LineShapeNode = ShapeNode & { shape: "line" };
/** Remaining table-cell and embed allowances while normalizing a deck. */
export interface DeckNormalizationBudget {
  slideCells: number;
  deckCells: number;
  slideEmbeds: number;
}
/** Style-schema node kinds (`nodeStyleKind`). */
export type NodeStyleKind =
  | "slides-text"
  | "slides-img"
  | "slides-icon"
  | "slides-stack"
  | "slides-table"
  | "slides-shape";

declare module "../bindings" {
  interface RuntimeBindings {
    SLIDE_WIDTH: number;
    SLIDE_HEIGHT: number;
    defaultMediaSize: number;
    maxTextMarks: number;
    maxVideoDelaySeconds: number;
    defaultShapeStrokeWidth: number;
    arrowHeadLengthFactor: number;
    filledArrowHeadWidthFactor: number;
    openArrowHeadWidthFactor: number;
    arrowShaftInsetFactor: number;
    maxShapeStrokeWidth: number;
    maxShapeCornerRadius: number;
    maxGridTracks: number;
    maxGridGap: number;
    textFitMinimumScale: number;
    minimumTextFontSize: number;
    maxTextLineSpacing: number;
    maxBuildOrder: number;
    defaultListGutter: number;
    maxInlineSvgBytes: number;
    maxInlineImageBytes: number;
    maxEmbeddedFontBytes: number;
    maxFontStylesheetUrlLength: number;
    maxDeckFontFaces: number;
    maxDeckFontCssBytes: number;
    maxDeckAssetBytes: number;
    maxModelCoordinate: number;
    maxNodeTextLength: number;
    maxSlideNotesLength: number;
    maxSectionDescriptionLength: number;
    maxHtmlEmbedBytes: number;
    maxSlideHtmlEmbeds: number;
    maxSlideFrames: number;
    maxNodeTreeDepth: number;
    maxTableColumns: number;
    maxTableRows: number;
    maxSlideTableCells: number;
    maxDeckTableCells: number;
    maxSlidePaintCost: number;
    maxSlideAnimations: number;
    maxDeckSections: number;
    maxDeckSlides: number;
    maxDeckAssets: number;
    slideHexColorPattern: RegExp;
    imageBase64DataUrlPattern: RegExp;
    svgUtf8DataUrlPattern: RegExp;
    svgDataUrlPattern: RegExp;
    modelStoredBlobPattern: RegExp;
    modelEmulatorBlobPattern: RegExp;
    designSystemImagePathPattern: RegExp;
    embeddedFontDataUrlPattern: RegExp;
    googleFontStylesheetPattern: RegExp;
    designSystemFontPathPattern: RegExp;
    modelIdPattern: RegExp;
    tableCellKeyPattern: RegExp;
    descriptionControlCharacterPattern: RegExp;
    anthropicAccentColor: string;
    designSystemAssetPathSource: string;
    designSystemFontPathSource: string;
    textRoles: readonly string[];
    textRoleLabels: TextRoleLabels;
    slideIconNames: readonly string[];
    shapeVariants: readonly string[];
    shapeVariantLabels: ShapeVariantLabels;
    connectorCornerValues: readonly string[];
    connectorHeadValues: readonly string[];
    arrowHeadKindValues: readonly string[];
    connectorRoutingValues: readonly string[];
    shadowPresetNames: readonly string[];
    shadowPresets: ShadowPresets;
    textFitValues: readonly string[];
    defaultTextFit: TextFit;
    buildEffectValues: readonly string[];
    slideTransitionValues: readonly string[];
    slideTransitionLabels: SlideTransitionLabels;
    slideColorNames: readonly string[];
    slideModelEmulatorDetected: boolean | undefined;
    themeFontFamilyKinds: readonly (keyof ThemeFonts)[];
    reservedModelFontFamilyNames: Set<string>;
    normalizeVideoDelay: (delay?: unknown) => number | undefined;
    serializeImageCrop: (crop: ImageCrop) => string;
    parseImageCrop: (cropText?: string) => ImageCrop | null | undefined;
    connectorArrowInset: (strokeWidth?: number) => number;
    connectorArrowHeads: (connector: ConnectorHeadFields) => ConnectorArrowHeads;
    setConnectorArrowHeads: <T extends ConnectorHeadFields>(
      connector: T,
      heads: ConnectorArrowHeads,
    ) => T;
    connectorEndpoints: (
      width: number,
      height: number,
      corner?: ConnectorCorner,
      strokeWidth?: number,
    ) => ConnectorEndpoints;
    absoluteConnectorEndpoints: (
      rect: ModelRect,
      corner?: ConnectorCorner,
      strokeWidth?: number,
    ) => [ConnectorPoint, ConnectorPoint];
    connectorBoundsFromEndpoints: (
      start: ConnectorPoint,
      end: ConnectorPoint,
      strokeWidth?: number,
    ) => ConnectorBounds;
    connectorGeometry: (
      width: number,
      height: number,
      connector: ConnectorRouteFields,
    ) => ConnectorGeometry;
    shortenConnectorShaftForHeads: (
      geometry: ConnectorGeometry,
      strokeWidth: number,
    ) => ConnectorPoint[];
    connectorArrowHeadWings: (
      head: ConnectorArrowHead,
      strokeWidth: number,
    ) => [ConnectorPoint, ConnectorPoint];
    lineShapeEndpoints: (
      rect: ModelRect,
      rotate?: number,
    ) => [ConnectorPoint, ConnectorPoint];
    lineShapeFromEndpoints: (
      start: ConnectorPoint,
      end: ConnectorPoint,
      thickness: number,
      endpoint?: number,
    ) => LineShapeBounds;
    shapeOutline: (style?: StyleBag) => ShapeOutline | undefined;
    shapeHasOutline: (style?: StyleBag) => boolean;
    shapeZeroWidthOutlineColor: (style?: StyleBag) => string | undefined;
    migrateLegacyShapeStyle: (
      node: RawRecord,
      kind: string,
      fill: string,
      stroke: string,
      strokeWidth?: number,
    ) => RawRecord | undefined;
    normalizeShapeVariant: (variant?: unknown) => TextFit | undefined;
    isFlowContainer: (node: SlideNode) => node is FlowContainerNode;
    isOverlayNode: (node: SlideNode) => node is OverlayNode;
    isConnectorNode: (node: SlideNode) => node is ConnectorNode;
    isLineShapeNode: (node: SlideNode) => node is LineShapeNode;
    isUnplacedFlowContainer: (node: {
      kind: unknown;
      place?: NodePlacement;
    }) => boolean;
    overlayBaseDepth: (overlay: OverlayNode, depth: number) => number;
    nodeTreeWithinDepthLimit: (node: SlideNode, depth: number) => boolean;
    nodeChildren: (node: SlideNode) => SlideNode[] | undefined;
    normalizeRotation: (rotation?: number) => number | undefined;
    nodeStyleKind: (node: SlideNode) => NodeStyleKind | undefined;
    isFullBleedAxis: (axis: Axis) => boolean;
    isEmptyBackgroundFrame: (frame: Frame) => boolean;
    countNodeTree: (node: SlideNode) => number;
    slidePrimaryLayoutFrame: (slide: Slide) => Frame | undefined;
    isPrimaryLayoutFrame: (slide: Slide, frame: Frame) => boolean;
    createModelId: () => string;
    isSlideColor: (color: string) => boolean;
    isSlideModelEmulator: () => boolean;
    isModelBlobReference: (src: string) => boolean;
    isAllowedImageSource: (src: string) => boolean;
    isRenderableImageSource: (src: string) => boolean;
    normalizeTextFill: (fill?: unknown) => TextFill | undefined;
    isEmbeddedFontDataUrl: (src: string) => boolean;
    isAllowedFontSource: (src: string) => boolean;
    isAllowedGoogleFontStylesheet: (url: string) => boolean;
    normalizeFontFaces: (faces?: unknown) => FontFace[] | undefined;
    normalizeThemeFontFamilies: (families?: unknown) => ThemeFonts | undefined;
    stringOrDefault: (value?: unknown, fallback?: string) => string;
    boundedJsonSummary: (
      value: unknown,
      maxDepth: number,
      maxLength: number,
    ) => string;
    finiteNumberOrDefault: (
      value: unknown,
      fallback: number,
      minimum: number,
      maximum: number,
    ) => number;
    finiteNumberInRange: (
      value: unknown,
      minimum: number,
      maximum: number,
    ) => number | undefined;
    normalizeAxisSpec: (axis?: unknown) => Axis;
    normalizeAlignment: (align?: unknown) => Alignment | undefined;
    normalizeTextAlignment: (align?: unknown) => TextAlignment | undefined;
    normalizeContainerAlignment: (
      align?: unknown,
    ) => ContainerAlignment | undefined;
    normalizeJustification: (justify?: unknown) => Justification | undefined;
    normalizeNodePlacement: (placement?: unknown) => NodePlacement | undefined;
    normalizeGridTrack: (track?: unknown) => GridTrack | undefined;
    normalizeGridTracks: (tracks?: unknown) => GridTrack[] | undefined;
    tablePlacementWithoutHeight: (
      placement?: NodePlacement,
    ) => NodePlacement | undefined;
    applyNormalizedPlacement: (
      node: NodeBase & { kind?: string },
      placement: unknown,
      depth: number,
    ) => void;
    createDeckNormalizationBudget: () => DeckNormalizationBudget;
    normalizeTableColumnWidths: (
      widths: unknown,
      columns: number,
    ) => number[] | undefined;
    normalizeTableColumnAlignments: (
      alignments: unknown,
      columns: number,
    ) => Alignment[] | undefined;
    normalizeTableCellStyles: (
      cellStyles: unknown,
      rows: number,
      columns: number,
    ) => TableNode["cellStyles"];
    normalizeTableRowStyles: (
      rowStyles: unknown,
      rowCount: number,
    ) => TableNode["rowStyles"];
    normalizeTableRows: (
      table: RawRecord,
      budget: DeckNormalizationBudget,
    ) => TableNode;
    applyNormalizedNodeStyle: (
      node: NodeBase,
      style: unknown,
      nodeKind: NodeStyleKind,
      diagnostics?: NormalizationDiagnostics,
    ) => void;
    normalizeSlideNode: (
      node?: unknown,
      depth?: number,
      budget?: DeckNormalizationBudget,
      diagnostics?: NormalizationDiagnostics,
      overlayBaseDepth?: number,
    ) => SlideNode;
    isSafeHyperlink: (href: string) => boolean;
    alignUtf16Boundary: (text: string, offset: number) => number;
    normalizeTextMarks: (marks: unknown, text: string) => TextMark[] | undefined;
    normalizeBuildEffect: (build?: unknown) => BuildEffect | undefined;
    normalizeFrameBuild: (build?: unknown) => FrameBuild | undefined;
    normalizeTableYAxis: (axis: Axis, explicitSize?: number) => Axis;
    normalizeSlideFrame: (
      frame?: unknown,
      budget?: DeckNormalizationBudget,
      diagnostics?: NormalizationDiagnostics,
    ) => Frame;
    normalizeSlide: (
      slide: unknown,
      fallbackId: string,
      budget?: DeckNormalizationBudget,
      diagnostics?: NormalizationDiagnostics,
    ) => Slide;
    setDeckListStyle: (deck: Slide, lists?: ListRenderingMode) => Slide;
    stripPaintEffects: (style: StyleBag) => StyleBag | undefined;
    enforceDeckPaintBudget: (
      slides: Slide[],
      diagnostics?: NormalizationDiagnostics,
    ) => void;
    normalizeDescription: (text: unknown, maxLength: number) => string;
    importLegacyDeckChildren: (
      children: unknown,
      diagnostics: Set<string>,
    ) => Set<string>;
    slideTitleSnippet: (slide?: Slide, maxLength?: number) => string;
    normalizeDeck: (
      deck?: unknown,
      diagnostics?: NormalizationDiagnostics,
    ) => DeckContent;
    collectSlideAssetIds: (slide: Slide, assetIds: Set<string>) => void;
    normalizeListRenderingMode: (input?: unknown) => ListRenderingMode | undefined;
    textListGutter: (source: SlideNode, options?: unknown) => number | undefined;
    enumStringOrUndefined: (
      input: unknown,
      options: readonly string[],
    ) => string | undefined;
    initializeSlideModel: () => void;
  }
}

export function installModelDeck(runtime: RuntimeBindings): () => void {
  var SLIDE_WIDTH: number;
  var SLIDE_HEIGHT: number;
  var defaultMediaSize: number;
  var textRoles: readonly string[];
  var textRoleLabels: TextRoleLabels;
  var maxTextMarks: number;
  var maxVideoDelaySeconds: number;
  var slideIconNames: readonly string[];
  var shapeVariants: readonly string[];
  var shapeVariantLabels: ShapeVariantLabels;
  var connectorCornerValues: readonly string[];
  var connectorHeadValues: readonly string[];
  var arrowHeadKindValues: readonly string[];
  var connectorRoutingValues: readonly string[];
  var defaultShapeStrokeWidth: number;
  var arrowHeadLengthFactor: number;
  var filledArrowHeadWidthFactor: number;
  var openArrowHeadWidthFactor: number;
  var arrowShaftInsetFactor: number;
  var shadowPresetNames: readonly string[];
  var shadowPresets: ShadowPresets;
  var maxShapeStrokeWidth: number;
  var maxShapeCornerRadius: number;
  var anthropicAccentColor: string;
  var maxGridTracks: number;
  var maxGridGap: number;
  var textFitValues: readonly string[];
  var defaultTextFit: TextFit;
  var textFitMinimumScale: number;
  var minimumTextFontSize: number;
  var maxTextLineSpacing: number;
  var buildEffectValues: readonly string[];
  var maxBuildOrder: number;
  var slideTransitionValues: readonly string[];
  var slideTransitionLabels: SlideTransitionLabels;
  var normalizeListRenderingMode: RuntimeBindings["normalizeListRenderingMode"];
  var defaultListGutter: number;
  var textListGutter: RuntimeBindings["textListGutter"];
  var slideHexColorPattern: RegExp;
  var slideColorNames: readonly string[];
  var imageBase64DataUrlPattern: RegExp;
  var svgUtf8DataUrlPattern: RegExp;
  var svgDataUrlPattern: RegExp;
  var maxInlineSvgBytes: number;
  var maxInlineImageBytes: number;
  var modelStoredBlobPattern: RegExp;
  var modelEmulatorBlobPattern: RegExp;
  var designSystemAssetPathSource: string;
  var designSystemImagePathPattern: RegExp;
  var slideModelEmulatorDetected: boolean | undefined;
  var themeFontFamilyKinds: readonly (keyof ThemeFonts)[];
  var embeddedFontDataUrlPattern: RegExp;
  var maxEmbeddedFontBytes: number;
  var googleFontStylesheetPattern: RegExp;
  var maxFontStylesheetUrlLength: number;
  var reservedModelFontFamilyNames: Set<string>;
  var designSystemFontPathSource: string;
  var designSystemFontPathPattern: RegExp;
  var maxDeckFontFaces: number;
  var maxDeckFontCssBytes: number;
  var maxDeckAssetBytes: number;
  var modelIdPattern: RegExp;
  var maxModelCoordinate: number;
  var maxNodeTextLength: number;
  var maxSlideNotesLength: number;
  var maxSectionDescriptionLength: number;
  var maxHtmlEmbedBytes: number;
  var maxSlideHtmlEmbeds: number;
  var maxSlideFrames: number;
  var maxNodeTreeDepth: number;
  var maxTableColumns: number;
  var maxTableRows: number;
  var maxSlideTableCells: number;
  var maxDeckTableCells: number;
  var tableCellKeyPattern: RegExp;
  var maxSlidePaintCost: number;
  var maxSlideAnimations: number;
  var maxDeckSections: number;
  var descriptionControlCharacterPattern: RegExp;
  var maxDeckSlides: number;
  var maxDeckAssets: number;
  var enumStringOrUndefined: RuntimeBindings["enumStringOrUndefined"];
  var initializeSlideModel: RuntimeBindings["initializeSlideModel"];
  function normalizeVideoDelay(delay?: unknown): number | undefined {
    let value =
      typeof delay === "number"
        ? delay
        : typeof delay === "string" && delay.trim() !== ""
          ? Number(delay)
          : NaN;
    if (!Number.isFinite(value)) {
      return;
    }
    let normalized = Math.round(Math.min(value, maxVideoDelaySeconds) * 10) / 10;
    if (normalized > 0) {
      return normalized;
    } else {
      return undefined;
    }
  }
  function serializeImageCrop(crop: ImageCrop): string {
    let callback = (input: number): string =>
      String(Math.round(input * 1e5) / 1000) + "%";
    return String(crop.zoom) + " " + callback(crop.x) + " " + callback(crop.y);
  }
  function parseImageCrop(cropText?: string): ImageCrop | null | undefined {
    let value =
      /^(\d{1,9}(?:\.\d{1,6})?) (\d{1,9}(?:\.\d{1,6})?)% (\d{1,9}(?:\.\d{1,6})?)%$/.exec(
        (cropText ?? "").trim().replace(/\s+/g, " "),
      );
    if (value) {
      return (
        (0, runtime.normalizeImageCrop)({
          zoom: Number(value[1]),
          x: Number(value[2]) / 100,
          y: Number(value[3]) / 100,
        }) ?? null
      );
    } else {
      return undefined;
    }
  }
  function connectorArrowInset(strokeWidth?: number): number {
    return Math.max(
      4,
      Math.ceil(2.2 * (strokeWidth ?? defaultShapeStrokeWidth)) + 1,
    );
  }
  function connectorArrowHeads(
    connector: ConnectorHeadFields,
  ): ConnectorArrowHeads {
    let head = connector.head ?? "end";
    return {
      start: connector.headStart ?? (head === "both" ? "filled" : "none"),
      end: connector.headEnd ?? (head === "none" ? "none" : "filled"),
    };
  }
  function setConnectorArrowHeads<T extends ConnectorHeadFields>(
    connector: T,
    heads: ConnectorArrowHeads,
  ): T {
    let result: ConnectorHeadFields = {
      ...connector,
    };
    if (heads.end === "none") {
      result.head = "none";
    } else if (heads.start === "none") {
      delete result.head;
    } else {
      result.head = "both";
    }
    let defaultHeads = connectorArrowHeads({
      head: result.head,
    });
    if (heads.start === defaultHeads.start) {
      delete result.headStart;
    } else {
      result.headStart = heads.start;
    }
    if (heads.end === defaultHeads.end) {
      delete result.headEnd;
    } else {
      result.headEnd = heads.end;
    }
    return result as T;
  }
  function connectorEndpoints(
    width: number,
    height: number,
    corner?: ConnectorCorner,
    strokeWidth?: number,
  ): ConnectorEndpoints {
    let value = connectorArrowInset(strokeWidth),
      value2 = width < 2 * value ? width / 2 : value,
      value3 = height < 2 * value ? height / 2 : value,
      value4 = width < 2 * value ? width / 2 : width - value,
      value5 = height < 2 * value ? height / 2 : height - value,
      value6 = corner ?? "tl",
      value7 = value6 === "tl" || value6 === "bl" ? value2 : value4,
      value8 = value6 === "tl" || value6 === "tr" ? value3 : value5;
    return {
      start: [value7, value8],
      end: [
        value7 === value2 ? value4 : value2,
        value8 === value3 ? value5 : value3,
      ],
    };
  }
  function absoluteConnectorEndpoints(
    rect: ModelRect,
    corner?: ConnectorCorner,
    strokeWidth?: number,
  ): [ConnectorPoint, ConnectorPoint] {
    let { start: value, end: value2 } = connectorEndpoints(
      rect.w,
      rect.h,
      corner,
      strokeWidth,
    );
    return [
      [rect.x + value[0], rect.y + value[1]],
      [rect.x + value2[0], rect.y + value2[1]],
    ];
  }
  function connectorBoundsFromEndpoints(
    start: ConnectorPoint,
    end: ConnectorPoint,
    strokeWidth?: number,
  ): ConnectorBounds {
    let value = connectorArrowInset(strokeWidth),
      [value2, value3] = start,
      [value4, value5] = end;
    return {
      left: Math.min(value2, value4) - value,
      top: Math.min(value3, value5) - value,
      w: Math.abs(value4 - value2) + 2 * value,
      h: Math.abs(value5 - value3) + 2 * value,
      from:
        value5 >= value3
          ? value4 >= value2
            ? "tl"
            : "tr"
          : value4 >= value2
            ? "bl"
            : "br",
    };
  }
  function connectorGeometry(
    width: number,
    height: number,
    connector: ConnectorRouteFields,
  ): ConnectorGeometry {
    let { start: value, end: value2 } = connectorEndpoints(
        width,
        height,
        connector.from,
        connector.strokeWidth,
      ),
      value3 = (value[0] + value2[0]) / 2,
      value4 = (value[1] + value2[1]) / 2,
      value5 = Math.abs(value2[0] - value[0]) < 1,
      value6 = Math.abs(value2[1] - value[1]) < 1,
      items: ConnectorPoint = [value5 ? value3 : value[0], value6 ? value4 : value[1]],
      items2: ConnectorPoint = [
        value5 ? value3 : value2[0],
        value6 ? value4 : value2[1],
      ],
      items3: ConnectorPoint[] = [items, items2],
      value7 = connector.route ?? "straight";
    if (!value5 && !value6) {
      if (value7 === "elbow") {
        items3 =
          Math.abs(items2[0] - items[0]) >= Math.abs(items2[1] - items[1])
            ? [items, [value3, items[1]], [value3, items2[1]], items2]
            : [items, [items[0], value4], [items2[0], value4], items2];
      } else if (value7 === "hv") {
        items3 = [items, [items2[0], items[1]], items2];
      } else if (value7 === "vh") {
        items3 = [items, [items[0], items2[1]], items2];
      }
    }
    let callback = (
        input: ConnectorPoint,
        options: ConnectorPoint,
      ): ConnectorPoint => {
        let value9 = options[0] - input[0],
          value10 = options[1] - input[1],
          value11 = Math.hypot(value9, value10) || 1;
        return [value9 / value11, value10 / value11];
      },
      items4: ConnectorArrowHead[] = [],
      value8 = connectorArrowHeads(connector),
      length = items3.length;
    if (value8.end !== "none") {
      items4.push({
        tip: items3[length - 1]!,
        dir: callback(items3[length - 2]!, items3[length - 1]!),
        kind: value8.end,
      });
    }
    if (value8.start !== "none") {
      items4.push({
        tip: items3[0]!,
        dir: callback(items3[1]!, items3[0]!),
        kind: value8.start,
      });
    }
    return {
      points: items3,
      heads: items4,
    };
  }
  function shortenConnectorShaftForHeads(
    geometry: ConnectorGeometry,
    strokeWidth: number,
  ): ConnectorPoint[] {
    let value = geometry.points.map(
        ([input, input2]): ConnectorPoint => [input, input2],
      ),
      length = value.length,
      value2 = arrowShaftInsetFactor * strokeWidth;
    for (let value3 of geometry.heads) {
      if (value3.kind !== "filled") {
        continue;
      }
      let value4 = geometry.points[length - 1]!,
        value5 =
          value3.tip[0] === value4[0] && value3.tip[1] === value4[1]
            ? length - 1
            : 0,
        value6 = value[value5 === 0 ? 1 : length - 2]!,
        value7 = Math.hypot(
          value3.tip[0] - value6[0],
          value3.tip[1] - value6[1],
        );
      if (length === 2 && value7 <= value2) {
        if (value7 === 0) {
          return value;
        } else {
          return [];
        }
      }
      let value8 = Math.min(value2, value7);
      value[value5] = [
        value3.tip[0] - value3.dir[0] * value8,
        value3.tip[1] - value3.dir[1] * value8,
      ];
    }
    return value;
  }
  function connectorArrowHeadWings(
    head: ConnectorArrowHead,
    strokeWidth: number,
  ): [ConnectorPoint, ConnectorPoint] {
    let [tip, tip2] = head.tip,
      [dir, dir2] = head.dir,
      value = arrowHeadLengthFactor * strokeWidth,
      value2 =
        (head.kind === "open"
          ? openArrowHeadWidthFactor
          : filledArrowHeadWidthFactor) * strokeWidth,
      value3 = tip - dir * value,
      value4 = tip2 - dir2 * value;
    return [
      [value3 - dir2 * value2, value4 + dir * value2],
      [value3 + dir2 * value2, value4 - dir * value2],
    ];
  }
  function lineShapeEndpoints(
    rect: ModelRect,
    rotate?: number,
  ): [ConnectorPoint, ConnectorPoint] {
    let value = rect.x + rect.w / 2,
      value2 = rect.y + rect.h / 2,
      value3 = rect.w >= rect.h,
      value4 = (value3 ? rect.w : rect.h) / 2,
      value5 = (((rotate ?? 0) + (value3 ? 0 : 90)) * Math.PI) / 180,
      value6 = Math.cos(value5) * value4,
      value7 = Math.sin(value5) * value4;
    return [
      [value - value6, value2 - value7],
      [value + value6, value2 + value7],
    ];
  }
  function lineShapeFromEndpoints(
    start: ConnectorPoint,
    end: ConnectorPoint,
    thickness: number,
    endpoint?: number,
  ): LineShapeBounds {
    let value = end[0] - start[0],
      value2 = end[1] - start[1],
      value3 = Math.max(
        Math.max(1, thickness),
        Math.round(Math.hypot(value, value2)),
      ),
      value4 = normalizeRotation(
        (Math.atan2(value2, value) * 180) / Math.PI +
          (endpoint === 0 ? 180 : 0),
      ),
      value5 = ((value4 ?? 0) * Math.PI) / 180,
      value6 = endpoint === 0 ? -1 : 1,
      value7 = start[0] + (value6 * Math.cos(value5) * value3) / 2,
      value8 = start[1] + (value6 * Math.sin(value5) * value3) / 2,
      value9 = Math.abs(((((value4 ?? 0) % 180) + 180) % 180) - 90);
    if (value3 > thickness && value9 < 45) {
      return {
        left: value7 - thickness / 2,
        top: value8 - value3 / 2,
        w: thickness,
        h: value3,
        rotate: normalizeRotation((value4 ?? 0) - 90),
      };
    } else {
      return {
        left: value7 - value3 / 2,
        top: value8 - thickness / 2,
        w: value3,
        h: thickness,
        rotate: value4,
      };
    }
  }
  function shapeOutline(style?: StyleBag): ShapeOutline | undefined {
    if (
      style === undefined ||
      style.borderStyle === undefined ||
      style.borderStyle === "none"
    ) {
      return;
    }
    let value = style.borderWidth ?? 3;
    if (value > 0) {
      return {
        color: style.borderColor ?? "#000000",
        width: value,
        line: style.borderStyle,
      };
    } else {
      return undefined;
    }
  }
  function shapeHasOutline(style?: StyleBag): boolean {
    return shapeOutline(style) !== undefined;
  }
  function shapeZeroWidthOutlineColor(style?: StyleBag): string | undefined {
    if (
      style !== undefined &&
      style.borderStyle !== undefined &&
      style.borderStyle !== "none" &&
      style.borderWidth === 0
    ) {
      return style.borderColor ?? "#000000";
    } else {
      return undefined;
    }
  }
  function migrateLegacyShapeStyle(
    node: RawRecord,
    kind: string,
    fill: string,
    stroke: string,
    strokeWidth?: number,
  ): RawRecord | undefined {
    let state: RawRecord = {
        ...(typeof node.style === "object" &&
        node.style !== null &&
        !Array.isArray(node.style)
          ? node.style
          : {}),
      },
      callback = (input: string): string | undefined =>
        isSlideColor(input)
          ? (runtime.namedSlideColors[input] ?? input)
          : undefined;
    if (state.backgroundColor === undefined && callback(fill) !== undefined) {
      state.backgroundColor = callback(fill);
    }
    if (
      state.borderStyle === undefined &&
      state.borderWidth === undefined &&
      callback(stroke) !== undefined
    ) {
      state.borderStyle = "solid";
      state.borderWidth = strokeWidth ?? 2;
      state.borderColor = state.borderColor ?? callback(stroke);
    }
    let value = stringOrDefault(node.shadow);
    if (state.boxShadow === undefined && shadowPresetNames.includes(value)) {
      state.boxShadow = [
        {
          ...shadowPresets[value],
        },
      ];
    }
    if (
      kind === "rounded" &&
      [
        "borderRadius",
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomRightRadius",
        "borderBottomLeftRadius",
      ].every((input) => state[input] === undefined)
    ) {
      state.borderRadius = maxShapeCornerRadius;
    }
    if (Object.keys(state).length > 0) {
      return state;
    } else {
      return undefined;
    }
  }
  function normalizeShapeVariant(variant?: unknown): TextFit | undefined {
    if (typeof variant === "string" && textFitValues.includes(variant)) {
      return variant as TextFit;
    } else {
      return undefined;
    }
  }
  function isFlowContainer(node: SlideNode): node is FlowContainerNode {
    return node.kind === "stack" || node.kind === "grid";
  }
  function isOverlayNode(node: SlideNode): node is OverlayNode {
    return node.kind === "overlay";
  }
  function isConnectorNode(node: SlideNode): node is ConnectorNode {
    return node.kind === "shape" && node.shape === "connector";
  }
  function isLineShapeNode(node: SlideNode): node is LineShapeNode {
    return node.kind === "shape" && node.shape === "line";
  }
  function isUnplacedFlowContainer(node: {
    kind: unknown;
    place?: NodePlacement;
  }): boolean {
    return (
      (node.kind === "stack" || node.kind === "grid") &&
      node.place === undefined
    );
  }
  function overlayBaseDepth(overlay: OverlayNode, depth: number): number {
    if (isUnplacedFlowContainer(overlay.base)) {
      return depth;
    } else {
      return depth + 1;
    }
  }
  function nodeTreeWithinDepthLimit(node: SlideNode, depth: number): boolean {
    let value = nodeChildren(node);
    if (value === undefined) {
      return true;
    }
    if (depth >= maxNodeTreeDepth) {
      return false;
    }
    if (node.kind === "overlay") {
      return (
        nodeTreeWithinDepthLimit(node.base, overlayBaseDepth(node, depth)) &&
        node.layers.every((input) =>
          nodeTreeWithinDepthLimit(input.node, depth + 1),
        )
      );
    }
    return value.every((input) => nodeTreeWithinDepthLimit(input, depth + 1));
  }
  function nodeChildren(node: SlideNode): SlideNode[] | undefined {
    if (isFlowContainer(node)) {
      return node.children;
    }
    if (node.kind === "overlay") {
      return [node.base, ...node.layers.map((input) => input.node)];
    }
    return;
  }
  function normalizeRotation(rotation?: number): number | undefined {
    if (!Number.isFinite(rotation)) {
      return;
    }
    let normalized =
        ((((Math.round(rotation! * 100) / 100 + 180) % 360) + 360) % 360) -
        180,
      rounded = Math.round(normalized * 100) / 100;
    if (rounded === 0) {
      return undefined;
    } else {
      if (rounded === -180) {
        return 180;
      } else {
        return rounded;
      }
    }
  }
  function nodeStyleKind(node: SlideNode): NodeStyleKind | undefined {
    switch (node.kind) {
      case "text":
        return "slides-text";
      case "img":
        return "slides-img";
      case "icon":
        return "slides-icon";
      case "stack":
      case "grid":
      case "overlay":
        return "slides-stack";
      case "table":
        return "slides-table";
      case "shape":
        if (node.shape === "connector") {
          return undefined;
        } else {
          return "slides-shape";
        }
      case "html":
      case "spacer":
        return;
    }
  }
  function isFullBleedAxis(axis: Axis): boolean {
    return (
      axis.anchor === "fill" &&
      axis.margin === 0 &&
      axis.offset === 0 &&
      axis.size === undefined
    );
  }
  function isEmptyBackgroundFrame(frame: Frame): boolean {
    return (
      isFullBleedAxis(frame.x) &&
      isFullBleedAxis(frame.y) &&
      frame.node.kind === "stack" &&
      frame.node.children.length === 0
    );
  }
  function countNodeTree(node: SlideNode): number {
    return (
      1 +
      (nodeChildren(node) ?? []).reduce(
        (input: number, options: SlideNode): number =>
          input + countNodeTree(options),
        0,
      )
    );
  }
  function slidePrimaryLayoutFrame(slide: Slide): Frame | undefined {
    let bestFrame: Frame | undefined,
      largestCount = -1;
    for (let value of slide.frames) {
      if (
        !isFullBleedAxis(value.x) ||
        !isFullBleedAxis(value.y) ||
        !isFlowContainer(value.node) ||
        value.node.children.length === 0
      ) {
        continue;
      }
      let value2 = countNodeTree(value.node);
      if (value2 >= largestCount) {
        bestFrame = value;
        largestCount = value2;
      }
    }
    return bestFrame;
  }
  function isPrimaryLayoutFrame(slide: Slide, frame: Frame): boolean {
    return slidePrimaryLayoutFrame(slide)?.id === frame.id;
  }
  function createModelId(): string {
    return crypto.randomUUID().slice(0, 8);
  }
  function isSlideColor(color: string): boolean {
    return slideHexColorPattern.test(color) || slideColorNames.includes(color);
  }
  function isSlideModelEmulator(): boolean {
    slideModelEmulatorDetected ??=
      typeof document !== "undefined" &&
      typeof document.querySelector === "function" &&
      ["build", "host"].some(
        (input) =>
          document.querySelector(
            'meta[name="' + ["appifact", "emulator", input].join("-") + '"]',
          ) !== null,
      );
    return slideModelEmulatorDetected;
  }
  function isModelBlobReference(src: string): boolean {
    return (
      modelStoredBlobPattern.test(src) ||
      (modelEmulatorBlobPattern.test(src) && isSlideModelEmulator())
    );
  }
  function isAllowedImageSource(src: string): boolean {
    if (isModelBlobReference(src) || designSystemImagePathPattern.test(src)) {
      return true;
    }
    if (
      !imageBase64DataUrlPattern.test(src) &&
      !svgUtf8DataUrlPattern.test(src)
    ) {
      return false;
    }
    if (svgUtf8DataUrlPattern.test(src) && src.includes("#")) {
      return false;
    }
    return !svgDataUrlPattern.test(src) || src.length <= maxInlineSvgBytes;
  }
  function isRenderableImageSource(src: string): boolean {
    if (isModelBlobReference(src) || designSystemImagePathPattern.test(src)) {
      return true;
    }
    let value = imageBase64DataUrlPattern.exec(src);
    if (
      value === null ||
      !/^[A-Za-z0-9+/=]+$/.test(src.slice(value[0].length))
    ) {
      return false;
    }
    return value[1] !== "svg+xml" || src.length <= maxInlineSvgBytes;
  }
  function normalizeTextFill(fill?: unknown): TextFill | undefined {
    if (typeof fill !== "object" || fill === null) {
      return;
    }
    let value = fill as RawRecord;
    if (value.kind === "gradient") {
      let value2 = (0, runtime.normalizeStyleBag)(
        {
          backgroundGradient: value.gradient,
        },
        "slides-text",
      ).bag?.backgroundGradient;
      if (value2 !== undefined) {
        return {
          kind: "gradient",
          gradient: value2,
        };
      } else {
        return undefined;
      }
    }
    if (
      value.kind === "image" &&
      typeof value.src === "string" &&
      isRenderableImageSource(value.src)
    ) {
      return {
        kind: "image",
        src: value.src,
        ...(value.size === "contain"
          ? {
              size: "contain" as const,
            }
          : {}),
      };
    }
    return;
  }
  function isEmbeddedFontDataUrl(src: string): boolean {
    return (
      embeddedFontDataUrlPattern.test(src) && src.length <= maxEmbeddedFontBytes
    );
  }
  function isAllowedFontSource(src: string): boolean {
    return (
      isEmbeddedFontDataUrl(src) ||
      isModelBlobReference(src) ||
      designSystemFontPathPattern.test(src)
    );
  }
  function isAllowedGoogleFontStylesheet(url: string): boolean {
    return (
      url.length <= maxFontStylesheetUrlLength &&
      googleFontStylesheetPattern.test(url)
    );
  }
  function normalizeFontFaces(faces?: unknown): FontFace[] | undefined {
    if (!Array.isArray(faces)) {
      return;
    }
    let items: FontFace[] = [],
      values = new Set<string>();
    for (let value of faces.slice(0, maxDeckFontFaces * 4) as unknown[]) {
      if (items.length >= maxDeckFontFaces) {
        break;
      }
      if (typeof value !== "object" || value === null) {
        continue;
      }
      let { family: value2, src: value3, href: value4 } = value as RawRecord;
      if (
        typeof value2 !== "string" ||
        !runtime.customFontFamilyPattern.test(value2)
      ) {
        continue;
      }
      if (
        reservedModelFontFamilyNames.has(value2.toLowerCase()) ||
        values.has(value2.toLowerCase())
      ) {
        continue;
      }
      if (value4 !== undefined) {
        if (
          value3 !== undefined ||
          typeof value4 !== "string" ||
          !isAllowedGoogleFontStylesheet(value4)
        ) {
          continue;
        }
        values.add(value2.toLowerCase());
        items.push({
          family: value2,
          href: value4,
        });
        continue;
      }
      if (typeof value3 !== "string" || !isAllowedFontSource(value3)) {
        continue;
      }
      values.add(value2.toLowerCase());
      items.push({
        family: value2,
        src: value3,
      });
    }
    if (items.length > 0) {
      return items;
    } else {
      return undefined;
    }
  }
  function normalizeThemeFontFamilies(
    families?: unknown,
  ): ThemeFonts | undefined {
    if (typeof families !== "object" || families === null) {
      return;
    }
    let value = families as RawRecord,
      state: ThemeFonts = {};
    for (let value2 of themeFontFamilyKinds) {
      if (!Object.hasOwn(value, value2)) {
        continue;
      }
      let value3 = value[value2];
      if (typeof value3 !== "object" || value3 === null) {
        continue;
      }
      let {
        family: value4,
        src: value5,
        href: value6,
      } = value3 as RawRecord;
      if (
        typeof value4 !== "string" ||
        !runtime.customFontFamilyPattern.test(value4)
      ) {
        continue;
      }
      if (reservedModelFontFamilyNames.has(value4.toLowerCase())) {
        continue;
      }
      if (value6 !== undefined) {
        if (value5 !== undefined) {
          continue;
        }
        if (
          typeof value6 !== "string" ||
          !isAllowedGoogleFontStylesheet(value6)
        ) {
          continue;
        }
        state[value2] = {
          family: value4,
          href: value6,
        };
        continue;
      }
      if (typeof value5 !== "string" || !isAllowedFontSource(value5)) {
        continue;
      }
      state[value2] = {
        family: value4,
        src: value5,
      };
    }
    if (Object.keys(state).length > 0) {
      return state;
    } else {
      return undefined;
    }
  }
  function stringOrDefault(value?: unknown, fallback: string = ""): string {
    if (typeof value === "string") {
      return value;
    } else {
      return fallback;
    }
  }
  function boundedJsonSummary(
    value: unknown,
    maxDepth: number,
    maxLength: number,
  ): string {
    let items: string[] = [],
      index = 0,
      flag = false,
      callback = (items2: string): void => {
        if (flag) {
          return;
        }
        items.push(items2);
        index += items2.length;
        if (index >= maxLength) {
          flag = true;
        }
      },
      callback2 = (items2: unknown, options: number): void => {
        if (flag) {
          return;
        }
        if (typeof items2 === "string") {
          callback(
            JSON.stringify(
              items2.length > maxLength
                ? (0, runtime.truncateUtf16Safely)(items2, maxLength) + "…"
                : items2,
            ),
          );
          return;
        }
        if (
          items2 === null ||
          typeof items2 === "number" ||
          typeof items2 === "boolean"
        ) {
          callback(JSON.stringify(items2));
          return;
        }
        if (typeof items2 !== "object") {
          callback("null");
          return;
        }
        if (options >= maxDepth) {
          callback('"…"');
          return;
        }
        if (Array.isArray(items2)) {
          callback("[");
          for (let index2 = 0; index2 < items2.length; index2++) {
            if (flag) {
              break;
            }
            if (index2 > 0) {
              callback(",");
            }
            let value2: unknown = items2[index2];
            if (
              value2 === undefined ||
              typeof value2 === "function" ||
              typeof value2 === "symbol"
            ) {
              callback("null");
            } else {
              callback2(value2, options + 1);
            }
          }
          callback("]");
          return;
        }
        callback("{");
        let flag2 = true;
        for (let value2 of Object.keys(items2)) {
          if (flag) {
            break;
          }
          let value3 = (items2 as RawRecord)[value2];
          if (
            value3 === undefined ||
            typeof value3 === "function" ||
            typeof value3 === "symbol"
          ) {
            continue;
          }
          if (!flag2) {
            callback(",");
          }
          flag2 = false;
          callback(JSON.stringify(value2) + ":");
          callback2(value3, options + 1);
        }
        callback("}");
      };
    callback2(value, 0);
    return items.join("");
  }
  function finiteNumberOrDefault(
    value: unknown,
    fallback: number,
    minimum: number,
    maximum: number,
  ): number {
    let value2 =
      typeof value === "number" && Number.isFinite(value) ? value : fallback;
    return Math.min(maximum, Math.max(minimum, value2));
  }
  function finiteNumberInRange(
    value: unknown,
    minimum: number,
    maximum: number,
  ): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return;
    }
    return Math.min(maximum, Math.max(minimum, value));
  }
  function normalizeAxisSpec(axis?: unknown): Axis {
    let value: RawRecord =
      typeof axis === "object" && axis !== null ? (axis as RawRecord) : {};
    return {
      anchor:
        value.anchor === "center" ||
        value.anchor === "trailing" ||
        value.anchor === "fill"
          ? value.anchor
          : "leading",
      margin: finiteNumberOrDefault(value.margin, 0, 0, maxModelCoordinate),
      offset: finiteNumberOrDefault(
        value.offset,
        0,
        -maxModelCoordinate,
        maxModelCoordinate,
      ),
      size: finiteNumberInRange(value.size, 1, maxModelCoordinate),
    };
  }
  function normalizeAlignment(align?: unknown): Alignment | undefined {
    if (align === "start" || align === "center" || align === "end") {
      return align;
    } else {
      return undefined;
    }
  }
  function normalizeTextAlignment(align?: unknown): TextAlignment | undefined {
    return (
      normalizeAlignment(align) ?? (align === "justify" ? align : undefined)
    );
  }
  function normalizeContainerAlignment(
    align?: unknown,
  ): ContainerAlignment | undefined {
    return (
      normalizeAlignment(align) ??
      (align === "stretch" || align === "baseline" ? align : undefined)
    );
  }
  function normalizeJustification(justify?: unknown): Justification | undefined {
    if (
      justify === "start" ||
      justify === "center" ||
      justify === "end" ||
      justify === "between" ||
      justify === "around" ||
      justify === "evenly"
    ) {
      return justify;
    } else {
      return undefined;
    }
  }
  function normalizeNodePlacement(placement?: unknown): NodePlacement | undefined {
    if (typeof placement !== "object" || placement === null) {
      return;
    }
    let raw = placement as RawRecord,
      placement2: NodePlacement = {},
      grow = finiteNumberInRange(raw.grow, 0, 100);
    if (grow !== undefined) {
      placement2.grow = grow;
    }
    let shrink = finiteNumberInRange(raw.shrink, 0, 100);
    if (shrink !== undefined) {
      placement2.shrink = shrink;
    }
    let basis = finiteNumberInRange(raw.basis, 0, maxModelCoordinate);
    if (basis !== undefined) {
      placement2.basis = basis;
    }
    let value = normalizeContainerAlignment(raw.alignSelf);
    if (value !== undefined) {
      placement2.alignSelf = value;
    }
    let value2 = finiteNumberInRange(raw.minW, 0, maxModelCoordinate);
    if (value2 !== undefined) {
      placement2.minW = value2;
    }
    if (raw.minWFit === "min-content" || raw.minWFit === "max-content") {
      placement2.minWFit = raw.minWFit;
    }
    let value3 = finiteNumberInRange(raw.minH, 0, maxModelCoordinate);
    if (value3 !== undefined) {
      placement2.minH = value3;
    }
    let value4 = finiteNumberInRange(raw.maxW, 1, maxModelCoordinate);
    if (value4 !== undefined) {
      placement2.maxW = value4;
    }
    let value5 = finiteNumberInRange(raw.maxH, 1, maxModelCoordinate);
    if (value5 !== undefined) {
      placement2.maxH = value5;
    }
    let value6 = finiteNumberInRange(raw.aspect, 0.05, 20);
    if (value6 !== undefined) {
      placement2.aspect = value6;
    }
    let value7 = finiteNumberInRange(raw.colSpan, 1, maxGridTracks);
    if (value7 !== undefined) {
      placement2.colSpan = Math.round(value7);
    }
    let value8 = finiteNumberInRange(raw.rowSpan, 1, maxGridTracks);
    if (value8 !== undefined) {
      placement2.rowSpan = Math.round(value8);
    }
    let value9: NodePlacement["justifySelf"] =
      raw.justifySelf === "stretch"
        ? "stretch"
        : normalizeAlignment(raw.justifySelf);
    if (value9 !== undefined) {
      placement2.justifySelf = value9;
    }
    if (Object.keys(placement2).length > 0) {
      return placement2;
    } else {
      return undefined;
    }
  }
  function normalizeGridTrack(track?: unknown): GridTrack | undefined {
    if (track === "auto") {
      return "auto";
    }
    if (typeof track !== "object" || track === null) {
      return;
    }
    let value = track as RawRecord,
      value2 = finiteNumberInRange(value.fr, 0.1, 100);
    if (value2 !== undefined && value.fr !== undefined) {
      return {
        fr: value2,
      };
    }
    let value3 = finiteNumberInRange(value.px, 1, maxModelCoordinate);
    if (value3 !== undefined && value.px !== undefined) {
      return {
        px: value3,
      };
    }
    return;
  }
  function normalizeGridTracks(tracks?: unknown): GridTrack[] | undefined {
    if (!Array.isArray(tracks)) {
      return;
    }
    let items: GridTrack[] = [];
    for (let value of tracks.slice(0, maxGridTracks) as unknown[]) {
      let value2 = normalizeGridTrack(value);
      if (value2 !== undefined) {
        items.push(value2);
      }
    }
    if (items.length > 0) {
      return items;
    } else {
      return undefined;
    }
  }
  function tablePlacementWithoutHeight(
    placement?: NodePlacement,
  ): NodePlacement | undefined {
    if (
      !placement ||
      (placement.minH === undefined &&
        placement.maxH === undefined &&
        placement.aspect === undefined)
    ) {
      return placement;
    }
    let state: NodePlacement = {
      ...placement,
    };
    delete state.minH;
    delete state.maxH;
    delete state.aspect;
    if (Object.keys(state).length > 0) {
      return state;
    } else {
      return undefined;
    }
  }
  function applyNormalizedPlacement(
    node: NodeBase & { kind?: string },
    placement: unknown,
    depth: number,
  ): void {
    if (depth === 0) {
      return;
    }
    let value = normalizeNodePlacement(placement),
      value2 =
        node.kind === "table" ? tablePlacementWithoutHeight(value) : value;
    if (value2) {
      node.place = value2;
    }
  }
  function createDeckNormalizationBudget(): DeckNormalizationBudget {
    return {
      slideCells: maxSlideTableCells,
      deckCells: 1 / 0,
      slideEmbeds: maxSlideHtmlEmbeds,
    };
  }
  function normalizeTableColumnWidths(
    widths: unknown,
    columns: number,
  ): number[] | undefined {
    if (!Array.isArray(widths) || widths.length !== columns) {
      return;
    }
    let items: number[] = [];
    for (let value of widths as unknown[]) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return;
      }
      items.push(Math.min(100, Math.max(1, value)));
    }
    return items;
  }
  function normalizeTableColumnAlignments(
    alignments: unknown,
    columns: number,
  ): Alignment[] | undefined {
    if (!Array.isArray(alignments) || alignments.length !== columns) {
      return;
    }
    let items: Alignment[] = [];
    for (let value of alignments as unknown[]) {
      let value2 = normalizeAlignment(value);
      if (value2 === undefined) {
        return;
      }
      items.push(value2);
    }
    return items;
  }
  function normalizeTableCellStyles(
    cellStyles: unknown,
    rows: number,
    columns: number,
  ): TableNode["cellStyles"] {
    if (typeof cellStyles !== "object" || cellStyles === null || rows === 0) {
      return;
    }
    let items: [string, { color: string }][] = [],
      values = new Set<string>();
    for (let value of Object.keys(cellStyles)) {
      let value2 = tableCellKeyPattern.exec(value);
      if (!value2) {
        continue;
      }
      let value3 = Number(value2[1]),
        value4 = Number(value2[2]);
      if (value3 >= rows || value4 >= columns) {
        continue;
      }
      let value5 = String(value3) + "." + String(value4);
      if (values.has(value5)) {
        continue;
      }
      let value6 = (cellStyles as RawRecord)[value];
      if (typeof value6 !== "object" || value6 === null) {
        continue;
      }
      let color = (value6 as RawRecord).color;
      if (typeof color !== "string" || !isSlideColor(color)) {
        continue;
      }
      values.add(value5);
      items.push([
        value5,
        {
          color: color,
        },
      ]);
    }
    if (items.length > 0) {
      return Object.fromEntries(items);
    } else {
      return undefined;
    }
  }
  function normalizeTableRowStyles(
    rowStyles: unknown,
    rowCount: number,
  ): TableNode["rowStyles"] {
    if (typeof rowStyles !== "object" || rowStyles === null) {
      return;
    }
    let items: [string, { background: string }][] = [],
      values = new Set<string>();
    for (let value of Object.keys(rowStyles)) {
      if (!/^\d{1,3}$/.test(value)) {
        continue;
      }
      let value2 = Number(value);
      if (value2 >= rowCount) {
        continue;
      }
      let value3 = String(value2);
      if (values.has(value3)) {
        continue;
      }
      let value4 = (rowStyles as RawRecord)[value];
      if (typeof value4 !== "object" || value4 === null) {
        continue;
      }
      let background = (value4 as RawRecord).background;
      if (typeof background !== "string" || !isSlideColor(background)) {
        continue;
      }
      values.add(value3);
      items.push([
        value3,
        {
          background: background,
        },
      ]);
    }
    if (items.length > 0) {
      return Object.fromEntries(items);
    } else {
      return undefined;
    }
  }
  function normalizeTableRows(
    table: RawRecord,
    budget: DeckNormalizationBudget,
  ): TableNode {
    let rawRows: unknown[] = Array.isArray(table.rows)
        ? table.rows.slice(0, maxTableRows)
        : [],
      columns: number;
    if (typeof table.cols === "number" && Number.isFinite(table.cols)) {
      columns = Math.min(maxTableColumns, Math.max(1, Math.round(table.cols)));
    } else {
      let count = 1;
      for (let value10 of rawRows)
        if (Array.isArray(value10) && value10.length > count) {
          count = value10.length;
        }
      columns = Math.min(maxTableColumns, count);
    }
    let value = Math.max(1, rawRows.length),
      value2 = Math.min(budget.slideCells, budget.deckCells),
      value3 = Math.min(value, Math.floor(value2 / columns));
    budget.slideCells -= value3 * columns;
    budget.deckCells -= value3 * columns;
    let items: string[][] = [];
    for (let index = 0; index < value3; index++) {
      let value10 = rawRows[index],
        items2: string[] = [];
      for (let index2 = 0; index2 < columns; index2++) {
        let value11: unknown = Array.isArray(value10)
          ? value10[index2]
          : undefined;
        items2.push(
          (0, runtime.truncateUtf16Safely)(
            stringOrDefault(value11),
            maxNodeTextLength,
          ),
        );
      }
      items.push(items2);
    }
    let state: TableNode = {
        kind: "table",
        rows: items,
        cols: columns,
        header: table.header === true,
      },
      value4 = normalizeTableColumnWidths(table.colWidths, columns);
    if (value4) {
      state.colWidths = value4;
    }
    let value5 = normalizeTableColumnAlignments(table.colAligns, columns);
    if (value5) {
      state.colAligns = value5;
    }
    let value6 = normalizeTableCellStyles(
      table.cellStyles,
      items.length,
      columns,
    );
    if (value6) {
      state.cellStyles = value6;
    }
    let value7 = normalizeTableRowStyles(table.rowStyles, items.length);
    if (value7) {
      state.rowStyles = value7;
    }
    let cellPadding = table.cellPadding as RawRecord | null | undefined;
    if (
      typeof cellPadding === "object" &&
      cellPadding !== null &&
      !Array.isArray(cellPadding)
    ) {
      let callback = (input: unknown): number | undefined =>
          typeof input === "number" && Number.isFinite(input)
            ? Math.min(maxGridGap, Math.max(0, Math.round(input * 10) / 10))
            : undefined,
        value10 = callback(cellPadding.x),
        value11 = callback(cellPadding.y);
      if (value10 !== undefined || value11 !== undefined) {
        state.cellPadding = {
          ...(value10 !== undefined
            ? {
                x: value10,
              }
            : {}),
          ...(value11 !== undefined
            ? {
                y: value11,
              }
            : {}),
        };
      }
    }
    if (
      state.header &&
      typeof table.headerWeight === "number" &&
      Number.isFinite(table.headerWeight)
    ) {
      state.headerWeight = Math.min(
        900,
        Math.max(100, Math.round(table.headerWeight / 100) * 100),
      );
    }
    let value8 = stringOrDefault(table.role);
    if (textRoles.includes(value8)) {
      state.role = value8 as TextRole;
    }
    let value9 = normalizeShapeVariant(table.fit);
    if (value9 !== undefined) {
      state.fit = value9;
    }
    return state;
  }
  function applyNormalizedNodeStyle(
    node: NodeBase,
    style: unknown,
    nodeKind: NodeStyleKind,
    diagnostics?: NormalizationDiagnostics,
  ): void {
    let { bag: value, dropped: value2 } = (0, runtime.normalizeStyleBag)(
      style,
      nodeKind,
    );
    if (diagnostics) {
      diagnostics.droppedStyles += value2;
    }
    if (value) {
      node.style = value;
    }
  }
  function normalizeSlideNode(
    node?: unknown,
    depth: number = 0,
    budget: DeckNormalizationBudget = createDeckNormalizationBudget(),
    diagnostics?: NormalizationDiagnostics,
    overlayBaseDepth2: number = 0,
  ): SlideNode {
    let value: RawRecord =
        typeof node === "object" && node !== null ? (node as RawRecord) : {},
      value2 = depth - overlayBaseDepth2;
    if (value.kind === "img") {
      let value11 = stringOrDefault(value.src),
        state2: ImageNode = {
          kind: "img",
          alt: (0, runtime.truncateUtf16Safely)(
            stringOrDefault(value.alt),
            500,
          ),
          fit: value.fit === "contain" ? "contain" : "cover",
        },
        value12 = stringOrDefault(value.asset);
      if (modelIdPattern.test(value12)) {
        state2.asset = value12;
      }
      if (isAllowedImageSource(value11)) {
        state2.src = value11;
      }
      let value13 = stringOrDefault(value.video);
      if (isModelBlobReference(value13)) {
        state2.video = value13;
        if (value.videoStart === "click") {
          state2.videoStart = "click";
        }
        let value18 = normalizeVideoDelay(value.videoDelay);
        if (value18 !== undefined && state2.videoStart === undefined) {
          state2.videoDelay = value18;
        }
        if (value.videoSound === "on") {
          state2.videoSound = "on";
        }
      } else {
        let value18 = (0, runtime.normalizeVideoLink)(value.videoLink);
        if (value18 !== undefined) {
          state2.videoLink = value18;
        }
      }
      let value14 =
        state2.fit === "cover" &&
        (state2.asset !== undefined || state2.src !== undefined)
          ? (0, runtime.normalizeImageCrop)(value.crop)
          : undefined;
      if (value14 !== undefined) {
        state2.crop = value14;
      }
      let value15 = finiteNumberInRange(value.w, 1, maxModelCoordinate),
        value16 = finiteNumberInRange(value.h, 1, maxModelCoordinate);
      if (value15 !== undefined) {
        state2.w = value15;
      }
      if (value16 !== undefined) {
        state2.h = value16;
      }
      applyNormalizedNodeStyle(state2, value.style, "slides-img", diagnostics);
      let value17 = finiteNumberInRange(value.radius, 0, 200);
      if (value17 !== undefined && value17 > 0) {
        let value18 = Object.fromEntries(
          Object.entries(state2.style ?? {}).filter(
            ([input]) => !/^border.+Radius$/.test(input),
          ),
        ) as StyleBag;
        state2.style = {
          ...value18,
          borderRadius: value17,
        };
      }
      applyNormalizedPlacement(state2, value.place, depth);
      return state2;
    }
    if (value.kind === "icon") {
      let value11 = stringOrDefault(value.icon);
      if (slideIconNames.includes(value11)) {
        let state2: IconNode = {
            kind: "icon",
            icon: value11,
          },
          value12 = stringOrDefault(value.color);
        if (isSlideColor(value12)) {
          state2.color = value12;
        }
        let value13 = finiteNumberInRange(value.w, 1, maxModelCoordinate),
          value14 = finiteNumberInRange(value.h, 1, maxModelCoordinate);
        if (value13 !== undefined) {
          state2.w = value13;
        }
        if (value14 !== undefined) {
          state2.h = value14;
        }
        applyNormalizedNodeStyle(
          state2,
          value.style,
          "slides-icon",
          diagnostics,
        );
        applyNormalizedPlacement(state2, value.place, depth);
        return state2;
      }
      return {
        kind: "text",
        role: "body",
        text: (0, runtime.truncateUtf16Safely)(
          "[icon: " + value11 + "]",
          maxNodeTextLength,
        ),
      };
    }
    if (value.kind === "shape") {
      let value11 = stringOrDefault(value.shape);
      if (shapeVariants.includes(value11)) {
        let state2: ShapeNode = {
            kind: "shape",
            shape: value11 === "rounded" ? "rect" : (value11 as ShapeVariant),
          },
          value12 = finiteNumberInRange(value.w, 1, maxModelCoordinate),
          value13 = finiteNumberInRange(value.h, 1, maxModelCoordinate);
        if (value12 !== undefined) {
          state2.w = value12;
        }
        if (value13 !== undefined) {
          state2.h = value13;
        }
        let value14 = stringOrDefault(value.fill),
          value15 = stringOrDefault(value.stroke),
          value16 = finiteNumberInRange(
            value.strokeWidth,
            0,
            maxShapeStrokeWidth,
          );
        if (state2.shape === "connector") {
          state2.stroke = isSlideColor(value15) ? value15 : "clay";
          state2.strokeWidth =
            value16 !== undefined && value16 > 0
              ? value16
              : defaultShapeStrokeWidth;
          let value17 = stringOrDefault(value.from);
          if (connectorCornerValues.includes(value17) && value17 !== "tl") {
            state2.from = value17 as ConnectorCorner;
          }
          let callback = <T extends string>(
            input: unknown,
            options: readonly string[],
          ): T | undefined =>
            options.find((input2) => input2 === input) as T | undefined;
          Object.assign(
            state2,
            setConnectorArrowHeads(
              {},
              connectorArrowHeads({
                head: callback<ConnectorHead>(value.head, connectorHeadValues),
                headStart: callback<ArrowHeadKind>(
                  value.headStart,
                  arrowHeadKindValues,
                ),
                headEnd: callback<ArrowHeadKind>(
                  value.headEnd,
                  arrowHeadKindValues,
                ),
              }),
            ),
          );
          let value18 = stringOrDefault(value.route);
          if (
            connectorRoutingValues.includes(value18) &&
            value18 !== "straight"
          ) {
            state2.route = value18 as ConnectorRouting;
          }
          if (value.dashed === true) {
            state2.dashed = true;
          }
        } else {
          let value17 =
            typeof value.rotate === "number"
              ? normalizeRotation(value.rotate)
              : undefined;
          if (value17 !== undefined) {
            state2.rotate = value17;
          }
          applyNormalizedNodeStyle(
            state2,
            migrateLegacyShapeStyle(value, value11, value14, value15, value16),
            "slides-shape",
            diagnostics,
          );
          if (state2.shape !== "rect" && state2.style !== undefined) {
            let {
              borderRadius: style,
              borderTopLeftRadius: style2,
              borderTopRightRadius: style3,
              borderBottomRightRadius: style4,
              borderBottomLeftRadius: style5,
              ...style6
            } = state2.style;
            state2.style = Object.keys(style6).length > 0 ? style6 : undefined;
          }
          if (
            state2.shape === "line" &&
            state2.style?.borderStyle !== undefined &&
            state2.style.borderStyle !== "none" &&
            state2.style.borderStyle !== "solid"
          ) {
            state2.style = {
              ...state2.style,
              borderStyle: "solid",
            };
          }
          if (
            state2.style?.backgroundColor === undefined &&
            !shapeHasOutline(state2.style) &&
            shapeZeroWidthOutlineColor(state2.style) === undefined
          ) {
            state2.style = {
              ...state2.style,
              backgroundColor: anthropicAccentColor,
            };
          }
        }
        applyNormalizedPlacement(state2, value.place, depth);
        return state2;
      }
      return {
        kind: "text",
        role: "body",
        text: (0, runtime.truncateUtf16Safely)(
          "[shape: " + value11 + "]",
          maxNodeTextLength,
        ),
      };
    }
    if (value.kind === "table") {
      let value11 = normalizeTableRows(value, budget);
      applyNormalizedNodeStyle(
        value11,
        value.style,
        "slides-table",
        diagnostics,
      );
      applyNormalizedPlacement(value11, value.place, depth);
      return value11;
    }
    if (value.kind === "spacer") {
      let state2: SpacerNode = {
        kind: "spacer",
      };
      applyNormalizedPlacement(state2, value.place, depth);
      return state2;
    }
    if (value.kind === "html") {
      if (depth > 0) {
        return {
          kind: "text",
          role: "caption",
          text: "[web embed — embeds sit at the slide level, not in stacks]",
        };
      }
      if (budget.slideEmbeds > 0) {
        budget.slideEmbeds -= 1;
        return {
          kind: "html",
          html: (0, runtime.truncateUtf16Safely)(
            stringOrDefault(value.html),
            maxHtmlEmbedBytes,
          ),
        };
      }
      return {
        kind: "text",
        role: "caption",
        text:
          "[web embed removed — a slide holds at most " +
          String(maxSlideHtmlEmbeds) +
          "]",
      };
    }
    if (value.kind === "overlay" && value2 < maxNodeTreeDepth) {
      let state2: NodeBase = {};
      applyNormalizedNodeStyle(
        state2,
        value.style,
        "slides-stack",
        diagnostics,
      );
      applyNormalizedPlacement(state2, value.place, depth);
      let value11 = Array.isArray(value.layers)
          ? (value.layers.slice(0, maxTextLineSpacing) as unknown[]).filter(
              (input): input is RawRecord =>
                typeof input === "object" && input !== null,
            )
          : [],
        value12: RawRecord =
          typeof value.base === "object" && value.base !== null
            ? (value.base as RawRecord)
            : {},
        value13 =
          value12.kind !== "overlay" &&
          isUnplacedFlowContainer({
            kind: value12.kind,
            place: normalizeNodePlacement(value12.place),
          }),
        value14 = normalizeSlideNode(
          value.base,
          depth + 1,
          budget,
          diagnostics,
          value13 ? overlayBaseDepth2 + 1 : overlayBaseDepth2,
        ),
        items: OverlayLayer[] = [];
      for (let value15 of value11) {
        let value16 = normalizeSlideNode(
            value15.node,
            depth + 1,
            budget,
            diagnostics,
            overlayBaseDepth2,
          ),
          value17 = value16.kind === "overlay" ? value16.base : value16,
          value18 = normalizeAxisSpec(value15.y);
        items.push({
          node: value17,
          x: normalizeAxisSpec(value15.x),
          y:
            value17.kind === "table"
              ? normalizeTableYAxis(value18, undefined)
              : value18,
        });
      }
      let state3: OverlayNode = {
        kind: "overlay",
        base: value14.kind === "overlay" ? value14.base : value14,
        layers: items,
        ...state2,
      };
      if (value.group === true) {
        state3.group = true;
      }
      return state3;
    }
    if (value.kind === "grid" && value2 < maxNodeTreeDepth) {
      let value11 = Array.isArray(value.children)
          ? (value.children.slice(0, maxSlideFrames) as unknown[]).map(
              (input) =>
                normalizeSlideNode(
                  input,
                  depth + 1,
                  budget,
                  diagnostics,
                  overlayBaseDepth2,
                ),
            )
          : [],
        value12 = normalizeGridTracks(value.rows),
        value13 = normalizeContainerAlignment(value.alignItems),
        value14: NodePlacement["justifySelf"] =
          value.justifyItems === "stretch"
            ? "stretch"
            : normalizeAlignment(value.justifyItems),
        state2: GridNode = {
          kind: "grid",
          columns: normalizeGridTracks(value.columns) ?? [
            {
              fr: 1,
            },
          ],
          ...(value12 !== undefined
            ? {
                rows: value12,
              }
            : {}),
          gap: finiteNumberOrDefault(value.gap, 16, 0, 512),
          ...(value13 !== undefined && value13 !== "stretch"
            ? {
                alignItems: value13,
              }
            : {}),
          ...(value14 !== undefined && value14 !== "stretch"
            ? {
                justifyItems: value14,
              }
            : {}),
          children: value11,
        };
      if (value.group === true) {
        state2.group = true;
      }
      applyNormalizedNodeStyle(
        state2,
        value.style,
        "slides-stack",
        diagnostics,
      );
      applyNormalizedPlacement(state2, value.place, depth);
      return state2;
    }
    if (value.kind === "stack" && value2 < maxNodeTreeDepth) {
      let value11 = Array.isArray(value.children)
          ? (value.children.slice(0, maxSlideFrames) as unknown[]).map(
              (input) =>
                normalizeSlideNode(
                  input,
                  depth + 1,
                  budget,
                  diagnostics,
                  overlayBaseDepth2,
                ),
            )
          : [],
        value12 = normalizeJustification(value.justify),
        value13 = value12 === "start" ? undefined : value12,
        state2: StackNode = {
          kind: "stack",
          dir: value.dir === "h" ? "h" : "v",
          align: normalizeContainerAlignment(value.align) ?? "stretch",
          ...(value13 !== undefined
            ? {
                justify: value13,
              }
            : {}),
          gap: finiteNumberOrDefault(value.gap, 16, 0, 512),
          children: value11,
        };
      if (value.wrap === true) {
        state2.wrap = true;
      }
      if (value.group === true) {
        state2.group = true;
      }
      applyNormalizedNodeStyle(
        state2,
        value.style,
        "slides-stack",
        diagnostics,
      );
      applyNormalizedPlacement(state2, value.place, depth);
      return state2;
    }
    let value3 = value.text ?? (value.kind === undefined ? "" : undefined),
      value4 = value3 === undefined;
    if (value4 && diagnostics) {
      diagnostics.degradedNodes = (diagnostics.degradedNodes ?? 0) + 1;
    }
    let state: TextNode = {
        kind: "text",
        role: textRoles.includes(stringOrDefault(value.role))
          ? (value.role as TextRole)
          : "body",
        text: (0, runtime.truncateUtf16Safely)(
          stringOrDefault(
            value4 ? boundedJsonSummary(value, 12, maxNodeTextLength) : value3,
          ),
          maxNodeTextLength,
        ),
      },
      value5 = stringOrDefault(value.color);
    if (isSlideColor(value5)) {
      state.color = value5;
    }
    let value6 = normalizeTextAlignment(value.align);
    if (value6) {
      state.align = value6;
    }
    if (value.wrap === "nowrap") {
      state.wrap = "nowrap";
    }
    let value7 = normalizeShapeVariant(value.fit);
    if (value7 !== undefined) {
      state.fit = value7;
    }
    let value8 = finiteNumberInRange(value.hangingIndent, 0, 512);
    if (value8 !== undefined && value8 > 0) {
      state.hangingIndent = value8;
    }
    let value9 = normalizeTextMarks(value.marks, state.text);
    if (value9 !== undefined) {
      state.marks = value9;
    }
    if (value.list === "bullet" || value.list === "number") {
      state.list = value.list;
    }
    applyNormalizedNodeStyle(state, value.style, "slides-text", diagnostics);
    let value10 = normalizeTextFill(value.fill);
    if (value10 !== undefined) {
      state.fill = value10;
      if (
        state.style?.backgroundColor !== undefined ||
        state.style?.backgroundGradient !== undefined
      ) {
        let {
          backgroundColor: style,
          backgroundGradient: style2,
          ...style3
        } = state.style;
        if (Object.keys(style3).length > 0) {
          state.style = style3;
        } else {
          delete state.style;
        }
      }
    }
    applyNormalizedPlacement(state, value.place, depth);
    return state;
  }
  function isSafeHyperlink(href: string): boolean {
    if (href.length === 0 || href.length > 2048) {
      return false;
    }
    if (/\s/.test(href)) {
      return false;
    }
    for (let index = 0; index < href.length; index++)
      if (href.charCodeAt(index) < 32) {
        return false;
      }
    return /^https?:\/\//i.test(href);
  }
  function alignUtf16Boundary(text: string, offset: number): number {
    if (offset <= 0) {
      return 0;
    }
    if (offset >= text.length) {
      return text.length;
    }
    let value = text.charCodeAt(offset);
    if (value >= 56320 && value <= 57343) {
      return offset - 1;
    } else {
      return offset;
    }
  }
  function normalizeTextMarks(
    marks: unknown,
    text: string,
  ): TextMark[] | undefined {
    if (!Array.isArray(marks)) {
      return;
    }
    let validMarks: TextMark[] = [];
    for (let value of marks.slice(0, maxTextMarks) as unknown[]) {
      if (typeof value !== "object" || value === null) {
        continue;
      }
      let value2 = value as RawRecord,
        value3 = typeof value2.start === "number" ? value2.start : NaN,
        value4 = typeof value2.end === "number" ? value2.end : NaN;
      if (!Number.isInteger(value3) || !Number.isInteger(value4)) {
        continue;
      }
      let value5 = alignUtf16Boundary(
          text,
          Math.max(0, Math.min(text.length, value3)),
        ),
        value6 = alignUtf16Boundary(
          text,
          Math.max(0, Math.min(text.length, value4)),
        );
      if (value6 <= value5) {
        continue;
      }
      let state: TextMark = {
        start: value5,
        end: value6,
      };
      if (value2.bold === true) {
        state.bold = true;
      }
      if (value2.italic === true) {
        state.italic = true;
      }
      if (value2.underline === true) {
        state.underline = true;
      }
      let value7 = stringOrDefault(value2.color);
      if (isSlideColor(value7)) {
        state.color = value7;
      }
      let value8 = stringOrDefault(value2.href);
      if (value8 !== "" && isSafeHyperlink(value8)) {
        state.href = value8.replace(/^https?:\/\//i, (input) =>
          input.toLowerCase(),
        );
      }
      if (
        state.bold === undefined &&
        state.italic === undefined &&
        state.underline === undefined &&
        state.color === undefined &&
        state.href === undefined
      ) {
        continue;
      }
      validMarks.push(state);
    }
    if (validMarks.length === 0) {
      return;
    }
    validMarks.sort(
      (input, options) => input.start - options.start || input.end - options.end,
    );
    let lineBreakBoundaries: number[] = [];
    for (let index = 0; index < text.length; index++)
      if (
        text[index] ===
        `
`
      ) {
        lineBreakBoundaries.push(index);
        lineBreakBoundaries.push(index + 1);
      }
    let boundaries = [
        ...new Set([
          ...validMarks.flatMap((input) => [input.start, input.end]),
          ...lineBreakBoundaries,
        ]),
      ].sort((input, options) => input - options),
      normalizedMarks: TextMark[] = [];
    for (let index = 0; index < boundaries.length - 1; index++) {
      let value = boundaries[index]!,
        value2 = boundaries[index + 1]!,
        value3 = validMarks.filter(
          (input) => input.start <= value && input.end >= value2,
        );
      if (value3.length === 0) {
        continue;
      }
      if (
        value2 === value + 1 &&
        text[value] ===
          `
`
      ) {
        continue;
      }
      let state: TextMark = {
        start: value,
        end: value2,
      };
      for (let value5 of value3) {
        if (value5.bold) {
          state.bold = true;
        }
        if (value5.italic) {
          state.italic = true;
        }
        if (value5.underline) {
          state.underline = true;
        }
        if (value5.color !== undefined) {
          state.color = value5.color;
        }
        if (value5.href !== undefined) {
          state.href = value5.href;
        }
      }
      if (
        state.bold === undefined &&
        state.italic === undefined &&
        state.underline === undefined &&
        state.color === undefined &&
        state.href === undefined
      ) {
        continue;
      }
      let value4 = normalizedMarks[normalizedMarks.length - 1];
      if (
        value4 !== undefined &&
        value4.end === state.start &&
        value4.bold === state.bold &&
        value4.italic === state.italic &&
        value4.underline === state.underline &&
        value4.color === state.color &&
        value4.href === state.href
      ) {
        value4.end = state.end;
        continue;
      }
      normalizedMarks.push(state);
    }
    if (normalizedMarks.length > 0) {
      return normalizedMarks.slice(0, maxTextMarks);
    } else {
      return undefined;
    }
  }
  function normalizeBuildEffect(build?: unknown): BuildEffect | undefined {
    if (typeof build !== "object" || build === null) {
      return;
    }
    let raw = build as RawRecord,
      effect = raw.effect;
    if (typeof effect !== "string" || !buildEffectValues.includes(effect)) {
      return;
    }
    let order =
      typeof raw.order === "number" && Number.isFinite(raw.order)
        ? Math.max(1, Math.min(maxBuildOrder, Math.round(raw.order)))
        : 1;
    return {
      effect: effect as BuildEffectName,
      order: order,
      ...(raw.auto === true
        ? {
            auto: true as const,
          }
        : {}),
    };
  }
  function normalizeFrameBuild(build?: unknown): FrameBuild | undefined {
    if (typeof build !== "object" || build === null) {
      return;
    }
    let raw = build as RawRecord,
      enter = normalizeBuildEffect(raw.in),
      exit = normalizeBuildEffect(raw.out);
    if (enter === undefined && exit === undefined) {
      return;
    }
    if (
      enter !== undefined &&
      exit !== undefined &&
      exit.order <= enter.order
    ) {
      exit.order = Math.min(maxBuildOrder, enter.order + 1);
      if (exit.order <= enter.order) {
        enter.order = exit.order - 1;
      }
    }
    return {
      ...(enter !== undefined
        ? {
            in: enter,
          }
        : {}),
      ...(exit !== undefined
        ? {
            out: exit,
          }
        : {}),
    };
  }
  function normalizeTableYAxis(axis: Axis, explicitSize?: number): Axis {
    if (axis.anchor !== "fill" && axis.size === undefined) {
      return axis;
    }
    if (
      explicitSize === undefined &&
      (axis.anchor === "center" || axis.anchor === "trailing")
    ) {
      return {
        anchor: axis.anchor,
        margin: axis.margin,
        offset: axis.offset,
      };
    }
    let size = axis.size ?? 0,
      designSize = explicitSize ?? 0,
      start =
        axis.anchor === "center"
          ? designSize / 2 + axis.offset - size / 2
          : axis.anchor === "trailing"
            ? designSize - axis.margin - size
            : axis.margin;
    return {
      anchor: "leading",
      margin: Math.max(0, Math.round(start)),
      offset: 0,
    };
  }
  function normalizeSlideFrame(
    frame?: unknown,
    budget?: DeckNormalizationBudget,
    diagnostics?: NormalizationDiagnostics,
  ): Frame {
    let raw: RawRecord =
        typeof frame === "object" && frame !== null ? (frame as RawRecord) : {},
      id = stringOrDefault(raw.id),
      build = normalizeFrameBuild(raw.build),
      node = normalizeSlideNode(
        raw.node,
        0,
        budget ?? createDeckNormalizationBudget(),
        diagnostics,
      ),
      yAxis = normalizeAxisSpec(raw.y);
    return {
      id: modelIdPattern.test(id) ? id : createModelId(),
      x: normalizeAxisSpec(raw.x),
      y:
        node.kind === "table"
          ? normalizeTableYAxis(yAxis, SLIDE_HEIGHT)
          : yAxis,
      node: node,
      ...(build !== undefined
        ? {
            build: build,
          }
        : {}),
    };
  }
  function normalizeSlide(
    slide: unknown,
    fallbackId: string,
    budget?: DeckNormalizationBudget,
    diagnostics?: NormalizationDiagnostics,
  ): Slide {
    let raw: RawRecord =
        typeof slide === "object" && slide !== null ? (slide as RawRecord) : {},
      id = stringOrDefault(raw.id),
      background = stringOrDefault(raw.bg),
      budget2 = budget ?? createDeckNormalizationBudget();
    budget2.slideCells = maxSlideTableCells;
    budget2.slideEmbeds = maxSlideHtmlEmbeds;
    let notes = typeof raw.notes === "string" ? raw.notes : "",
      frameIds = new Set<string>(),
      ensureUniqueFrameId = (input: Frame): Frame => {
        let id2 = input.id;
        while (frameIds.has(id2)) id2 = createModelId();
        frameIds.add(id2);
        if (id2 === input.id) {
          return input;
        } else {
          return {
            ...input,
            id: id2,
          };
        }
      };
    return {
      v: 1,
      id: modelIdPattern.test(id) ? id : fallbackId,
      bg: isSlideColor(background) ? background : "ivory-warm",
      frames: Array.isArray(raw.frames)
        ? (raw.frames.slice(0, maxSlideFrames) as unknown[]).map((input) =>
            ensureUniqueFrameId(
              normalizeSlideFrame(input, budget2, diagnostics),
            ),
          )
        : [],
      ...(raw.skipped === true
        ? {
            skipped: true as const,
          }
        : {}),
      ...(normalizeListRenderingMode(raw.lists) !== undefined
        ? {
            lists: normalizeListRenderingMode(raw.lists),
          }
        : {}),
      ...(notes.trim() !== ""
        ? {
            notes: (0, runtime.truncateUtf16Safely)(notes, maxSlideNotesLength),
          }
        : {}),
      ...(typeof raw.transition === "string" &&
      slideTransitionValues.includes(raw.transition)
        ? {
            transition: raw.transition as SlideTransition,
          }
        : {}),
    };
  }
  function setDeckListStyle(deck: Slide, lists?: ListRenderingMode): Slide {
    if (deck.lists === lists) {
      return deck;
    }
    let { lists: value, ...value2 } = deck;
    if (lists === undefined) {
      return value2;
    } else {
      return {
        ...value2,
        lists: lists,
      };
    }
  }
  function stripPaintEffects(style: StyleBag): StyleBag | undefined {
    let value = style as RawRecord;
    for (let value2 of runtime.paintEffectProperties as readonly string[])
      delete value[value2];
    delete value.animation;
    let hover = style.hover as RawRecord | undefined;
    if (hover) {
      for (let value2 of runtime.hoverStyleProperties as readonly string[])
        if ((runtime.paintEffectProperties as readonly string[]).includes(value2)) {
          delete hover[value2];
        }
      if (Object.keys(hover).length === 0) {
        delete value.hover;
      }
    }
    if (Object.keys(style).length === 0) {
      return undefined;
    } else {
      return style;
    }
  }
  function enforceDeckPaintBudget(
    slides: Slide[],
    diagnostics?: NormalizationDiagnostics,
  ): void {
    let index = 0,
      index2 = 0,
      callback = (input: SlideNode): void => {
        let style = input.style;
        if (style !== undefined) {
          let value2 = (0, runtime.paintEffectCost)(style);
          if (value2 > 0 && (index += value2) > maxSlidePaintCost) {
            input.style = stripPaintEffects(style);
            if (diagnostics) {
              diagnostics.droppedStyles += 1;
            }
          } else if (
            style.animation !== undefined &&
            ++index2 > maxSlideAnimations
          ) {
            delete style.animation;
            if (Object.keys(style).length === 0) {
              input.style = undefined;
            }
            if (diagnostics) {
              diagnostics.droppedStyles += 1;
            }
          }
        }
        let value = nodeChildren(input);
        if (value !== undefined) {
          for (let value2 of value) callback(value2);
        }
      };
    for (let value of slides)
      for (let value2 of value.frames) callback(value2.node);
  }
  function normalizeDescription(text: unknown, maxLength: number): string {
    return (0, runtime.truncateUtf16Safely)(
      stringOrDefault(text)
        .replace(descriptionControlCharacterPattern, "")
        .replace(/\s+/g, " "),
      maxLength,
    ).trim();
  }
  function importLegacyDeckChildren(
    children: unknown,
    diagnostics: Set<string>,
  ): Set<string> {
    let value: unknown = Array.isArray(children)
        ? children
        : typeof children === "object" && children !== null
          ? (children as RawRecord).children
          : undefined,
      values = new Set<string>(),
      values2 = new Set<string>(),
      values3 = new Set<string>(),
      value2 = 4 * (maxDeckSlides + maxDeckSections),
      callback = (
        input: unknown,
        options: boolean,
        context: number,
        value3: number,
      ): void => {
        if (!Array.isArray(input) || value3 > 32) {
          return;
        }
        for (let value4 of input as unknown[]) {
          if (value2-- <= 0) {
            return;
          }
          if (typeof value4 !== "object" || value4 === null) {
            continue;
          }
          let value5 = value4 as RawRecord;
          if (typeof value5.slide === "string") {
            if (diagnostics.has(value5.slide) && !values2.has(value5.slide)) {
              values2.add(value5.slide);
              if (options) {
                values.add(value5.slide);
              }
            }
            continue;
          }
          if (
            typeof value5.group !== "object" ||
            value5.group === null ||
            values3.size >= maxDeckSections
          ) {
            continue;
          }
          let group = value5.group as RawRecord,
            value6 = stringOrDefault(group.id);
          if (
            !modelIdPattern.test(value6) ||
            values3.has(value6) ||
            context > 3
          ) {
            callback(group.children, options, context, value3 + 1);
            continue;
          }
          values3.add(value6);
          callback(
            group.children,
            options || group.skipped === true,
            context + 1,
            value3 + 1,
          );
        }
      };
    callback(value, false, 1, 0);
    return values;
  }
  function slideTitleSnippet(slide?: Slide, maxLength: number = 42): string {
    if (!slide) {
      return "";
    }
    let text = "",
      text2 = "",
      callback = (source: SlideNode): void => {
        if (text2 !== "") {
          return;
        }
        if (source.kind === "text") {
          let value2 = source.text.replace(/\s+/g, " ").trim();
          if (value2 !== "") {
            if (text === "") {
              text = value2;
            }
            if (
              source.role === "display" ||
              source.role === "h1" ||
              source.role === "h2" ||
              source.role === "h3"
            ) {
              text2 = value2;
            }
          }
        }
        if (source.kind === "stack" || source.kind === "grid") {
          for (let value2 of source.children) callback(value2);
        } else if (source.kind === "overlay") {
          callback(source.base);
          for (let value2 of source.layers) callback(value2.node);
        }
      };
    for (let value2 of slide.frames) callback(value2.node);
    let value = text2 !== "" ? text2 : text;
    if (value.length > maxLength) {
      return (
        (0, runtime.truncateUtf16Safely)(value, maxLength - 1).trimEnd() + "…"
      );
    } else {
      return value;
    }
  }
  function normalizeDeck(
    deck?: unknown,
    diagnostics?: NormalizationDiagnostics,
  ): DeckContent {
    if (diagnostics) {
      diagnostics.droppedStyles = 0;
      diagnostics.degradedNodes = 0;
    }
    let raw: RawRecord =
        typeof deck === "object" && deck !== null ? (deck as RawRecord) : {},
      rawSlides: RawRecord =
        typeof raw.slides === "object" && raw.slides !== null
          ? (raw.slides as RawRecord)
          : {},
      rawOrder: unknown[] = Array.isArray(raw.order) ? raw.order : [],
      order: string[] = [],
      slideEntries: [string, Slide][] = [],
      slideIds = new Set<string>(),
      budget: DeckNormalizationBudget = {
        slideCells: 0,
        deckCells: maxDeckTableCells,
        slideEmbeds: 0,
      };
    for (let value of rawOrder) {
      if (
        typeof value !== "string" ||
        !modelIdPattern.test(value) ||
        slideIds.has(value) ||
        !Object.hasOwn(rawSlides, value)
      ) {
        continue;
      }
      slideIds.add(value);
      order.push(value);
      if (order.length >= maxDeckSlides) {
        break;
      }
    }
    let skippedSlideIds = importLegacyDeckChildren(raw.outline, slideIds),
      listMode = normalizeListRenderingMode(raw.lists);
    for (let value of order) {
      let value2 = rawSlides[value],
        value3 = !skippedSlideIds.has(value)
          ? value2
          : typeof value2 === "object" && value2 !== null
            ? {
                ...value2,
                skipped: true,
              }
            : {
                skipped: true,
              };
      slideEntries.push([
        value,
        setDeckListStyle(
          normalizeSlide(value3, value, budget, diagnostics),
          listMode,
        ),
      ]);
    }
    enforceDeckPaintBudget(
      slideEntries.map(([, input]) => input),
      diagnostics,
    );
    let assetEntries: [string, string][] = [],
      rawAssets: RawRecord =
        typeof raw.assets === "object" && raw.assets !== null
          ? (raw.assets as RawRecord)
          : {};
    for (let value in rawAssets) {
      if (assetEntries.length >= maxDeckAssets) {
        break;
      }
      if (!Object.hasOwn(rawAssets, value) || !modelIdPattern.test(value)) {
        continue;
      }
      let value2 = rawAssets[value];
      if (typeof value2 !== "string" || !isAllowedImageSource(value2)) {
        continue;
      }
      assetEntries.push([value, value2]);
    }
    let fonts = normalizeThemeFontFamilies(raw.fonts),
      faces = normalizeFontFaces(raw.faces),
      slides: Record<string, Slide> = Object.fromEntries(slideEntries),
      sections = (0, runtime.normalizeSections)(raw.sections),
      cover = enumStringOrUndefined(raw.cover, order);
    return {
      theme: raw.theme === "neutral" ? "neutral" : "anthropic",
      ...(raw.format === "html"
        ? {
            format: "html" as const,
          }
        : {}),
      ...(sections !== undefined
        ? {
            sections: sections,
          }
        : {}),
      ...(cover !== undefined
        ? {
            cover: cover,
          }
        : {}),
      order: order,
      slides: slides,
      assets: Object.fromEntries(assetEntries),
      ...(fonts !== undefined
        ? {
            fonts: fonts,
          }
        : {}),
      ...(faces !== undefined
        ? {
            faces: faces,
          }
        : {}),
      ...(listMode !== undefined
        ? {
            lists: listMode,
          }
        : {}),
    };
  }
  function collectSlideAssetIds(slide: Slide, assetIds: Set<string>): void {
    let callback = (source: SlideNode): void => {
      if (source.kind === "img" && source.asset !== undefined) {
        assetIds.add(source.asset);
      }
      let value = nodeChildren(source);
      if (value !== undefined) {
        for (let value2 of value) callback(value2);
      }
    };
    for (let value of slide.frames) callback(value.node);
  }
  bindRuntimeValue(runtime, "normalizeVideoDelay", () => normalizeVideoDelay);
  bindRuntimeValue(runtime, "serializeImageCrop", () => serializeImageCrop);
  bindRuntimeValue(runtime, "parseImageCrop", () => parseImageCrop);
  bindRuntimeValue(runtime, "connectorArrowInset", () => connectorArrowInset);
  bindRuntimeValue(runtime, "connectorArrowHeads", () => connectorArrowHeads);
  bindRuntimeValue(
    runtime,
    "setConnectorArrowHeads",
    () => setConnectorArrowHeads,
  );
  bindRuntimeValue(runtime, "connectorEndpoints", () => connectorEndpoints);
  bindRuntimeValue(
    runtime,
    "absoluteConnectorEndpoints",
    () => absoluteConnectorEndpoints,
  );
  bindRuntimeValue(
    runtime,
    "connectorBoundsFromEndpoints",
    () => connectorBoundsFromEndpoints,
  );
  bindRuntimeValue(runtime, "connectorGeometry", () => connectorGeometry);
  bindRuntimeValue(
    runtime,
    "shortenConnectorShaftForHeads",
    () => shortenConnectorShaftForHeads,
  );
  bindRuntimeValue(
    runtime,
    "connectorArrowHeadWings",
    () => connectorArrowHeadWings,
  );
  bindRuntimeValue(runtime, "lineShapeEndpoints", () => lineShapeEndpoints);
  bindRuntimeValue(
    runtime,
    "lineShapeFromEndpoints",
    () => lineShapeFromEndpoints,
  );
  bindRuntimeValue(runtime, "shapeOutline", () => shapeOutline);
  bindRuntimeValue(runtime, "shapeHasOutline", () => shapeHasOutline);
  bindRuntimeValue(
    runtime,
    "shapeZeroWidthOutlineColor",
    () => shapeZeroWidthOutlineColor,
  );
  bindRuntimeValue(
    runtime,
    "migrateLegacyShapeStyle",
    () => migrateLegacyShapeStyle,
  );
  bindRuntimeValue(
    runtime,
    "normalizeShapeVariant",
    () => normalizeShapeVariant,
  );
  bindRuntimeValue(runtime, "isFlowContainer", () => isFlowContainer);
  bindRuntimeValue(runtime, "isOverlayNode", () => isOverlayNode);
  bindRuntimeValue(runtime, "isConnectorNode", () => isConnectorNode);
  bindRuntimeValue(runtime, "isLineShapeNode", () => isLineShapeNode);
  bindRuntimeValue(
    runtime,
    "isUnplacedFlowContainer",
    () => isUnplacedFlowContainer,
  );
  bindRuntimeValue(runtime, "overlayBaseDepth", () => overlayBaseDepth);
  bindRuntimeValue(
    runtime,
    "nodeTreeWithinDepthLimit",
    () => nodeTreeWithinDepthLimit,
  );
  bindRuntimeValue(runtime, "nodeChildren", () => nodeChildren);
  bindRuntimeValue(runtime, "normalizeRotation", () => normalizeRotation);
  bindRuntimeValue(runtime, "nodeStyleKind", () => nodeStyleKind);
  bindRuntimeValue(runtime, "isFullBleedAxis", () => isFullBleedAxis);
  bindRuntimeValue(
    runtime,
    "isEmptyBackgroundFrame",
    () => isEmptyBackgroundFrame,
  );
  bindRuntimeValue(runtime, "countNodeTree", () => countNodeTree);
  bindRuntimeValue(
    runtime,
    "slidePrimaryLayoutFrame",
    () => slidePrimaryLayoutFrame,
  );
  bindRuntimeValue(runtime, "isPrimaryLayoutFrame", () => isPrimaryLayoutFrame);
  bindRuntimeValue(runtime, "createModelId", () => createModelId);
  bindRuntimeValue(runtime, "isSlideColor", () => isSlideColor);
  bindRuntimeValue(runtime, "isSlideModelEmulator", () => isSlideModelEmulator);
  bindRuntimeValue(runtime, "isModelBlobReference", () => isModelBlobReference);
  bindRuntimeValue(runtime, "isAllowedImageSource", () => isAllowedImageSource);
  bindRuntimeValue(
    runtime,
    "isRenderableImageSource",
    () => isRenderableImageSource,
  );
  bindRuntimeValue(runtime, "normalizeTextFill", () => normalizeTextFill);
  bindRuntimeValue(
    runtime,
    "isEmbeddedFontDataUrl",
    () => isEmbeddedFontDataUrl,
  );
  bindRuntimeValue(runtime, "isAllowedFontSource", () => isAllowedFontSource);
  bindRuntimeValue(
    runtime,
    "isAllowedGoogleFontStylesheet",
    () => isAllowedGoogleFontStylesheet,
  );
  bindRuntimeValue(runtime, "normalizeFontFaces", () => normalizeFontFaces);
  bindRuntimeValue(
    runtime,
    "normalizeThemeFontFamilies",
    () => normalizeThemeFontFamilies,
  );
  bindRuntimeValue(runtime, "stringOrDefault", () => stringOrDefault);
  bindRuntimeValue(runtime, "boundedJsonSummary", () => boundedJsonSummary);
  bindRuntimeValue(
    runtime,
    "finiteNumberOrDefault",
    () => finiteNumberOrDefault,
  );
  bindRuntimeValue(runtime, "finiteNumberInRange", () => finiteNumberInRange);
  bindRuntimeValue(runtime, "normalizeAxisSpec", () => normalizeAxisSpec);
  bindRuntimeValue(runtime, "normalizeAlignment", () => normalizeAlignment);
  bindRuntimeValue(
    runtime,
    "normalizeTextAlignment",
    () => normalizeTextAlignment,
  );
  bindRuntimeValue(
    runtime,
    "normalizeContainerAlignment",
    () => normalizeContainerAlignment,
  );
  bindRuntimeValue(
    runtime,
    "normalizeJustification",
    () => normalizeJustification,
  );
  bindRuntimeValue(
    runtime,
    "normalizeNodePlacement",
    () => normalizeNodePlacement,
  );
  bindRuntimeValue(runtime, "normalizeGridTrack", () => normalizeGridTrack);
  bindRuntimeValue(runtime, "normalizeGridTracks", () => normalizeGridTracks);
  bindRuntimeValue(
    runtime,
    "tablePlacementWithoutHeight",
    () => tablePlacementWithoutHeight,
  );
  bindRuntimeValue(
    runtime,
    "applyNormalizedPlacement",
    () => applyNormalizedPlacement,
  );
  bindRuntimeValue(
    runtime,
    "createDeckNormalizationBudget",
    () => createDeckNormalizationBudget,
  );
  bindRuntimeValue(
    runtime,
    "normalizeTableColumnWidths",
    () => normalizeTableColumnWidths,
  );
  bindRuntimeValue(
    runtime,
    "normalizeTableColumnAlignments",
    () => normalizeTableColumnAlignments,
  );
  bindRuntimeValue(
    runtime,
    "normalizeTableCellStyles",
    () => normalizeTableCellStyles,
  );
  bindRuntimeValue(
    runtime,
    "normalizeTableRowStyles",
    () => normalizeTableRowStyles,
  );
  bindRuntimeValue(runtime, "normalizeTableRows", () => normalizeTableRows);
  bindRuntimeValue(
    runtime,
    "applyNormalizedNodeStyle",
    () => applyNormalizedNodeStyle,
  );
  bindRuntimeValue(runtime, "normalizeSlideNode", () => normalizeSlideNode);
  bindRuntimeValue(runtime, "isSafeHyperlink", () => isSafeHyperlink);
  bindRuntimeValue(runtime, "alignUtf16Boundary", () => alignUtf16Boundary);
  bindRuntimeValue(runtime, "normalizeTextMarks", () => normalizeTextMarks);
  bindRuntimeValue(runtime, "normalizeBuildEffect", () => normalizeBuildEffect);
  bindRuntimeValue(runtime, "normalizeFrameBuild", () => normalizeFrameBuild);
  bindRuntimeValue(runtime, "normalizeTableYAxis", () => normalizeTableYAxis);
  bindRuntimeValue(runtime, "normalizeSlideFrame", () => normalizeSlideFrame);
  bindRuntimeValue(runtime, "normalizeSlide", () => normalizeSlide);
  bindRuntimeValue(runtime, "setDeckListStyle", () => setDeckListStyle);
  bindRuntimeValue(runtime, "stripPaintEffects", () => stripPaintEffects);
  bindRuntimeValue(
    runtime,
    "enforceDeckPaintBudget",
    () => enforceDeckPaintBudget,
  );
  bindRuntimeValue(runtime, "normalizeDescription", () => normalizeDescription);
  bindRuntimeValue(
    runtime,
    "importLegacyDeckChildren",
    () => importLegacyDeckChildren,
  );
  bindRuntimeValue(runtime, "slideTitleSnippet", () => slideTitleSnippet);
  bindRuntimeValue(runtime, "normalizeDeck", () => normalizeDeck);
  bindRuntimeValue(runtime, "collectSlideAssetIds", () => collectSlideAssetIds);
  bindRuntimeValue(
    runtime,
    "SLIDE_WIDTH",
    () => SLIDE_WIDTH,
    (value) => {
      SLIDE_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDE_HEIGHT",
    () => SLIDE_HEIGHT,
    (value) => {
      SLIDE_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultMediaSize",
    () => defaultMediaSize,
    (value) => {
      defaultMediaSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textRoles",
    () => textRoles,
    (value) => {
      textRoles = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textRoleLabels",
    () => textRoleLabels,
    (value) => {
      textRoleLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxTextMarks",
    () => maxTextMarks,
    (value) => {
      maxTextMarks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxVideoDelaySeconds",
    () => maxVideoDelaySeconds,
    (value) => {
      maxVideoDelaySeconds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideIconNames",
    () => slideIconNames,
    (value) => {
      slideIconNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shapeVariants",
    () => shapeVariants,
    (value) => {
      shapeVariants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shapeVariantLabels",
    () => shapeVariantLabels,
    (value) => {
      shapeVariantLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "connectorCornerValues",
    () => connectorCornerValues,
    (value) => {
      connectorCornerValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "connectorHeadValues",
    () => connectorHeadValues,
    (value) => {
      connectorHeadValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "arrowHeadKindValues",
    () => arrowHeadKindValues,
    (value) => {
      arrowHeadKindValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "connectorRoutingValues",
    () => connectorRoutingValues,
    (value) => {
      connectorRoutingValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultShapeStrokeWidth",
    () => defaultShapeStrokeWidth,
    (value) => {
      defaultShapeStrokeWidth = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "arrowHeadLengthFactor",
    () => arrowHeadLengthFactor,
    (value) => {
      arrowHeadLengthFactor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "filledArrowHeadWidthFactor",
    () => filledArrowHeadWidthFactor,
    (value) => {
      filledArrowHeadWidthFactor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "openArrowHeadWidthFactor",
    () => openArrowHeadWidthFactor,
    (value) => {
      openArrowHeadWidthFactor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "arrowShaftInsetFactor",
    () => arrowShaftInsetFactor,
    (value) => {
      arrowShaftInsetFactor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shadowPresetNames",
    () => shadowPresetNames,
    (value) => {
      shadowPresetNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shadowPresets",
    () => shadowPresets,
    (value) => {
      shadowPresets = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxShapeStrokeWidth",
    () => maxShapeStrokeWidth,
    (value) => {
      maxShapeStrokeWidth = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxShapeCornerRadius",
    () => maxShapeCornerRadius,
    (value) => {
      maxShapeCornerRadius = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "anthropicAccentColor",
    () => anthropicAccentColor,
    (value) => {
      anthropicAccentColor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxGridTracks",
    () => maxGridTracks,
    (value) => {
      maxGridTracks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxGridGap",
    () => maxGridGap,
    (value) => {
      maxGridGap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textFitValues",
    () => textFitValues,
    (value) => {
      textFitValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultTextFit",
    () => defaultTextFit,
    (value) => {
      defaultTextFit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textFitMinimumScale",
    () => textFitMinimumScale,
    (value) => {
      textFitMinimumScale = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "minimumTextFontSize",
    () => minimumTextFontSize,
    (value) => {
      minimumTextFontSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxTextLineSpacing",
    () => maxTextLineSpacing,
    (value) => {
      maxTextLineSpacing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buildEffectValues",
    () => buildEffectValues,
    (value) => {
      buildEffectValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxBuildOrder",
    () => maxBuildOrder,
    (value) => {
      maxBuildOrder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideTransitionValues",
    () => slideTransitionValues,
    (value) => {
      slideTransitionValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideTransitionLabels",
    () => slideTransitionLabels,
    (value) => {
      slideTransitionLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeListRenderingMode",
    () => normalizeListRenderingMode,
    (value) => {
      normalizeListRenderingMode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultListGutter",
    () => defaultListGutter,
    (value) => {
      defaultListGutter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textListGutter",
    () => textListGutter,
    (value) => {
      textListGutter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideHexColorPattern",
    () => slideHexColorPattern,
    (value) => {
      slideHexColorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideColorNames",
    () => slideColorNames,
    (value) => {
      slideColorNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "imageBase64DataUrlPattern",
    () => imageBase64DataUrlPattern,
    (value) => {
      imageBase64DataUrlPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "svgUtf8DataUrlPattern",
    () => svgUtf8DataUrlPattern,
    (value) => {
      svgUtf8DataUrlPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "svgDataUrlPattern",
    () => svgDataUrlPattern,
    (value) => {
      svgDataUrlPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxInlineSvgBytes",
    () => maxInlineSvgBytes,
    (value) => {
      maxInlineSvgBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxInlineImageBytes",
    () => maxInlineImageBytes,
    (value) => {
      maxInlineImageBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "modelStoredBlobPattern",
    () => modelStoredBlobPattern,
    (value) => {
      modelStoredBlobPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "modelEmulatorBlobPattern",
    () => modelEmulatorBlobPattern,
    (value) => {
      modelEmulatorBlobPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemAssetPathSource",
    () => designSystemAssetPathSource,
    (value) => {
      designSystemAssetPathSource = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemImagePathPattern",
    () => designSystemImagePathPattern,
    (value) => {
      designSystemImagePathPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideModelEmulatorDetected",
    () => slideModelEmulatorDetected,
    (value) => {
      slideModelEmulatorDetected = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "themeFontFamilyKinds",
    () => themeFontFamilyKinds,
    (value) => {
      themeFontFamilyKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "embeddedFontDataUrlPattern",
    () => embeddedFontDataUrlPattern,
    (value) => {
      embeddedFontDataUrlPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxEmbeddedFontBytes",
    () => maxEmbeddedFontBytes,
    (value) => {
      maxEmbeddedFontBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "googleFontStylesheetPattern",
    () => googleFontStylesheetPattern,
    (value) => {
      googleFontStylesheetPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxFontStylesheetUrlLength",
    () => maxFontStylesheetUrlLength,
    (value) => {
      maxFontStylesheetUrlLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reservedModelFontFamilyNames",
    () => reservedModelFontFamilyNames,
    (value) => {
      reservedModelFontFamilyNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemFontPathSource",
    () => designSystemFontPathSource,
    (value) => {
      designSystemFontPathSource = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemFontPathPattern",
    () => designSystemFontPathPattern,
    (value) => {
      designSystemFontPathPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxDeckFontFaces",
    () => maxDeckFontFaces,
    (value) => {
      maxDeckFontFaces = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxDeckFontCssBytes",
    () => maxDeckFontCssBytes,
    (value) => {
      maxDeckFontCssBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxDeckAssetBytes",
    () => maxDeckAssetBytes,
    (value) => {
      maxDeckAssetBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "modelIdPattern",
    () => modelIdPattern,
    (value) => {
      modelIdPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxModelCoordinate",
    () => maxModelCoordinate,
    (value) => {
      maxModelCoordinate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxNodeTextLength",
    () => maxNodeTextLength,
    (value) => {
      maxNodeTextLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxSlideNotesLength",
    () => maxSlideNotesLength,
    (value) => {
      maxSlideNotesLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxSectionDescriptionLength",
    () => maxSectionDescriptionLength,
    (value) => {
      maxSectionDescriptionLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxHtmlEmbedBytes",
    () => maxHtmlEmbedBytes,
    (value) => {
      maxHtmlEmbedBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxSlideHtmlEmbeds",
    () => maxSlideHtmlEmbeds,
    (value) => {
      maxSlideHtmlEmbeds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxSlideFrames",
    () => maxSlideFrames,
    (value) => {
      maxSlideFrames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxNodeTreeDepth",
    () => maxNodeTreeDepth,
    (value) => {
      maxNodeTreeDepth = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxTableColumns",
    () => maxTableColumns,
    (value) => {
      maxTableColumns = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxTableRows",
    () => maxTableRows,
    (value) => {
      maxTableRows = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxSlideTableCells",
    () => maxSlideTableCells,
    (value) => {
      maxSlideTableCells = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxDeckTableCells",
    () => maxDeckTableCells,
    (value) => {
      maxDeckTableCells = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tableCellKeyPattern",
    () => tableCellKeyPattern,
    (value) => {
      tableCellKeyPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxSlidePaintCost",
    () => maxSlidePaintCost,
    (value) => {
      maxSlidePaintCost = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxSlideAnimations",
    () => maxSlideAnimations,
    (value) => {
      maxSlideAnimations = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxDeckSections",
    () => maxDeckSections,
    (value) => {
      maxDeckSections = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "descriptionControlCharacterPattern",
    () => descriptionControlCharacterPattern,
    (value) => {
      descriptionControlCharacterPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxDeckSlides",
    () => maxDeckSlides,
    (value) => {
      maxDeckSlides = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxDeckAssets",
    () => maxDeckAssets,
    (value) => {
      maxDeckAssets = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "enumStringOrUndefined",
    () => enumStringOrUndefined,
    (value) => {
      enumStringOrUndefined = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSlideModel",
    () => initializeSlideModel,
    (value) => {
      initializeSlideModel = value;
    },
  );
  return () => {
    SLIDE_WIDTH = 1920;
    SLIDE_HEIGHT = 1080;
    defaultMediaSize = 240;
    maxTextMarks = 100;
    maxVideoDelaySeconds = 60;
    defaultShapeStrokeWidth = 2;
    arrowHeadLengthFactor = 4;
    filledArrowHeadWidthFactor = 2;
    openArrowHeadWidthFactor = 1.7;
    arrowShaftInsetFactor = 2;
    maxShapeStrokeWidth = 32;
    maxShapeCornerRadius = 24;
    anthropicAccentColor = "#d97757";
    maxGridTracks = 24;
    maxGridGap = 64;
    defaultTextFit = "shrink";
    textFitMinimumScale = 0.6;
    minimumTextFontSize = 8;
    maxTextLineSpacing = 24;
    maxBuildOrder = 50;
    normalizeListRenderingMode = (input?: unknown): ListRenderingMode | undefined =>
      input === "css" ? "css" : undefined;
    defaultListGutter = 40;
    textListGutter = (source: SlideNode, options?: unknown): number | undefined =>
      options === "css" && source.kind === "text" && source.list !== undefined
        ? (source.style?.paddingLeft ?? defaultListGutter)
        : undefined;
    maxInlineSvgBytes = 71680;
    maxInlineImageBytes = 71680;
    designSystemAssetPathSource =
      "project/ds/[a-z0-9][a-z0-9_-]{0,63}/(?:[A-Za-z0-9][A-Za-z0-9._-]{0,99}/){0,8}[A-Za-z0-9][A-Za-z0-9._-]{0,99}\\.";
    maxEmbeddedFontBytes = 524288;
    maxFontStylesheetUrlLength = 1024;
    maxDeckFontFaces = 4;
    maxDeckFontCssBytes = 245760;
    maxDeckAssetBytes = 2097152;
    maxModelCoordinate = 4096;
    maxNodeTextLength = 20000;
    maxSlideNotesLength = 4000;
    maxSectionDescriptionLength = 400;
    maxHtmlEmbedBytes = 16384;
    maxSlideHtmlEmbeds = 8;
    maxSlideFrames = 200;
    maxNodeTreeDepth = 16;
    maxTableColumns = 24;
    maxTableRows = 100;
    maxSlideTableCells = 4000;
    maxDeckTableCells = 40000;
    maxSlidePaintCost = 1000;
    maxSlideAnimations = 100;
    maxDeckSections = 100;
    maxDeckSlides = 500;
    maxDeckAssets = 200;
    enumStringOrUndefined = (input: unknown, options: readonly string[]): string | undefined =>
      typeof input === "string" && options.includes(input) ? input : undefined;
    initializeSlideModel = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeVideoLinks)();
      (0, runtime.initializeImageCrop)();
      (0, runtime.initializeSections)();
      (0, runtime.initializeSlideTypeScales)();
      (0, runtime.initializeStyleSchema)();
      textRoles = [
        "display",
        "h1",
        "h2",
        "h3",
        "lead",
        "eyebrow",
        "body",
        "caption",
      ];
      textRoleLabels = {
        display: "Display",
        h1: "Heading 1",
        h2: "Heading 2",
        h3: "Heading 3",
        lead: "Lead",
        eyebrow: "Eyebrow",
        body: "Body",
        caption: "Caption",
      };
      slideIconNames = [
        "Ant",
        "Activity",
        "Book",
        "Chart",
        "Chat",
        "Check",
        "CheckCircle",
        "Clock",
        "Cloud",
        "Code",
        "Database",
        "Globe",
        "GraduationCap",
        "Home",
        "Key",
        "Lightbulb",
        "Lightning",
        "Link",
        "Lock",
        "Owl",
        "PaperPlane",
        "Play",
        "Search",
        "Settings",
        "Star",
        "ThumbsUp",
        "Tool",
        "Trust",
        "Users",
        "Verified",
        "Warning",
        "Wrench",
      ];
      shapeVariants = [
        "rect",
        "rounded",
        "ellipse",
        "diamond",
        "arrow-right",
        "arrow-left",
        "arrow-up",
        "arrow-down",
        "line",
        "connector",
      ];
      shapeVariantLabels = {
        rect: "Rectangle",
        rounded: "Rounded rectangle",
        ellipse: "Ellipse",
        diamond: "Diamond (decision)",
        "arrow-right": "Arrow right",
        "arrow-left": "Arrow left",
        "arrow-up": "Arrow up",
        "arrow-down": "Arrow down",
        line: "Line",
        connector: "Connector",
      };
      connectorCornerValues = ["tl", "tr", "bl", "br"];
      connectorHeadValues = ["end", "both", "none"];
      arrowHeadKindValues = ["none", "open", "filled"];
      connectorRoutingValues = ["straight", "elbow", "hv", "vh"];
      shadowPresetNames = ["subtle", "medium", "strong"];
      shadowPresets = {
        subtle: {
          x: 0,
          y: 2,
          blur: 8,
          spread: 0,
          color: "#1414132e",
        },
        medium: {
          x: 0,
          y: 6,
          blur: 20,
          spread: 0,
          color: "#14141340",
        },
        strong: {
          x: 0,
          y: 14,
          blur: 40,
          spread: 0,
          color: "#14141352",
        },
      };
      textFitValues = ["shrink", "none", "grow"];
      buildEffectValues = [
        "fade",
        "rise",
        "drop",
        "left",
        "right",
        "scale",
        "pop",
      ];
      slideTransitionValues = ["fade", "push", "magic"];
      slideTransitionLabels = {
        none: "None",
        fade: "Fade",
        push: "Push",
        magic: "Magic move",
      };
      slideHexColorPattern = /^#[0-9a-fA-F]{3,8}$/;
      slideColorNames = [
        "slate",
        "ivory",
        "ivory-warm",
        "clay",
        "oat",
        "white",
        "text-secondary",
        "text-tertiary",
      ];
      imageBase64DataUrlPattern =
        /^data:image\/(png|jpeg|gif|webp|avif|svg\+xml);base64,/;
      svgUtf8DataUrlPattern = /^data:image\/svg\+xml(;utf8|;charset=utf-8)?,/;
      svgDataUrlPattern =
        /^data:image\/svg\+xml(;base64|;utf8|;charset=utf-8)?[;,]/;
      modelStoredBlobPattern = /^\/?_blob\/[0-9a-f]{32}$/;
      modelEmulatorBlobPattern =
        /^blob:(null|https?:\/\/[A-Za-z0-9.:\[\]-]{1,100})\/[0-9a-f-]{36}$/;
      designSystemImagePathPattern = new RegExp(
        "^" +
          designSystemAssetPathSource +
          "(?:[Pp][Nn][Gg]|[Jj][Pp][Ee]?[Gg]|[Gg][Ii][Ff]|[Ww][Ee][Bb][Pp]|[Aa][Vv][Ii][Ff]|[Ss][Vv][Gg])$",
      );
      themeFontFamilyKinds = ["sans", "serif"];
      embeddedFontDataUrlPattern =
        /^data:font\/(woff2|woff|ttf|otf);base64,[A-Za-z0-9+/]+={0,2}$/;
      googleFontStylesheetPattern =
        /^https:\/\/fonts\.googleapis\.com\/css2\?[A-Za-z0-9&=+,.:;@_-]+$/;
      reservedModelFontFamilyNames = new Set([
        "inherit",
        "initial",
        "unset",
        "revert",
        "revert-layer",
        "default",
      ]);
      designSystemFontPathSource =
        designSystemAssetPathSource +
        "(?:[Ww][Oo][Ff][Ff]2?|[Tt][Tt][Ff]|[Oo][Tt][Ff])";
      designSystemFontPathPattern = new RegExp(
        "^" + designSystemFontPathSource + "$",
      );
      modelIdPattern = /^[\w-]{1,64}$/;
      tableCellKeyPattern = /^(\d{1,3})\.(\d{1,2})$/;
      descriptionControlCharacterPattern = /[^\P{Cc}\t\n\r]|\p{Cf}/gu;
    });
  };
}
