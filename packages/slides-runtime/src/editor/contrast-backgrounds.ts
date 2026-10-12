/** Restored application module; prepare first, initialize in original order. */
import type {
  Axis,
  ConnectorCorner,
  Frame,
  ListRenderingMode,
  OverlayLayer,
  OverlayNode,
  ShadowValue,
  Slide,
  SlideNode,
  StyleBag,
  TextNode,
} from "../deck-contracts";
import type { NodeSelection } from "../layout/selection-groups";
import type { SlideRect } from "../model/geometry";
import type { RenderingTheme } from "../rendering/theme";
import type {
  InspectorCustomIcon,
  InspectorIcon,
  InspectorStrokePath,
} from "../ui/inspector-icons";
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Straight (not premultiplied) colour with every channel in 0..1. */
export interface ContrastRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}
/** How a style's background counts towards contrast: absent, opaque, translucent or not knowable. */
export type ContrastBackgroundClass =
  | { kind: "unknown" }
  | { kind: "none" }
  | { kind: "solid"; color: ContrastRgba }
  | { kind: "wash"; color: ContrastRgba };
/** A colour a node is measured against plus the label that names its source in the UI. */
export interface ContrastBackground {
  css: string;
  label: string;
}
/** Box of a frame for contrast: `may` includes shadow overhang, `certain` exists when the size is fixed. */
export interface ContrastFrameBounds {
  may: SlideRect;
  bare: SlideRect;
  certain: SlideRect | undefined;
}
/** Known size of an overlay's container; an axis is `undefined` when it depends on content. */
export interface ContrastContainerSize {
  w: number | undefined;
  h: number | undefined;
}
/** Space a frame can grow into on each axis. */
export interface ContrastAvailableSize {
  w: number;
  h: number;
}
/** WCAG content classes that pick the required contrast ratio. */
export type ContrastContentKind = "largeText" | "text" | "graphic";
/** Node kinds whose colour can be contrast-checked. */
export type ContrastNodeKind = "text" | "icon";
/** Extra switches of `selectionContrastBackground`. */
export interface SelectionContrastOptions {
  /** Check text even when some runs carry their own colour. */
  runs?: boolean;
}
/** Contrast context of a selection: one background (or several distinct ones) and the content class. */
export interface SelectionContrast {
  against: ContrastBackground | ContrastBackground[];
  role: ContrastContentKind;
}
/** Values of `justify-content` the toolbar has a glyph for. */
export type JustifyIconKey =
  | "flex-start"
  | "start"
  | "center"
  | "flex-end"
  | "end"
  | "space-between"
  | "space-around"
  | "space-evenly"
  | "stretch";
/** Values of `align-items` the toolbar has a glyph for. */
export type AlignIconKey =
  | "flex-start"
  | "start"
  | "center"
  | "flex-end"
  | "end"
  | "stretch"
  | "baseline"
  | "auto";
/** Alignment actions of a multi-selection. */
export type SelectionAlignAction =
  | "left"
  | "hcenter"
  | "right"
  | "top"
  | "vcenter"
  | "bottom";

declare module "../bindings" {
  interface RuntimeBindings {
    SLIDE_BACKGROUND_LABEL: string;
    BOX_FILL_LABEL: string;
    LARGE_TEXT_THRESHOLD: number;
    contrastContentKind: (fontSize: number) => ContrastContentKind;
    OPAQUE_BACKGROUND_THRESHOLD: number;
    TRANSPARENT_BACKGROUND_THRESHOLD: number;
    boxShadowRecords: (style?: StyleBag) => ShadowValue[];
    textShadowRecords: (style?: StyleBag) => ShadowValue[];
    hasInsetBoxShadow: (style?: StyleBag) => boolean;
    hasVisibleShadow: (style?: StyleBag) => boolean;
    styleShadowOutset: (style?: StyleBag) => number;
    nodeShadowOutset: (node: SlideNode) => number;
    classifyContrastBackground: (style?: StyleBag) => ContrastBackgroundClass;
    styleComplicatesContrast: (style?: StyleBag) => boolean;
    isHiddenContrastNode: (node: SlideNode) => boolean;
    hasTransformedDescendant: (node: SlideNode) => boolean;
    paintsContrastSurface: (node: SlideNode) => boolean;
    subtreePaintsContrastSurface: (node: SlideNode) => boolean;
    subtreeComplicatesContrast: (node: SlideNode) => boolean;
    childrenComplicateContrast: (
      node: SlideNode,
      ancestors: ReadonlySet<SlideNode>,
    ) => boolean;
    containerShadowOutset: (node: SlideNode) => number;
    coversWholeSlide: (rectangle: SlideRect) => boolean;
    rectanglesOverlap_Ae0: (left: SlideRect, right: SlideRect) => boolean;
    FULL_SLIDE_RECTANGLE: SlideRect;
    contrastFrameBounds: (frame: Frame) => ContrastFrameBounds;
    overlayComplicatesContrast: (
      frame: Frame,
      node: SlideNode,
      atRoot: boolean,
    ) => boolean;
    certainSolidBackground: (node: SlideNode) => ContrastRgba | undefined;
    rgbToHexColor: (color: ContrastRgba) => string;
    slideContrastBackground: (slide: Slide) => ContrastBackground | undefined;
    nodeContrastBackground: (
      slide: Slide,
      at: NodeSelection,
      styleMode?: RenderingTheme,
    ) => ContrastBackground | undefined;
    SLIDE_CONTRAST_SOURCE: "slide";
    earlierFrameContrastBackground: (
      slide: Slide,
      frame: Frame,
      rectangle: SlideRect,
    ) => ContrastRgba | "slide" | undefined;
    overlayLayerFitsWithin: (
      layer: OverlayLayer,
      container: ContrastContainerSize,
      available: ContrastAvailableSize,
      atRoot?: boolean,
    ) => boolean;
    UNKNOWN_CONTAINER_SIZE: ContrastContainerSize;
    overlayBaseKnownSize: (
      frame: Frame,
      overlay: OverlayNode,
    ) => ContrastContainerSize;
    frameAvailableSize: (frame: Frame) => ContrastAvailableSize;
    hasNonShrinkTextFit: (node: SlideNode) => boolean;
    hasNoWrapText: (node: SlideNode) => boolean;
    LOWERCASE_GLYPH_WIDTH: number;
    UPPERCASE_GLYPH_WIDTH: number;
    WIDE_CONTRAST_GLYPH_PATTERN: RegExp;
    UPPERCASE_CONTRAST_GLYPH_PATTERN: RegExp;
    estimatedGlyphWidth: (text: string, uppercase: boolean) => number;
    frameTextContrastSize: (
      frame: Frame,
      node: RenderingTheme,
      background: ListRenderingMode | undefined,
    ) => SlideRect;
    nodeTextContrastSize: (
      node: TextNode,
      parentRole: RenderingTheme,
      rectangle: number,
      available: ListRenderingMode | undefined,
    ) => number;
    CONTRAST_KIND_PRIORITY: Record<ContrastContentKind, number>;
    DEFAULT_CONTRAST_NODE_KINDS: readonly ContrastNodeKind[];
    TEXT_CONTRAST_NODE_KINDS: readonly ContrastNodeKind[];
    ICON_CONTRAST_NODE_KINDS: readonly ContrastNodeKind[];
    selectionContrastBackground: (
      slide: Slide,
      selection: readonly NodeSelection[],
      kinds: RenderingTheme,
      options?: readonly ContrastNodeKind[],
      extra?: SelectionContrastOptions,
    ) => SelectionContrast | undefined;
    toolbarIconPath: (d: string, strokeWidth?: number) => InspectorStrokePath;
    createToolbarIcon: (name: string, d: string) => InspectorCustomIcon;
    DEFAULT_JUSTIFY_ICON: string;
    JUSTIFY_ICONS: Record<JustifyIconKey, InspectorIcon>;
    ALIGN_ICONS: Record<AlignIconKey, InspectorIcon>;
    CONNECTOR_DIRECTION_ICONS: Record<ConnectorCorner, InspectorCustomIcon>;
    STACK_LAYOUT_ICON: InspectorCustomIcon;
    OVERLAY_LAYOUT_ICON: InspectorCustomIcon;
    SELECTION_ALIGN_ICONS: Record<SelectionAlignAction, InspectorCustomIcon>;
  }
}

export function installEditorContrastBackgrounds(
  runtime: RuntimeBindings,
): () => void {
  var SLIDE_BACKGROUND_LABEL: RuntimeBindings["SLIDE_BACKGROUND_LABEL"];
  var BOX_FILL_LABEL: RuntimeBindings["BOX_FILL_LABEL"];
  var LARGE_TEXT_THRESHOLD: RuntimeBindings["LARGE_TEXT_THRESHOLD"];
  var OPAQUE_BACKGROUND_THRESHOLD: RuntimeBindings["OPAQUE_BACKGROUND_THRESHOLD"];
  var TRANSPARENT_BACKGROUND_THRESHOLD: RuntimeBindings["TRANSPARENT_BACKGROUND_THRESHOLD"];
  var hasInsetBoxShadow: RuntimeBindings["hasInsetBoxShadow"];
  var hasVisibleShadow: RuntimeBindings["hasVisibleShadow"];
  var isHiddenContrastNode: RuntimeBindings["isHiddenContrastNode"];
  var coversWholeSlide: RuntimeBindings["coversWholeSlide"];
  var rectanglesOverlap_Ae0: RuntimeBindings["rectanglesOverlap_Ae0"];
  var FULL_SLIDE_RECTANGLE: RuntimeBindings["FULL_SLIDE_RECTANGLE"];
  var rgbToHexColor: RuntimeBindings["rgbToHexColor"];
  var SLIDE_CONTRAST_SOURCE: RuntimeBindings["SLIDE_CONTRAST_SOURCE"];
  var UNKNOWN_CONTAINER_SIZE: RuntimeBindings["UNKNOWN_CONTAINER_SIZE"];
  var LOWERCASE_GLYPH_WIDTH: RuntimeBindings["LOWERCASE_GLYPH_WIDTH"];
  var UPPERCASE_GLYPH_WIDTH: RuntimeBindings["UPPERCASE_GLYPH_WIDTH"];
  var WIDE_CONTRAST_GLYPH_PATTERN: RuntimeBindings["WIDE_CONTRAST_GLYPH_PATTERN"];
  var UPPERCASE_CONTRAST_GLYPH_PATTERN: RuntimeBindings["UPPERCASE_CONTRAST_GLYPH_PATTERN"];
  var CONTRAST_KIND_PRIORITY: RuntimeBindings["CONTRAST_KIND_PRIORITY"];
  var DEFAULT_CONTRAST_NODE_KINDS: RuntimeBindings["DEFAULT_CONTRAST_NODE_KINDS"];
  var TEXT_CONTRAST_NODE_KINDS: RuntimeBindings["TEXT_CONTRAST_NODE_KINDS"];
  var ICON_CONTRAST_NODE_KINDS: RuntimeBindings["ICON_CONTRAST_NODE_KINDS"];
  var toolbarIconPath: RuntimeBindings["toolbarIconPath"];
  var createToolbarIcon: RuntimeBindings["createToolbarIcon"];
  var DEFAULT_JUSTIFY_ICON: RuntimeBindings["DEFAULT_JUSTIFY_ICON"];
  var JUSTIFY_ICONS: RuntimeBindings["JUSTIFY_ICONS"];
  var ALIGN_ICONS: RuntimeBindings["ALIGN_ICONS"];
  var CONNECTOR_DIRECTION_ICONS: RuntimeBindings["CONNECTOR_DIRECTION_ICONS"];
  var STACK_LAYOUT_ICON: RuntimeBindings["STACK_LAYOUT_ICON"];
  var OVERLAY_LAYOUT_ICON: RuntimeBindings["OVERLAY_LAYOUT_ICON"];
  var SELECTION_ALIGN_ICONS: RuntimeBindings["SELECTION_ALIGN_ICONS"];
  function contrastContentKind(fontSize: number): ContrastContentKind {
    if (fontSize >= LARGE_TEXT_THRESHOLD) {
      return "largeText";
    } else {
      return "text";
    }
  }
  function boxShadowRecords(style?: StyleBag): ShadowValue[] {
    let value = style?.boxShadow;
    if (value === undefined) {
      return [];
    } else {
      if (Array.isArray(value)) {
        return value;
      } else {
        return [value];
      }
    }
  }
  function textShadowRecords(style?: StyleBag): ShadowValue[] {
    let value = style?.textShadow;
    if (value === undefined) {
      return [];
    } else {
      if (Array.isArray(value)) {
        return value;
      } else {
        return [value];
      }
    }
  }
  function styleShadowOutset(style?: StyleBag): number {
    let index = 0;
    for (let value of [
      ...boxShadowRecords(style).filter(
        (input: ShadowValue): boolean => input.inset !== true,
      ),
      ...textShadowRecords(style),
    ])
      index = Math.max(
        index,
        Math.max(Math.abs(value.x), Math.abs(value.y)) +
          value.blur +
          Math.max(0, value.spread ?? 0),
      );
    return index;
  }
  function nodeShadowOutset(node: SlideNode): number {
    return Math.max(
      styleShadowOutset(node.style),
      ...((0, runtime.nodeChildren)(node) ?? []).map(nodeShadowOutset),
      0,
    );
  }
  function classifyContrastBackground(style?: StyleBag): ContrastBackgroundClass {
    if (style?.backgroundGradient !== undefined || hasInsetBoxShadow(style)) {
      return {
        kind: "unknown",
      };
    }
    let value = style?.backgroundColor;
    if (value === undefined || value.trim().toLowerCase() === "transparent") {
      return {
        kind: "none",
      };
    }
    let value2: ContrastRgba | undefined = (0, runtime.parseContrastColor)(
      (0, runtime.resolveSlideColor)(value) ?? value,
    );
    if (value2 === undefined) {
      return {
        kind: "unknown",
      };
    }
    if (value2.a <= TRANSPARENT_BACKGROUND_THRESHOLD) {
      return {
        kind: "none",
      };
    }
    return {
      kind: value2.a >= OPAQUE_BACKGROUND_THRESHOLD ? "solid" : "wash",
      color: value2,
    };
  }
  function styleComplicatesContrast(style?: StyleBag): boolean {
    if (style === undefined) {
      return false;
    }
    return (
      (style.opacity !== undefined && style.opacity < 1) ||
      style.filter !== undefined ||
      style.backdropFilter !== undefined ||
      (style.mixBlendMode !== undefined && style.mixBlendMode !== "normal") ||
      style.animation !== undefined
    );
  }
  function hasTransformedDescendant(node: SlideNode): boolean {
    return (
      node.style?.transform !== undefined ||
      (node.kind === "shape" &&
        node.rotate !== undefined &&
        node.rotate !== 0) ||
      ((0, runtime.nodeChildren)(node) ?? []).some(hasTransformedDescendant)
    );
  }
  function paintsContrastSurface(node: SlideNode): boolean {
    if (isHiddenContrastNode(node)) {
      return false;
    }
    if (
      node.kind === "img" ||
      node.kind === "html" ||
      node.kind === "shape" ||
      node.kind === "table"
    ) {
      return true;
    }
    return (
      classifyContrastBackground(node.style).kind !== "none" ||
      hasVisibleShadow(node.style)
    );
  }
  function subtreePaintsContrastSurface(node: SlideNode): boolean {
    return (
      paintsContrastSurface(node) ||
      styleComplicatesContrast(node.style) ||
      ((0, runtime.nodeChildren)(node) ?? []).some(subtreePaintsContrastSurface)
    );
  }
  function subtreeComplicatesContrast(node: SlideNode): boolean {
    if (styleComplicatesContrast(node.style)) {
      return true;
    }
    if (!isHiddenContrastNode(node)) {
      let value = classifyContrastBackground(node.style);
      if (
        value.kind === "wash" ||
        value.kind === "unknown" ||
        node.kind === "img" ||
        node.kind === "html" ||
        node.kind === "table" ||
        hasVisibleShadow(node.style)
      ) {
        return true;
      }
    }
    return ((0, runtime.nodeChildren)(node) ?? []).some(
      subtreeComplicatesContrast,
    );
  }
  function childrenComplicateContrast(
    node: SlideNode,
    ancestors: ReadonlySet<SlideNode>,
  ): boolean {
    let value =
      node.kind === "stack" || node.kind === "grid"
        ? Math.max(0, node.gap ?? 0)
        : 0;
    return ((0, runtime.nodeChildren)(node) ?? []).some(
      (input: SlideNode): boolean => {
        if (ancestors.has(input)) {
          return childrenComplicateContrast(input, ancestors);
        }
        if (
          hasTransformedDescendant(input) &&
          (subtreePaintsContrastSurface(input) ||
            subtreeComplicatesContrast(input))
        ) {
          return true;
        }
        return (
          (node.kind === "overlay" && input === node.base
            ? containerShadowOutset(input)
            : nodeShadowOutset(input)) > value
        );
      },
    );
  }
  function containerShadowOutset(node: SlideNode): number {
    let index = 0;
    for (let value of textShadowRecords(node.style))
      index = Math.max(
        index,
        Math.max(Math.abs(value.x), Math.abs(value.y)) + value.blur,
      );
    return Math.max(
      index,
      ...((0, runtime.nodeChildren)(node) ?? []).map(nodeShadowOutset),
      0,
    );
  }
  function contrastFrameBounds(frame: Frame): ContrastFrameBounds {
    if (
      hasTransformedDescendant(frame.node) ||
      overlayComplicatesContrast(frame, frame.node, true)
    ) {
      return {
        may: FULL_SLIDE_RECTANGLE,
        bare: FULL_SLIDE_RECTANGLE,
        certain: undefined,
      };
    }
    let value = (0, runtime.frameBounds)(frame.x, frame.y),
      value2 = frame.x.anchor === "fill" || frame.x.size !== undefined,
      value3 =
        frame.y.anchor === "fill" ||
        (frame.y.size !== undefined && frame.node.kind !== "table"),
      callback = (
        input: Axis,
        options: number,
        context: number,
        value9: boolean,
        extra: number,
      ): [number, number] =>
        value9
          ? [options, context]
          : input.anchor === "trailing"
            ? [0, options]
            : input.anchor === "center"
              ? [0, extra]
              : [options, Math.max(0, extra - options)],
      [value4, value5] = callback(
        frame.x,
        value.x,
        value.w,
        value2,
        runtime.SLIDE_WIDTH,
      ),
      [value6, value7] = callback(
        frame.y,
        value.y,
        value.h,
        value3,
        runtime.SLIDE_HEIGHT,
      ),
      value8 = nodeShadowOutset(frame.node),
      state = {
        x: value4,
        y: value6,
        w: value5,
        h: value7,
      };
    return {
      may: {
        x: value4 - value8,
        y: value6 - value8,
        w: value5 + 2 * value8,
        h: value7 + 2 * value8,
      },
      bare: state,
      certain: value2 && value3 ? value : undefined,
    };
  }
  function overlayComplicatesContrast(
    frame: Frame,
    node: SlideNode,
    atRoot: boolean,
  ): boolean {
    if (node.kind === "overlay") {
      let value = atRoot
          ? overlayBaseKnownSize(frame, node)
          : UNKNOWN_CONTAINER_SIZE,
        value2 = frameAvailableSize(frame);
      if (
        node.layers.some(
          (input: OverlayLayer): boolean =>
            !overlayLayerFitsWithin(input, value, value2, true),
        )
      ) {
        return true;
      }
    }
    return ((0, runtime.nodeChildren)(node) ?? []).some(
      (input: SlideNode): boolean =>
        overlayComplicatesContrast(frame, input, false),
    );
  }
  function certainSolidBackground(node: SlideNode): ContrastRgba | undefined {
    if (
      !(0, runtime.isFlowContainer)(node) ||
      isHiddenContrastNode(node) ||
      styleComplicatesContrast(node.style) ||
      hasTransformedDescendant(node)
    ) {
      return;
    }
    let value = classifyContrastBackground(node.style);
    if (
      value.kind === "solid" &&
      !node.children.some(subtreePaintsContrastSurface)
    ) {
      return value.color;
    } else {
      return undefined;
    }
  }
  function slideContrastBackground(slide: Slide): ContrastBackground | undefined {
    if ((0, runtime.isGradientBackgroundSlide)(slide)) {
      return;
    }
    let value = (0, runtime.resolveSlideColor)(slide.bg),
      value2: ContrastRgba | undefined =
        value === undefined
          ? undefined
          : (0, runtime.parseContrastColor)(value);
    if (value2 === undefined || value2.a < OPAQUE_BACKGROUND_THRESHOLD) {
      return;
    }
    return {
      css: (0, runtime.stripHexAlpha)(value!),
      label: SLIDE_BACKGROUND_LABEL,
    };
  }
  function nodeContrastBackground(
    slide: Slide,
    at: NodeSelection,
    styleMode: RenderingTheme = (0, runtime.getRenderingTheme)(),
  ): ContrastBackground | undefined {
    let value = (0, runtime.frameById)(slide, at.frameId);
    if (value === undefined) {
      return;
    }
    let value2 = (0, runtime.selectionNodePath)(at),
      items: SlideNode[] = [value.node];
    for (let value7 of value2) {
      let value8 = (0, runtime.nodeChildren)(items[items.length - 1]!)?.[value7];
      if (value8 === undefined) {
        return;
      }
      items.push(value8);
    }
    if (
      items.some((input: SlideNode): boolean =>
        styleComplicatesContrast(input.style),
      )
    ) {
      return;
    }
    if (
      items.some(
        (input: SlideNode): boolean => textShadowRecords(input.style).length > 0,
      )
    ) {
      return;
    }
    if (childrenComplicateContrast(value.node, new Set(items))) {
      return;
    }
    for (let count = 1; count < items.length; count++) {
      let value7 = items[count - 1]!;
      if (
        value7.kind === "overlay" &&
        value7.layers
          .slice(value2[count - 1])
          .some((input: OverlayLayer): boolean =>
            subtreeComplicatesContrast(input.node),
          )
      ) {
        return;
      }
    }
    let value3 = items.some(hasTransformedDescendant)
        ? FULL_SLIDE_RECTANGLE
        : frameTextContrastSize(value, styleMode, slide.lists),
      value4 = slide.frames.indexOf(value);
    for (let value7 of slide.frames.slice(value4 + 1))
      if (
        subtreeComplicatesContrast(value7.node) &&
        rectanglesOverlap_Ae0(contrastFrameBounds(value7).may, value3)
      ) {
        return;
      }
    let items2: ContrastRgba[] = [],
      callback = (input: ContrastRgba): ContrastBackground => {
        let state: ContrastRgba = {
          ...input,
          a: 1,
        };
        for (let value7 = items2.length - 1; value7 >= 0; value7--)
          state = (0, runtime.compositeContrastColor)(items2[value7]!, state);
        return {
          css: rgbToHexColor(state),
          label: BOX_FILL_LABEL,
        };
      },
      value5 = items.map(
        (
          (input: boolean) =>
          (input2: SlideNode): boolean =>
            (input =
              input2.style?.visibility === undefined
                ? input
                : input2.style.visibility !== "hidden")
        )(true),
      ),
      index = 0;
    for (let value7 = items.length - 1; value7 >= 1; value7--)
      if (items[value7]!.style?.transform !== undefined) {
        index = value7;
        break;
      }
    for (let value7 = items.length - 1; value7 >= 0; value7--) {
      let value8 = value7 > 0 ? items[value7 - 1] : undefined,
        value9 = value8?.kind === "overlay" ? value2[value7 - 1] : undefined,
        value10: ContrastBackgroundClass = value5[value7]
          ? classifyContrastBackground(items[value7]!.style)
          : {
              kind: "none",
            };
      if (value10.kind !== "none" && value7 < index) {
        return;
      }
      if (value10.kind === "unknown") {
        return;
      }
      if (value10.kind === "solid") {
        return callback(value10.color);
      }
      if (value10.kind === "wash") {
        items2.push(value10.color);
      }
      if (value8?.kind === "overlay" && value9 !== undefined && value9 >= 1) {
        if (
          value8.layers
            .slice(0, value9 - 1)
            .some((input: OverlayLayer): boolean =>
              subtreePaintsContrastSurface(input.node),
            )
        ) {
          return;
        }
        let value11 = certainSolidBackground(value8.base);
        if (value11 !== undefined) {
          if (index >= value7) {
            return;
          }
          let value12 =
            value7 - 1 === 0 && !hasTransformedDescendant(value.node)
              ? overlayBaseKnownSize(value, value8)
              : UNKNOWN_CONTAINER_SIZE;
          if (
            overlayLayerFitsWithin(
              value8.layers[value9 - 1]!,
              value12,
              frameAvailableSize(value),
            )
          ) {
            return callback(value11);
          } else {
            return undefined;
          }
        }
        if (subtreePaintsContrastSurface(value8.base)) {
          return;
        }
      }
    }
    let value6 = earlierFrameContrastBackground(slide, value, value3);
    if (value6 === undefined) {
      return;
    }
    if (value6 === SLIDE_CONTRAST_SOURCE) {
      let value7 = slideContrastBackground(slide),
        value8: ContrastRgba | undefined =
          value7 === undefined
            ? undefined
            : (0, runtime.parseContrastColor)(value7.css);
      if (value7 === undefined || value8 === undefined) {
        return undefined;
      } else {
        if (items2.length === 0) {
          return value7;
        } else {
          return callback(value8);
        }
      }
    }
    return callback(value6);
  }
  function earlierFrameContrastBackground(
    slide: Slide,
    frame: Frame,
    rectangle: SlideRect,
  ): ContrastRgba | "slide" | undefined {
    for (let value = slide.frames.indexOf(frame) - 1; value >= 0; value--) {
      let value2 = slide.frames[value]!;
      if (!subtreePaintsContrastSurface(value2.node)) {
        continue;
      }
      let { may: value3, certain: value4 } = contrastFrameBounds(value2);
      if (!rectanglesOverlap_Ae0(value3, rectangle)) {
        continue;
      }
      let value5 = certainSolidBackground(value2.node);
      if (
        value5 !== undefined &&
        value4 !== undefined &&
        coversWholeSlide(value4)
      ) {
        return value5;
      } else {
        return undefined;
      }
    }
    return SLIDE_CONTRAST_SOURCE;
  }
  function overlayLayerFitsWithin(
    layer: OverlayLayer,
    container: ContrastContainerSize,
    available: ContrastAvailableSize,
    atRoot = false,
  ): boolean {
    let callback = (
      input: Axis,
      options: number | undefined,
      context: number,
    ): boolean => {
      if (input.anchor === "center") {
        return (
          input.offset === 0 &&
          (input.size === undefined ||
            input.size <= (options ?? (atRoot ? context : -1)))
        );
      }
      if (input.margin < 0) {
        return false;
      }
      if (input.anchor === "fill" || input.size === undefined) {
        return input.margin < (options ?? context);
      }
      if (options !== undefined) {
        return input.margin + input.size <= options;
      } else {
        return atRoot && input.margin + input.size <= context;
      }
    };
    if (
      !callback(layer.x, container.w, available.w) ||
      !callback(layer.y, container.h, available.h)
    ) {
      return false;
    }
    if (
      !atRoot &&
      layer.y.size !== undefined &&
      hasNonShrinkTextFit(layer.node)
    ) {
      return false;
    }
    if (!atRoot && hasNoWrapText(layer.node)) {
      return false;
    }
    return true;
  }
  function overlayBaseKnownSize(
    frame: Frame,
    overlay: OverlayNode,
  ): ContrastContainerSize {
    if (!(0, runtime.isUnplacedFlowContainer)(overlay.base)) {
      return UNKNOWN_CONTAINER_SIZE;
    }
    let value = (0, runtime.frameBounds)(frame.x, frame.y);
    return {
      w:
        frame.x.anchor === "fill" || frame.x.size !== undefined
          ? value.w
          : undefined,
      h:
        frame.y.anchor === "fill" ||
        (frame.y.size !== undefined && frame.node.kind !== "table")
          ? value.h
          : undefined,
    };
  }
  function frameAvailableSize(frame: Frame): ContrastAvailableSize {
    let value = (0, runtime.frameBounds)(frame.x, frame.y),
      value2 =
        frame.x.anchor === "fill" || frame.x.size !== undefined
          ? value.w
          : frame.x.anchor === "trailing"
            ? value.x + value.w
            : frame.x.anchor === "center"
              ? runtime.SLIDE_WIDTH
              : Math.max(0, runtime.SLIDE_WIDTH - value.x),
      value3 =
        frame.y.anchor === "fill" ||
        (frame.y.size !== undefined && frame.node.kind !== "table")
          ? value.h
          : frame.y.anchor === "trailing"
            ? value.y + value.h
            : frame.y.anchor === "center"
              ? runtime.SLIDE_HEIGHT
              : Math.max(0, runtime.SLIDE_HEIGHT - value.y);
    return {
      w: value2,
      h: value3,
    };
  }
  function hasNonShrinkTextFit(node: SlideNode): boolean {
    return (
      (node.kind === "text" &&
        node.fit !== undefined &&
        node.fit !== "shrink") ||
      ((0, runtime.nodeChildren)(node) ?? []).some(hasNonShrinkTextFit)
    );
  }
  function hasNoWrapText(node: SlideNode): boolean {
    return (
      (node.kind === "text" && node.wrap === "nowrap") ||
      ((0, runtime.nodeChildren)(node) ?? []).some(hasNoWrapText)
    );
  }
  function estimatedGlyphWidth(text: string, uppercase: boolean): number {
    let length = (text.match(WIDE_CONTRAST_GLYPH_PATTERN) ?? []).length,
      value = text.replace(WIDE_CONTRAST_GLYPH_PATTERN, "");
    if (uppercase) {
      return length * 1.05 + value.length * UPPERCASE_GLYPH_WIDTH;
    }
    let length2 = (value.match(UPPERCASE_CONTRAST_GLYPH_PATTERN) ?? []).length;
    return (
      length * 1.05 +
      length2 * UPPERCASE_GLYPH_WIDTH +
      (value.length - length2) * LOWERCASE_GLYPH_WIDTH
    );
  }
  function frameTextContrastSize(
    frame: Frame,
    node: RenderingTheme,
    background: ListRenderingMode | undefined,
  ): SlideRect {
    let { bare: bare, certain: certain } = contrastFrameBounds(frame),
      node2 = frame.node,
      value =
        certain !== undefined ||
        frame.y.anchor === "fill" ||
        (frame.y.size !== undefined && node2.kind !== "table");
    if (node2.kind !== "text") {
      let value7 = certain ?? bare,
        value8 =
          value && hasNonShrinkTextFit(node2)
            ? {
                y: 0,
                h: runtime.SLIDE_HEIGHT,
              }
            : {},
        value9 = hasNoWrapText(node2)
          ? {
              x: 0,
              w: runtime.SLIDE_WIDTH,
            }
          : {};
      return {
        ...value7,
        ...value8,
        ...value9,
      };
    }
    let value2 =
        node2.wrap === "nowrap"
          ? {
              x: 0,
              w: runtime.SLIDE_WIDTH,
            }
          : {
              x: bare.x,
              w: bare.w,
            },
      value3 =
        frame.x.anchor === "center" && frame.x.size === undefined
          ? runtime.SLIDE_WIDTH / 2 - Math.abs(frame.x.offset)
          : bare.w,
      value4 = nodeTextContrastSize(node2, node, value3, background),
      value5 = certain ?? bare;
    if (value) {
      return {
        ...value5,
        ...value2,
        h: Math.max(value5.h, value4),
      };
    }
    let value6 = (0, runtime.frameBounds)(frame.x, frame.y, 0, value4);
    return {
      ...value2,
      y: value6.y,
      h: value6.h,
    };
  }
  function nodeTextContrastSize(
    node: TextNode,
    parentRole: RenderingTheme,
    rectangle: number,
    available: ListRenderingMode | undefined,
  ): number {
    let value = (0, runtime.nodeTypographyCombo)(node, parentRole),
      value2 = node.style ?? {},
      value3 =
        value2.textTransform === "uppercase" ||
        value2.textTransform === "capitalize",
      value4 =
        (value2.paddingLeft ?? 0) +
        (value2.paddingRight ?? 0) +
        (value2.borderLeftWidth ?? value2.borderWidth ?? 0) +
        (value2.borderRightWidth ?? value2.borderWidth ?? 0) +
        (node.hangingIndent ?? 0) +
        (node.list !== undefined ? 1.2 * value.fontSize : 0),
      value5 = (0, runtime.textListGutter)(node, available),
      value6 = Math.max(
        1,
        rectangle -
          (value5 === undefined
            ? value4
            : value4 -
              (value2.paddingLeft ?? 0) -
              1.2 * value.fontSize +
              value5),
      ),
      value7 = node.text
        .split(
          `
`,
        )
        .reduce(
          (input: number, items: string): number =>
            input +
            (node.wrap === "nowrap"
              ? 1
              : Math.max(
                  1,
                  Math.ceil(
                    (estimatedGlyphWidth(items, value3) * value.fontSize +
                      items.length * Math.max(0, value.letterSpacing)) /
                      value6,
                  ),
                )),
          0,
        ),
      value8 =
        (value2.borderTopWidth ?? value2.borderWidth ?? 0) +
        (value2.borderBottomWidth ?? value2.borderWidth ?? 0);
    return (
      value7 * value.fontSize * value.lineHeight +
      (value2.paddingTop ?? 0) +
      (value2.paddingBottom ?? 0) +
      value8
    );
  }
  function selectionContrastBackground(
    slide: Slide,
    selection: readonly NodeSelection[],
    kinds: RenderingTheme,
    options: readonly ContrastNodeKind[] = DEFAULT_CONTRAST_NODE_KINDS,
    extra: SelectionContrastOptions = {},
  ): SelectionContrast | undefined {
    let items: ContrastBackground[] = [],
      value: ContrastContentKind | undefined;
    for (let value2 of selection) {
      let value3 = (0, runtime.selectedNode)(slide, value2);
      if (
        value3 === undefined ||
        (value3.kind !== "text" && value3.kind !== "icon") ||
        !options.includes(value3.kind)
      ) {
        continue;
      }
      if (
        extra.runs !== true &&
        value3.kind === "text" &&
        value3.marks?.some((input) => input.color !== undefined) === true
      ) {
        return;
      }
      let value4 = nodeContrastBackground(slide, value2, kinds);
      if (value4 === undefined) {
        return;
      }
      if (
        !items.some(
          (input: ContrastBackground): boolean =>
            input.label === value4.label &&
            input.css.toLowerCase() === value4.css.toLowerCase(),
        )
      ) {
        items.push(value4);
      }
      let value5: ContrastContentKind =
        value3.kind === "icon"
          ? "graphic"
          : contrastContentKind(
              (0, runtime.nodeTypographyCombo)(value3, kinds).fontSize,
            );
      if (
        value === undefined ||
        CONTRAST_KIND_PRIORITY[value5] > CONTRAST_KIND_PRIORITY[value]
      ) {
        value = value5;
      }
    }
    if (value === undefined || items.length === 0) {
      return;
    }
    return {
      against: items.length === 1 ? items[0]! : items,
      role: value,
    };
  }
  bindRuntimeValue(
    runtime,
    "SLIDE_BACKGROUND_LABEL",
    () => SLIDE_BACKGROUND_LABEL,
    (value) => {
      SLIDE_BACKGROUND_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BOX_FILL_LABEL",
    () => BOX_FILL_LABEL,
    (value) => {
      BOX_FILL_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LARGE_TEXT_THRESHOLD",
    () => LARGE_TEXT_THRESHOLD,
    (value) => {
      LARGE_TEXT_THRESHOLD = value;
    },
  );
  bindRuntimeValue(runtime, "contrastContentKind", () => contrastContentKind);
  bindRuntimeValue(
    runtime,
    "OPAQUE_BACKGROUND_THRESHOLD",
    () => OPAQUE_BACKGROUND_THRESHOLD,
    (value) => {
      OPAQUE_BACKGROUND_THRESHOLD = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TRANSPARENT_BACKGROUND_THRESHOLD",
    () => TRANSPARENT_BACKGROUND_THRESHOLD,
    (value) => {
      TRANSPARENT_BACKGROUND_THRESHOLD = value;
    },
  );
  bindRuntimeValue(runtime, "boxShadowRecords", () => boxShadowRecords);
  bindRuntimeValue(runtime, "textShadowRecords", () => textShadowRecords);
  bindRuntimeValue(
    runtime,
    "hasInsetBoxShadow",
    () => hasInsetBoxShadow,
    (value) => {
      hasInsetBoxShadow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasVisibleShadow",
    () => hasVisibleShadow,
    (value) => {
      hasVisibleShadow = value;
    },
  );
  bindRuntimeValue(runtime, "styleShadowOutset", () => styleShadowOutset);
  bindRuntimeValue(runtime, "nodeShadowOutset", () => nodeShadowOutset);
  bindRuntimeValue(
    runtime,
    "classifyContrastBackground",
    () => classifyContrastBackground,
  );
  bindRuntimeValue(
    runtime,
    "styleComplicatesContrast",
    () => styleComplicatesContrast,
  );
  bindRuntimeValue(
    runtime,
    "isHiddenContrastNode",
    () => isHiddenContrastNode,
    (value) => {
      isHiddenContrastNode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasTransformedDescendant",
    () => hasTransformedDescendant,
  );
  bindRuntimeValue(
    runtime,
    "paintsContrastSurface",
    () => paintsContrastSurface,
  );
  bindRuntimeValue(
    runtime,
    "subtreePaintsContrastSurface",
    () => subtreePaintsContrastSurface,
  );
  bindRuntimeValue(
    runtime,
    "subtreeComplicatesContrast",
    () => subtreeComplicatesContrast,
  );
  bindRuntimeValue(
    runtime,
    "childrenComplicateContrast",
    () => childrenComplicateContrast,
  );
  bindRuntimeValue(
    runtime,
    "containerShadowOutset",
    () => containerShadowOutset,
  );
  bindRuntimeValue(
    runtime,
    "coversWholeSlide",
    () => coversWholeSlide,
    (value) => {
      coversWholeSlide = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rectanglesOverlap_Ae0",
    () => rectanglesOverlap_Ae0,
    (value) => {
      rectanglesOverlap_Ae0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FULL_SLIDE_RECTANGLE",
    () => FULL_SLIDE_RECTANGLE,
    (value) => {
      FULL_SLIDE_RECTANGLE = value;
    },
  );
  bindRuntimeValue(runtime, "contrastFrameBounds", () => contrastFrameBounds);
  bindRuntimeValue(
    runtime,
    "overlayComplicatesContrast",
    () => overlayComplicatesContrast,
  );
  bindRuntimeValue(
    runtime,
    "certainSolidBackground",
    () => certainSolidBackground,
  );
  bindRuntimeValue(
    runtime,
    "rgbToHexColor",
    () => rgbToHexColor,
    (value) => {
      rgbToHexColor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideContrastBackground",
    () => slideContrastBackground,
  );
  bindRuntimeValue(
    runtime,
    "nodeContrastBackground",
    () => nodeContrastBackground,
  );
  bindRuntimeValue(
    runtime,
    "SLIDE_CONTRAST_SOURCE",
    () => SLIDE_CONTRAST_SOURCE,
    (value) => {
      SLIDE_CONTRAST_SOURCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "earlierFrameContrastBackground",
    () => earlierFrameContrastBackground,
  );
  bindRuntimeValue(
    runtime,
    "overlayLayerFitsWithin",
    () => overlayLayerFitsWithin,
  );
  bindRuntimeValue(
    runtime,
    "UNKNOWN_CONTAINER_SIZE",
    () => UNKNOWN_CONTAINER_SIZE,
    (value) => {
      UNKNOWN_CONTAINER_SIZE = value;
    },
  );
  bindRuntimeValue(runtime, "overlayBaseKnownSize", () => overlayBaseKnownSize);
  bindRuntimeValue(runtime, "frameAvailableSize", () => frameAvailableSize);
  bindRuntimeValue(runtime, "hasNonShrinkTextFit", () => hasNonShrinkTextFit);
  bindRuntimeValue(runtime, "hasNoWrapText", () => hasNoWrapText);
  bindRuntimeValue(
    runtime,
    "LOWERCASE_GLYPH_WIDTH",
    () => LOWERCASE_GLYPH_WIDTH,
    (value) => {
      LOWERCASE_GLYPH_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UPPERCASE_GLYPH_WIDTH",
    () => UPPERCASE_GLYPH_WIDTH,
    (value) => {
      UPPERCASE_GLYPH_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "WIDE_CONTRAST_GLYPH_PATTERN",
    () => WIDE_CONTRAST_GLYPH_PATTERN,
    (value) => {
      WIDE_CONTRAST_GLYPH_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UPPERCASE_CONTRAST_GLYPH_PATTERN",
    () => UPPERCASE_CONTRAST_GLYPH_PATTERN,
    (value) => {
      UPPERCASE_CONTRAST_GLYPH_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "estimatedGlyphWidth", () => estimatedGlyphWidth);
  bindRuntimeValue(
    runtime,
    "frameTextContrastSize",
    () => frameTextContrastSize,
  );
  bindRuntimeValue(runtime, "nodeTextContrastSize", () => nodeTextContrastSize);
  bindRuntimeValue(
    runtime,
    "CONTRAST_KIND_PRIORITY",
    () => CONTRAST_KIND_PRIORITY,
    (value) => {
      CONTRAST_KIND_PRIORITY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_CONTRAST_NODE_KINDS",
    () => DEFAULT_CONTRAST_NODE_KINDS,
    (value) => {
      DEFAULT_CONTRAST_NODE_KINDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_CONTRAST_NODE_KINDS",
    () => TEXT_CONTRAST_NODE_KINDS,
    (value) => {
      TEXT_CONTRAST_NODE_KINDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ICON_CONTRAST_NODE_KINDS",
    () => ICON_CONTRAST_NODE_KINDS,
    (value) => {
      ICON_CONTRAST_NODE_KINDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "selectionContrastBackground",
    () => selectionContrastBackground,
  );
  bindRuntimeValue(
    runtime,
    "toolbarIconPath",
    () => toolbarIconPath,
    (value) => {
      toolbarIconPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createToolbarIcon",
    () => createToolbarIcon,
    (value) => {
      createToolbarIcon = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_JUSTIFY_ICON",
    () => DEFAULT_JUSTIFY_ICON,
    (value) => {
      DEFAULT_JUSTIFY_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "JUSTIFY_ICONS",
    () => JUSTIFY_ICONS,
    (value) => {
      JUSTIFY_ICONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ALIGN_ICONS",
    () => ALIGN_ICONS,
    (value) => {
      ALIGN_ICONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONNECTOR_DIRECTION_ICONS",
    () => CONNECTOR_DIRECTION_ICONS,
    (value) => {
      CONNECTOR_DIRECTION_ICONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STACK_LAYOUT_ICON",
    () => STACK_LAYOUT_ICON,
    (value) => {
      STACK_LAYOUT_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OVERLAY_LAYOUT_ICON",
    () => OVERLAY_LAYOUT_ICON,
    (value) => {
      OVERLAY_LAYOUT_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SELECTION_ALIGN_ICONS",
    () => SELECTION_ALIGN_ICONS,
    (value) => {
      SELECTION_ALIGN_ICONS = value;
    },
  );
  return () => {
    (0, runtime.initializeUiContrast)();
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeHtmlWriter)();
    (0, runtime.initializeModelGeometry)();
    (0, runtime.initializeModelEditing)();
    (0, runtime.initializeModelSelection)();
    (0, runtime.initializeRenderingTheme)();
    (0, runtime.initializeTypographyInference)();
    SLIDE_BACKGROUND_LABEL = "slide background";
    BOX_FILL_LABEL = "box fill";
    LARGE_TEXT_THRESHOLD = 44;
    OPAQUE_BACKGROUND_THRESHOLD = 0.98;
    TRANSPARENT_BACKGROUND_THRESHOLD = 0.02;
    hasInsetBoxShadow = (style?: StyleBag): boolean =>
      boxShadowRecords(style).some(
        (input: ShadowValue): boolean => input.inset === true,
      );
    hasVisibleShadow = (style?: StyleBag): boolean =>
      boxShadowRecords(style).some(
        (input: ShadowValue): boolean => input.inset !== true,
      ) || textShadowRecords(style).length > 0;
    isHiddenContrastNode = (node: SlideNode): boolean =>
      node.style?.visibility === "hidden";
    coversWholeSlide = (rectangle: SlideRect): boolean =>
      rectangle.x <= 0 &&
      rectangle.y <= 0 &&
      rectangle.x + rectangle.w >= runtime.SLIDE_WIDTH &&
      rectangle.y + rectangle.h >= runtime.SLIDE_HEIGHT;
    rectanglesOverlap_Ae0 = (left: SlideRect, right: SlideRect): boolean =>
      left.x <= right.x + right.w &&
      right.x <= left.x + left.w &&
      left.y <= right.y + right.h &&
      right.y <= left.y + left.h;
    FULL_SLIDE_RECTANGLE = {
      x: 0,
      y: 0,
      w: runtime.SLIDE_WIDTH,
      h: runtime.SLIDE_HEIGHT,
    };
    rgbToHexColor = (color: ContrastRgba): string =>
      "#" +
      [color.r, color.g, color.b]
        .map(
          (input: number): string =>
            Math.round(input * 255)
              .toString(16)
              .padStart(2, "0"),
        )
        .join("");
    SLIDE_CONTRAST_SOURCE = "slide";
    UNKNOWN_CONTAINER_SIZE = {
      w: undefined,
      h: undefined,
    };
    LOWERCASE_GLYPH_WIDTH = 0.75;
    UPPERCASE_GLYPH_WIDTH = 0.9;
    WIDE_CONTRAST_GLYPH_PATTERN =
      /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]|[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
    UPPERCASE_CONTRAST_GLYPH_PATTERN = /\p{Lu}/gu;
    CONTRAST_KIND_PRIORITY = {
      text: 2,
      largeText: 1,
      graphic: 0,
    };
    DEFAULT_CONTRAST_NODE_KINDS = ["text", "icon"];
    TEXT_CONTRAST_NODE_KINDS = ["text"];
    ICON_CONTRAST_NODE_KINDS = ["icon"];
    toolbarIconPath = (d: string, strokeWidth = 1): InspectorStrokePath => ({
      d: d,
      strokeWidth: strokeWidth,
    });
    createToolbarIcon = (name: string, d: string): InspectorCustomIcon => ({
      name: name,
      viewBox: 16,
      paths: [toolbarIconPath(d)],
    });
    DEFAULT_JUSTIFY_ICON = "JustifySpaceBetween";
    JUSTIFY_ICONS = {
      "flex-start": "JustifyStart",
      start: "JustifyStart",
      center: "JustifyCenter",
      "flex-end": "JustifyEnd",
      end: "JustifyEnd",
      "space-between": "JustifySpaceBetween",
      "space-around": createToolbarIcon(
        "JustifyAround",
        "M2.5 2.5V13.5M13.5 2.5V13.5M6 5V11M10 5V11",
      ),
      "space-evenly": createToolbarIcon(
        "JustifyEvenly",
        "M2.5 2.5V13.5M13.5 2.5V13.5M6.25 5V11M9.75 5V11M8 7V9",
      ),
      stretch: createToolbarIcon(
        "JustifyStretch",
        "M2.5 2.5V13.5M13.5 2.5V13.5M4.5 6H11.5M4.5 10H11.5",
      ),
    };
    ALIGN_ICONS = {
      "flex-start": "AlignStart",
      start: "AlignStart",
      center: "AlignCenter",
      "flex-end": "AlignEnd",
      end: "AlignEnd",
      stretch: "AlignStretch",
      baseline: createToolbarIcon(
        "AlignItemsBaseline",
        "M2.5 10.5H13.5M5 10.5V5L6.5 5M9.5 10.5V7H11.5V10.5",
      ),
      auto: createToolbarIcon(
        "AlignAuto",
        "M4 4H6M10 4H12M4 12H6M10 12H12M4 4V6M12 4V6M4 10V12M12 10V12",
      ),
    };
    CONNECTOR_DIRECTION_ICONS = {
      tl: createToolbarIcon("ConnectorDownRight", "M4 4L12 12M12 6.5V12H6.5"),
      tr: createToolbarIcon("ConnectorDownLeft", "M12 4L4 12M4 6.5V12H9.5"),
      bl: createToolbarIcon("ConnectorUpRight", "M4 12L12 4M6.5 4H12V9.5"),
      br: createToolbarIcon("ConnectorUpLeft", "M12 12L4 4M9.5 4H4V9.5"),
    };
    STACK_LAYOUT_ICON = createToolbarIcon(
      "LayoutStack",
      "M2.5 3.5H13.5V12.5H2.5Z M5 6V10M8 6V10M11 6V10",
    );
    OVERLAY_LAYOUT_ICON = createToolbarIcon(
      "LayoutLayered",
      "M3 5H11V11H3Z M5 3H13V9",
    );
    SELECTION_ALIGN_ICONS = {
      left: createToolbarIcon(
        "ActionAlignLeft",
        "M3.93 3.4V12.58M6.59 10.99H12.17M6.59 7.99H9.48M6.59 4.99H12.17",
      ),
      hcenter: createToolbarIcon(
        "ActionAlignHCenter",
        "M5.21 10.99H10.79M6.56 7.99H9.44M5.21 4.99H10.79",
      ),
      right: createToolbarIcon(
        "ActionAlignRight",
        "M12.07 3.4V12.58M3.83 10.99H9.41M6.52 7.99H9.41M3.83 4.99H9.41",
      ),
      top: createToolbarIcon(
        "ActionAlignTop",
        "M5 6.58V12.16M11 6.58V12.16M8 6.58V9.47M3.41 3.93H12.59",
      ),
      vcenter: createToolbarIcon(
        "ActionAlignVCenter",
        "M10.99 5.21V10.79M7.99 6.56V9.44M4.99 5.21V10.79",
      ),
      bottom: createToolbarIcon(
        "ActionAlignBottom",
        "M3.42 12.07H12.6M5.01 3.83V9.41M8.01 6.52V9.41M11.01 3.83V9.41",
      ),
    };
  };
}
