/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactDomClientNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  BlendModeValue,
  IconNode,
  ImageNode,
  ShapeNode,
  Slide,
  SlideNode,
  SpacerNode,
  StackNode,
  StyleBag,
  TextMark,
} from "../deck-contracts";
import type { EmbedCaptureRequest } from "./embed-capture";
import type {
  PptxBoxLeaf,
  PptxCornerRadii,
  PptxCornerRounding,
  PptxExportDeck,
  PptxImageLeaf,
  PptxLeaf,
  PptxRect,
  PptxTableGround,
  PptxTextLeaf,
  PptxVerticalAlign,
} from "./pptx";

/** Rotation (degrees) and scale a node inherits from the nodes above it. */
export interface NodeTransform {
  rot: number;
  scl: number;
}
/** The text edge a row keeps when the box around it hugs the text: it sits centred or against the right edge of its parent. */
export interface TextHold {
  /** Path of the stack the text sits in. */
  parent: string;
  how: "center" | "right";
  /** Set when the stack lays its children out in one row that must still fit beside the text. */
  row?: { children: number; gap: number };
}
/** Every node that is measured: spacers take no space and are skipped. */
export type MeasuredNode = Exclude<SlideNode, SpacerNode>;
/** A node of the model tree with the state it is measured in. */
export interface MeasuredModelNode {
  node: MeasuredNode;
  /** Dotted child indices from the frame's node; empty for the frame's node itself. */
  path: string;
  /** Product of the opacities down to the node. */
  opacity: number;
  /** False when the node or one of its parents is hidden. */
  shown: boolean;
  blend?: BlendModeValue;
  turn: NodeTransform;
  across?: TextHold;
}
/** What a node contributes to the paint behind a table at its path. */
export interface MeasuredGround {
  style: StyleBag | undefined;
  opacity: number;
  blend?: BlendModeValue;
}
/** Caption drawn in place of a video that has no poster. */
export interface VideoCaption {
  text: string;
  marks: TextMark[];
}
/** The lines a text element is laid out in. */
export interface TextLineMetrics {
  range: Range;
  /** Distance of every line's centre along the text direction, in page pixels. */
  down: number[];
  lineHeight: number;
}
/** Measures the text of a list marker in the font of its list. */
export interface ListMarkerMeasure {
  ascent: number;
  /** Width of `text`; `tabular` switches on tabular numerals, `family` replaces the font family. */
  advance: (text: string, tabular: boolean, family?: string) => number;
  /** Removes the helper element used for measuring. */
  done: () => void;
}
/** Measures the marker of a list element; undefined when no canvas is available. */
export type ListMarkerMeasurer = (element: Element) => ListMarkerMeasure | undefined;
export type ListMetrics = Pick<
  PptxTextLeaf,
  "listGutter" | "listHang" | "listNumberWidth" | "listOutside"
>;
/** Computed-style keys that decide how text is drawn on a canvas. */
export type CanvasFontStyleKey =
  | "fontStyle"
  | "fontWeight"
  | "fontStretch"
  | "fontSize"
  | "fontFamily"
  | "fontKerning"
  | "fontFeatureSettings"
  | "fontVariationSettings"
  | "letterSpacing";
/** Position of the slide in the page, which rectangles are measured from. */
export type SlideOrigin = Pick<DOMRect, "left" | "top">;
/** A shape or icon painted to a PNG, with the rectangle it covers. */
export interface ShapeRaster {
  dataUri: string;
  rect: PptxRect;
}
/** A web embed that gets rasterised later and swapped in for its placeholder leaf. */
export interface EmbedFallback {
  slide: number;
  leaf: number;
  req: EmbedCaptureRequest;
  round: PptxCornerRounding;
}
export interface MeasureDeckOptions {
  /** How long to wait for the fonts; unbounded when undefined. */
  fontsReadyMs?: number;
}
/** A deck measured for export: the leaves of every slide. */
export interface MeasuredDeck extends PptxExportDeck {
  /** Font families that were still loading when the deck was measured. */
  lateFamilies?: string[];
}
export interface DeckMeasurementTestHooks {
  darkVideoCaption: RuntimeBindings["darkVideoCaption"];
  modelNodes: RuntimeBindings["collectMeasuredModelNodes"];
  boxLeaf: RuntimeBindings["measureBoxLeaf"];
  rectWithin: RuntimeBindings["rectangleWithinSlide"];
  rounding: RuntimeBindings["mergeCornerRounding"];
  clippedCorners: RuntimeBindings["clippedCornerRadii"];
  groundsOf: RuntimeBindings["ancestorGrounds"];
  listMetrics: RuntimeBindings["measureListMetrics"];
  oneLineWidth: RuntimeBindings["oneLineTextWidth"];
  soleText: RuntimeBindings["hasSolePlainText"];
  hugsLines: RuntimeBindings["hugsMeasuredLines"];
  linesHeight: RuntimeBindings["textLinesHeight"];
  heldWhere: RuntimeBindings["applyHeldTextPosition"];
}
export interface DeckMeasurementExports {
  measureDeck: RuntimeBindings["measureDeck"];
  _test: DeckMeasurementTestHooks;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactForExportDeckMeasurement: ReactNamespace;
    reactDOMClientForExportDeckMeasurement: ReactDomClientNamespace;
    deckMeasurementExports: DeckMeasurementExports;
    IDENTITY_TRANSFORM: NodeTransform;
    ZERO_CORNER_RADII: PptxCornerRadii;
    /** Slack, in pixels, when comparing measured positions. */
    MEASUREMENT_TOLERANCE: number;
    deckMeasurementTestHooks: DeckMeasurementTestHooks;
    CANVAS_FONT_STYLE_KEYS: readonly CanvasFontStyleKey[];
    initializeDeckMeasurement: () => void;
    /** How a text in a stack sits when its box hugs it: centred, or against the right edge. */
    textHorizontalHold: (
      stack: StackNode,
      childIndex: number,
      parentPath: string,
    ) => TextHold | undefined;
    /** The side a held text really keeps, or undefined when its position is already explained by the layout. */
    applyHeldTextPosition: (
      surface: Element,
      hold: TextHold,
      rectangle: PptxRect,
      slideRectangle: SlideOrigin,
    ) => TextHold["how"] | undefined;
    collectMeasuredModelNodes: (
      node: SlideNode,
      path?: string,
      opacity?: number,
      visible?: boolean,
      clip?: BlendModeValue,
      transform?: NodeTransform,
      grounds?: TextHold,
    ) => MeasuredModelNode[];
    darkVideoCaption: (image: ImageNode) => VideoCaption | undefined;
    textLineMetrics: (
      element: Element,
      transform: NodeTransform,
    ) => TextLineMetrics | undefined;
    /** Width of the one line a text sits on; undefined when it wraps or is rotated close to 45 degrees. */
    oneLineTextWidth: (
      element: Element,
      transform: NodeTransform,
    ) => number | undefined;
    textLinesHeight: (
      element: Element,
      transform: NodeTransform,
    ) => number | undefined;
    hugsMeasuredLines: (
      expected: number | undefined,
      measured: number,
    ) => boolean;
    hasSolePlainText: (node: SlideNode) => node is StackNode;
    measureListMarker: ListMarkerMeasurer;
    measureListMetrics: (
      element: Element,
      node: "bullet" | "number",
      transform: number,
      slideRectangle: string,
      measureMarker?: ListMarkerMeasurer,
    ) => ListMetrics;
    clippedCornerRadii: (
      element: Element,
      node: Element,
      rectangle: SlideOrigin,
      slideRectangle: PptxRect,
      transform: NodeTransform,
    ) => PptxCornerRadii;
    ancestorGrounds: (
      path: string,
      grounds: ReadonlyMap<string, MeasuredGround>,
    ) => PptxTableGround[];
    mergeCornerRounding: (
      radii: PptxCornerRadii,
      clip: PptxCornerRadii,
    ) => PptxCornerRounding;
    measureBoxLeaf: (
      node: MeasuredNode,
      element: Element,
      rectangle: string,
      slideRectangle: SlideOrigin,
      leaves: number,
      opacity?: BlendModeValue,
      transform?: NodeTransform,
    ) => PptxBoxLeaf | undefined;
    multiplyCanvasOpacity: (
      context: CanvasRenderingContext2D,
      opacity: number,
    ) => void;
    rasterizeHtmlLeaf: (
      element: IconNode,
      css: string,
      rectangle: PptxRect,
      opacity: number,
    ) => string | undefined;
    rasterizeShapeLeaf: (
      node: ShapeNode,
      rectangle: PptxRect,
      opacity: number,
    ) => ShapeRaster | undefined;
    rectangleWithinSlide: (
      element: Element,
      slideRectangle: SlideOrigin,
      transform?: NodeTransform,
    ) => PptxRect;
    contentRectangleWithinSlide: (
      element: Element,
      slideRectangle: SlideOrigin,
      transform?: NodeTransform,
    ) => PptxRect;
    waitForImages: (container: Element) => Promise<void>;
    rasterizeSvgImages: (measuredDeck: PptxExportDeck) => Promise<void>;
    replaceRasterFallbacks: (
      measuredDeck: PptxExportDeck,
      requests: readonly EmbedFallback[],
    ) => Promise<void>;
    deckUsesFontFamily: (slides: readonly Slide[], family: string) => boolean;
    /** Lays the slides out in a hidden page and reads back every leaf the exporter writes. */
    measureDeck: (
      title: string,
      slides: readonly Slide[],
      assets: ReadonlyMap<string, string>,
      options?: MeasureDeckOptions,
    ) => Promise<MeasuredDeck>;
  }
}

export function installExportDeckMeasurement(
  runtime: RuntimeBindings,
): () => void {
  var deckMeasurementExports: RuntimeBindings["deckMeasurementExports"];
  var reactForExportDeckMeasurement: ReactNamespace;
  var reactDOMClientForExportDeckMeasurement: ReactDomClientNamespace;
  var IDENTITY_TRANSFORM: RuntimeBindings["IDENTITY_TRANSFORM"];
  var ZERO_CORNER_RADII: RuntimeBindings["ZERO_CORNER_RADII"];
  var MEASUREMENT_TOLERANCE: RuntimeBindings["MEASUREMENT_TOLERANCE"];
  var deckMeasurementTestHooks: RuntimeBindings["deckMeasurementTestHooks"];
  var CANVAS_FONT_STYLE_KEYS: RuntimeBindings["CANVAS_FONT_STYLE_KEYS"];
  var initializeDeckMeasurement: RuntimeBindings["initializeDeckMeasurement"];
  function textHorizontalHold(
    stack: StackNode,
    childIndex: number,
    parentPath: string,
  ): TextHold | undefined {
    let value = stack.children[childIndex]!,
      value2 = stack.justify ?? "start",
      value3 = stack.children.length === 1;
    if (stack.dir === "v") {
      let value4 =
        ("place" in value ? value.place?.alignSelf : undefined) ?? stack.align;
      if (value4 === "center") {
        return {
          parent: parentPath,
          how: value4,
        };
      } else {
        if (value4 === "end") {
          return {
            parent: parentPath,
            how: "right",
          };
        } else {
          return undefined;
        }
      }
    }
    if (value3) {
      if (value2 === "center" || value2 === "around" || value2 === "evenly") {
        return {
          parent: parentPath,
          how: "center",
        };
      } else {
        if (value2 === "end") {
          return {
            parent: parentPath,
            how: "right",
          };
        } else {
          return undefined;
        }
      }
    }
    if (
      childIndex === stack.children.length - 1 &&
      !stack.children.some((source) => source.kind === "spacer") &&
      (value2 === "end" || value2 === "between")
    ) {
      return {
        parent: parentPath,
        how: "right",
        row: {
          children: stack.children.length,
          gap: stack.gap,
        },
      };
    } else {
      return undefined;
    }
  }
  function applyHeldTextPosition(
    surface: Element,
    hold: TextHold,
    rectangle: PptxRect,
    slideRectangle: SlideOrigin,
  ): TextHold["how"] | undefined {
    let callback = (input: string): Element | null =>
        surface.querySelector('[data-node-path="' + input + '"]'),
      value = callback(hold.parent);
    if (value === null) {
      return;
    }
    let value2 = contentRectangleWithinSlide(value, slideRectangle),
      [items, items2]: [number, number] = [
        rectangle.x - value2.x,
        value2.x + value2.w - rectangle.x - rectangle.w,
      ];
    if (!(items > MEASUREMENT_TOLERANCE)) {
      return;
    }
    if (hold.row !== undefined) {
      let value3 = Array.from(
        {
          length: hold.row.children,
        },
        (input, options) =>
          callback(
            (hold.parent === "" ? "" : hold.parent + ".") + String(options),
          ),
      ).map((input) =>
        input === null
          ? NaN
          : rectangleWithinSlide(input, slideRectangle, IDENTITY_TRANSFORM).w,
      );
      if (
        !(
          value2.w -
            value3.reduce((input, options) => input + options, 0) -
            hold.row.gap * (value3.length - 1) >
          MEASUREMENT_TOLERANCE
        )
      ) {
        return;
      }
    }
    if (
      hold.how === "center"
        ? Math.abs(items - items2) <= MEASUREMENT_TOLERANCE
        : Math.abs(items2) <= MEASUREMENT_TOLERANCE
    ) {
      return hold.how;
    } else {
      return undefined;
    }
  }
  function collectMeasuredModelNodes(
    node: SlideNode,
    path: string = "",
    opacity: number = 1,
    visible: boolean = true,
    clip?: BlendModeValue,
    transform: NodeTransform = IDENTITY_TRANSFORM,
    grounds?: TextHold,
  ): MeasuredModelNode[] {
    if (node.kind === "spacer") {
      return [];
    }
    let value = opacity * (node.style?.opacity ?? 1),
      value2 =
        node.style?.visibility === undefined
          ? visible
          : node.style.visibility !== "hidden",
      value3 = node.style?.mixBlendMode,
      value4 = value3 !== undefined && value3 !== "normal" ? value3 : clip,
      value5: { rotate?: number; scale?: number } | undefined =
        node.kind === "shape"
          ? {
              rotate: node.rotate,
              scale: undefined,
            }
          : node.style?.transform,
      state: NodeTransform = {
        rot: transform.rot + (value5?.rotate ?? 0),
        scl: transform.scl * (value5?.scale ?? 1),
      },
      state2: MeasuredModelNode = {
        node: node,
        path: path,
        opacity: value,
        shown: value2,
        ...(value4 !== undefined
          ? {
              blend: value4,
            }
          : {}),
        turn: state,
        ...(grounds !== undefined
          ? {
              across: grounds,
            }
          : {}),
      },
      callback = (input: SlideNode, options: number): MeasuredModelNode[] =>
        collectMeasuredModelNodes(
          input,
          path === "" ? String(options) : path + "." + String(options),
          value,
          value2,
          value4,
          state,
          node.kind === "stack"
            ? textHorizontalHold(node, options, path)
            : undefined,
        );
    if (node.kind === "stack" || node.kind === "grid") {
      return [state2, ...node.children.flatMap(callback)];
    }
    if (node.kind === "overlay") {
      return [
        state2,
        ...[node.base, ...node.layers.map((input) => input.node)].flatMap(
          callback,
        ),
      ];
    }
    return [state2];
  }
  function darkVideoCaption(image: ImageNode): VideoCaption | undefined {
    let value: string | null =
      image.videoLink !== undefined && !(0, runtime.imageHasPoster)(image)
        ? (0, runtime.videoWatchUrl)(image.videoLink)
        : null;
    if (value === null) {
      return;
    }
    let value2 =
      image.alt !== ""
        ? image.alt +
          `
`
        : "";
    return {
      text: value2 + value,
      marks: [
        {
          start: value2.length,
          end: value2.length + value.length,
          href: value,
        },
      ],
    };
  }
  function textLineMetrics(
    element: Element,
    transform: NodeTransform,
  ): TextLineMetrics | undefined {
    let value = parseFloat(getComputedStyle(element).lineHeight) * transform.scl;
    if (!(value > 0)) {
      return;
    }
    let value2 = element.ownerDocument.createRange();
    value2.selectNodeContents(element);
    let value3 = (transform.rot * Math.PI) / 180,
      value4 = [...value2.getClientRects()]
        .filter((input) => input.width > 0 && input.height > 0)
        .map(
          (input) =>
            (input.top + input.height / 2) * Math.cos(value3) -
            (input.left + input.width / 2) * Math.sin(value3),
        );
    if (value4.length === 0) {
      return undefined;
    } else {
      return {
        range: value2,
        down: value4,
        lineHeight: value,
      };
    }
  }
  function oneLineTextWidth(
    element: Element,
    transform: NodeTransform,
  ): number | undefined {
    let value = textLineMetrics(element, transform);
    if (
      value === undefined ||
      Math.max(...value.down) - Math.min(...value.down) > value.lineHeight / 2
    ) {
      return;
    }
    let bounds = value.range.getBoundingClientRect(),
      value2 = (transform.rot * Math.PI) / 180,
      [items, items2]: [number, number] = [
        Math.abs(Math.cos(value2)),
        Math.abs(Math.sin(value2)),
      ];
    if (Math.abs(items * items - items2 * items2) < 0.5) {
      return;
    }
    let value3 =
      (bounds.width * items - bounds.height * items2) /
      (items * items - items2 * items2);
    if (value3 > 0) {
      return value3;
    } else {
      return undefined;
    }
  }
  function textLinesHeight(
    element: Element,
    transform: NodeTransform,
  ): number | undefined {
    let value = textLineMetrics(element, transform);
    if (value === undefined) {
      return;
    }
    let value2 = [...value.down].sort((input, options) => input - options);
    return (
      value2.filter(
        (input, options) =>
          options === 0 || input - value2[options - 1]! > value.lineHeight / 2,
      ).length * value.lineHeight
    );
  }
  function hugsMeasuredLines(
    expected: number | undefined,
    measured: number,
  ): boolean {
    return expected !== undefined && Math.abs(measured - expected) <= 2;
  }
  function hasSolePlainText(node: SlideNode): node is StackNode {
    if (node.kind !== "stack" || node.children.length !== 1) {
      return false;
    }
    let value = node.children[0]!;
    return (
      value.kind === "text" &&
      value.text.trim() !== "" &&
      value.list === undefined &&
      value.hangingIndent === undefined &&
      value.style?.transform === undefined &&
      value.style?.visibility === undefined &&
      value.style?.mixBlendMode === undefined
    );
  }
  function measureListMarker(element: Element): ListMarkerMeasure | undefined {
    let ownerDocument = element.ownerDocument,
      value = getComputedStyle(element),
      value2 = ownerDocument.createElement("canvas").getContext("2d");
    if (!value2) {
      return;
    }
    value2.font = [
      value.fontStyle,
      value.fontWeight,
      value.fontSize,
      value.fontFamily,
    ].join(" ");
    let fontBoundingBoxAscent = value2.measureText("x").fontBoundingBoxAscent,
      value3: HTMLSpanElement | undefined;
    return {
      ascent: fontBoundingBoxAscent,
      advance: (input: string, options: boolean, context?: string): number => {
        if (value3 === undefined) {
          value3 = ownerDocument.createElement("span");
          for (let value4 of CANVAS_FONT_STYLE_KEYS)
            value3.style[value4] = value[value4];
          Object.assign(value3.style, {
            position: "fixed",
            top: "0",
            left: "0",
            visibility: "hidden",
            whiteSpace: "pre",
          });
          ownerDocument.body.appendChild(value3);
        }
        Object.assign(value3.style, {
          fontFamily: context ?? value.fontFamily,
          fontVariantNumeric: options ? "tabular-nums" : "normal",
          letterSpacing:
            !options && parseFloat(value.letterSpacing) < 0
              ? "normal"
              : value.letterSpacing,
        });
        value3.textContent = input;
        return value3.getBoundingClientRect().width;
      },
      done: (): void => value3?.remove(),
    };
  }
  function measureListMetrics(
    element: Element,
    node: "bullet" | "number",
    transform: number,
    slideRectangle: string,
    measureMarker: ListMarkerMeasurer = measureListMarker,
  ): ListMetrics {
    let element2 = element.querySelector("ul, ol");
    if (element2 === null) {
      return {};
    }
    let paddingInlineStart = getComputedStyle(element2).paddingInlineStart,
      value = /^[\d.]+px$/.test(paddingInlineStart)
        ? parseFloat(paddingInlineStart)
        : 0,
      value2 = element2.hasAttribute("data-css-list");
    if (!(value > 0) && !value2) {
      return {};
    }
    let value3: ListMetrics = value2
        ? {
            listOutside: true,
          }
        : {
            listGutter: value,
          },
      value4 = measureMarker(element2);
    if (value4 === undefined) {
      return value3;
    }
    try {
      if (node === "bullet") {
        let value7 = Math.floor((Math.round(value4.ascent) * 2) / 3) + 7;
        return {
          ...value3,
          ...(value7 > 0
            ? {
                listHang: value7,
              }
            : {}),
        };
      }
      let callback = (
          input: string,
          options: boolean,
          context?: string,
        ): number => {
          let value7 = Array.from(
              {
                length: 10,
              },
              (input2, options2) =>
                value4.advance(String(options2), options, context),
            ),
            value8 = value4.advance(input, options, context),
            index = 0;
          for (let count = 1; count <= transform; count++)
            index = Math.max(
              index,
              value8 +
                [...String(count)].reduce(
                  (input2, options2) => input2 + value7[Number(options2)]!,
                  0,
                ),
            );
          return index;
        },
        value5 = callback(". ", true),
        value6 = Math.max(
          callback(".", false),
          callback(
            ".",
            false,
            JSON.stringify(slideRectangle) + ", Arial, sans-serif",
          ),
          callback(".", false, "Arial, sans-serif"),
        );
      return {
        ...value3,
        ...(value5 > 0
          ? {
              listHang: value5,
            }
          : {}),
        ...(value6 > 0
          ? {
              listNumberWidth: value6,
            }
          : {}),
      };
    } finally {
      value4.done();
    }
  }
  function clippedCornerRadii(
    element: Element,
    node: Element,
    rectangle: SlideOrigin,
    slideRectangle: PptxRect,
    transform: NodeTransform,
  ): PptxCornerRadii {
    let state: PptxCornerRadii = {
      tl: 0,
      tr: 0,
      br: 0,
      bl: 0,
    };
    if (transform.rot !== 0 || transform.scl !== 1) {
      return state;
    }
    let callback = (input: number, options: number): boolean =>
        Math.abs(input - options) <= 1,
      callback2 = (input: string): number => {
        let value = parseFloat(input);
        if (Number.isFinite(value) && value > 0) {
          return value;
        } else {
          return 0;
        }
      };
    for (
      let parentElement: HTMLElement | null = element.parentElement;
      parentElement !== null;
      parentElement =
        parentElement === node ? null : parentElement.parentElement
    ) {
      let value = getComputedStyle(parentElement);
      if (value.overflowX === "visible" || value.overflowX === "") {
        continue;
      }
      let value2 = rectangleWithinSlide(parentElement, rectangle),
        state2 = {
          left: callback2(value.borderLeftWidth),
          top: callback2(value.borderTopWidth),
          right: callback2(value.borderRightWidth),
          bottom: callback2(value.borderBottomWidth),
        },
        value3 = (0, runtime.insetRect)(value2, state2),
        state3: PptxCornerRadii = {
          tl: callback2(value.borderTopLeftRadius),
          tr: callback2(value.borderTopRightRadius),
          br: callback2(value.borderBottomRightRadius),
          bl: callback2(value.borderBottomLeftRadius),
        },
        value4 = Math.min(
          1,
          value2.w / (state3.tl + state3.tr || 1),
          value2.w / (state3.bl + state3.br || 1),
          value2.h / (state3.tl + state3.bl || 1),
          value2.h / (state3.tr + state3.br || 1),
        ),
        callback3 = (input: number, options: number, context: number): number =>
          Math.max(0, input * value4 - (options + context) / 2),
        [items, items2, items3, items4]: [boolean, boolean, boolean, boolean] =
          [
            callback(slideRectangle.x, value3.x),
            callback(slideRectangle.y, value3.y),
            callback(slideRectangle.x + slideRectangle.w, value3.x + value3.w),
            callback(slideRectangle.y + slideRectangle.h, value3.y + value3.h),
          ];
      if (items && items2) {
        state.tl = Math.max(
          state.tl,
          callback3(state3.tl, state2.left, state2.top),
        );
      }
      if (items3 && items2) {
        state.tr = Math.max(
          state.tr,
          callback3(state3.tr, state2.right, state2.top),
        );
      }
      if (items3 && items4) {
        state.br = Math.max(
          state.br,
          callback3(state3.br, state2.right, state2.bottom),
        );
      }
      if (items && items4) {
        state.bl = Math.max(
          state.bl,
          callback3(state3.bl, state2.left, state2.bottom),
        );
      }
    }
    return state;
  }
  function ancestorGrounds(
    path: string,
    grounds: ReadonlyMap<string, MeasuredGround>,
  ): PptxTableGround[] {
    let items: PptxTableGround[] = [];
    for (
      let value: string | undefined = path;
      value !== undefined;
      value =
        value === ""
          ? undefined
          : value.slice(0, Math.max(0, value.lastIndexOf(".")))
    ) {
      let entry = grounds.get(value);
      if (
        entry === undefined ||
        entry.blend !== undefined ||
        !(entry.opacity > 0)
      ) {
        continue;
      }
      for (let value2 of [
        entry.style?.backgroundGradient?.stops[0]?.color,
        entry.style?.backgroundColor,
      ])
        if (value2 !== undefined) {
          items.push({
            color: value2,
            ...(entry.opacity < 1
              ? {
                  opacity: entry.opacity,
                }
              : {}),
          });
        }
    }
    return items;
  }
  function mergeCornerRounding(
    radii: PptxCornerRadii,
    clip: PptxCornerRadii,
  ): PptxCornerRounding {
    let state: PptxCornerRadii = {
        tl: Math.max(radii.tl, clip.tl),
        tr: Math.max(radii.tr, clip.tr),
        br: Math.max(radii.br, clip.br),
        bl: Math.max(radii.bl, clip.bl),
      },
      value: PptxCornerRounding =
        Math.max(radii.tl, radii.tr, radii.br, radii.bl) <= 0 &&
        Math.max(state.tl, state.tr, state.br, state.bl) > 0
          ? {
              clipRounded: true,
            }
          : {};
    if (
      state.tr === state.tl &&
      state.br === state.tl &&
      state.bl === state.tl
    ) {
      if (state.tl > 0) {
        return {
          radius: state.tl,
          ...value,
        };
      } else {
        return {};
      }
    }
    return {
      corners: state,
      ...value,
    };
  }
  function measureBoxLeaf(
    node: MeasuredNode,
    element: Element,
    rectangle: string,
    slideRectangle: SlideOrigin,
    leaves: number,
    opacity?: BlendModeValue,
    transform: NodeTransform = IDENTITY_TRANSFORM,
  ): PptxBoxLeaf | undefined {
    let style = node.style;
    if (style === undefined) {
      return;
    }
    if (node.kind === "shape" || node.kind === "html") {
      return;
    }
    let value = node.kind === "img" && (0, runtime.imageHasPoster)(node),
      value2 =
        style.backgroundColor !== undefined
          ? (0, runtime.cssToPptxColor)(style.backgroundColor)
          : undefined,
      value3 =
        style.backgroundGradient !== undefined ||
        (value2 !== undefined && (value2.transparency ?? 0) < 100);
    if (
      value &&
      (!value3 || (node as ImageNode).fit !== "contain" || opacity !== undefined)
    ) {
      return;
    }
    let value4 = value ? undefined : style.borderStyle,
      value5 =
        node.kind === "table" && node.rows.length > 0
          ? ["right", "bottom"].filter(
              (input) =>
                style.borderSides === undefined ||
                style.borderSides.split(" ").includes(input),
            )
          : undefined,
      value6 =
        value4 !== undefined && value4 !== "none" && value5?.length !== 0;
    if (
      style.backgroundColor === undefined &&
      style.backgroundGradient === undefined &&
      !value6
    ) {
      return;
    }
    let element2 = element.querySelector(
      '[data-node-path="' + rectangle + '"]',
    );
    if (!element2) {
      return;
    }
    let value7 = rectangleWithinSlide(element2, slideRectangle, transform),
      value8: PptxRect =
        node.kind === "table"
          ? {
              x: value7.x,
              y: value7.y,
              w: value7.w,
              h: value7.h,
            }
          : value7;
    if (value8.w <= 0 || value8.h <= 0) {
      return;
    }
    let value9 = mergeCornerRounding(
        (0, runtime.borderRadiiByCorner)(style),
        clippedCornerRadii(
          element2,
          element,
          slideRectangle,
          value8,
          transform,
        ),
      ),
      value10 =
        style.boxShadow?.find((input) => input.inset !== true) ??
        (value ? undefined : style.boxShadow?.[0]);
    return {
      kind: "box",
      rect: value8,
      ...(style.backgroundColor !== undefined
        ? {
            fill: style.backgroundColor,
          }
        : {}),
      ...(style.backgroundGradient !== undefined
        ? {
            gradient: style.backgroundGradient,
          }
        : {}),
      ...(value6
        ? {
            border: {
              style: value4!,
              ...(style.borderWidth !== undefined
                ? {
                    width: style.borderWidth,
                  }
                : {}),
              ...(style.borderColor !== undefined
                ? {
                    color: style.borderColor,
                  }
                : {}),
              ...(value5 !== undefined
                ? {
                    sides: value5.join(" "),
                  }
                : style.borderSides !== undefined
                  ? {
                      sides: style.borderSides,
                    }
                  : {}),
              ...(style.borderTopWidth !== undefined ||
              style.borderRightWidth !== undefined ||
              style.borderBottomWidth !== undefined ||
              style.borderLeftWidth !== undefined
                ? {
                    widths:
                      value5 !== undefined
                        ? {
                            right: style.borderRightWidth,
                            bottom: style.borderBottomWidth,
                          }
                        : {
                            top: style.borderTopWidth,
                            right: style.borderRightWidth,
                            bottom: style.borderBottomWidth,
                            left: style.borderLeftWidth,
                          },
                  }
                : {}),
            },
          }
        : {}),
      ...value9,
      ...(value10 !== undefined
        ? {
            shadow: value10,
          }
        : {}),
      ...(leaves < 1
        ? {
            opacity: leaves,
          }
        : {}),
      ...(opacity !== undefined
        ? {
            blend: opacity,
          }
        : {}),
    };
  }
  function multiplyCanvasOpacity(
    context: CanvasRenderingContext2D,
    opacity: number,
  ): void {
    if (opacity >= 1) {
      return;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = "destination-in";
    context.fillStyle = "#000";
    context.globalAlpha = Math.max(0, opacity);
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  }
  function rasterizeHtmlLeaf(
    element: IconNode,
    css: string,
    rectangle: PptxRect,
    opacity: number,
  ): string | undefined {
    let value = Math.max(1, Math.round(rectangle.w)),
      value2 = Math.max(1, Math.round(rectangle.h)),
      value3 = Math.min(2, 2048 / Math.max(value, value2)),
      value4 = document.createElement("canvas");
    value4.width = Math.max(1, Math.round(value * value3));
    value4.height = Math.max(1, Math.round(value2 * value3));
    let value5 = value4.getContext("2d");
    if (!value5) {
      return;
    }
    let value6 = Math.min(value4.width, value4.height) * 0.9;
    value5.font = String(value6) + "px mc-anthropicons";
    value5.textAlign = "center";
    value5.textBaseline = "middle";
    value5.fillStyle =
      (0, runtime.resolveSlideColor)(element.color) ??
      (0, runtime.slideTextColor)(css);
    value5.fillText(
      runtime.iconFontGlyphs[element.icon]!,
      value4.width / 2,
      value4.height / 2 + value6 * 0.04,
    );
    multiplyCanvasOpacity(value5, opacity);
    try {
      return value4.toDataURL("image/png");
    } catch {
      return;
    }
  }
  function rasterizeShapeLeaf(
    node: ShapeNode,
    rectangle: PptxRect,
    opacity: number,
  ): ShapeRaster | undefined {
    let value = Math.max(1, Math.round(rectangle.w)),
      value2 = Math.max(1, Math.round(rectangle.h)),
      value3 =
        node.shape === "connector"
          ? Math.max(
              0,
              Math.ceil(
                (0, runtime.connectorArrowInset)(node.strokeWidth) -
                  Math.min(value, value2) / 2,
              ),
            )
          : 0,
      value4 = Math.min(
        2,
        2048 / Math.max(value + 2 * value3, value2 + 2 * value3),
      ),
      value5 = document.createElement("canvas");
    value5.width = Math.max(1, Math.round((value + 2 * value3) * value4));
    value5.height = Math.max(1, Math.round((value2 + 2 * value3) * value4));
    let value6 = value5.getContext("2d");
    if (!value6) {
      return;
    }
    let { width: width, height: height } = value5,
      value7 = (0, runtime.shapeOutline)(node.style),
      value8 = node.style?.backgroundColor,
      value9 = value7?.color,
      value10 = (value7?.width ?? 0) * value4,
      value11: PptxRect =
        value3 > 0
          ? {
              ...rectangle,
              x: rectangle.x - value3,
              y: rectangle.y - value3,
              w: rectangle.w + 2 * value3,
              h: rectangle.h + 2 * value3,
            }
          : rectangle;
    if (node.shape === "connector") {
      let value12: number =
          node.strokeWidth ?? runtime.defaultShapeStrokeWidth,
        value13 = (0, runtime.connectorGeometry)(value, value2, node);
      value6.translate(value3 * value4, value3 * value4);
      let value14: string =
        (0, runtime.resolveSlideColor)(node.stroke) ?? "#000000";
      value6.strokeStyle = value6.fillStyle = (0, runtime.stripHexAlpha)(
        value14,
      );
      value6.lineWidth = value12 * value4;
      value6.lineCap = "round";
      value6.lineJoin = "round";
      if (node.dashed === true) {
        value6.setLineDash([value12 * 3 * value4, value12 * 2 * value4]);
      }
      value6.beginPath();
      (0, runtime.shortenConnectorShaftForHeads)(value13, value12).forEach(
        ([input, input2], options): void =>
          options === 0
            ? value6.moveTo(input * value4, input2 * value4)
            : value6.lineTo(input * value4, input2 * value4),
      );
      value6.stroke();
      value6.setLineDash([]);
      for (let value15 of value13.heads) {
        let [value16, value17] = (0, runtime.connectorArrowHeadWings)(
          value15,
          value12,
        );
        value6.beginPath();
        value6.moveTo(value16[0] * value4, value16[1] * value4);
        value6.lineTo(value15.tip[0] * value4, value15.tip[1] * value4);
        value6.lineTo(value17[0] * value4, value17[1] * value4);
        if (value15.kind === "open") {
          value6.stroke();
        } else {
          value6.closePath();
          value6.fill();
        }
      }
      multiplyCanvasOpacity(
        value6,
        opacity * (0, runtime.cssColorOpacity)(value14),
      );
      try {
        return {
          dataUri: value5.toDataURL("image/png"),
          rect: value11,
        };
      } catch {
        return;
      }
    }
    ((): void => {
      value6.beginPath();
      let shape = node.shape,
        value12: PptxCornerRadii = (0, runtime.borderRadiiByCorner)(node.style);
      if (
        shape === "rect" &&
        Math.max(value12.tl, value12.tr, value12.br, value12.bl) > 0
      ) {
        let callback = (input: number): number =>
          Math.max(
            0,
            Math.min(
              input * value4 - value10 / 2,
              (width - value10) / 2,
              (height - value10) / 2,
            ),
          );
        value6.roundRect(
          value10 / 2,
          value10 / 2,
          width - value10,
          height - value10,
          [
            callback(value12.tl),
            callback(value12.tr),
            callback(value12.br),
            callback(value12.bl),
          ],
        );
      } else if (shape === "rect" || shape === "line") {
        value6.rect(
          value10 / 2,
          value10 / 2,
          width - value10,
          height - value10,
        );
      } else if (shape === "ellipse") {
        value6.ellipse(
          width / 2,
          height / 2,
          (width - value10) / 2,
          (height - value10) / 2,
          0,
          0,
          Math.PI * 2,
        );
      } else {
        (runtime.shapeClipPaths[shape] ?? "")
          .split(" ")
          .map((input: string): number[] => input.split(",").map(Number))
          .forEach(([input, input2]: number[], options: number): void => {
            let value13 = ((input ?? 0) / 100) * width,
              value14 = ((input2 ?? 0) / 100) * height;
            if (options === 0) {
              value6.moveTo(value13, value14);
            } else {
              value6.lineTo(value13, value14);
            }
          });
        value6.closePath();
      }
    })();
    if (value8 !== undefined) {
      value6.fillStyle = value8;
      value6.fill();
    }
    if (value10 > 0 && value9 !== undefined) {
      value6.strokeStyle = value9;
      value6.lineWidth = value10;
      value6.lineJoin = "round";
      if (value7?.line === "dashed") {
        value6.setLineDash([value10 * 3, value10 * 2]);
      } else if (value7?.line === "dotted") {
        value6.setLineDash([0, value10 * 2]);
        value6.lineCap = "round";
      }
      value6.stroke();
    }
    multiplyCanvasOpacity(value6, opacity);
    try {
      return {
        dataUri: value5.toDataURL("image/png"),
        rect: value11,
      };
    } catch {
      return;
    }
  }
  function rectangleWithinSlide(
    element: Element,
    slideRectangle: SlideOrigin,
    transform: NodeTransform = IDENTITY_TRANSFORM,
  ): PptxRect {
    let bounds = element.getBoundingClientRect(),
      value = ((transform.rot % 360) + 360) % 360;
    if (value === 0 && transform.scl === 1) {
      return {
        x: bounds.left - slideRectangle.left,
        y: bounds.top - slideRectangle.top,
        w: bounds.width,
        h: bounds.height,
      };
    }
    let value2 = element as HTMLElement,
      value3 = typeof value2.offsetWidth === "number",
      value4 = value3 ? null : getComputedStyle(element),
      value5 =
        (value3
          ? value2.offsetWidth
          : parseFloat(value4?.width ?? "") || bounds.width) * transform.scl,
      value6 =
        (value3
          ? value2.offsetHeight
          : parseFloat(value4?.height ?? "") || bounds.height) * transform.scl;
    return {
      x: bounds.left + bounds.width / 2 - slideRectangle.left - value5 / 2,
      y: bounds.top + bounds.height / 2 - slideRectangle.top - value6 / 2,
      w: value5,
      h: value6,
      ...(value !== 0
        ? {
            rotate: value,
          }
        : {}),
    };
  }
  function contentRectangleWithinSlide(
    element: Element,
    slideRectangle: SlideOrigin,
    transform: NodeTransform = IDENTITY_TRANSFORM,
  ): PptxRect {
    let value = rectangleWithinSlide(element, slideRectangle, transform),
      value2 = getComputedStyle(element),
      callback = (input: string): number =>
        (parseFloat(input) || 0) * transform.scl,
      value3 =
        callback(value2.borderLeftWidth) +
        Math.max(
          0,
          callback(value2.paddingLeft) +
            Math.min(0, callback(value2.textIndent)),
        ),
      value4 = callback(value2.borderTopWidth) + callback(value2.paddingTop),
      value5 =
        callback(value2.borderRightWidth) + callback(value2.paddingRight),
      value6 =
        callback(value2.borderBottomWidth) + callback(value2.paddingBottom);
    return (0, runtime.insetRect)(value, {
      left: value3,
      top: value4,
      right: value5,
      bottom: value6,
    });
  }
  async function waitForImages(container: Element): Promise<void> {
    let items = [...container.querySelectorAll("img")];
    await Promise.all(
      items.map((input) => input.decode().catch((): void => {})),
    );
  }
  async function rasterizeSvgImages(
    measuredDeck: PptxExportDeck,
  ): Promise<void> {
    for (let value of measuredDeck.slides)
      for (let value2 of value.leaves) {
        if (value2.kind !== "img") {
          continue;
        }
        let dataUri = value2.dataUri;
        if (
          dataUri === undefined ||
          !dataUri.startsWith("data:image/svg+xml")
        ) {
          continue;
        }
        try {
          let value3 = new Image();
          await new Promise<void>((input, options): void => {
            let value12 = setTimeout(
              (): void => options(Error("svg decode timeout")),
              1e4,
            );
            value3.onload = (): void => {
              clearTimeout(value12);
              input();
            };
            value3.onerror = (): void => {
              clearTimeout(value12);
              options(Error("svg decode failed"));
            };
            value3.src = dataUri;
          });
          let value4 = value3.naturalWidth > 0 && value3.naturalHeight > 0,
            value5 = value4 ? value3.naturalWidth : Math.max(1, value2.rect.w),
            value6 = value4
              ? value3.naturalHeight
              : Math.max(1, value2.rect.h),
            value7 = Math.min(
              2,
              2048 / Math.max(1, Math.max(value2.rect.w, value2.rect.h)),
            ),
            value8 = Math.max(1, Math.round(value2.rect.w * value7)),
            value9 = Math.max(
              1,
              Math.round((value8 * value6) / Math.max(1, value5)),
            );
          if (value9 > 2048) {
            value8 = Math.max(1, Math.round((value8 * 2048) / value9));
            value9 = 2048;
          }
          let value10 = document.createElement("canvas");
          value10.width = value8;
          value10.height = value9;
          let value11 = value10.getContext("2d");
          if (value11 === null) {
            continue;
          }
          value11.drawImage(value3, 0, 0, value8, value9);
          value11.getImageData(0, 0, 1, 1);
          value2.dataUri = value10.toDataURL("image/png");
          value2.naturalW = value8;
          value2.naturalH = value9;
        } catch {}
      }
  }
  async function replaceRasterFallbacks(
    measuredDeck: PptxExportDeck,
    requests: readonly EmbedFallback[],
  ): Promise<void> {
    if (requests.length === 0) {
      return;
    }
    let value = await (0, runtime.captureHtmlEmbeds)(
      requests.map((input): EmbedCaptureRequest => input.req),
    );
    for (let value2 of requests) {
      let entry = value.get(value2.req.key),
        value3 = measuredDeck.slides[value2.slide]?.leaves[value2.leaf];
      if (entry === undefined || value3 === undefined) {
        continue;
      }
      measuredDeck.slides[value2.slide]!.leaves[value2.leaf] = {
        kind: "img",
        rect: value3.rect,
        dataUri: entry.dataUri,
        fit: "contain",
        alt: "web embed",
        naturalW: entry.w,
        naturalH: entry.h,
        ...value2.round,
      };
    }
  }
  function deckUsesFontFamily(slides: readonly Slide[], family: string): boolean {
    let value = family.trim().toLowerCase(),
      callback = (source: SlideNode): boolean => {
        let value2 =
          source.kind === "text" || source.kind === "table"
            ? source.style?.fontFamily
            : undefined;
        return (
          (typeof value2 === "object" &&
            value2.family.trim().toLowerCase() === value) ||
          ((0, runtime.nodeChildren)(source) ?? []).some(callback)
        );
      };
    return slides.some((input) =>
      input.frames.some((input2) => callback(input2.node)),
    );
  }
  /**
   * Lays the slides out off screen and reads every leaf's position and style.
   * The parameter names are historical: `slides` is the deck title, `assets` the
   * slides and `faces` the asset map (the bound signature uses the real names).
   */
  async function measureDeck(
    slides: string,
    assets: readonly Slide[],
    faces: ReadonlyMap<string, string>,
    options?: MeasureDeckOptions,
  ): Promise<MeasuredDeck> {
    let value = document.createElement("div");
    value.style.cssText =
      "position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;z-index:-1000;overflow:hidden;width:0;height:0;";
    value.setAttribute("data-appifact-content", "");
    document.body.appendChild(value);
    let value2 =
      reactDOMClientForExportDeckMeasurement.createRoot(value);
    try {
      (0, runtime.renderReactSynchronously)(
        value2,
        reactForExportDeckMeasurement.createElement(
          "div",
          null,
          assets.map(
            (input, options2) =>
              reactForExportDeckMeasurement.createElement(
                "div",
                {
                  key: input.id,
                  "data-measure-slide": String(options2),
                },
                reactForExportDeckMeasurement.createElement(
                  runtime.SlideSurface,
                  {
                    slide: input,
                    assets: faces,
                    animate: false,
                  },
                ),
              ),
          ),
        ),
      );
      value.offsetHeight;
      let value3 =
          options?.fontsReadyMs === undefined
            ? undefined
            : Date.now() + options.fontsReadyMs,
        value4 = await (0, runtime.waitForDocumentFonts)(
          document.fonts,
          options?.fontsReadyMs,
        ),
        value5 = document.fonts
          .load("90px mc-anthropicons")
          .catch((): void => {});
      await (value3 === undefined
        ? value5
        : (0, runtime.promiseWithTimeout)(
            value5,
            Math.max(100, value3 - Date.now()),
          ));
      await waitForImages(value);
      if (document.visibilityState === "visible") {
        await new Promise<void>((input): void => {
          let value8 = setTimeout(input, 1000);
          requestAnimationFrame(
            (): number =>
              requestAnimationFrame((): void => {
                clearTimeout(value8);
                input();
              }),
          );
        });
      }
      let value6 = await (0, runtime.captureDeckBackgrounds)(
          assets,
          (input: number): HTMLElement | null =>
            (value.querySelector('[data-measure-slide="' + String(input) + '"]')
              ?.firstElementChild ?? null) as HTMLElement | null,
          rectangleWithinSlide,
        ),
        value7: string[] = (0, runtime.uniqueFontFamilyNames)(value4).filter(
          (input: string): boolean => deckUsesFontFamily(assets, input),
        ),
        items: string[] = [
          ...(value7.length > 0
            ? [(0, runtime.fontTimeoutWarning)(value7, "sized")]
            : []),
          ...value6.notes,
        ],
        state: MeasuredDeck = {
          title: slides,
          slides: [],
          ...(items.length > 0
            ? {
                exportNotes: items,
              }
            : {}),
          ...(value7.length > 0
            ? {
                lateFamilies: value7,
              }
            : {}),
        },
        items2: EmbedFallback[] = [];
      assets.forEach((input, options2): void => {
        let value8 = value.querySelector(
          '[data-measure-slide="' + String(options2) + '"]',
        )?.firstElementChild;
        if (!value8) {
          state.slides.push({
            bg: input.bg,
            leaves: [],
            ...(input.notes !== undefined
              ? {
                  notes: input.notes,
                }
              : {}),
          });
          return;
        }
        let bounds = value8.getBoundingClientRect(),
          items3: PptxLeaf[] = [],
          entry = value6.pictures.get(options2);
        for (let value9 of input.frames) {
          if (entry?.frameIds.has(value9.id) === true) {
            continue;
          }
          let element = value8.querySelector(
            '[data-frame-id="' + value9.id + '"]',
          );
          if (!element) {
            continue;
          }
          let callback = (input2: Element): number => {
              let value14 = parseFloat(
                getComputedStyle(input2).getPropertyValue("--fit"),
              );
              if (Number.isFinite(value14) && value14 > 0 && value14 < 1) {
                return value14;
              } else {
                return 1;
              }
            },
            value10 = collectMeasuredModelNodes(value9.node),
            entries = new Map(
              value10.map(
                (input2): [string, MeasuredGround] => [
                  input2.path,
                  {
                    style: input2.node.style,
                    opacity: input2.shown ? input2.opacity : 0,
                    ...(input2.blend !== undefined
                      ? {
                          blend: input2.blend,
                        }
                      : {}),
                  },
                ],
              ),
            ),
            value11: PptxBoxLeaf | undefined,
            value12: PptxRect | undefined,
            value13: PptxVerticalAlign | undefined,
            callback2 = (): void => {
              if (value11 !== undefined) {
                items3.push(value11);
              }
              value11 = undefined;
            };
          for (let {
            node: value14,
            path: value15,
            opacity: value16,
            shown: value17,
            blend: value18,
            turn: value19,
            across: value20,
          } of value10) {
            if (!value17 || value16 <= 0) {
              callback2();
              continue;
            }
            let value21 = measureBoxLeaf(
              value14,
              element,
              value15,
              bounds,
              value16,
              value18,
              value19,
            );
            if (value14.kind !== "text") {
              callback2();
            }
            if (value21 !== undefined && hasSolePlainText(value14)) {
              value11 = value21;
              let element2 = element.querySelector(
                '[data-node-path="' + value15 + '"]',
              );
              value12 =
                element2 !== null
                  ? contentRectangleWithinSlide(element2, bounds, value19)
                  : undefined;
              let value22 =
                value14.dir === "v" ? value14.justify : value14.align;
              value13 =
                value22 === "center" ||
                value22 === "around" ||
                value22 === "evenly"
                  ? "middle"
                  : value22 === "end"
                    ? "bottom"
                    : undefined;
            } else if (value21 !== undefined && value14.kind !== "text") {
              items3.push(value21);
            }
            if (
              value14.kind === "stack" ||
              value14.kind === "grid" ||
              value14.kind === "overlay"
            ) {
              continue;
            }
            if (value14.kind === "text") {
              let value22 =
                value14.text.trim() === ""
                  ? null
                  : element.querySelector('[data-text-path="' + value15 + '"]');
              if (value21 !== undefined || value22 === null) {
                callback2();
              }
              let value23 = value21 ?? value11,
                value24 =
                  value21 === undefined && value11 !== undefined,
                value25 = value24 ? value12 : undefined;
              value11 = undefined;
              if (value22 === null) {
                if (value21 !== undefined) {
                  items3.push(value21);
                }
                continue;
              }
              let value26 = contentRectangleWithinSlide(
                  value22,
                  bounds,
                  value19,
                ),
                value27 = oneLineTextWidth(value22, value19),
                value28 =
                  value23 === undefined &&
                  value27 !== undefined &&
                  value20 !== undefined &&
                  value19.rot % 360 === 0 &&
                  value19.scl === 1
                    ? applyHeldTextPosition(element, value20, value26, bounds)
                    : undefined,
                value29 =
                  value23 !== undefined
                    ? textLinesHeight(value22, value19)
                    : undefined,
                value30 =
                  value24 && hugsMeasuredLines(value29, value26.h)
                    ? value13
                    : undefined,
                style = value14.style;
              items3.push({
                kind: "text",
                ...(value23 !== undefined
                  ? {
                      box: value23,
                    }
                  : {}),
                ...(value27 !== undefined
                  ? {
                      lineWidth: value27,
                    }
                  : {}),
                ...(value28 !== undefined
                  ? {
                      heldSide: value28,
                    }
                  : {}),
                ...(value29 !== undefined
                  ? {
                      linesHeight: value29,
                    }
                  : {}),
                ...(value30 !== undefined
                  ? {
                      boxAnchor: value30,
                    }
                  : {}),
                ...(value25 !== undefined
                  ? {
                      boxInner: value25,
                    }
                  : {}),
                rect: value26,
                role: value14.role,
                text: value14.text,
                color: value14.color,
                align: value14.align,
                ...(value14.marks !== undefined
                  ? {
                      marks: value14.marks,
                    }
                  : {}),
                ...(value14.list !== undefined
                  ? {
                      list: value14.list,
                      ...measureListMetrics(
                        value22,
                        value14.list,
                        (0, runtime.textLinesAsRuns)(value14).length,
                        (0, runtime.pptxFontFace)(
                          value14.role,
                          style?.fontFamily,
                        ),
                      ),
                    }
                  : {}),
                ...(style?.fontSize !== undefined
                  ? {
                      fontSize: style.fontSize,
                    }
                  : {}),
                ...(style?.fontWeight !== undefined
                  ? {
                      fontWeight: style.fontWeight,
                    }
                  : {}),
                ...(style?.fontStyle === "italic"
                  ? {
                      italic: true,
                    }
                  : {}),
                ...(style?.textDecorationLine === "underline"
                  ? {
                      underline: {
                        ...(style.textDecorationStyle !== undefined
                          ? {
                              style: style.textDecorationStyle,
                            }
                          : {}),
                        ...(style.textDecorationColor !== undefined
                          ? {
                              color: style.textDecorationColor,
                            }
                          : {}),
                      },
                    }
                  : {}),
                ...(style?.textDecorationLine === "line-through"
                  ? {
                      strike: true,
                    }
                  : {}),
                ...(style?.fontFamily !== undefined
                  ? {
                      fontFamily: style.fontFamily,
                    }
                  : {}),
                ...(style?.lineHeight !== undefined
                  ? {
                      lineHeight: style.lineHeight,
                    }
                  : {}),
                ...(style?.letterSpacing !== undefined &&
                style.letterSpacing !== 0
                  ? {
                      letterSpacing: style.letterSpacing,
                    }
                  : {}),
                ...(style?.textTransform !== undefined &&
                style.textTransform !== "none"
                  ? {
                      textTransform: style.textTransform,
                    }
                  : {}),
                ...(value14.wrap === "nowrap"
                  ? {
                      nowrap: true,
                    }
                  : {}),
                ...(value16 < 1
                  ? {
                      opacity: value16,
                    }
                  : {}),
                ...(value14.fit !== undefined
                  ? {
                      fit: value14.fit,
                    }
                  : {}),
                ...((value14.fit ?? runtime.defaultTextFit) === "shrink" &&
                callback(value22) < 1
                  ? {
                      fitScale: callback(value22),
                    }
                  : {}),
                ...(value14.fill !== undefined
                  ? {
                      textFill: value14.fill,
                    }
                  : {}),
              });
            } else if (value14.kind === "icon") {
              let element2 = element.querySelector(
                '[data-icon-path="' + value15 + '"]',
              );
              if (!element2) {
                continue;
              }
              let value22 = rectangleWithinSlide(
                  element2,
                  bounds,
                  value19,
                ),
                value23 = rasterizeHtmlLeaf(
                  value14,
                  input.bg,
                  value22,
                  value16,
                );
              if (value23 === undefined) {
                continue;
              }
              items3.push({
                kind: "img",
                rect: value22,
                dataUri: value23,
                fit: "contain",
                alt: value14.icon,
                naturalW: Math.max(1, Math.round(value22.w)),
                naturalH: Math.max(1, Math.round(value22.h)),
                ...mergeCornerRounding(
                  ZERO_CORNER_RADII,
                  clippedCornerRadii(
                    element2,
                    element,
                    bounds,
                    value22,
                    value19,
                  ),
                ),
              });
            } else if (value14.kind === "shape") {
              let element2 = element.querySelector(
                '[data-node-path="' + value15 + '"]',
              );
              if (!element2) {
                continue;
              }
              let value22 = rasterizeShapeLeaf(
                value14,
                rectangleWithinSlide(element2, bounds, value19),
                value16,
              );
              if (value22 === undefined) {
                continue;
              }
              let { dataUri: value23, rect: value24 } = value22;
              items3.push({
                kind: "img",
                rect: value24,
                dataUri: value23,
                fit: "contain",
                alt: value14.shape,
                naturalW: Math.max(1, Math.round(value24.w)),
                naturalH: Math.max(1, Math.round(value24.h)),
                ...mergeCornerRounding(
                  ZERO_CORNER_RADII,
                  clippedCornerRadii(
                    element2,
                    element,
                    bounds,
                    value24,
                    value19,
                  ),
                ),
              });
            } else if (value14.kind === "table") {
              let element2 = element.querySelector(
                '[data-node-path="' + value15 + '"]',
              );
              if (!element2) {
                continue;
              }
              let value22 = value14.rows.map(
                  (input2, options3): number => {
                    let element3 = element2.querySelector(
                      ':scope > [data-cell="' + String(options3) + '.0"]',
                    );
                    if (element3) {
                      return rectangleWithinSlide(element3, bounds, value19).h;
                    } else {
                      return 0;
                    }
                  },
                ),
                value23 = getComputedStyle(element2),
                value24 =
                  (parseFloat(value23.paddingTop) || 0) > 0 ||
                  (parseFloat(value23.paddingLeft) || 0) > 0,
                value25 = parseFloat(value23.borderTopWidth) || 0,
                value26 = rectangleWithinSlide(
                  element2,
                  bounds,
                  value19,
                ),
                state2 = {
                  x: value26.x,
                  y: value26.y,
                  w: value26.w,
                  h: value26.h,
                },
                value27 = mergeCornerRounding(
                  (0, runtime.borderRadiiByCorner)(value14.style),
                  clippedCornerRadii(
                    element2,
                    element,
                    bounds,
                    state2,
                    value19,
                  ),
                ),
                value28 =
                  value25 > 0 &&
                  (value24 ||
                    value27.radius !== undefined ||
                    value27.corners !== undefined);
              if (value28) {
                items3.push({
                  kind: "box",
                  rect: state2,
                  border: {
                    style: "solid",
                    width: value25 * value19.scl,
                    color: value23.borderTopColor,
                    sides: "top left",
                  },
                  ...value27,
                  ...(value16 < 1
                    ? {
                        opacity: value16,
                      }
                    : {}),
                });
              }
              let value29 = contentRectangleWithinSlide(
                element2,
                bounds,
                value19,
              );
              items3.push({
                kind: "table",
                rect: {
                  ...value29,
                  w: Math.max(1, value29.w),
                  h: Math.max(1, value29.h),
                },
                ...(value27.radius !== undefined ||
                value27.corners !== undefined
                  ? {
                      frame: {
                        rect: state2,
                        borders: {
                          left:
                            (parseFloat(value23.borderLeftWidth) || 0) *
                            value19.scl,
                          top: value25 * value19.scl,
                          right:
                            (parseFloat(value23.borderRightWidth) || 0) *
                            value19.scl,
                          bottom:
                            (parseFloat(value23.borderBottomWidth) || 0) *
                            value19.scl,
                        },
                        ...value27,
                      },
                    }
                  : {}),
                ...(value28
                  ? {
                      openTopLeft: true,
                    }
                  : {}),
                ...(value22.length > 0 &&
                value22.every((input2) => input2 > 0)
                  ? {
                      rowHeights: value22,
                    }
                  : {}),
                rows: value14.rows,
                cols: value14.cols,
                header: value14.header,
                colWidths: value14.colWidths,
                colAligns: value14.colAligns,
                cellStyles: value14.cellStyles,
                rowStyles: value14.rowStyles,
                cellPadding: value14.cellPadding,
                headerWeight: value14.headerWeight,
                role: value14.role,
                ...(value14.style?.fontFamily !== undefined
                  ? {
                      fontFamily: value14.style.fontFamily,
                    }
                  : {}),
                ...(value14.style?.fontSize !== undefined
                  ? {
                      fontSize: value14.style.fontSize,
                    }
                  : {}),
                ...(value14.style?.color !== undefined
                  ? {
                      color: value14.style.color,
                    }
                  : {}),
                ...(ancestorGrounds(value15, entries).length > 0
                  ? {
                      backgrounds: ancestorGrounds(value15, entries),
                    }
                  : {}),
                ...((value14.fit ?? runtime.defaultTextFit) === "shrink" &&
                callback(element2) < 1
                  ? {
                      fitScale: callback(element2),
                    }
                  : {}),
              });
            } else if (value14.kind === "html") {
              let element2 = element.querySelector(
                '[data-node-path="' + value15 + '"]',
              );
              if (!element2) {
                continue;
              }
              let value22 = rectangleWithinSlide(
                element2,
                bounds,
                value19,
              );
              items2.push({
                slide: options2,
                leaf: items3.length,
                req: {
                  key: String(options2) + "/" + value9.id,
                  html: value14.html,
                  w: value22.w,
                  h: value22.h,
                },
                round: mergeCornerRounding(
                  ZERO_CORNER_RADII,
                  clippedCornerRadii(
                    element2,
                    element,
                    bounds,
                    value22,
                    value19,
                  ),
                ),
              });
              items3.push({
                kind: "text",
                rect: value22,
                role: "caption",
                text: "[Interactive web embed — view it in the original presentation]",
                align: "center",
                embedPlaceholder: true,
              });
            } else {
              let value22 = darkVideoCaption(value14);
              if (value22 !== undefined) {
                let element3 = element.querySelector(
                  '[data-img-path="' + value15 + '"]',
                );
                if (!element3) {
                  continue;
                }
                let value25 = rectangleWithinSlide(
                  element3,
                  bounds,
                  value19,
                );
                items3.push({
                  kind: "box",
                  rect: value25,
                  fill: "#141413",
                  ...(value16 < 1
                    ? {
                        opacity: value16,
                      }
                    : {}),
                });
                items3.push({
                  kind: "text",
                  rect: value25,
                  role: "caption",
                  color: "#ffffff",
                  align: "center",
                  ...value22,
                });
                continue;
              }
              if (!(0, runtime.imageHasPoster)(value14)) {
                continue;
              }
              let element2 = element.querySelector(
                '[data-img-path="' + value15 + '"]',
              );
              if (!element2) {
                continue;
              }
              let value23 =
                  element2 instanceof HTMLImageElement
                    ? element2
                    : element2.querySelector("img"),
                value24 =
                  value14.crop !== undefined &&
                  value23 !== null &&
                  value23 !== element2 &&
                  value23.style.maxWidth === "none",
                state2: PptxImageLeaf = {
                  kind: "img",
                  rect: rectangleWithinSlide(element2, bounds, value19),
                  dataUri:
                    value14.asset !== undefined
                      ? faces.get(value14.asset)
                      : value14.src,
                  fit: value14.fit,
                  ...(value24
                    ? {
                        crop: value14.crop,
                      }
                    : {}),
                  alt: value14.alt,
                  ...(value16 < 1
                    ? {
                        opacity: value16,
                      }
                    : {}),
                };
              Object.assign(
                state2,
                mergeCornerRounding(
                  (0, runtime.borderRadiiByCorner)(value14.style),
                  clippedCornerRadii(
                    element2,
                    element,
                    bounds,
                    state2.rect,
                    value19,
                  ),
                ),
              );
              if (value23 !== null && value23.naturalWidth > 0) {
                state2.naturalW = value23.naturalWidth;
                state2.naturalH = value23.naturalHeight;
              }
              let style = value14.style;
              if (
                style?.borderStyle !== undefined &&
                style.borderStyle !== "none"
              ) {
                state2.border = {
                  style: style.borderStyle,
                  ...(style.borderWidth !== undefined
                    ? {
                        width: style.borderWidth,
                      }
                    : {}),
                  ...(style.borderColor !== undefined
                    ? {
                        color: style.borderColor,
                      }
                    : {}),
                  ...(style.borderSides !== undefined
                    ? {
                        sides: style.borderSides,
                      }
                    : {}),
                  ...(style.borderTopWidth !== undefined ||
                  style.borderRightWidth !== undefined ||
                  style.borderBottomWidth !== undefined ||
                  style.borderLeftWidth !== undefined
                    ? {
                        widths: {
                          top: style.borderTopWidth,
                          right: style.borderRightWidth,
                          bottom: style.borderBottomWidth,
                          left: style.borderLeftWidth,
                        },
                      }
                    : {}),
                };
              }
              if (
                style?.boxShadow?.[0] !== undefined &&
                style.boxShadow[0] !== value21?.shadow
              ) {
                state2.shadow = style.boxShadow[0];
              }
              items3.push(state2);
            }
          }
          callback2();
        }
        state.slides.push({
          bg: input.bg,
          leaves: items3,
          ...(input.notes !== undefined
            ? {
                notes: input.notes,
              }
            : {}),
          ...(entry !== undefined
            ? {
                backdrop: entry.dataUri,
                ground: entry.ground,
              }
            : {}),
        });
      });
      await rasterizeSvgImages(state);
      await replaceRasterFallbacks(state, items2);
      return state;
    } finally {
      value2.unmount();
      value.remove();
    }
  }
  bindRuntimeValue(
    runtime,
    "deckMeasurementExports",
    () => deckMeasurementExports,
    (value) => {
      deckMeasurementExports = value;
    },
  );
  bindRuntimeValue(runtime, "textHorizontalHold", () => textHorizontalHold);
  bindRuntimeValue(
    runtime,
    "applyHeldTextPosition",
    () => applyHeldTextPosition,
  );
  bindRuntimeValue(
    runtime,
    "collectMeasuredModelNodes",
    () => collectMeasuredModelNodes,
  );
  bindRuntimeValue(runtime, "darkVideoCaption", () => darkVideoCaption);
  bindRuntimeValue(runtime, "textLineMetrics", () => textLineMetrics);
  bindRuntimeValue(runtime, "oneLineTextWidth", () => oneLineTextWidth);
  bindRuntimeValue(runtime, "textLinesHeight", () => textLinesHeight);
  bindRuntimeValue(runtime, "hugsMeasuredLines", () => hugsMeasuredLines);
  bindRuntimeValue(runtime, "hasSolePlainText", () => hasSolePlainText);
  bindRuntimeValue(runtime, "measureListMarker", () => measureListMarker);
  bindRuntimeValue(runtime, "measureListMetrics", () => measureListMetrics);
  bindRuntimeValue(runtime, "clippedCornerRadii", () => clippedCornerRadii);
  bindRuntimeValue(runtime, "ancestorGrounds", () => ancestorGrounds);
  bindRuntimeValue(runtime, "mergeCornerRounding", () => mergeCornerRounding);
  bindRuntimeValue(runtime, "measureBoxLeaf", () => measureBoxLeaf);
  bindRuntimeValue(
    runtime,
    "multiplyCanvasOpacity",
    () => multiplyCanvasOpacity,
  );
  bindRuntimeValue(runtime, "rasterizeHtmlLeaf", () => rasterizeHtmlLeaf);
  bindRuntimeValue(runtime, "rasterizeShapeLeaf", () => rasterizeShapeLeaf);
  bindRuntimeValue(runtime, "rectangleWithinSlide", () => rectangleWithinSlide);
  bindRuntimeValue(
    runtime,
    "contentRectangleWithinSlide",
    () => contentRectangleWithinSlide,
  );
  bindRuntimeValue(runtime, "waitForImages", () => waitForImages);
  bindRuntimeValue(runtime, "rasterizeSvgImages", () => rasterizeSvgImages);
  bindRuntimeValue(
    runtime,
    "replaceRasterFallbacks",
    () => replaceRasterFallbacks,
  );
  bindRuntimeValue(runtime, "deckUsesFontFamily", () => deckUsesFontFamily);
  bindRuntimeValue(runtime, "measureDeck", () => measureDeck);
  bindRuntimeValue(
    runtime,
    "reactForExportDeckMeasurement",
    () => reactForExportDeckMeasurement,
    (value) => {
      reactForExportDeckMeasurement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDOMClientForExportDeckMeasurement",
    () => reactDOMClientForExportDeckMeasurement,
    (value) => {
      reactDOMClientForExportDeckMeasurement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "IDENTITY_TRANSFORM",
    () => IDENTITY_TRANSFORM,
    (value) => {
      IDENTITY_TRANSFORM = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ZERO_CORNER_RADII",
    () => ZERO_CORNER_RADII,
    (value) => {
      ZERO_CORNER_RADII = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MEASUREMENT_TOLERANCE",
    () => MEASUREMENT_TOLERANCE,
    (value) => {
      MEASUREMENT_TOLERANCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "deckMeasurementTestHooks",
    () => deckMeasurementTestHooks,
    (value) => {
      deckMeasurementTestHooks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CANVAS_FONT_STYLE_KEYS",
    () => CANVAS_FONT_STYLE_KEYS,
    (value) => {
      CANVAS_FONT_STYLE_KEYS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDeckMeasurement",
    () => initializeDeckMeasurement,
    (value) => {
      initializeDeckMeasurement = value;
    },
  );
  return () => {
    deckMeasurementExports = {} as DeckMeasurementExports;
    (0, runtime.defineLiveExports)(deckMeasurementExports, {
      measureDeck: () => measureDeck,
      _test: () => deckMeasurementTestHooks,
    });
    MEASUREMENT_TOLERANCE = 2;
    initializeDeckMeasurement = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeModelEditing)();
      (0, runtime.initializeVideoLinks)();
      (0, runtime.initializeRichTextDom)();
      (0, runtime.initializeSlideRenderer)();
      (0, runtime.initializeModelSelection)();
      (0, runtime.initializeRenderingTheme)();
      (0, runtime.initializeIconFont)();
      (0, runtime.initializeEmbedCapture)();
      (0, runtime.initializeSynchronousReactRender)();
      (0, runtime.initializePptxExport)();
      (0, runtime.initializeBackgroundCapture)();
      (0, runtime.initializeCaptureFallback)();
      reactForExportDeckMeasurement = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      reactDOMClientForExportDeckMeasurement = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactDomClientNamespace)(),
        1,
      );
      IDENTITY_TRANSFORM = {
        rot: 0,
        scl: 1,
      };
      ZERO_CORNER_RADII = {
        tl: 0,
        tr: 0,
        br: 0,
        bl: 0,
      };
      deckMeasurementTestHooks = {
        darkVideoCaption: darkVideoCaption,
        modelNodes: collectMeasuredModelNodes,
        boxLeaf: measureBoxLeaf,
        rectWithin: rectangleWithinSlide,
        rounding: mergeCornerRounding,
        clippedCorners: clippedCornerRadii,
        groundsOf: ancestorGrounds,
        listMetrics: measureListMetrics,
        oneLineWidth: oneLineTextWidth,
        soleText: hasSolePlainText,
        hugsLines: hugsMeasuredLines,
        linesHeight: textLinesHeight,
        heldWhere: applyHeldTextPosition,
      };
      CANVAS_FONT_STYLE_KEYS = [
        "fontStyle",
        "fontWeight",
        "fontStretch",
        "fontSize",
        "fontFamily",
        "fontKerning",
        "fontFeatureSettings",
        "fontVariationSettings",
        "letterSpacing",
      ];
    });
  };
}
