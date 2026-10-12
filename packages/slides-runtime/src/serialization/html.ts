/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  Axis,
  BuildEffect,
  DeckContent,
  FlowContainerNode,
  FontFamilyFallback,
  Frame,
  GridTrack,
  Justification,
  ListRenderingMode,
  ShapeNode,
  Slide,
  SlideNode,
  StyleBag,
  TextMark,
  TextNode,
  TextRole,
  ThemeFonts,
} from "../deck-contracts";
import type { ConnectorEndpoints } from "../model/deck";
import type { TextRun } from "../model/rich-text-dom";
import type { AnchoredSection } from "../model/sections";
import type { TypeScale } from "../model/type-scales";

/** One CSS declaration: property name and serialized value. */
export type CssDeclaration = [property: string, value: string];
/** A position (and optional size) along one axis, in slide pixels. */
export interface AxisPosition {
  at: number;
  size?: number;
}
/** The declarations that place a frame, plus the translate that centres it. */
export interface FrameStyle {
  decls: CssDeclaration[];
  translate: string | undefined;
}
/** The text-node fields that typography serialization reads. */
export type TextTypography = Pick<TextNode, "align" | "wrap" | "color" | "fill">;
/** Which edges of a text run keep their outer spaces visible. */
export type SpaceEdge = "none" | "first" | "last" | "both";
/** HTML tag a text role is written as. */
export type TextRoleHtmlTag = "h1" | "h2" | "h3" | "p";
/** `justify-content` value per non-default justification. */
export type JustifyContent = Record<Exclude<Justification, "start">, string>;
/** Border widths per side, in the order top, right, bottom, left. */
export type BorderSideWidths = Array<[side: string, width: number | undefined]>;
/** Geometry of the container a node is positioned in. */
export interface NodeAnchors {
  x: Axis;
  y: Axis;
  spanW: number | undefined;
  spanH: number | undefined;
}
/** Writes a deck or slide as indented HTML lines. */
export interface SlideHtmlWriterInstance {
  deck: DeckContent;
  out: string[];
  scale: TypeScale;
  neutral: boolean;
  sectionAt: Map<string, AnchoredSection>;
  lists: ListRenderingMode | undefined;
  line(indent: number, text: string): void;
  text(): string;
  roleDecls(node: TextNode): CssDeclaration[];
  connector(
    node: ShapeNode,
    indent: number,
    attributes: string,
    anchors: NodeAnchors | undefined,
    placement: CssDeclaration[],
    declarations: CssDeclaration[],
    transform?: string,
  ): void;
  node(
    node: SlideNode,
    indent: number,
    declarations?: CssDeclaration[],
    attributes?: string,
    transform?: string,
    anchors?: NodeAnchors,
  ): void;
  slide(slide: Slide): void;
}
export type SlideHtmlWriterConstructor = new (
  deck: DeckContent,
) => SlideHtmlWriterInstance;
/** `serializeSlideColor`: a defined colour always serializes to a string. */
export interface SerializeSlideColor {
  (color: string): string;
  (color: string | undefined): string | undefined;
}

declare module "../bindings" {
  interface RuntimeBindings {
    SlideHtmlWriter: SlideHtmlWriterConstructor;
    roundSerializedNumber: (value: number) => number;
    serializedFontFallbacks: Record<FontFamilyFallback, string>;
    quoteFontFamily: (family: string) => string;
    textRoleHtmlTags: Record<TextRole, TextRoleHtmlTag>;
    cssPropertySerializationOrder: string[];
    cssPropertyOrderMap: Map<string, number>;
    initializeHtmlWriter: () => void;
    serializeAxisPosition: (
      axis: Axis,
      designSize?: number,
    ) => AxisPosition | undefined;
    escapeSlideHtmlText: (text: string, preserveSpaces?: boolean) => string;
    escapeSlideHtmlAttribute: (text: string) => string;
    serializeSlideColor: SerializeSlideColor;
    serializeStyleAttribute: (properties: CssDeclaration[]) => string;
    serializeAxisStyle: (
      axis: Axis,
      nearProperty: string,
      farProperty: string,
      sizeProperty: string,
      centers: string[],
    ) => CssDeclaration[];
    serializeFrameStyle: (frame: Frame) => FrameStyle;
    serializeThemeFontFamily: (
      family: FontFamilyFallback,
      themeFamilies?: ThemeFonts,
    ) => string;
    serializeTypographyStyle: (
      style?: StyleBag,
      role?: TextTypography,
      themeFamilies?: ThemeFonts,
    ) => CssDeclaration[];
    serializeNodeStyle: (
      style?: StyleBag,
      nodeKind?: string,
    ) => CssDeclaration[];
    serializeNodePlacement: (node: SlideNode) => CssDeclaration[];
    serializeTextRun: (
      run: TextRun,
      spaceEdge?: SpaceEdge,
      cssMode?: boolean,
    ) => string;
    serializeTextRuns: (runs: TextRun[], cssMode?: boolean) => string;
    serializeRichText: (
      text: string,
      marks?: TextMark[],
      cssMode?: boolean,
    ) => string;
    serializeBuildEffect: (build: BuildEffect) => string;
    serializeGridTrack: (track: GridTrack) => string;
    isGradientBackgroundSlide: (slide: Slide) => boolean;
    isFullBleedFrame: (frame: Frame, allowGradient?: boolean) => boolean;
    orderCssProperties: (
      properties: Iterable<CssDeclaration>,
    ) => CssDeclaration[];
    deduplicateCssProperties: (
      properties: Iterable<CssDeclaration>,
    ) => CssDeclaration[];
    serializeSlideHtml: (deck: DeckContent, slide: Slide) => string;
    serializeDeckHead: (deck: Partial<DeckContent>, title: string) => string;
    writeDeckHead: (
      writer: SlideHtmlWriterInstance,
      deck: Pick<DeckContent, "faces" | "fonts">,
      title: string,
    ) => void;
    serializeDeckHtml: (deck: DeckContent, title: string) => string;
  }
}

export function installSerializationHtml(runtime: RuntimeBindings): () => void {
  var SlideHtmlWriter: RuntimeBindings["SlideHtmlWriter"];
  var roundSerializedNumber: RuntimeBindings["roundSerializedNumber"];
  var serializedFontFallbacks: RuntimeBindings["serializedFontFallbacks"];
  var quoteFontFamily: RuntimeBindings["quoteFontFamily"];
  var textRoleHtmlTags: RuntimeBindings["textRoleHtmlTags"];
  var cssPropertySerializationOrder: RuntimeBindings["cssPropertySerializationOrder"];
  var cssPropertyOrderMap: RuntimeBindings["cssPropertyOrderMap"];
  var initializeHtmlWriter: RuntimeBindings["initializeHtmlWriter"];
  function serializeAxisPosition(
    axis: Axis,
    designSize?: number,
  ): AxisPosition | undefined {
    let value =
      axis.anchor === "fill"
        ? designSize !== undefined
          ? Math.max(0, designSize - 2 * axis.margin)
          : undefined
        : axis.size;
    switch (axis.anchor) {
      case "trailing":
        if (designSize !== undefined && value !== undefined) {
          return {
            at: designSize - axis.margin - value,
            size: value,
          };
        } else {
          return undefined;
        }
      case "center":
        if (designSize !== undefined && value !== undefined) {
          return {
            at: designSize / 2 + axis.offset - value / 2,
            size: value,
          };
        } else {
          return undefined;
        }
      default:
        if (value !== undefined) {
          return {
            at: axis.margin,
            size: value,
          };
        } else {
          return {
            at: axis.margin,
          };
        }
    }
  }
  function escapeSlideHtmlText(
    text: string,
    preserveSpaces: boolean = false,
  ): string {
    let value = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/[\t\r\f]/g, " ")
      .replace(
        / {2,}/g,
        (items) => " " + " ".repeat(items.length - 1),
      );
    if (preserveSpaces) {
      value = value.replace(/(^|\n) /g, "$1 ").replace(/ ($|\n)/g, " $1");
    }
    return value.replace(/\u00a0/g, "&nbsp;");
  }
  function escapeSlideHtmlAttribute(text: string): string {
    return escapeSlideHtmlText(text).replace(/"/g, "&quot;");
  }
  function serializeSlideColor(color: string): string;
  function serializeSlideColor(color: string | undefined): string | undefined;
  function serializeSlideColor(color?: string): string | undefined {
    if (color === undefined) {
      return;
    }
    let namedColor = runtime.namedSlideColors[color];
    if (namedColor !== undefined) {
      return namedColor.toLowerCase();
    }
    return (0, runtime.normalizeCssColorHex)(color) ?? color.toLowerCase();
  }
  function serializeStyleAttribute(properties: CssDeclaration[]): string {
    let nonemptyProperties = properties.filter(
      ([, input]) => input !== "",
    );
    if (nonemptyProperties.length === 0) {
      return "";
    } else {
      return (
        ' style="' +
        escapeSlideHtmlAttribute(
          nonemptyProperties
            .map(([input, input2]) => input + ":" + input2)
            .join("; "),
        ) +
        '"'
      );
    }
  }
  function serializeAxisStyle(
    axis: Axis,
    nearProperty: string,
    farProperty: string,
    sizeProperty: string,
    centers: string[],
  ): CssDeclaration[] {
    let items: CssDeclaration[] = [];
    switch (axis.anchor) {
      case "leading":
        items.push([nearProperty, (0, runtime.formatCssPixels)(axis.margin)]);
        break;
      case "trailing":
        items.push([farProperty, (0, runtime.formatCssPixels)(axis.margin)]);
        break;
      case "fill":
        items.push(
          [nearProperty, (0, runtime.formatCssPixels)(axis.margin)],
          [farProperty, (0, runtime.formatCssPixels)(axis.margin)],
        );
        break;
      case "center":
        items.push([
          nearProperty,
          roundSerializedNumber(axis.offset) === 0
            ? "50%"
            : "calc(50% " +
              (axis.offset < 0 ? "- " : "+ ") +
              (0, runtime.formatCssNumber)(Math.abs(axis.offset)) +
              "px)",
        ]);
        centers.push("-50%");
        break;
    }
    if (axis.anchor !== "center") {
      centers.push("0");
    }
    if (axis.anchor !== "fill" && axis.size !== undefined) {
      items.push([sizeProperty, (0, runtime.formatCssPixels)(axis.size)]);
    }
    return items;
  }
  function serializeFrameStyle(frame: Frame): FrameStyle {
    let centers: string[] = [],
      xProperties = serializeAxisStyle(
        frame.x,
        "left",
        "right",
        "width",
        centers,
      ),
      yProperties = serializeAxisStyle(
        frame.y,
        "top",
        "bottom",
        "height",
        centers,
      ),
      properties = new Map([...xProperties, ...yProperties]);
    if (frame.node.kind === "table") {
      properties.delete("height");
      if (frame.y.anchor === "fill") {
        properties.delete("bottom");
      }
    }
    let items: CssDeclaration[] = [["position", "absolute"]];
    for (let value2 of [
      "top",
      "right",
      "bottom",
      "left",
      "width",
      "height",
    ]) {
      let entry = properties.get(value2);
      if (entry !== undefined) {
        items.push([value2, entry]);
      }
    }
    let value =
      centers[0] === "-50%" && centers[1] === "-50%"
        ? "translate(-50%, -50%)"
        : centers[0] === "-50%"
          ? "translateX(-50%)"
          : centers[1] === "-50%"
            ? "translateY(-50%)"
            : undefined;
    return {
      decls: items,
      translate: value,
    };
  }
  function serializeThemeFontFamily(
    family: FontFamilyFallback,
    themeFamilies?: ThemeFonts,
  ): string {
    let value =
      family === "sans" || family === "serif"
        ? themeFamilies?.[family]
        : undefined;
    if (value !== undefined) {
      return (
        quoteFontFamily(value.family) + ", " + serializedFontFallbacks[family]
      );
    } else {
      return serializedFontFallbacks[family];
    }
  }
  function serializeTypographyStyle(
    style?: StyleBag,
    role?: TextTypography,
    themeFamilies?: ThemeFonts,
  ): CssDeclaration[] {
    let properties: CssDeclaration[] = [];
    if (style === undefined && role === undefined) {
      return properties;
    }
    let family = style?.fontFamily;
    if (family !== undefined) {
      if (typeof family === "string") {
        properties.push([
          "font-family",
          family === "helvetica"
            ? "Helvetica, sans-serif"
            : serializeThemeFontFamily(family, themeFamilies),
        ]);
      } else {
        properties.push([
          "font-family",
          quoteFontFamily(family.family) +
            ", " +
            (family.webSafe !== undefined
              ? quoteFontFamily(family.webSafe) + ", "
              : "") +
            serializedFontFallbacks[family.fallback],
        ]);
      }
    }
    if (style?.fontSize !== undefined) {
      properties.push([
        "font-size",
        (0, runtime.formatCssPixels)(style.fontSize),
      ]);
    }
    if (style?.fontWeight !== undefined) {
      properties.push([
        "font-weight",
        String(
          Math.max(
            100,
            Math.min(900, Math.round(style.fontWeight / 100) * 100),
          ),
        ),
      ]);
    }
    if (style?.fontStyle !== undefined) {
      properties.push(["font-style", style.fontStyle]);
    }
    if (style?.lineHeight !== undefined) {
      properties.push([
        "line-height",
        (0, runtime.formatCssNumber)(style.lineHeight),
      ]);
    }
    if (style?.letterSpacing !== undefined) {
      properties.push([
        "letter-spacing",
        (0, runtime.formatCssPixels)(style.letterSpacing),
      ]);
    }
    if (role?.align !== undefined && role.align !== "start") {
      properties.push([
        "text-align",
        role.align === "center"
          ? "center"
          : role.align === "justify"
            ? "justify"
            : "right",
      ]);
    }
    if (style?.textTransform !== undefined) {
      properties.push(["text-transform", style.textTransform]);
    }
    if (role?.wrap === "nowrap") {
      properties.push(["white-space", "nowrap"]);
    }
    let value = style?.textDecorationLine,
      value2 = style?.textDecorationStyle,
      value3 = style?.textDecorationColor;
    if (value !== undefined || value2 !== undefined || value3 !== undefined) {
      properties.push([
        "text-decoration",
        [value ?? "underline", value2, serializeSlideColor(value3)]
          .filter((input) => input !== undefined)
          .join(" "),
      ]);
    }
    if (style?.fontVariantNumeric !== undefined) {
      properties.push(["font-variant-numeric", style.fontVariantNumeric]);
    }
    if (
      style?.textStrokeWidth !== undefined ||
      style?.textStrokeColor !== undefined
    ) {
      properties.push([
        "-webkit-text-stroke",
        [
          style.textStrokeWidth !== undefined
            ? (0, runtime.formatCssPixels)(style.textStrokeWidth)
            : undefined,
          serializeSlideColor(style.textStrokeColor),
        ]
          .filter((input) => input !== undefined)
          .join(" "),
      ]);
    }
    if (role?.color !== undefined) {
      properties.push(["color", serializeSlideColor(role.color)]);
    }
    let value4 = role?.fill;
    if (
      value4 !== undefined &&
      (value4.kind === "gradient" ||
        (0, runtime.isRenderableImageSource)(value4.src))
    ) {
      properties.push([
        "background",
        value4.kind === "gradient"
          ? (0, runtime.serializeCssGradient)(value4.gradient)
          : "url(" +
            value4.src +
            ") center / " +
            (value4.size ?? "cover") +
            " no-repeat",
      ]);
      properties.push(
        ["-webkit-background-clip", "text"],
        ["background-clip", "text"],
        ["-webkit-text-fill-color", "transparent"],
      );
    }
    return properties;
  }
  function serializeNodeStyle(style?: StyleBag, nodeKind?: string): CssDeclaration[] {
    let properties: CssDeclaration[] = [],
      backgroundColor = style?.backgroundColor,
      gradient = style?.backgroundGradient;
    if (backgroundColor !== undefined && gradient !== undefined) {
      properties.push(
        ["background-color", serializeSlideColor(backgroundColor)],
        ["background-image", (0, runtime.serializeCssGradient)(gradient)],
      );
    } else if (backgroundColor !== undefined) {
      properties.push(["background", serializeSlideColor(backgroundColor)]);
    } else if (gradient !== undefined) {
      properties.push([
        "background",
        (0, runtime.serializeCssGradient)(gradient),
      ]);
    }
    let value: BorderSideWidths =
      style !== undefined
        ? [
            ["top", style.borderTopWidth],
            ["right", style.borderRightWidth],
            ["bottom", style.borderBottomWidth],
            ["left", style.borderLeftWidth],
          ]
        : [];
    if (
      style !== undefined &&
      value.some(([, input]) => input !== undefined)
    ) {
      if (style.borderStyle !== undefined && style.borderStyle !== "none") {
        let value4 =
            " " +
            (style.borderStyle ?? "solid") +
            " " +
            (serializeSlideColor(style.borderColor) ?? "#000000"),
          value5: string | null =
            style.borderSides === undefined
              ? null
              : " " + style.borderSides + " ";
        for (let [value6, value7] of value) {
          let value8 =
            value7 ??
            (style.borderWidth !== undefined &&
            (value5 === null || value5.includes(" " + value6 + " "))
              ? style.borderWidth
              : 0);
          if (value8 > 0) {
            properties.push([
              "border-" + value6,
              (0, runtime.formatCssPixels)(value8) + value4,
            ]);
          }
        }
      }
    } else if (
      style?.borderWidth !== undefined ||
      style?.borderStyle !== undefined ||
      style?.borderColor !== undefined
    ) {
      if (style.borderStyle === "none" || style.borderWidth === 0) {
      } else {
        let value4 =
          (0, runtime.formatCssPixels)(style.borderWidth ?? 1) +
          " " +
          (style.borderStyle ?? "solid") +
          " " +
          (serializeSlideColor(style.borderColor) ?? "#000000");
        if (style.borderSides === undefined) {
          properties.push(["border", value4]);
        } else {
          for (let value5 of style.borderSides.split(" "))
            properties.push(["border-" + value5, value4]);
        }
      }
    }
    if (
      style !== undefined &&
      (style.borderTopLeftRadius !== undefined ||
        style.borderTopRightRadius !== undefined ||
        style.borderBottomRightRadius !== undefined ||
        style.borderBottomLeftRadius !== undefined)
    ) {
      let value4 = style.borderRadius ?? 0;
      properties.push([
        "border-radius",
        [
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomRightRadius,
          style.borderBottomLeftRadius,
        ]
          .map(
            (input) =>
              (0, runtime.formatCssPixels)(input ?? value4),
          )
          .join(" "),
      ]);
    } else if (style?.borderRadius !== undefined) {
      properties.push([
        "border-radius",
        (0, runtime.formatCssPixels)(style.borderRadius),
      ]);
    }
    if (style?.opacity !== undefined) {
      properties.push(["opacity", (0, runtime.formatCssNumber)(style.opacity)]);
    }
    if (style?.boxShadow !== undefined) {
      properties.push([
        "box-shadow",
        style.boxShadow.map(runtime.serializeCssShadow).join(", "),
      ]);
    }
    if (style?.textShadow !== undefined) {
      properties.push([
        "text-shadow",
        style.textShadow.map(runtime.serializeCssShadow).join(", "),
      ]);
    }
    let value2: string =
        style?.transform !== undefined
          ? (0, runtime.serializeCssTransform)(style.transform)
          : "",
      value3 = [nodeKind, value2]
        .filter(
          (input) => input !== undefined && input !== "",
        )
        .join(" ");
    if (value3 !== "") {
      properties.push(["transform", value3]);
    }
    if (style?.filter !== undefined) {
      let value4: string = (0, runtime.serializeCssFilter)(style.filter);
      if (value4 !== "") {
        properties.push(["filter", value4]);
      }
    }
    if (style?.backdropFilter !== undefined) {
      let value4: string = (0, runtime.serializeCssFilter)(
        style.backdropFilter,
      );
      if (value4 !== "") {
        properties.push(["backdrop-filter", value4]);
      }
    }
    if (style?.mixBlendMode !== undefined) {
      properties.push(["mix-blend-mode", style.mixBlendMode]);
    }
    if (style?.overflow !== undefined) {
      properties.push(["overflow", style.overflow]);
    }
    let items: Array<number | undefined> = [
      style?.paddingTop,
      style?.paddingRight,
      style?.paddingBottom,
      style?.paddingLeft,
    ];
    if (items.some((input) => input !== undefined)) {
      let [value4, value5, value6, value7] = items.map(
          (input) => input ?? 0,
        ) as [number, number, number, number],
        value8 =
          value4 === value6 && value5 === value7
            ? value4 === value5
              ? [value4]
              : [value4, value5]
            : value5 === value7
              ? [value4, value5, value6]
              : [value4, value5, value6, value7];
      properties.push([
        "padding",
        value8.map(runtime.formatCssPixels).join(" "),
      ]);
    }
    return properties;
  }
  function serializeNodePlacement(node: SlideNode): CssDeclaration[] {
    let placement = node.place,
      properties: CssDeclaration[] = [];
    if (placement === undefined) {
      return properties;
    }
    if (
      placement.grow !== undefined ||
      placement.shrink !== undefined ||
      placement.basis !== undefined
    ) {
      let value2 = placement.grow ?? 0,
        value3 = placement.shrink ?? 1,
        basis = placement.basis;
      if (basis === undefined) {
        properties.push([
          "flex",
          value3 === 1
            ? (0, runtime.formatCssNumber)(value2) + " 1 auto"
            : (0, runtime.formatCssNumber)(value2) +
              " " +
              (0, runtime.formatCssNumber)(value3) +
              " auto",
        ]);
      } else if (roundSerializedNumber(basis) === 0 && value3 === 1) {
        properties.push(["flex", (0, runtime.formatCssNumber)(value2)]);
      } else {
        properties.push([
          "flex",
          (0, runtime.formatCssNumber)(value2) +
            " " +
            (0, runtime.formatCssNumber)(value3) +
            " " +
            (roundSerializedNumber(basis) === 0
              ? "0px"
              : (0, runtime.formatCssPixels)(basis)),
        ]);
      }
    }
    if (placement.alignSelf !== undefined) {
      properties.push(["align-self", placement.alignSelf]);
    }
    let value =
      node.kind === "text" ||
      node.kind === "stack" ||
      node.kind === "grid" ||
      node.kind === "table" ||
      node.kind === "overlay";
    if (
      value &&
      placement.minW !== undefined &&
      placement.maxW !== undefined &&
      roundSerializedNumber(placement.minW) ===
        roundSerializedNumber(placement.maxW)
    ) {
      properties.push(["width", (0, runtime.formatCssPixels)(placement.minW)]);
      if (placement.minWFit !== undefined) {
        properties.push(["min-width", placement.minWFit]);
      }
    } else {
      if (placement.minWFit !== undefined) {
        properties.push(["min-width", placement.minWFit]);
      } else if (placement.minW !== undefined) {
        properties.push([
          "min-width",
          (0, runtime.formatCssPixels)(placement.minW),
        ]);
      }
      if (placement.maxW !== undefined) {
        properties.push([
          "max-width",
          (0, runtime.formatCssPixels)(placement.maxW),
        ]);
      }
    }
    if (node.kind !== "table") {
      if (
        value &&
        placement.minH !== undefined &&
        placement.maxH !== undefined &&
        roundSerializedNumber(placement.minH) ===
          roundSerializedNumber(placement.maxH)
      ) {
        properties.push([
          "height",
          (0, runtime.formatCssPixels)(placement.minH),
        ]);
      } else {
        if (placement.minH !== undefined) {
          properties.push([
            "min-height",
            (0, runtime.formatCssPixels)(placement.minH),
          ]);
        }
        if (placement.maxH !== undefined) {
          properties.push([
            "max-height",
            (0, runtime.formatCssPixels)(placement.maxH),
          ]);
        }
      }
      if (placement.aspect !== undefined) {
        properties.push([
          "aspect-ratio",
          (0, runtime.formatCssNumber)(placement.aspect),
        ]);
      }
    }
    if (placement.colSpan !== undefined) {
      properties.push(["grid-column", "span " + String(placement.colSpan)]);
    }
    if (placement.rowSpan !== undefined) {
      properties.push(["grid-row", "span " + String(placement.rowSpan)]);
    }
    if (placement.justifySelf !== undefined) {
      properties.push(["justify-self", placement.justifySelf]);
    }
    return properties;
  }
  function serializeTextRun(
    run: TextRun,
    spaceEdge: SpaceEdge = "none",
    cssMode: boolean = false,
  ): string {
    let html = escapeSlideHtmlText(run.text);
    if (
      (spaceEdge === "first" || spaceEdge === "both") &&
      html.startsWith(" ")
    ) {
      html = "&nbsp;" + html.slice(1);
    }
    if ((spaceEdge === "last" || spaceEdge === "both") && html.endsWith(" ")) {
      html = html.slice(0, -1) + "&nbsp;";
    }
    if (run.underline) {
      html = "<u>" + html + "</u>";
    }
    if (run.italic) {
      html = "<i>" + html + "</i>";
    }
    if (run.bold) {
      html = "<b>" + html + "</b>";
    }
    if (run.color !== undefined) {
      html =
        '<span style="color:' +
        serializeSlideColor(run.color) +
        (cssMode ? "; -webkit-text-fill-color:currentcolor" : "") +
        '">' +
        html +
        "</span>";
    }
    if (run.href !== undefined) {
      html =
        '<a href="' + escapeSlideHtmlAttribute(run.href) + '">' + html + "</a>";
    }
    return html;
  }
  function serializeTextRuns(
    runs: TextRun[],
    cssMode: boolean = false,
  ): string {
    return runs
      .map(
        (input, options) =>
          serializeTextRun(
            input,
            runs.length === 1
              ? "both"
              : options === 0
                ? "first"
                : options === runs.length - 1
                  ? "last"
                  : "none",
            cssMode,
          ),
      )
      .join("");
  }
  function serializeRichText(
    text: string,
    marks?: TextMark[],
    cssMode: boolean = false,
  ): string {
    return (0, runtime.textLinesAsRuns)({
      text: text,
      marks: marks,
    })
      .map((input) => serializeTextRuns(input, cssMode))
      .join("<br>");
  }
  function serializeBuildEffect(build: BuildEffect): string {
    return (
      build.effect +
      " " +
      String(build.order) +
      (build.auto === true ? " auto" : "")
    );
  }
  function serializeGridTrack(track: GridTrack): string {
    if (track === "auto") {
      return "auto";
    }
    if ("fr" in track) {
      return (0, runtime.formatCssNumber)(track.fr) + "fr";
    } else {
      return (0, runtime.formatCssPixels)(track.px);
    }
  }
  function isGradientBackgroundSlide(slide: Slide): boolean {
    let value = slide.frames[0];
    return (
      value !== undefined &&
      isFullBleedFrame(value, true) &&
      value.node.kind === "stack" &&
      value.node.children.length === 0 &&
      value.node.style?.backgroundGradient !== undefined &&
      Object.keys(value.node.style).every(
        (input) =>
          input === "backgroundGradient" || input === "backgroundColor",
      ) &&
      value.build === undefined
    );
  }
  function isFullBleedFrame(frame: Frame, allowGradient?: boolean): boolean {
    let callback = (input: Axis) =>
      input.anchor === "fill" && roundSerializedNumber(input.margin) === 0;
    if (!callback(frame.x) || !callback(frame.y)) {
      return false;
    }
    let style = frame.node.style;
    if (style === undefined) {
      return true;
    }
    let values = new Set([
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "overflow",
    ]);
    if (allowGradient) {
      return true;
    }
    return Object.keys(style).every(
      (input) => values.has(input),
    );
  }
  function orderCssProperties(properties: Iterable<CssDeclaration>): CssDeclaration[] {
    return [...properties].sort(
      (input, options) =>
        (cssPropertyOrderMap.get(input[0]) ?? 999) -
        (cssPropertyOrderMap.get(options[0]) ?? 999),
    );
  }
  function deduplicateCssProperties(properties: Iterable<CssDeclaration>): CssDeclaration[] {
    let properties2: Map<string, string> = new Map();
    for (let [value, value2] of properties)
      properties2.set(value, value2);
    return [...properties2];
  }
  function serializeSlideHtml(deck: DeckContent, slide: Slide): string {
    let writer = new SlideHtmlWriter(deck);
    writer.slide(slide);
    return writer.text();
  }
  function serializeDeckHead(deck: Partial<DeckContent>, title: string): string {
    let writer = new SlideHtmlWriter({
      theme: "neutral",
      order: [],
      slides: {},
      assets: {},
      ...deck,
    });
    writeDeckHead(writer, deck, title);
    return writer.text();
  }
  function writeDeckHead(
    writer: SlideHtmlWriterInstance,
    deck: Pick<DeckContent, "faces" | "fonts">,
    title: string,
  ): void {
    writer.line(0, "<head>");
    writer.line(1, "<title>" + escapeSlideHtmlText(title) + "</title>");
    let items: string[] = [],
      items2: string[] = [];
    for (let value of (deck.faces ?? []))
      if ("href" in value) {
        if (!items.includes(value.href!)) {
          items.push(value.href!);
        }
      } else {
        items2.push(
          '@font-face{font-family:"' +
            value.family +
            '";src:url(' +
            value.src +
            ")}",
        );
      }
    for (let value of ["sans", "serif"] as const) {
      let value2 = deck.fonts?.[value];
      if (value2 === undefined) {
        continue;
      }
      if ("href" in value2) {
        if (!items.includes(value2.href!)) {
          items.push(value2.href!);
        }
      } else {
        items2.push(
          '@font-face{font-family:"' +
            value2.family +
            '";src:url(' +
            value2.src +
            ")}",
        );
      }
    }
    for (let value of items)
      writer.line(
        1,
        '<link rel="stylesheet" href="' +
          escapeSlideHtmlAttribute(value) +
          '">',
      );
    if (items2.length > 0) {
      writer.line(1, "<style>" + items2.join("") + "</style>");
    }
    writer.line(0, "</head>");
  }
  function serializeDeckHtml(deck: DeckContent, title: string): string {
    let writer = new SlideHtmlWriter(deck);
    writer.sectionAt = new Map(
      (0, runtime.anchoredSectionsInOrder)(deck.sections, deck.order).map(
        (input: AnchoredSection): [string, AnchoredSection] => [input.start, input],
      ),
    );
    writer.line(0, "<!doctype html>");
    writer.line(0, "<html>");
    writeDeckHead(writer, deck, title);
    writer.line(0, "<body>");
    for (let value of deck.order) {
      let value2 = deck.slides[value];
      if (value2 !== undefined) {
        writer.slide(value2);
      }
    }
    writer.line(0, "</body>");
    writer.line(0, "</html>");
    return writer.text();
  }
  bindRuntimeValue(
    runtime,
    "serializeAxisPosition",
    () => serializeAxisPosition,
  );
  bindRuntimeValue(runtime, "escapeSlideHtmlText", () => escapeSlideHtmlText);
  bindRuntimeValue(
    runtime,
    "escapeSlideHtmlAttribute",
    () => escapeSlideHtmlAttribute,
  );
  bindRuntimeValue(runtime, "serializeSlideColor", () => serializeSlideColor);
  bindRuntimeValue(
    runtime,
    "serializeStyleAttribute",
    () => serializeStyleAttribute,
  );
  bindRuntimeValue(runtime, "serializeAxisStyle", () => serializeAxisStyle);
  bindRuntimeValue(runtime, "serializeFrameStyle", () => serializeFrameStyle);
  bindRuntimeValue(
    runtime,
    "serializeThemeFontFamily",
    () => serializeThemeFontFamily,
  );
  bindRuntimeValue(
    runtime,
    "serializeTypographyStyle",
    () => serializeTypographyStyle,
  );
  bindRuntimeValue(runtime, "serializeNodeStyle", () => serializeNodeStyle);
  bindRuntimeValue(
    runtime,
    "serializeNodePlacement",
    () => serializeNodePlacement,
  );
  bindRuntimeValue(runtime, "serializeTextRun", () => serializeTextRun);
  bindRuntimeValue(runtime, "serializeTextRuns", () => serializeTextRuns);
  bindRuntimeValue(runtime, "serializeRichText", () => serializeRichText);
  bindRuntimeValue(
    runtime,
    "SlideHtmlWriter",
    () => SlideHtmlWriter,
    (value) => {
      SlideHtmlWriter = value;
    },
  );
  bindRuntimeValue(runtime, "serializeBuildEffect", () => serializeBuildEffect);
  bindRuntimeValue(runtime, "serializeGridTrack", () => serializeGridTrack);
  bindRuntimeValue(
    runtime,
    "isGradientBackgroundSlide",
    () => isGradientBackgroundSlide,
  );
  bindRuntimeValue(runtime, "isFullBleedFrame", () => isFullBleedFrame);
  bindRuntimeValue(runtime, "orderCssProperties", () => orderCssProperties);
  bindRuntimeValue(
    runtime,
    "deduplicateCssProperties",
    () => deduplicateCssProperties,
  );
  bindRuntimeValue(runtime, "serializeSlideHtml", () => serializeSlideHtml);
  bindRuntimeValue(runtime, "serializeDeckHead", () => serializeDeckHead);
  bindRuntimeValue(runtime, "writeDeckHead", () => writeDeckHead);
  bindRuntimeValue(runtime, "serializeDeckHtml", () => serializeDeckHtml);
  bindRuntimeValue(
    runtime,
    "roundSerializedNumber",
    () => roundSerializedNumber,
    (value) => {
      roundSerializedNumber = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "serializedFontFallbacks",
    () => serializedFontFallbacks,
    (value) => {
      serializedFontFallbacks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "quoteFontFamily",
    () => quoteFontFamily,
    (value) => {
      quoteFontFamily = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textRoleHtmlTags",
    () => textRoleHtmlTags,
    (value) => {
      textRoleHtmlTags = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssPropertySerializationOrder",
    () => cssPropertySerializationOrder,
    (value) => {
      cssPropertySerializationOrder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssPropertyOrderMap",
    () => cssPropertyOrderMap,
    (value) => {
      cssPropertyOrderMap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeHtmlWriter",
    () => initializeHtmlWriter,
    (value) => {
      initializeHtmlWriter = value;
    },
  );
  return () => {
    SlideHtmlWriter = class SlideHtmlWriter {
      deck: DeckContent;
      out: string[] = [];
      scale: TypeScale;
      neutral: boolean;
      sectionAt: Map<string, AnchoredSection> = new Map();
      lists: ListRenderingMode | undefined;
      constructor(input: DeckContent) {
        this.deck = input;
        this.neutral = input.theme === "neutral";
        this.scale = this.neutral
          ? runtime.neutralTypeScale
          : runtime.anthropicTypeScale;
      }
      line(input: number, options: string): void {
        this.out.push("  ".repeat(input) + options);
      }
      text(): string {
        return (
          this.out.join(`
`) +
          `
`
        );
      }
      roleDecls(input: TextNode): CssDeclaration[] {
        let value =
            input.list !== undefined ? "p" : textRoleHtmlTags[input.role],
          value2 = this.scale[input.role],
          value3 =
            runtime.neutralTypeScale[value === "p" ? "body" : value],
          items: CssDeclaration[] = [],
          style = input.style;
        if (
          !this.neutral &&
          value2.serifDisplay &&
          style?.fontFamily === undefined
        ) {
          items.push([
            "font-family",
            serializeThemeFontFamily("serif", this.deck.fonts),
          ]);
        }
        if (
          style?.fontSize === undefined &&
          value2.fontSize !== value3.fontSize
        ) {
          items.push([
            "font-size",
            (0, runtime.formatCssPixels)(value2.fontSize),
          ]);
        }
        let value4 = Math.round(value2.fontWeight / 100) * 100;
        if (style?.fontWeight === undefined && value4 !== value3.fontWeight) {
          items.push(["font-weight", String(value4)]);
        }
        if (
          style?.lineHeight === undefined &&
          value2.lineHeight !== value3.lineHeight
        ) {
          items.push([
            "line-height",
            (0, runtime.formatCssNumber)(value2.lineHeight),
          ]);
        }
        return items;
      }
      connector(
        input: ShapeNode,
        options: number,
        context: string,
        value: NodeAnchors | undefined,
        extra: CssDeclaration[],
        detail: CssDeclaration[],
        argument?: string,
      ): void {
        let value2 =
            input.strokeWidth ?? runtime.defaultShapeStrokeWidth,
          items: CssDeclaration[] = [];
        if (input.stroke !== undefined) {
          items.push(["color", serializeSlideColor(input.stroke)]);
        }
        if (value2 !== runtime.defaultShapeStrokeWidth) {
          items.push(["border-width", (0, runtime.formatCssPixels)(value2)]);
        }
        if (input.dashed === true) {
          items.push(["border-style", "dashed"]);
        }
        let value3 =
          (input.head !== undefined && input.head !== "end"
            ? ' head="' + input.head + '"'
            : "") +
          (input.headStart !== undefined
            ? ' head-start="' + input.headStart + '"'
            : "") +
          (input.headEnd !== undefined
            ? ' head-end="' + input.headEnd + '"'
            : "") +
          (input.route !== undefined && input.route !== "straight"
            ? ' route="' + input.route + '"'
            : "");
        if (
          !(
            value !== undefined &&
            value.x.anchor === "leading" &&
            value.y.anchor === "leading" &&
            value.x.size !== undefined &&
            value.y.size !== undefined
          )
        ) {
          let value7 = value === undefined ? [...extra] : [...detail];
          if (value === undefined) {
            if (input.w !== undefined) {
              value7.push(["width", (0, runtime.formatCssPixels)(input.w)]);
            }
            if (input.h !== undefined) {
              value7.push(["height", (0, runtime.formatCssPixels)(input.h)]);
            }
          } else if (argument !== undefined) {
            value7.push(["transform", argument]);
          }
          let value8 =
            input.from !== undefined && input.from !== "tl"
              ? ' from="' + input.from + '"'
              : "";
          this.line(
            options,
            "<x-connector" +
              value8 +
              value3 +
              context +
              serializeStyleAttribute(
                orderCssProperties(
                  deduplicateCssProperties([...value7, ...items]),
                ),
              ) +
              "></x-connector>",
          );
          return;
        }
        let margin = value.x.margin,
          margin2 = value.y.margin,
          { start: value4, end: value5 }: ConnectorEndpoints = (0,
          runtime.connectorEndpoints)(
            value.x.size,
            value.y.size,
            input.from,
            input.strokeWidth,
          ),
          value6 =
            ' x1="' +
            (0, runtime.formatCssNumber)(margin + value4[0]) +
            '" y1="' +
            (0, runtime.formatCssNumber)(margin2 + value4[1]) +
            '" x2="' +
            (0, runtime.formatCssNumber)(margin + value5[0]) +
            '" y2="' +
            (0, runtime.formatCssNumber)(margin2 + value5[1]) +
            '"' +
            value3;
        this.line(
          options,
          "<x-connector" +
            value6 +
            context +
            serializeStyleAttribute(orderCssProperties(items)) +
            "></x-connector>",
        );
      }
      node(
        table: SlideNode,
        options: number,
        items: CssDeclaration[] = [],
        value: string = "",
        extra?: string,
        detail?: NodeAnchors,
      ): void {
        let value2 = serializeNodePlacement(table),
          callback = (input: string) =>
            items.some(([input2]) => input2 === input),
          value3 = callback("left") && callback("right"),
          value4 = callback("top") && callback("bottom");
        switch (table.kind) {
          case "text": {
            let value5 =
              table.list === "bullet"
                ? "ul"
                : table.list === "number"
                  ? "ol"
                  : textRoleHtmlTags[table.role];
            if (table.fit !== undefined) {
              value += ' data-fit="' + table.fit + '"';
            }
            let value6 = this.roleDecls(table),
              value7 = serializeTypographyStyle(
                table.style,
                table,
                this.deck.fonts,
              ),
              value8 = (0, runtime.textListGutter)(table, this.lists),
              value9 =
                (table.style?.paddingTop ??
                  table.style?.paddingRight ??
                  table.style?.paddingBottom) !== undefined,
              value10 =
                value8 !== undefined &&
                value9 &&
                table.style?.paddingLeft === undefined
                  ? {
                      ...table.style,
                      paddingLeft: value8,
                    }
                  : table.style,
              value11 = deduplicateCssProperties([
                ...items,
                ...value2,
                ...value6,
                ...value7,
                ...serializeNodeStyle(value10, extra),
              ]),
              value12 = serializeStyleAttribute(
                orderCssProperties(value11),
              );
            if (table.list !== undefined) {
              this.line(options, "<" + value5 + value + value12 + ">");
              let value13 = (0, runtime.textLinesAsRuns)({
                text: table.text,
                marks: table.marks,
              });
              for (let value14 of value13)
                this.line(
                  options + 1,
                  "<li>" +
                    serializeTextRuns(value14, table.fill !== undefined) +
                    "</li>",
                );
              this.line(options, "</" + value5 + ">");
            } else {
              this.line(
                options,
                "<" +
                  value5 +
                  value +
                  value12 +
                  ">" +
                  serializeRichText(
                    table.text,
                    table.marks,
                    table.fill !== undefined,
                  ) +
                  "</" +
                  value5 +
                  ">",
              );
            }
            return;
          }
          case "img": {
            let value5 =
                table.src ??
                (table.asset !== undefined
                  ? this.deck.assets[table.asset]
                  : undefined),
              value6 = (0, runtime.normalizeVideoLink)(
                table.videoLink,
              ),
              value7 =
                table.video !== undefined
                  ? ' data-video="' +
                    escapeSlideHtmlAttribute(table.video) +
                    '"' +
                    (table.videoStart === "click"
                      ? ' data-video-start="click"'
                      : table.videoDelay !== undefined
                        ? ' data-video-delay="' + String(table.videoDelay) + '"'
                        : "") +
                    (table.videoSound === "on" ? ' data-video-sound="on"' : "")
                  : value6 !== undefined
                    ? " data-video-" +
                      value6.provider +
                      '="' +
                      escapeSlideHtmlAttribute(value6.id) +
                      '"' +
                      (value6.start !== undefined
                        ? ' data-video-at="' + String(value6.start) + '"'
                        : "")
                    : "",
              items2 = [...items, ...value2];
            if (table.w !== undefined && !value3 && !callback("width")) {
              items2.push(["width", (0, runtime.formatCssPixels)(table.w)]);
            }
            if (table.h !== undefined && !value4 && !callback("height")) {
              items2.push(["height", (0, runtime.formatCssPixels)(table.h)]);
            }
            if (value5 === undefined) {
              if (table.fit === "contain") {
                items2.push(["object-fit", "contain"]);
              }
              items2.push(...serializeNodeStyle(table.style, extra));
              this.line(
                options,
                '<img alt="' +
                  escapeSlideHtmlAttribute(table.alt) +
                  '"' +
                  value7 +
                  value +
                  serializeStyleAttribute(
                    orderCssProperties(deduplicateCssProperties(items2)),
                  ) +
                  ">",
              );
              return;
            }
            let value8 =
                table.video === undefined && value6 === undefined
                  ? (0, runtime.decodeSvgDataUrl)(value5)
                  : undefined,
              value9 =
                value8 !== undefined &&
                (0, runtime.validateSvgMarkup)(value8) === undefined
                  ? (0, runtime.parseSvgDimensions)(value8)
                  : undefined;
            if (value9 !== undefined) {
              items2.push(...serializeNodeStyle(table.style, extra));
              let value10 = Object.keys(value9.attrs).map(
                  (input) => input.toLowerCase(),
                ),
                value11 = value10.includes("xmlns")
                  ? ""
                  : ' xmlns="http://www.w3.org/2000/svg"';
              if (
                !value10.includes("xmlns:xlink") &&
                /\bxlink:/i.test(value8!)
              ) {
                value11 += ' xmlns:xlink="http://www.w3.org/1999/xlink"';
              }
              for (let [value12, value13] of Object.entries<string>(
                value9.attrs,
              )) {
                let value14 = value12.toLowerCase();
                if (
                  value14 === "style" ||
                  value14 === "width" ||
                  value14 === "height" ||
                  value14 === "id" ||
                  value14.startsWith("data-build-")
                ) {
                  continue;
                }
                value11 +=
                  " " +
                  value12 +
                  '="' +
                  escapeSlideHtmlAttribute(value13) +
                  '"';
              }
              if (
                table.alt !== "" &&
                value9.attrs["aria-label"] === undefined
              ) {
                value11 +=
                  ' aria-label="' + escapeSlideHtmlAttribute(table.alt) + '"';
              }
              this.line(
                options,
                "<svg" +
                  value11 +
                  value +
                  serializeStyleAttribute(
                    orderCssProperties(deduplicateCssProperties(items2)),
                  ) +
                  ">" +
                  value9.inner +
                  "</svg>",
              );
              return;
            }
            if (table.fit === "contain") {
              items2.push(["object-fit", "contain"]);
            } else if (
              table.crop !== undefined &&
              !value5.startsWith("data:image/svg+xml")
            ) {
              value +=
                ' data-crop="' +
                (0, runtime.serializeImageCrop)(table.crop) +
                '"';
            }
            items2.push(...serializeNodeStyle(table.style, extra));
            this.line(
              options,
              '<img src="' +
                escapeSlideHtmlAttribute(value5) +
                '" alt="' +
                escapeSlideHtmlAttribute(table.alt) +
                '"' +
                value7 +
                value +
                serializeStyleAttribute(
                  orderCssProperties(deduplicateCssProperties(items2)),
                ) +
                ">",
            );
            return;
          }
          case "icon": {
            if (!runtime.slideHtmlIconNames.includes(table.icon)) {
              this.line(
                options,
                "<\!-- a brand icon (" +
                  table.icon +
                  ") has no HTML spelling — dropped -->",
              );
              return;
            }
            let items2 = [...items, ...value2];
            if (table.color !== undefined) {
              items2.push(["color", serializeSlideColor(table.color)]);
            }
            if (table.w !== undefined && !value3 && !callback("width")) {
              items2.push(["width", (0, runtime.formatCssPixels)(table.w)]);
            }
            if (table.h !== undefined && !value4 && !callback("height")) {
              items2.push(["height", (0, runtime.formatCssPixels)(table.h)]);
            }
            items2.push(...serializeNodeStyle(table.style, extra));
            this.line(
              options,
              '<x-icon name="' +
                table.icon +
                '"' +
                value +
                serializeStyleAttribute(
                  orderCssProperties(deduplicateCssProperties(items2)),
                ) +
                "></x-icon>",
            );
            return;
          }
          case "shape": {
            if (table.shape === "connector") {
              this.connector(
                table,
                options,
                value,
                detail,
                value2,
                items,
                extra,
              );
              return;
            }
            let items2 = [...items, ...value2];
            if (table.w !== undefined && !value3 && !callback("width")) {
              items2.push(["width", (0, runtime.formatCssPixels)(table.w)]);
            }
            if (table.h !== undefined && !value4 && !callback("height")) {
              items2.push(["height", (0, runtime.formatCssPixels)(table.h)]);
            }
            let value5 = [
              extra,
              table.rotate !== undefined && table.rotate !== 0
                ? "rotate(" +
                  (0, runtime.formatCssNumber)(table.rotate) +
                  "deg)"
                : undefined,
            ]
              .filter((input) => input !== undefined)
              .join(" ");
            items2.push(
              ...serializeNodeStyle(
                table.style,
                value5 === "" ? undefined : value5,
              ),
            );
            let value6 = (0, runtime.shapeZeroWidthOutlineColor)(
              table.style,
            );
            if (value6 !== undefined) {
              items2.push([
                "border",
                "0 solid " +
                  ((0, runtime.normalizeCssColorHex)(value6) ?? "#000000"),
              ]);
            }
            this.line(
              options,
              '<x-shape kind="' +
                table.shape +
                '"' +
                value +
                serializeStyleAttribute(
                  orderCssProperties(deduplicateCssProperties(items2)),
                ) +
                "></x-shape>",
            );
            return;
          }
          case "spacer": {
            let value5 = deduplicateCssProperties([
              ...items,
              ...(value2.length > 0 ? value2 : [["flex", "1"] as CssDeclaration]),
            ]);
            this.line(
              options,
              "<div" +
                value +
                serializeStyleAttribute(orderCssProperties(value5)) +
                "></div>",
            );
            return;
          }
          case "stack":
          case "grid": {
            if (table.group === true) {
              value += " data-group";
            }
            let items2 = [...items, ...value2];
            if (table.kind === "stack") {
              items2.push(
                ["display", "flex"],
                ["flex-direction", table.dir === "h" ? "row" : "column"],
              );
              if (table.wrap === true && table.dir === "h") {
                items2.push(["flex-wrap", "wrap"]);
              }
              if (roundSerializedNumber(table.gap) !== 0) {
                items2.push(["gap", (0, runtime.formatCssPixels)(table.gap)]);
              }
              if (table.align !== "stretch") {
                items2.push(["align-items", table.align]);
              }
              if (table.justify !== undefined && table.justify !== "start") {
                items2.push([
                  "justify-content",
                  (
                    {
                      center: "center",
                      end: "end",
                      between: "space-between",
                      around: "space-around",
                      evenly: "space-evenly",
                    } as JustifyContent
                  )[table.justify],
                ]);
              }
            } else {
              items2.push(
                ["display", "grid"],
                [
                  "grid-template-columns",
                  table.columns.map(serializeGridTrack).join(" "),
                ],
              );
              if (table.rows !== undefined) {
                items2.push([
                  "grid-template-rows",
                  table.rows.map(serializeGridTrack).join(" "),
                ]);
              }
              if (roundSerializedNumber(table.gap) !== 0) {
                items2.push(["gap", (0, runtime.formatCssPixels)(table.gap)]);
              }
              if (
                table.alignItems !== undefined &&
                table.alignItems !== "stretch"
              ) {
                items2.push(["align-items", table.alignItems]);
              }
              if (
                table.justifyItems !== undefined &&
                table.justifyItems !== "stretch"
              ) {
                items2.push(["justify-items", table.justifyItems]);
              }
            }
            items2.push(...serializeNodeStyle(table.style, extra));
            this.line(
              options,
              "<div" +
                value +
                serializeStyleAttribute(
                  orderCssProperties(deduplicateCssProperties(items2)),
                ) +
                ">",
            );
            for (let value5 of table.children)
              this.node(value5, options + 1);
            this.line(options, "</div>");
            return;
          }
          case "overlay": {
            if (table.group === true) {
              value += " data-group";
            }
            let base = table.base as FlowContainerNode,
              value5 =
                (base.kind === "stack" || base.kind === "grid") &&
                serializeNodePlacement(base).length === 0,
              value6 = value2;
            if (value5) {
              let items2: CssDeclaration[] = [
                ["position", "relative"],
                ...items,
                ...value6,
              ];
              if (base.kind === "stack") {
                items2.push(
                  ["display", "flex"],
                  ["flex-direction", base.dir === "h" ? "row" : "column"],
                );
                if (base.wrap === true && base.dir === "h") {
                  items2.push(["flex-wrap", "wrap"]);
                }
                if (roundSerializedNumber(base.gap) !== 0) {
                  items2.push(["gap", (0, runtime.formatCssPixels)(base.gap)]);
                }
                if (base.align !== "stretch") {
                  items2.push(["align-items", base.align]);
                }
                if (base.justify !== undefined && base.justify !== "start") {
                  items2.push([
                    "justify-content",
                    (
                      {
                        center: "center",
                        end: "end",
                        between: "space-between",
                        around: "space-around",
                        evenly: "space-evenly",
                      } as JustifyContent
                    )[base.justify],
                  ]);
                }
              } else {
                items2.push(
                  ["display", "grid"],
                  [
                    "grid-template-columns",
                    base.columns.map(serializeGridTrack).join(" "),
                  ],
                );
                if (base.rows !== undefined) {
                  items2.push([
                    "grid-template-rows",
                    base.rows.map(serializeGridTrack).join(" "),
                  ]);
                }
                if (roundSerializedNumber(base.gap) !== 0) {
                  items2.push(["gap", (0, runtime.formatCssPixels)(base.gap)]);
                }
                if (
                  base.alignItems !== undefined &&
                  base.alignItems !== "stretch"
                ) {
                  items2.push(["align-items", base.alignItems]);
                }
                if (
                  base.justifyItems !== undefined &&
                  base.justifyItems !== "stretch"
                ) {
                  items2.push(["justify-items", base.justifyItems]);
                }
              }
              items2.push(
                ...serializeNodeStyle(base.style ?? table.style, extra),
              );
              this.line(
                options,
                "<div" +
                  value +
                  serializeStyleAttribute(
                    orderCssProperties(deduplicateCssProperties(items2)),
                  ) +
                  ">",
              );
              for (let value9 of base.children)
                this.node(value9, options + 1);
            } else {
              let items2: CssDeclaration[] = [
                ["position", "relative"],
                ...items,
                ...value6,
                ...serializeNodeStyle(table.style, extra),
              ];
              this.line(
                options,
                "<div" +
                  value +
                  serializeStyleAttribute(
                    orderCssProperties(deduplicateCssProperties(items2)),
                  ) +
                  ">",
              );
              this.node(base, options + 1);
            }
            let callback2 = (input: string) => {
                let value9 = [...items, ...value2].find(
                  ([input2]) => input2 === input,
                )?.[1];
                if (value9 !== undefined && /^-?[\d.]+px$/.test(value9)) {
                  return Number(value9.slice(0, -2));
                } else {
                  return undefined;
                }
              },
              value7 =
                detail !== undefined
                  ? serializeAxisPosition(detail.x, detail.spanW)?.size
                  : callback2("width"),
              value8 =
                detail !== undefined
                  ? serializeAxisPosition(detail.y, detail.spanH)?.size
                  : callback2("height");
            for (let value9 of table.layers) {
              let value10 = serializeFrameStyle({
                id: "",
                x: value9.x,
                y: value9.y,
                node: value9.node,
              });
              this.node(
                value9.node,
                options + 1,
                value10.decls,
                "",
                value10.translate,
                {
                  x: value9.x,
                  y: value9.y,
                  spanW: value7,
                  spanH: value8,
                },
              );
            }
            this.line(options, "</div>");
            return;
          }
          case "table": {
            let items2 = [...items, ...value2];
            if (
              table.style?.fontSize === undefined &&
              table.role !== undefined &&
              table.role !== "body"
            ) {
              items2.push([
                "font-size",
                (0, runtime.formatCssPixels)(this.scale[table.role].fontSize),
              ]);
            }
            items2.push(
              ...serializeTypographyStyle(
                table.style,
                undefined,
                this.deck.fonts,
              ),
            );
            if (table.style?.color !== undefined) {
              items2.push(["color", serializeSlideColor(table.style.color)]);
            }
            items2.push(...serializeNodeStyle(table.style, extra));
            if (table.fit !== undefined) {
              value += ' data-fit="' + table.fit + '"';
            }
            this.line(
              options,
              "<table" +
                value +
                serializeStyleAttribute(
                  orderCssProperties(deduplicateCssProperties(items2)),
                ) +
                ">",
            );
            table.rows.forEach(
              (input, options2) => {
                let value5 = input.map(
                    (input2, options3) => {
                      let value7 =
                          table.header && options2 === 0 ? "th" : "td",
                        items3: CssDeclaration[] = [],
                        cellPadding = table.cellPadding;
                      if (
                        cellPadding?.x !== undefined &&
                        cellPadding.y !== undefined
                      ) {
                        items3.push([
                          "padding",
                          cellPadding.x === cellPadding.y
                            ? (0, runtime.formatCssPixels)(cellPadding.y)
                            : (0, runtime.formatCssPixels)(cellPadding.y) +
                              " " +
                              (0, runtime.formatCssPixels)(cellPadding.x),
                        ]);
                      } else if (cellPadding?.y !== undefined) {
                        items3.push([
                          "padding-block",
                          (0, runtime.formatCssPixels)(cellPadding.y),
                        ]);
                      } else if (cellPadding?.x !== undefined) {
                        items3.push([
                          "padding-inline",
                          (0, runtime.formatCssPixels)(cellPadding.x),
                        ]);
                      }
                      if (value7 === "th" && table.headerWeight !== undefined) {
                        items3.push([
                          "font-weight",
                          String(table.headerWeight),
                        ]);
                      }
                      if (options2 === 0 && table.colWidths !== undefined) {
                        let value10 = table.colWidths.reduce(
                          (input3, options4) =>
                            input3 + options4,
                          0,
                        );
                        items3.push([
                          "width",
                          String(
                            Math.round(
                              (table.colWidths[options3]! / value10) * 100,
                            ),
                          ) + "%",
                        ]);
                      }
                      let value8 = table.colAligns?.[options3];
                      if (value8 !== undefined && value8 !== "start") {
                        items3.push([
                          "text-align",
                          value8 === "center" ? "center" : "right",
                        ]);
                      }
                      let value9 =
                        table.cellStyles?.[
                          String(options2) + "." + String(options3)
                        ];
                      if (value9 !== undefined) {
                        items3.push([
                          "color",
                          serializeSlideColor(value9.color),
                        ]);
                      }
                      return (
                        "<" +
                        value7 +
                        serializeStyleAttribute(items3) +
                        ">" +
                        escapeSlideHtmlText(input2, true).replace(
                          /\n/g,
                          "<br>",
                        ) +
                        "</" +
                        value7 +
                        ">"
                      );
                    },
                  ),
                  value6 = table.rowStyles?.[String(options2)];
                this.line(
                  options + 1,
                  "<tr" +
                    serializeStyleAttribute(
                      value6 !== undefined
                        ? [
                            [
                              "background",
                              serializeSlideColor(value6.background),
                            ],
                          ]
                        : [],
                    ) +
                    ">" +
                    value5.join("") +
                    "</tr>",
                );
              },
            );
            this.line(options, "</table>");
            return;
          }
          case "html": {
            if (items.length === 0) {
              this.line(
                options,
                "<\!-- a web embed inside a container has no HTML spelling — dropped -->",
              );
              return;
            }
            this.line(
              options,
              "<x-embed" +
                value +
                serializeStyleAttribute(
                  orderCssProperties(deduplicateCssProperties([...items])),
                ) +
                ">" +
                table.html.replace(/<\/x-embed/gi, "<\\/x-embed") +
                "</x-embed>",
            );
            return;
          }
        }
      }
      slide(input: Slide): void {
        this.lists = input.lists;
        let { id: value, frames: value2 } = input,
          items: CssDeclaration[] = [],
          value3 = value2[0],
          items2: CssDeclaration = [
            "background",
            serializeSlideColor(input.bg) ?? "#ffffff",
          ];
        if (
          value3 !== undefined &&
          value3.id === (0, runtime.deterministicEmbedId)(value, 0) &&
          isGradientBackgroundSlide(input) &&
          value3.node.kind === "stack" &&
          value3.node.style?.backgroundGradient !== undefined
        ) {
          let color =
              value3.node.style.backgroundGradient.stops[0]!.color,
            value7 = serializeSlideColor(input.bg) ?? color;
          if (
            value7 === color &&
            !(0, runtime.gradientContainsAlpha)(
              value3.node.style.backgroundGradient,
            )
          ) {
            items2 = [
              "background",
              (0, runtime.serializeCssGradient)(
                value3.node.style.backgroundGradient,
              ),
            ];
          } else {
            items.push(["background-color", value7]);
            items2 = [
              "background-image",
              (0, runtime.serializeCssGradient)(
                value3.node.style.backgroundGradient,
              ),
            ];
          }
          value2 = value2.slice(1);
        }
        items.push(items2);
        let entries: Map<string, number> = new Map();
        input.frames.forEach(
          (input2, options) =>
            entries.set(input2.id, options),
        );
        let callback = (input2: Frame) => {
            let entry2 = entries.get(input2.id);
            return (
              entry2 !== undefined &&
              input2.id === (0, runtime.deterministicEmbedId)(value, entry2)
            );
          },
          value4: number = -1;
        for (let index = 0; index < value2.length; index++) {
          let value7 = value2[index]!;
          if (
            callback(value7) &&
            isFullBleedFrame(value7, false) &&
            (value7.node.kind === "stack" || value7.node.kind === "grid") &&
            value7.build === undefined &&
            value7.node.place === undefined
          ) {
            value4 = index;
            break;
          }
        }
        let value5 = value4 >= 0 ? value2[value4]!.node : undefined;
        if (
          value5 !== undefined &&
          (value5.kind === "stack" || value5.kind === "grid")
        ) {
          if (value5.kind === "stack") {
            items.push(
              ["display", "flex"],
              ["flex-direction", value5.dir === "h" ? "row" : "column"],
            );
            if (value5.wrap === true && value5.dir === "h") {
              items.push(["flex-wrap", "wrap"]);
            }
            if (roundSerializedNumber(value5.gap) !== 0) {
              items.push(["gap", (0, runtime.formatCssPixels)(value5.gap)]);
            }
            if (value5.align !== "stretch") {
              items.push(["align-items", value5.align]);
            }
            if (value5.justify !== undefined && value5.justify !== "start") {
              items.push([
                "justify-content",
                (
                  {
                    center: "center",
                    end: "end",
                    between: "space-between",
                    around: "space-around",
                    evenly: "space-evenly",
                  } as JustifyContent
                )[value5.justify],
              ]);
            }
          } else {
            items.push(
              ["display", "grid"],
              [
                "grid-template-columns",
                value5.columns.map(serializeGridTrack).join(" "),
              ],
            );
            if (value5.rows !== undefined) {
              items.push([
                "grid-template-rows",
                value5.rows.map(serializeGridTrack).join(" "),
              ]);
            }
            if (roundSerializedNumber(value5.gap) !== 0) {
              items.push(["gap", (0, runtime.formatCssPixels)(value5.gap)]);
            }
            if (
              value5.alignItems !== undefined &&
              value5.alignItems !== "stretch"
            ) {
              items.push(["align-items", value5.alignItems]);
            }
            if (
              value5.justifyItems !== undefined &&
              value5.justifyItems !== "stretch"
            ) {
              items.push(["justify-items", value5.justifyItems]);
            }
          }
          items.push(...serializeNodeStyle(value5.style));
        }
        let value6 = ' id="' + escapeSlideHtmlAttribute(value) + '"',
          entry = this.sectionAt.get(value);
        if (entry !== undefined) {
          value6 +=
            ' data-section="' +
            escapeSlideHtmlAttribute(entry.description) +
            '"';
        }
        if (input.transition !== undefined) {
          value6 += ' data-transition="' + input.transition + '"';
        }
        if (input.skipped === true) {
          value6 += " hidden";
        }
        this.line(
          0,
          "<section" +
            value6 +
            serializeStyleAttribute(orderCssProperties(items)) +
            ">",
        );
        value2.forEach((input2, options) => {
          if (options === value4) {
            let node = input2.node as FlowContainerNode;
            for (let value9 of node.children) this.node(value9, 1);
            return;
          }
          let value7 = serializeFrameStyle(input2),
            value8 = callback(input2)
              ? ""
              : ' id="' + escapeSlideHtmlAttribute(input2.id) + '"';
          if (input2.build?.in !== undefined) {
            value8 +=
              ' data-build-in="' + serializeBuildEffect(input2.build.in) + '"';
          }
          if (input2.build?.out !== undefined) {
            value8 +=
              ' data-build-out="' +
              serializeBuildEffect(input2.build.out) +
              '"';
          }
          this.node(input2.node, 1, value7.decls, value8, value7.translate, {
            x: input2.x,
            y: input2.y,
            spanW: runtime.SLIDE_WIDTH,
            spanH: runtime.SLIDE_HEIGHT,
          });
        });
        if (input.notes !== undefined) {
          this.line(
            1,
            "<aside>" +
              escapeSlideHtmlText(input.notes, true).replace(/\n/g, "<br>") +
              "</aside>",
          );
        }
        this.line(0, "</section>");
      }
    };
    roundSerializedNumber = (input) =>
      Math.round(input * 100) / 100;
    quoteFontFamily = (input) =>
      /^[A-Za-z][A-Za-z-]*$/.test(input) ? input : "'" + input + "'";
    initializeHtmlWriter = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeCssValueParser)();
      (0, runtime.initializeHtmlCompiler)();
      (0, runtime.initializeRichTextDom)();
      (0, runtime.initializeVideoLinks)();
      (0, runtime.initializeSections)();
      (0, runtime.initializeSlideTypeScales)();
      serializedFontFallbacks = {
        sans: "sans-serif",
        serif: "serif",
        mono: "monospace",
        helvetica: "sans-serif",
      };
      textRoleHtmlTags = {
        display: "h1",
        h1: "h1",
        h2: "h2",
        h3: "h3",
        lead: "p",
        eyebrow: "p",
        body: "p",
        caption: "p",
      };
      cssPropertySerializationOrder = [
        "position",
        "top",
        "right",
        "bottom",
        "left",
        "width",
        "height",
        "display",
        "flex-direction",
        "flex-wrap",
        "gap",
        "align-items",
        "justify-content",
        "justify-items",
        "grid-template-columns",
        "grid-template-rows",
        "flex",
        "align-self",
        "min-width",
        "max-width",
        "min-height",
        "max-height",
        "aspect-ratio",
        "grid-column",
        "grid-row",
        "justify-self",
        "padding",
        "font-family",
        "font-size",
        "font-weight",
        "font-style",
        "line-height",
        "letter-spacing",
        "text-align",
        "text-transform",
        "white-space",
        "text-decoration",
        "font-variant-numeric",
        "-webkit-text-stroke",
        "color",
        "background",
        "background-color",
        "background-image",
        "-webkit-background-clip",
        "background-clip",
        "-webkit-text-fill-color",
        "border",
        "border-top",
        "border-right",
        "border-bottom",
        "border-left",
        "border-radius",
        "object-fit",
        "opacity",
        "box-shadow",
        "text-shadow",
        "transform",
        "filter",
        "backdrop-filter",
        "mix-blend-mode",
        "overflow",
      ];
      cssPropertyOrderMap = new Map(
        cssPropertySerializationOrder.map(
          (input, options): [string, number] => [input, options],
        ),
      );
    });
  };
}
