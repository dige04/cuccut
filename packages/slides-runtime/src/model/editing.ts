/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";
import type {
  Alignment,
  Axis,
  BorderSidesValue,
  DeckContent,
  Frame,
  ImageNode,
  OverlayNode,
  Slide,
  SlideColor,
  SlideNode,
  StyleBag,
  TableNode,
  TextFill,
  TextMark,
  TextNode,
  TextRole,
  TransformValue,
} from "../deck-contracts";
import type {
  ConnectorBounds,
  LineShapeBounds,
  LineShapeNode,
  ShapeOutline,
} from "./deck";
import type { MediaSizeNode, SlideAxisName } from "./geometry";

/** Child indices from a node down to a descendant; an overlay's index 0 is its base, index i >= 1 is layer i - 1. */
export type NodePath = readonly number[];
/** Theme name of a deck (`DeckContent["theme"]`). */
export type DeckTheme = DeckContent["theme"];
/** Where `reorderSlideFrames` moves the selected frames. */
export type FrameOrder = "back" | "front";
/** Cell colours of a table keyed by `"row.column"`. */
type TableCellStyles = NonNullable<TableNode["cellStyles"]>;
/** Row backgrounds of a table keyed by row index. */
type TableRowStyles = NonNullable<TableNode["rowStyles"]>;
/** A path known to have at least one step. */
type NonEmptyNodePath = readonly [number, ...number[]];
/** Replaces a frame by an updated copy. */
export type SlideFrameUpdate = (frame: Frame) => Frame;
/** Replaces a node by an updated copy. */
export type SlideNodeUpdate = (node: SlideNode) => SlideNode;
/** Style properties to set on a node; an `undefined` value removes the property. */
export type StylePatch = { [K in keyof StyleBag]?: StyleBag[K] | undefined };
/** The size field of a media-sized node that is the smaller one. */
export type MediaSizeAxis = "w" | "h";
/** The smaller of two frame axes: which one, its size and the length of the other axis. */
export interface SmallerAxisInfo {
  axis: SlideAxisName;
  size: number | undefined;
  length: number | undefined;
}
/** Both axes of a frame. */
export type AxisPair = Pick<Frame, "x" | "y">;
/** Thickness of a line shape and whether it can be written back. */
export interface NodeThicknessInfo {
  size: number | undefined;
  writable: boolean;
}
export type BorderSideName = "top" | "right" | "bottom" | "left";
export type BorderSideWidthField =
  | "borderTopWidth"
  | "borderRightWidth"
  | "borderBottomWidth"
  | "borderLeftWidth";
/** Effective border width of each side. */
export type BorderWidths = Record<BorderSideName, number>;
export type BorderCornerName = "tl" | "tr" | "br" | "bl";
export type BorderCornerRadiusField =
  | "borderTopLeftRadius"
  | "borderTopRightRadius"
  | "borderBottomRightRadius"
  | "borderBottomLeftRadius";
/** Effective corner radius of each corner. */
export type BorderRadii = Record<BorderCornerName, number>;
/** How a video starts: on click, or automatically after an optional delay. */
export type VideoStartMode = "click" | "auto";
/** Maps a table cell to its new position, or `null` when the cell is dropped. */
export type TableCellRemap = (
  row: number,
  column: number,
) => [row: number, column: number] | null;
/** Maps a table row to its new index, or `null` when the row is dropped. */
export type TableRowRemap = (row: number) => number | null;

declare module "../bindings" {
  interface RuntimeBindings {
    nodeAtPath: (node: SlideNode, path: NodePath) => SlideNode | undefined;
    updateNodeAtPath: (
      node: SlideNode,
      path: NodePath,
      update: SlideNodeUpdate,
    ) => SlideNode;
    frameById: (slide: Slide, frameId: string) => Frame | undefined;
    updateSlideFrame: (
      slide: Slide,
      frameId: string,
      update: SlideFrameUpdate,
    ) => Slide;
    removeSlideFrame: (slide: Slide, frameId: string) => Slide;
    appendSlideFrame: (slide: Slide, frame: Frame) => Slide;
    frameStackContentOffset: (slide: Slide) => number;
    reorderSlideFrames: (
      slide: Slide,
      frameIds: ReadonlySet<string>,
      direction: FrameOrder,
    ) => Slide;
    removeOverlayLayer: (overlay: OverlayNode, layerIndex: number) => OverlayNode;
    removeNestedNode: (slide: Slide, frameId: string, path: NodePath) => Slide;
    removeSlideNode: (
      slide: Slide,
      frameId: string,
      child: number | NodePath,
    ) => Slide;
    wrapNodeInContainer: (
      slide: Slide,
      frameId: string,
      child: number | NodePath,
    ) => Slide;
    isEditableTextNode: (node: SlideNode | null | undefined) => node is TextNode;
    nodeIsBold: (node: TextNode, theme?: DeckTheme) => boolean;
    toggleNodeBold: (
      node: TextNode,
      theme?: DeckTheme,
      weight?: number,
    ) => TextNode;
    nodeIsItalic: (node: SlideNode) => boolean;
    toggleNodeItalic: <T extends SlideNode>(node: T) => T;
    setNodeList: (node: TextNode, list: TextNode["list"]) => TextNode;
    nodeIsUnderlined: (node: SlideNode) => boolean;
    toggleNodeUnderline: <T extends SlideNode>(node: T) => T;
    patchNodeStyle: <T extends SlideNode>(node: T, patch: StylePatch) => T;
    setTextFill: (node: SlideNode, fill: TextFill | undefined) => SlideNode;
    setNodeRotation: <T extends SlideNode>(
      node: T,
      rotation: number | undefined,
    ) => T;
    updatePositionedNode: (
      slide: Slide,
      frameId: string,
      path: NodePath,
      xAxis: Axis,
      yAxis: Axis,
      update: SlideNodeUpdate,
    ) => Slide;
    pinNodeToRect: (
      slide: Slide,
      frameId: string,
      path: NodePath,
      rect: ConnectorBounds,
    ) => Slide;
    updatePinnedNodeRect: (
      slide: Slide,
      frameId: string,
      path: NodePath,
      rect: LineShapeBounds,
      preservePosition: readonly [number, number],
    ) => Slide;
    smallerAxisSpec: (xAxis: Axis, yAxis: Axis) => SmallerAxisInfo;
    smallerMediaAxis: (node: Pick<MediaSizeNode, "w" | "h">) => MediaSizeAxis;
    hollowShapeOutline: (node: SlideNode) => ShapeOutline | undefined;
    fillShapeFromOutline: <T extends SlideNode>(
      node: T,
      outline: ShapeOutline,
    ) => T;
    minimumStrokeAdjustedSize: (
      node: SlideNode,
      size: number | undefined,
    ) => number | undefined;
    minimumLineThickness: (node: SlideNode) => number;
    nodeThicknessInfo: (
      slide: Slide,
      frameId: string,
      path: NodePath,
    ) => NodeThicknessInfo | undefined;
    nodeThickness: (
      slide: Slide,
      frameId: string,
      path: NodePath,
    ) => number | undefined;
    nodeThicknessIsWritable: (
      slide: Slide,
      frameId: string,
      path: NodePath,
    ) => boolean;
    setNodeThickness: (
      slide: Slide,
      frameId: string,
      path: NodePath,
      thickness: number,
    ) => Slide;
    setTableCellColor: (
      table: TableNode,
      row: number,
      column: number,
      color: SlideColor | undefined,
    ) => TableNode;
    setTableColumnAlignment: (
      table: TableNode,
      column: number,
      alignment: Alignment,
    ) => TableNode;
    nodeUniformLink: (node: TextNode) => string | undefined;
    setNodeLink: (node: TextNode, href: string | undefined) => TextNode;
    hasPerSideBorderWidths: (style: StyleBag | undefined) => boolean;
    borderWidthsBySide: (style: StyleBag | undefined) => BorderWidths;
    setBorderWidthsPreservingSides: (
      style: StyleBag | undefined,
      width: number,
    ) => StylePatch;
    borderPatchFromWidths: (widths: BorderWidths) => StylePatch;
    hasPerCornerRadius: (style: StyleBag | undefined) => boolean;
    borderRadiiByCorner: (style: StyleBag | undefined) => BorderRadii;
    borderRadiusPatch: (radii: BorderRadii) => StylePatch;
    looksLikeMediaFilename: (label: string) => boolean;
    imageHasPoster: (node: ImageNode) => boolean;
    imageHasMedia: (node: ImageNode) => boolean;
    replaceImageAsset: (
      node: ImageNode,
      assetId: string,
      label: string,
      video?: string,
      sound?: boolean,
    ) => ImageNode;
    setImageFit: (node: ImageNode, fit: ImageNode["fit"]) => ImageNode;
    resetImageDimensions: (
      node: SlideNode,
      resetWidth: boolean,
      resetHeight: boolean,
      assets: ReadonlyMap<string, string>,
    ) => SlideNode;
    setVideoStartMode: (
      node: ImageNode,
      mode: VideoStartMode,
      delay?: number,
    ) => ImageNode;
    setVideoLink: (node: ImageNode, link: unknown) => ImageNode;
    setVideoSound: (node: ImageNode, sound: boolean) => ImageNode;
    clearImageMedia: (node: ImageNode) => ImageNode;
    nodeDisplayLabel: (node: SlideNode, maxLength?: number) => string;
    nodeTextLabel: (
      node: SlideNode,
      roles?: readonly TextRole[],
    ) => string | undefined;
    nodeFallbackLabel: (node: SlideNode) => string | undefined;
    slideDisplayLabel: (slide: Slide) => string | undefined;
    isTableNode: (node: SlideNode | null | undefined) => node is TableNode;
    clampInteger: (value: number, minimum: number, maximum: number) => number;
    countNodeTableCells: (node: SlideNode) => number;
    countSlideTableCells: (slide: Slide) => number;
    countDeckTableCells: (slides: Iterable<Slide>) => number;
    countNodeEmbeds: (node: SlideNode) => number;
    countSlideEmbeds: (slide: Slide) => number;
    setTableCellText: (
      table: TableNode,
      row: number,
      column: number,
      text: string,
    ) => TableNode;
    tableCellExists: (table: TableNode, row: number, column: number) => boolean;
    resizeTable: (table: TableNode, rows: number, columns: number) => TableNode;
    remapTableCellStyles: (
      table: TableNode,
      target: TableNode,
      remap: TableCellRemap,
    ) => void;
    remapTableRowStyles: (
      table: TableNode,
      target: TableNode,
      remap: TableRowRemap,
    ) => void;
    insertTableRow: (table: TableNode, rowIndex: number) => TableNode;
    setTableColumnWidth: (
      table: TableNode,
      column: number,
      width: number,
    ) => TableNode;
    borderSideNames: readonly BorderSideName[];
    borderSideWidthFields: Record<BorderSideName, BorderSideWidthField>;
    emptyBorderSideWidthPatch: Record<BorderSideWidthField, undefined>;
    borderCornerRadiusFields: Record<BorderCornerName, BorderCornerRadiusField>;
    borderCornerNames: readonly BorderCornerName[];
    emptyCornerRadiusPatch: Record<BorderCornerRadiusField, undefined>;
    headingTextRoles: readonly TextRole[];
    initializeModelEditing: () => void;
  }
}

export function installModelEditing(runtime: RuntimeBindings): () => void {
  var borderSideNames: RuntimeBindings["borderSideNames"];
  var borderSideWidthFields: RuntimeBindings["borderSideWidthFields"];
  var emptyBorderSideWidthPatch: RuntimeBindings["emptyBorderSideWidthPatch"];
  var borderCornerRadiusFields: RuntimeBindings["borderCornerRadiusFields"];
  var borderCornerNames: RuntimeBindings["borderCornerNames"];
  var emptyCornerRadiusPatch: RuntimeBindings["emptyCornerRadiusPatch"];
  var headingTextRoles: RuntimeBindings["headingTextRoles"];
  var initializeModelEditing: RuntimeBindings["initializeModelEditing"];
  function nodeAtPath(node: SlideNode, path: NodePath): SlideNode | undefined {
    let value = node;
    for (let value2 of path) {
      let value3 = (0, runtime.nodeChildren)(value);
      if (value3 === undefined) {
        return;
      }
      let value4 = value3[value2];
      if (!value4) {
        return;
      }
      value = value4;
    }
    return value;
  }
  function updateNodeAtPath(
    node: SlideNode,
    path: NodePath,
    update: SlideNodeUpdate,
  ): SlideNode {
    if (path.length === 0) {
      return update(node);
    }
    let [index, ...tail] = path as NonEmptyNodePath;
    if ((0, runtime.isOverlayNode)(node)) {
      if (index === 0) {
        return {
          ...node,
          base: updateNodeAtPath(node.base, tail, update),
        };
      }
      let value2 = node.layers[index - 1];
      if (!value2) {
        return node;
      }
      let items2 = [...node.layers];
      items2[index - 1] = {
        ...value2,
        node: updateNodeAtPath(value2.node, tail, update),
      };
      return {
        ...node,
        layers: items2,
      };
    }
    if (!(0, runtime.isFlowContainer)(node)) {
      return node;
    }
    let value = node.children[index];
    if (!value) {
      return node;
    }
    let items = [...node.children];
    items[index] = updateNodeAtPath(value, tail, update);
    return {
      ...node,
      children: items,
    };
  }
  function frameById(slide: Slide, frameId: string): Frame | undefined {
    return slide.frames.find((input) => input.id === frameId);
  }
  function updateSlideFrame(
    slide: Slide,
    frameId: string,
    update: SlideFrameUpdate,
  ): Slide {
    return {
      ...slide,
      frames: slide.frames.map((input) =>
        input.id === frameId ? update(input) : input,
      ),
    };
  }
  function removeSlideFrame(slide: Slide, frameId: string): Slide {
    return {
      ...slide,
      frames: slide.frames.filter((input) => input.id !== frameId),
    };
  }
  function appendSlideFrame(slide: Slide, frame: Frame): Slide {
    return {
      ...slide,
      frames: [...slide.frames, frame],
    };
  }
  function frameStackContentOffset(slide: Slide): number {
    if ((0, runtime.isGradientBackgroundSlide)(slide)) {
      return 1;
    } else {
      return 0;
    }
  }
  function reorderSlideFrames(
    slide: Slide,
    frameIds: ReadonlySet<string>,
    direction: FrameOrder,
  ): Slide {
    let backgroundCount = frameStackContentOffset(slide),
      contentFrames = slide.frames.slice(backgroundCount),
      selectedFrames = contentFrames.filter((input) => frameIds.has(input.id));
    if (selectedFrames.length === 0) {
      return slide;
    }
    let remainingFrames = contentFrames.filter(
        (input) => !frameIds.has(input.id),
      ),
      backgroundFrames = slide.frames.slice(0, backgroundCount);
    return {
      ...slide,
      frames:
        direction === "back"
          ? [...backgroundFrames, ...selectedFrames, ...remainingFrames]
          : [...backgroundFrames, ...remainingFrames, ...selectedFrames],
    };
  }
  function removeOverlayLayer(
    overlay: OverlayNode,
    layerIndex: number,
  ): OverlayNode {
    return {
      ...overlay,
      layers: overlay.layers.filter((input, options) => options !== layerIndex),
    };
  }
  function removeNestedNode(
    slide: Slide,
    frameId: string,
    path: NodePath,
  ): Slide {
    if (path.length < 2) {
      return removeSlideNode(slide, frameId, path[0] ?? -1);
    }
    let frame = frameById(slide, frameId);
    if (!frame) {
      return slide;
    }
    let parentPath = path.slice(0, -1),
      childIndex = path[path.length - 1]!,
      parent = nodeAtPath(frame.node, parentPath);
    if (parent === undefined) {
      return slide;
    }
    if ((0, runtime.isOverlayNode)(parent)) {
      if (childIndex === 0) {
        return removeNestedNode(slide, frameId, parentPath);
      }
      if (childIndex - 1 < 0 || childIndex - 1 >= parent.layers.length) {
        return slide;
      }
      return updateSlideFrame(slide, frameId, (input) => ({
        ...input,
        node: updateNodeAtPath(input.node, parentPath, (input2) =>
          (0, runtime.isOverlayNode)(input2)
            ? removeOverlayLayer(input2, childIndex - 1)
            : input2,
        ),
      }));
    }
    if (
      !(0, runtime.isFlowContainer)(parent) ||
      childIndex < 0 ||
      childIndex >= parent.children.length
    ) {
      return slide;
    }
    let value = parent.children.filter((input, options) => options !== childIndex);
    if (value.every((source) => source.kind === "spacer")) {
      return removeNestedNode(slide, frameId, parentPath);
    }
    return updateSlideFrame(slide, frameId, (input) => ({
      ...input,
      node: updateNodeAtPath(input.node, parentPath, (input2) =>
        (0, runtime.isFlowContainer)(input2)
          ? {
              ...input2,
              children: value,
            }
          : input2,
      ),
    }));
  }
  function removeSlideNode(
    slide: Slide,
    frameId: string,
    child: number | NodePath,
  ): Slide {
    if (typeof child !== "number") {
      if (child.length !== 1) {
        return removeNestedNode(slide, frameId, child);
      }
      child = child[0]!;
    }
    let frame = frameById(slide, frameId);
    if (!frame) {
      return slide;
    }
    if ((0, runtime.isOverlayNode)(frame.node)) {
      if (child === 0) {
        return removeSlideFrame(slide, frameId);
      }
      if (child - 1 < 0 || child - 1 >= frame.node.layers.length) {
        return slide;
      }
      let value2 = child - 1;
      return updateSlideFrame(slide, frameId, (input) =>
        (0, runtime.isOverlayNode)(input.node)
          ? {
              ...input,
              node: removeOverlayLayer(input.node, value2),
            }
          : input,
      );
    }
    if (!(0, runtime.isFlowContainer)(frame.node)) {
      return slide;
    }
    if (child < 0 || child >= frame.node.children.length) {
      return slide;
    }
    let value = frame.node.children.filter((input, options) => options !== child);
    if (value.every((source) => source.kind === "spacer")) {
      return removeSlideFrame(slide, frameId);
    }
    return updateSlideFrame(slide, frameId, (input) =>
      (0, runtime.isFlowContainer)(input.node)
        ? {
            ...input,
            node: {
              ...input.node,
              children: value,
            },
          }
        : input,
    );
  }
  function wrapNodeInContainer(
    slide: Slide,
    frameId: string,
    child: number | NodePath,
  ): Slide {
    if (typeof child !== "number") {
      if (child.length === 1) {
        return wrapNodeInContainer(slide, frameId, child[0]!);
      }
      let value3 = frameById(slide, frameId),
        value4 = child.slice(0, -1),
        value5 = child[child.length - 1]!,
        value6 = value3 ? nodeAtPath(value3.node, value4) : undefined;
      if (!value3 || value6 === undefined) {
        return slide;
      }
      if ((0, runtime.isOverlayNode)(value6)) {
        let value7 = value6.layers[value5 - 1];
        if (
          value5 === 0 ||
          !value7 ||
          value6.layers.length >= runtime.maxTextLineSpacing
        ) {
          return slide;
        }
        let value8 = structuredClone(value7);
        value8.x = (0, runtime.moveAxisSpec)(value8.x, 24);
        value8.y = (0, runtime.moveAxisSpec)(value8.y, 24);
        let items3 = [...value6.layers];
        items3.splice(value5, 0, value8);
        return updateSlideFrame(slide, frameId, (input) => ({
          ...input,
          node: updateNodeAtPath(input.node, value4, (input2) =>
            (0, runtime.isOverlayNode)(input2)
              ? {
                  ...input2,
                  layers: items3,
                }
              : input2,
          ),
        }));
      }
      if (!(0, runtime.isFlowContainer)(value6) || !value6.children[value5]) {
        return slide;
      }
      let items2 = [...value6.children];
      items2.splice(value5 + 1, 0, structuredClone(value6.children[value5]));
      return updateSlideFrame(slide, frameId, (input) => ({
        ...input,
        node: updateNodeAtPath(input.node, value4, (input2) =>
          (0, runtime.isFlowContainer)(input2)
            ? {
                ...input2,
                children: items2,
              }
            : input2,
        ),
      }));
    }
    let value = frameById(slide, frameId);
    if (!value) {
      return slide;
    }
    if ((0, runtime.isOverlayNode)(value.node)) {
      let value3 = value.node.layers[child - 1];
      if (child === 0 || !value3) {
        return slide;
      }
      if (value.node.layers.length >= runtime.maxTextLineSpacing) {
        return slide;
      }
      let value4 = structuredClone(value3);
      value4.x = (0, runtime.moveAxisSpec)(value4.x, 24);
      value4.y = (0, runtime.moveAxisSpec)(value4.y, 24);
      let items2 = [...value.node.layers];
      items2.splice(child, 0, value4);
      return updateSlideFrame(slide, frameId, (input) =>
        (0, runtime.isOverlayNode)(input.node)
          ? {
              ...input,
              node: {
                ...input.node,
                layers: items2,
              },
            }
          : input,
      );
    }
    if (!(0, runtime.isFlowContainer)(value.node)) {
      return slide;
    }
    let value2 = value.node.children[child];
    if (!value2) {
      return slide;
    }
    let items = [...value.node.children];
    items.splice(child + 1, 0, structuredClone(value2));
    return updateSlideFrame(slide, frameId, (input) =>
      (0, runtime.isFlowContainer)(input.node)
        ? {
            ...input,
            node: {
              ...input.node,
              children: items,
            },
          }
        : input,
    );
  }
  function isEditableTextNode(
    node: SlideNode | null | undefined,
  ): node is TextNode {
    return node?.kind === "text";
  }
  function nodeIsBold(node: TextNode, theme: DeckTheme = "anthropic"): boolean {
    return (
      (node.style?.fontWeight ??
        (theme === "neutral"
          ? (0, runtime.typeScaleForRole)(node.role, theme).fontWeight
          : 0)) >= 600
    );
  }
  function toggleNodeBold(
    node: TextNode,
    theme: DeckTheme = "anthropic",
    weight?: number,
  ): TextNode {
    let style: StyleBag = {
        ...node.style,
      },
      defaultWeight: number = (0, runtime.typeScaleForRole)(
        node.role,
        theme,
      ).fontWeight,
      weight2: number = !nodeIsBold(node, theme)
        ? weight !== undefined && weight >= 600
          ? weight
          : defaultWeight >= 600
            ? defaultWeight
            : 700
        : weight !== undefined && weight < 600
          ? weight
          : defaultWeight < 600
            ? defaultWeight
            : 400;
    if (weight2 === defaultWeight) {
      delete style.fontWeight;
    } else {
      style.fontWeight = weight2;
    }
    let state: TextNode = {
      ...node,
    };
    if (Object.keys(style).length === 0) {
      delete state.style;
    } else {
      state.style = style;
    }
    return state;
  }
  function nodeIsItalic(node: SlideNode): boolean {
    return node.style?.fontStyle === "italic";
  }
  function toggleNodeItalic<T extends SlideNode>(node: T): T;
  function toggleNodeItalic(node: SlideNode): SlideNode {
    let style: StyleBag = {
      ...node.style,
    };
    if (nodeIsItalic(node)) {
      delete style.fontStyle;
    } else {
      style.fontStyle = "italic";
    }
    let node2: SlideNode = {
      ...node,
    };
    if (Object.keys(style).length === 0) {
      delete node2.style;
    } else {
      node2.style = style;
    }
    return node2;
  }
  function setNodeList(node: TextNode, list: TextNode["list"]): TextNode {
    let state: TextNode = {
      ...node,
    };
    if (list === undefined) {
      delete state.list;
    } else {
      state.list = list;
    }
    return state;
  }
  function nodeIsUnderlined(node: SlideNode): boolean {
    return node.style?.textDecorationLine === "underline";
  }
  function toggleNodeUnderline<T extends SlideNode>(node: T): T;
  function toggleNodeUnderline(node: SlideNode): SlideNode {
    if (node.style?.textDecorationLine === "line-through") {
      return node;
    }
    return patchNodeStyle(
      node,
      nodeIsUnderlined(node)
        ? {
            textDecorationLine: undefined,
            textDecorationStyle: undefined,
            textDecorationColor: undefined,
          }
        : {
            textDecorationLine: "underline",
          },
    );
  }
  function patchNodeStyle<T extends SlideNode>(node: T, patch: StylePatch): T;
  function patchNodeStyle(node: SlideNode, patch: StylePatch): SlideNode {
    let style: Record<string, unknown> = {
      ...node.style,
    };
    for (let [value, value2] of Object.entries(patch))
      if (value2 === undefined) {
        delete style[value];
      } else {
        style[value] = value2;
      }
    let result: SlideNode = {
      ...node,
    };
    if (Object.keys(style).length === 0) {
      delete result.style;
    } else {
      result.style = style as StyleBag;
    }
    if (
      result.kind === "text" &&
      result.fill !== undefined &&
      (patch.backgroundColor !== undefined ||
        patch.backgroundGradient !== undefined)
    ) {
      delete result.fill;
    }
    return result;
  }
  function setTextFill(node: SlideNode, fill: TextFill | undefined): SlideNode {
    if (node.kind !== "text") {
      return node;
    }
    if (fill === undefined) {
      let { fill: value, ...value2 } = node;
      return value2;
    }
    return {
      ...patchNodeStyle(node, {
        backgroundColor: undefined,
        backgroundGradient: undefined,
      }),
      fill: fill,
    };
  }
  function setNodeRotation<T extends SlideNode>(
    node: T,
    rotation: number | undefined,
  ): T;
  function setNodeRotation(
    node: SlideNode,
    rotation: number | undefined,
  ): SlideNode {
    let rotation2 = (0, runtime.normalizeRotation)(rotation);
    if (node.kind === "shape") {
      let { rotate: value, ...value2 } = node;
      if (rotation2 === undefined || node.shape === "connector") {
        return value2;
      } else {
        return {
          ...value2,
          rotate: rotation2,
        };
      }
    }
    let transform: TransformValue = {
      ...node.style?.transform,
    };
    if (rotation2 === undefined) {
      delete transform.rotate;
    } else {
      transform.rotate = rotation2;
    }
    return patchNodeStyle(node, {
      transform: Object.keys(transform).length === 0 ? undefined : transform,
    });
  }
  function updatePositionedNode(
    slide: Slide,
    frameId: string,
    path: NodePath,
    xAxis: Axis,
    yAxis: Axis,
    update: SlideNodeUpdate,
  ): Slide {
    return updateSlideFrame(slide, frameId, (input) => {
      if (path.length === 0) {
        return {
          ...input,
          x: xAxis,
          y: yAxis,
          node: update(input.node),
        };
      }
      let value = path[path.length - 1]! - 1,
        value2 = updateNodeAtPath(
          input.node,
          path.slice(0, -1),
          (input2) => {
            let value3 = (0, runtime.isOverlayNode)(input2)
              ? input2.layers[value]
              : undefined;
            if (!(0, runtime.isOverlayNode)(input2) || !value3) {
              return input2;
            }
            let items = [...input2.layers];
            items[value] = {
              ...value3,
              x: xAxis,
              y: yAxis,
              node: update(value3.node),
            };
            return {
              ...input2,
              layers: items,
            };
          },
        );
      if (value2 === input.node) {
        return input;
      } else {
        return {
          ...input,
          node: value2,
        };
      }
    });
  }
  function pinNodeToRect(
    slide: Slide,
    frameId: string,
    path: NodePath,
    rect: ConnectorBounds,
  ): Slide {
    let state: Axis = {
        anchor: "leading",
        margin: Math.max(0, rect.left),
        offset: 0,
        size: rect.w,
      },
      state2: Axis = {
        anchor: "leading",
        margin: Math.max(0, rect.top),
        offset: 0,
        size: rect.h,
      };
    return updatePositionedNode(
      slide,
      frameId,
      path,
      state,
      state2,
      (input) => {
        if (!(0, runtime.isConnectorNode)(input)) {
          return input;
        }
        let { from: value, w: value2, h: value3, ...value4 } = input;
        if (rect.from === "tl") {
          return value4;
        } else {
          return {
            ...value4,
            from: rect.from,
          };
        }
      },
    );
  }
  function updatePinnedNodeRect(
    slide: Slide,
    frameId: string,
    path: NodePath,
    rect: LineShapeBounds,
    preservePosition: readonly [number, number],
  ): Slide {
    let callback = (input: number, options: number, context: number): Axis =>
        input >= 0
          ? {
              anchor: "leading",
              margin: input,
              offset: 0,
              size: options,
            }
          : {
              anchor: "center",
              margin: 0,
              offset: input + options / 2 - context / 2,
              size: options,
            },
      callback2 = (input: SlideNode): SlideNode => {
        if (!(0, runtime.isLineShapeNode)(input)) {
          return input;
        }
        let { w: value, h: value2, ...value3 } = input;
        return setNodeRotation(value3, rect.rotate ?? 0);
      };
    return updatePositionedNode(
      slide,
      frameId,
      path,
      callback(rect.left, rect.w, preservePosition[0]),
      callback(rect.top, rect.h, preservePosition[1]),
      callback2,
    );
  }
  function smallerAxisSpec(xAxis: Axis, yAxis: Axis): SmallerAxisInfo {
    let width = xAxis.anchor !== "fill" ? xAxis.size : undefined,
      height = yAxis.anchor !== "fill" ? yAxis.size : undefined;
    if (
      width !== undefined && height !== undefined
        ? width < height
        : width !== undefined
          ? yAxis.anchor === "fill"
          : height !== undefined && xAxis.anchor !== "fill"
    ) {
      return {
        axis: "x",
        size: width,
        length: height,
      };
    } else {
      return {
        axis: "y",
        size: height,
        length: width,
      };
    }
  }
  function smallerMediaAxis(node: Pick<MediaSizeNode, "w" | "h">): MediaSizeAxis {
    if (node.w !== undefined && node.w < (node.h ?? runtime.defaultMediaSize)) {
      return "w";
    } else {
      return "h";
    }
  }
  function hollowShapeOutline(node: SlideNode): ShapeOutline | undefined {
    let outline = (0, runtime.shapeOutline)(node.style);
    if (
      outline !== undefined &&
      node.style?.backgroundColor === undefined &&
      node.style?.backgroundGradient === undefined
    ) {
      return outline;
    } else {
      return undefined;
    }
  }
  function fillShapeFromOutline<T extends SlideNode>(
    node: T,
    outline: ShapeOutline,
  ): T;
  function fillShapeFromOutline(
    node: SlideNode,
    outline: ShapeOutline,
  ): SlideNode {
    return patchNodeStyle(node, {
      backgroundColor: outline.color,
      borderWidth: undefined,
      borderStyle: undefined,
      borderColor: undefined,
      borderSides: undefined,
      borderTopWidth: undefined,
      borderRightWidth: undefined,
      borderBottomWidth: undefined,
      borderLeftWidth: undefined,
    });
  }
  function minimumStrokeAdjustedSize(
    node: SlideNode,
    size: number | undefined,
  ): number | undefined {
    let outline = (0, runtime.shapeOutline)(node.style);
    if (outline !== undefined && size !== undefined) {
      return Math.max(size, 2 * outline.width);
    } else {
      return size;
    }
  }
  function minimumLineThickness(node: SlideNode): number {
    let outline = (0, runtime.shapeOutline)(node.style);
    if (outline !== undefined && hollowShapeOutline(node) === undefined) {
      return 2 * outline.width;
    } else {
      return 1;
    }
  }
  function nodeThicknessInfo(
    slide: Slide,
    frameId: string,
    path: NodePath,
  ): NodeThicknessInfo | undefined {
    let value = frameById(slide, frameId);
    if (!value) {
      return;
    }
    let callback = (
      input: LineShapeNode,
      options: Axis,
      context: Axis,
    ): NodeThicknessInfo => {
      let value5 = smallerAxisSpec(options, context);
      return {
        size: minimumStrokeAdjustedSize(input, value5.size),
        writable: (value5.axis === "y" ? context : options).anchor !== "fill",
      };
    };
    if (path.length === 0) {
      if ((0, runtime.isLineShapeNode)(value.node)) {
        return callback(value.node, value.x, value.y);
      } else {
        return undefined;
      }
    }
    let value2 = nodeAtPath(value.node, path.slice(0, -1)),
      value3 = path[path.length - 1]!;
    if (value2 !== undefined && (0, runtime.isOverlayNode)(value2)) {
      let value5 = value3 >= 1 ? value2.layers[value3 - 1] : undefined;
      if (value5 !== undefined && (0, runtime.isLineShapeNode)(value5.node)) {
        return callback(value5.node, value5.x, value5.y);
      } else {
        return undefined;
      }
    }
    let value4 =
      value2 !== undefined && (0, runtime.isFlowContainer)(value2)
        ? value2.children[value3]
        : undefined;
    if (value4 !== undefined && (0, runtime.isLineShapeNode)(value4)) {
      return {
        size: minimumStrokeAdjustedSize(
          value4,
          value4[smallerMediaAxis(value4)],
        ),
        writable: true,
      };
    } else {
      return undefined;
    }
  }
  function nodeThickness(
    slide: Slide,
    frameId: string,
    path: NodePath,
  ): number | undefined {
    return nodeThicknessInfo(slide, frameId, path)?.size;
  }
  function nodeThicknessIsWritable(
    slide: Slide,
    frameId: string,
    path: NodePath,
  ): boolean {
    return nodeThicknessInfo(slide, frameId, path)?.writable === true;
  }
  function setNodeThickness(
    slide: Slide,
    frameId: string,
    path: NodePath,
    thickness: number,
  ): Slide {
    let value = Math.max(1, Math.round(thickness)),
      callback = (
        input: LineShapeNode,
        options: Axis,
        context: Axis,
        value2: readonly [number, number] | undefined,
      ): AxisPair => {
        let value3 = smallerAxisSpec(options, context),
          value4 = value3.axis === "y" ? context : options;
        if (value4.anchor === "fill") {
          return {
            x: options,
            y: context,
          };
        }
        let value5 = value3.axis === "y" ? options : context,
          value6 =
            value2 === undefined
              ? undefined
              : value3.axis === "y"
                ? value2[0]
                : value2[1],
          value7 =
            value3.length ??
            (value5.anchor === "fill" && value6 !== undefined
              ? value6 - 2 * value5.margin
              : undefined),
          value8 = Math.max(
            minimumLineThickness(input),
            value7 !== undefined
              ? Math.max(1, Math.min(value, value7 - 1))
              : value,
          ),
          value9 =
            value2 === undefined
              ? undefined
              : value3.axis === "y"
                ? value2[1]
                : value2[0],
          value10 = minimumStrokeAdjustedSize(input, value3.size),
          state: Axis = {
            ...value4,
            size: value8,
          };
        if (value4.anchor !== "center" && value10 !== undefined) {
          let value11 = value4.margin - (value8 - value10) / 2;
          if (value11 >= 0 || value9 === undefined) {
            state = {
              ...value4,
              size: value8,
              margin: Math.max(0, value11),
            };
          } else {
            state = {
              anchor: "center",
              margin: 0,
              offset:
                (value4.anchor === "leading"
                  ? value11
                  : value9 - value11 - value8) +
                value8 / 2 -
                value9 / 2,
              size: value8,
            };
          }
        }
        if (value3.axis === "y") {
          return {
            x: options,
            y: state,
          };
        } else {
          return {
            x: state,
            y: context,
          };
        }
      },
      callback2 = (input: LineShapeNode): LineShapeNode => {
        let value2 = hollowShapeOutline(input);
        if (value2 === undefined) {
          return input;
        } else {
          return fillShapeFromOutline(input, value2);
        }
      },
      callback3 = (input: LineShapeNode): LineShapeNode => {
        let { w: value2, h: value3, ...value4 } = callback2(input);
        return value4;
      };
    return updateSlideFrame(slide, frameId, (input) => {
      if (path.length === 0) {
        if ((0, runtime.isLineShapeNode)(input.node)) {
          return {
            ...input,
            ...callback(input.node, input.x, input.y, [
              runtime.SLIDE_WIDTH,
              runtime.SLIDE_HEIGHT,
            ]),
            node: callback3(input.node),
          };
        } else {
          return input;
        }
      }
      let value2 = path[path.length - 1]!,
        value3 = updateNodeAtPath(
          input.node,
          path.slice(0, -1),
          (source) => {
            if ((0, runtime.isOverlayNode)(source) && value2 >= 1) {
              let value9 = source.layers[value2 - 1];
              if (
                value9 === undefined ||
                !(0, runtime.isLineShapeNode)(value9.node)
              ) {
                return source;
              }
              let items2 = [...source.layers];
              items2[value2 - 1] = {
                ...value9,
                ...callback(value9.node, value9.x, value9.y, undefined),
                node: callback3(value9.node),
              };
              return {
                ...source,
                layers: items2,
              };
            }
            if (!(0, runtime.isFlowContainer)(source)) {
              return source;
            }
            let value4 = source.children[value2];
            if (value4 === undefined || !(0, runtime.isLineShapeNode)(value4)) {
              return source;
            }
            let items = [...source.children],
              value5 = smallerMediaAxis(value4),
              value6 =
                value5 === "w"
                  ? (value4.h ?? runtime.defaultMediaSize)
                  : value4.w,
              value7 = Math.max(
                minimumLineThickness(value4),
                value6 !== undefined
                  ? Math.max(1, Math.min(value, value6 - 1))
                  : value,
              ),
              value8: SlideAxisName | undefined =
                source.kind === "stack"
                  ? source.dir === "h"
                    ? "x"
                    : "y"
                  : undefined;
            items[value2] = (0, runtime.setNodeAxisSize)(
              callback2(value4),
              value5 === "w" ? "x" : "y",
              value7,
              value8,
            );
            return {
              ...source,
              children: items,
            };
          },
        );
      if (value3 === input.node) {
        return input;
      } else {
        return {
          ...input,
          node: value3,
        };
      }
    });
  }
  function setTableCellColor(
    table: TableNode,
    row: number,
    column: number,
    color: SlideColor | undefined,
  ): TableNode {
    let cellKey = String(row) + "." + String(column),
      cellStyles: TableCellStyles = {
        ...table.cellStyles,
      };
    if (color === undefined) {
      delete cellStyles[cellKey];
    } else {
      cellStyles[cellKey] = {
        ...cellStyles[cellKey],
        color: color,
      };
    }
    let result: TableNode = {
      ...table,
    };
    if (Object.keys(cellStyles).length === 0) {
      delete result.cellStyles;
    } else {
      result.cellStyles = cellStyles;
    }
    return result;
  }
  function setTableColumnAlignment(
    table: TableNode,
    column: number,
    alignment: Alignment,
  ): TableNode {
    if (column < 0 || column >= table.cols) {
      return table;
    }
    let alignments = Array.from<unknown, Alignment>(
        {
          length: table.cols,
        },
        (input, options) =>
          options === column
            ? alignment
            : (table.colAligns?.[options] ?? "start"),
      ),
      result: TableNode = {
        ...table,
      };
    if (alignments.every((input) => input === "start")) {
      delete result.colAligns;
    } else {
      result.colAligns = alignments;
    }
    return result;
  }
  function nodeUniformLink(node: TextNode): string | undefined {
    let linkMarks = (node.marks ?? []).filter(
        (input) => input.href !== undefined,
      ),
      href = linkMarks[0]?.href;
    if (
      href === undefined ||
      linkMarks.some((input) => input.href !== href)
    ) {
      return;
    }
    for (let index = 0; index < node.text.length; index++) {
      if (
        node.text[index] ===
        `
`
      ) {
        continue;
      }
      if (
        !linkMarks.some(
          (input) => input.start <= index && index < input.end,
        )
      ) {
        return;
      }
    }
    if (node.text.replace(/\n/g, "") === "") {
      return undefined;
    } else {
      return href;
    }
  }
  function setNodeLink(node: TextNode, href: string | undefined): TextNode {
    if (
      href !== undefined &&
      (node.marks?.length ?? 0) >= runtime.maxTextMarks
    ) {
      return node;
    }
    let marks: TextMark[] = [];
    for (let value2 of node.marks ?? [])
      if (value2.href === undefined) {
        marks.push(value2);
      } else if (
        value2.bold !== undefined ||
        value2.italic !== undefined ||
        value2.underline !== undefined ||
        value2.color !== undefined
      ) {
        let { href: value3, ...value4 } = value2;
        marks.push(value4);
      }
    if (href !== undefined && node.text.length > 0) {
      marks.unshift({
        start: 0,
        end: node.text.length,
        href: href,
      });
    }
    let value = (0, runtime.normalizeTextMarks)(marks, node.text),
      state: TextNode = {
        ...node,
      };
    if (value === undefined || value.length === 0) {
      delete state.marks;
    } else {
      state.marks = value;
    }
    return state;
  }
  function hasPerSideBorderWidths(style: StyleBag | undefined): boolean {
    return (
      style !== undefined &&
      borderSideNames.some(
        (input) => style[borderSideWidthFields[input]] !== undefined,
      )
    );
  }
  function borderWidthsBySide(style: StyleBag | undefined): BorderWidths {
    let widths: BorderWidths = {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    };
    if (
      style === undefined ||
      style.borderStyle === undefined ||
      style.borderStyle === "none"
    ) {
      return widths;
    }
    let perSide = hasPerSideBorderWidths(style),
      sides =
        style.borderSides === undefined ? null : " " + style.borderSides + " ",
      value = style.borderWidth ?? (perSide ? 0 : 3);
    for (let value2 of borderSideNames)
      widths[value2] =
        style[borderSideWidthFields[value2]] ??
        (sides === null || sides.includes(" " + value2 + " ") ? value : 0);
    return widths;
  }
  function setBorderWidthsPreservingSides(
    style: StyleBag | undefined,
    width: number,
  ): StylePatch {
    let widths = borderWidthsBySide(style),
      hasBorder = borderSideNames.some((input) => widths[input] > 0);
    return borderPatchFromWidths({
      top: !hasBorder || widths.top > 0 ? width : 0,
      right: !hasBorder || widths.right > 0 ? width : 0,
      bottom: !hasBorder || widths.bottom > 0 ? width : 0,
      left: !hasBorder || widths.left > 0 ? width : 0,
    });
  }
  function borderPatchFromWidths(widths: BorderWidths): StylePatch {
    let sides = borderSideNames.filter((input) => widths[input] > 0),
      patch: StylePatch = {
        ...emptyBorderSideWidthPatch,
        borderWidth: undefined,
        borderSides: undefined,
      };
    if (sides.length === 0) {
      return {
        ...patch,
        borderWidth: 0,
      };
    }
    let uniformWidth = widths[sides[0]!];
    if (sides.every((input) => widths[input] === uniformWidth)) {
      patch.borderWidth = uniformWidth;
      if (sides.length < 4) {
        patch.borderSides = sides.join(" ") as BorderSidesValue;
      }
      return patch;
    }
    for (let value of sides)
      patch[borderSideWidthFields[value]] = widths[value];
    return patch;
  }
  function hasPerCornerRadius(style: StyleBag | undefined): boolean {
    return (
      style !== undefined &&
      borderCornerNames.some(
        (input) => style[borderCornerRadiusFields[input]] !== undefined,
      )
    );
  }
  function borderRadiiByCorner(style: StyleBag | undefined): BorderRadii {
    let value = style?.borderRadius ?? 0;
    return {
      tl: style?.borderTopLeftRadius ?? value,
      tr: style?.borderTopRightRadius ?? value,
      br: style?.borderBottomRightRadius ?? value,
      bl: style?.borderBottomLeftRadius ?? value,
    };
  }
  function borderRadiusPatch(radii: BorderRadii): StylePatch {
    if (borderCornerNames.every((input) => radii[input] === radii.tl)) {
      return {
        ...emptyCornerRadiusPatch,
        borderRadius: radii.tl === 0 ? undefined : radii.tl,
      };
    }
    return {
      borderRadius: undefined,
      borderTopLeftRadius: radii.tl,
      borderTopRightRadius: radii.tr,
      borderBottomRightRadius: radii.br,
      borderBottomLeftRadius: radii.bl,
    };
  }
  function looksLikeMediaFilename(label: string): boolean {
    return /\.(png|jpe?g|jfif|pjpe?g|pjp|gif|webp|avif|apng|svg|heic|heif|bmp|ico|tiff?|jxl|mp4|m4v|webm|mov)$/i.test(
      label.trim(),
    );
  }
  function imageHasPoster(node: ImageNode): boolean {
    return node.asset !== undefined || node.src !== undefined;
  }
  function imageHasMedia(node: ImageNode): boolean {
    return (
      imageHasPoster(node) ||
      node.video !== undefined ||
      node.videoLink !== undefined
    );
  }
  function replaceImageAsset(
    node: ImageNode,
    assetId: string,
    label: string,
    video?: string,
    sound: boolean = false,
  ): ImageNode {
    let state: ImageNode = {
      ...node,
      asset: assetId,
      alt:
        node.alt === "" || looksLikeMediaFilename(node.alt) ? label : node.alt,
    };
    delete state.src;
    delete state.crop;
    if (video !== undefined) {
      if (((state.video = video), delete state.videoLink, sound)) {
        delete state.videoSound;
      } else {
        state.videoSound = "on";
      }
    } else {
      delete state.video;
      delete state.videoStart;
      delete state.videoDelay;
      delete state.videoSound;
    }
    return state;
  }
  function setImageFit(node: ImageNode, fit: ImageNode["fit"]): ImageNode {
    if (node.fit === fit) {
      return node;
    }
    let state: ImageNode = {
      ...node,
      fit: fit,
    };
    delete state.crop;
    return state;
  }
  function resetImageDimensions(
    node: SlideNode,
    resetWidth: boolean,
    resetHeight: boolean,
    assets: ReadonlyMap<string, string>,
  ): SlideNode {
    if (node.kind !== "img" || (!resetWidth && !resetHeight)) {
      return node;
    }
    let value = node.asset !== undefined ? assets.get(node.asset) : node.src;
    if (value === undefined || value.startsWith("data:image/svg+xml")) {
      return node;
    }
    if (
      !(resetWidth && node.w !== undefined) &&
      !(resetHeight && node.h !== undefined) &&
      node.crop === undefined
    ) {
      return node;
    }
    let state: ImageNode = {
      ...node,
    };
    if (resetWidth) {
      delete state.w;
    }
    if (resetHeight) {
      delete state.h;
    }
    delete state.crop;
    return state;
  }
  function setVideoStartMode(
    node: ImageNode,
    mode: VideoStartMode,
    delay?: number,
  ): ImageNode {
    let state: ImageNode = {
      ...node,
    };
    delete state.videoStart;
    delete state.videoDelay;
    if (node.video === undefined) {
      return state;
    }
    if (mode === "click") {
      state.videoStart = "click";
    } else {
      let value = (0, runtime.normalizeVideoDelay)(delay);
      if (value !== undefined) {
        state.videoDelay = value;
      }
    }
    return state;
  }
  function setVideoLink(node: ImageNode, link: unknown): ImageNode {
    let value = (0, runtime.normalizeVideoLink)(link);
    if (value === undefined) {
      return node;
    }
    return {
      ...(node.video !== undefined ? clearImageMedia(node) : node),
      videoLink: value,
    };
  }
  function setVideoSound(node: ImageNode, sound: boolean): ImageNode {
    let state: ImageNode = {
      ...node,
    };
    delete state.videoSound;
    if (sound && node.video !== undefined) {
      state.videoSound = "on";
    }
    return state;
  }
  function clearImageMedia(node: ImageNode): ImageNode {
    let result: ImageNode = {
      ...node,
    };
    delete result.asset;
    delete result.src;
    delete result.crop;
    delete result.video;
    delete result.videoStart;
    delete result.videoDelay;
    delete result.videoLink;
    delete result.videoSound;
    if (looksLikeMediaFilename(result.alt)) {
      result.alt = "";
    }
    return result;
  }
  function nodeDisplayLabel(node: SlideNode, maxLength: number = 60): string {
    switch (node.kind) {
      case "text": {
        let value = node.text.trim().replace(/\s+/g, " ");
        if (value === "") {
          return "Empty text";
        } else {
          return (0, runtime.truncateUtf16Safely)(value, maxLength);
        }
      }
      case "img": {
        let value = node.alt.trim().replace(/\s+/g, " ");
        if (value === "") {
          return "Image";
        } else {
          return (0, runtime.truncateUtf16Safely)(
            "Image — " + value,
            maxLength,
          );
        }
      }
      case "icon":
        return (0, runtime.truncateUtf16Safely)(
          "Icon — " + node.icon,
          maxLength,
        );
      case "shape":
        return runtime.shapeVariantLabels[node.shape];
      case "html":
        return "Web embed";
      case "table":
        return "Table " + String(node.rows.length) + "×" + String(node.cols);
      case "spacer":
        return "Spacer";
      case "stack": {
        let value = nodeTextLabel(node);
        if (value === undefined) {
          return "Group";
        } else {
          return (0, runtime.truncateUtf16Safely)(
            "Group — " + value,
            maxLength,
          );
        }
      }
      case "grid": {
        let value = nodeTextLabel(node);
        if (value === undefined) {
          return "Grid";
        } else {
          return (0, runtime.truncateUtf16Safely)("Grid — " + value, maxLength);
        }
      }
      case "overlay": {
        let value = nodeTextLabel(node);
        if (value === undefined) {
          return "Overlay";
        } else {
          return (0, runtime.truncateUtf16Safely)(
            "Overlay — " + value,
            maxLength,
          );
        }
      }
    }
  }
  function nodeTextLabel(
    node: SlideNode,
    roles?: readonly TextRole[],
  ): string | undefined {
    if (node.kind === "text") {
      if (roles !== undefined && !roles.includes(node.role)) {
        return;
      }
      let value2 = node.text.trim().replace(/\s+/g, " ");
      if (value2 === "") {
        return undefined;
      } else {
        return value2;
      }
    }
    let value = (0, runtime.nodeChildren)(node);
    if (value === undefined) {
      return;
    }
    for (let value2 of value) {
      let value3 = nodeTextLabel(value2, roles);
      if (value3 !== undefined) {
        return value3;
      }
    }
    return;
  }
  function nodeFallbackLabel(node: SlideNode): string | undefined {
    if (node.kind === "table") {
      for (let value2 of node.rows)
        for (let value3 of value2) {
          let value4 = value3.trim().replace(/\s+/g, " ");
          if (value4 !== "") {
            return value4;
          }
        }
      return;
    }
    if (node.kind === "img") {
      let value2 = node.alt.trim().replace(/\s+/g, " ");
      if (value2 === "") {
        return undefined;
      } else {
        return value2;
      }
    }
    let value = (0, runtime.nodeChildren)(node);
    if (value === undefined) {
      return;
    }
    for (let value2 of value) {
      let value3 = nodeFallbackLabel(value2);
      if (value3 !== undefined) {
        return value3;
      }
    }
    return;
  }
  function slideDisplayLabel(slide: Slide): string | undefined {
    for (let value of [headingTextRoles, undefined])
      for (let value2 of slide.frames) {
        let value3 = nodeTextLabel(value2.node, value);
        if (value3 !== undefined) {
          return value3;
        }
      }
    for (let value of slide.frames) {
      let value2 = nodeFallbackLabel(value.node);
      if (value2 !== undefined) {
        return value2;
      }
    }
    return;
  }
  function isTableNode(node: SlideNode | null | undefined): node is TableNode {
    return node?.kind === "table";
  }
  function clampInteger(
    value: number,
    minimum: number,
    maximum: number,
  ): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }
    return Math.min(maximum, Math.max(minimum, Math.round(value)));
  }
  function countNodeTableCells(node: SlideNode): number {
    if (node.kind === "table") {
      return Math.max(1, node.rows.length) * node.cols;
    }
    let value = (0, runtime.nodeChildren)(node);
    if (value === undefined) {
      return 0;
    }
    let index = 0;
    for (let value2 of value) index += countNodeTableCells(value2);
    return index;
  }
  function countSlideTableCells(slide: Slide): number {
    let index = 0;
    for (let value of slide.frames) index += countNodeTableCells(value.node);
    return index;
  }
  function countDeckTableCells(slides: Iterable<Slide>): number {
    let index = 0;
    for (let value of slides) index += countSlideTableCells(value);
    return index;
  }
  function countNodeEmbeds(node: SlideNode): number {
    if (node.kind === "html") {
      return 1;
    }
    let value = (0, runtime.nodeChildren)(node);
    if (value === undefined) {
      return 0;
    }
    let index = 0;
    for (let value2 of value) index += countNodeEmbeds(value2);
    return index;
  }
  function countSlideEmbeds(slide: Slide): number {
    let index = 0;
    for (let value of slide.frames) index += countNodeEmbeds(value.node);
    return index;
  }
  function setTableCellText(
    table: TableNode,
    row: number,
    column: number,
    text: string,
  ): TableNode {
    let sourceRow = table.rows[row];
    if (!sourceRow || column < 0 || column >= sourceRow.length) {
      return table;
    }
    let cells = [...sourceRow];
    cells[column] = text;
    let rows = [...table.rows];
    rows[row] = cells;
    return {
      ...table,
      rows: rows,
    };
  }
  function tableCellExists(
    table: TableNode,
    row: number,
    column: number,
  ): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(column)) {
      return false;
    }
    if (row < 0 || column < 0 || column >= table.cols) {
      return false;
    }
    let value = table.rows[row];
    return value !== undefined && column < value.length;
  }
  function resizeTable(
    table: TableNode,
    rows: number,
    columns: number,
  ): TableNode {
    let columnCount = clampInteger(columns, 1, runtime.maxTableColumns),
      rowCount = clampInteger(rows, 0, runtime.maxTableRows),
      rows2: string[][] = [];
    for (let index = 0; index < rowCount; index++) {
      let value = table.rows[index] ?? [],
        items: string[] = [];
      for (let index2 = 0; index2 < columnCount; index2++)
        items.push(value[index2] ?? "");
      rows2.push(items);
    }
    let result: TableNode = {
      ...table,
      rows: rows2,
      cols: columnCount,
    };
    if (table.colWidths !== undefined) {
      if (columnCount <= table.colWidths.length) {
        result.colWidths = table.colWidths.slice(0, columnCount);
      } else {
        let length = table.colWidths.length,
          value = table.colWidths.reduce(
            (input, options) => input + options,
            0,
          ),
          value2 = clampInteger(
            length > 0 ? value / length : 100 / columnCount,
            1,
            100,
          );
        result.colWidths = table.colWidths.concat(
          Array.from<unknown, number>(
            {
              length: columnCount - length,
            },
            () => value2,
          ),
        );
      }
    }
    if (table.colAligns !== undefined) {
      result.colAligns =
        columnCount <= table.colAligns.length
          ? table.colAligns.slice(0, columnCount)
          : table.colAligns.concat(
              Array.from<unknown, Alignment>(
                {
                  length: columnCount - table.colAligns.length,
                },
                () => "start",
              ),
            );
    }
    if (table.cellStyles !== undefined) {
      let value = Object.entries(table.cellStyles).filter(([input]) => {
        let value2 = /^(\d+)\.(\d+)$/.exec(input);
        return (
          value2 !== null &&
          Number(value2[1]) < rowCount &&
          Number(value2[2]) < columnCount
        );
      });
      if (value.length > 0) {
        result.cellStyles = Object.fromEntries(value);
      } else {
        delete result.cellStyles;
      }
    }
    remapTableRowStyles(table, result, (input) =>
      input < rowCount ? input : null,
    );
    return result;
  }
  function remapTableCellStyles(
    table: TableNode,
    target: TableNode,
    remap: TableCellRemap,
  ): void {
    if (table.cellStyles === undefined) {
      return;
    }
    let state: TableCellStyles = {},
      index = 0;
    for (let [value, value2] of Object.entries(table.cellStyles)) {
      let value3 = /^(\d+)\.(\d+)$/.exec(value),
        value4 =
          value3 !== null ? remap(Number(value3[1]), Number(value3[2])) : null;
      if (value4 === null) {
        continue;
      }
      state[String(value4[0]) + "." + String(value4[1])] = value2;
      index += 1;
    }
    if (index > 0) {
      target.cellStyles = state;
    } else {
      delete target.cellStyles;
    }
  }
  function remapTableRowStyles(
    table: TableNode,
    target: TableNode,
    remap: TableRowRemap,
  ): void {
    if (table.rowStyles === undefined) {
      return;
    }
    let state: TableRowStyles = {};
    for (let [value, value2] of Object.entries(table.rowStyles)) {
      let value3 = /^\d+$/.test(value) ? remap(Number(value)) : null;
      if (value3 !== null) {
        state[String(value3)] = value2;
      }
    }
    if (Object.keys(state).length > 0) {
      target.rowStyles = state;
    } else {
      delete target.rowStyles;
    }
  }
  function insertTableRow(table: TableNode, rowIndex: number): TableNode {
    let rowCount = table.rows.length;
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex > rowCount) {
      return table;
    }
    if (rowCount >= runtime.maxTableRows) {
      return table;
    }
    let rows = [...table.rows];
    rows.splice(
      rowIndex,
      0,
      Array.from<unknown, string>(
        {
          length: table.cols,
        },
        () => "",
      ),
    );
    let result: TableNode = {
      ...table,
      rows: rows,
    };
    remapTableCellStyles(table, result, (input, options) => [
      input >= rowIndex ? input + 1 : input,
      options,
    ]);
    remapTableRowStyles(table, result, (input) =>
      input >= rowIndex ? input + 1 : input,
    );
    return result;
  }
  function setTableColumnWidth(
    table: TableNode,
    column: number,
    width: number,
  ): TableNode {
    if (!Number.isInteger(column) || column < 0 || column >= table.cols) {
      return table;
    }
    let widths =
      table.colWidths !== undefined && table.colWidths.length === table.cols
        ? [...table.colWidths]
        : Array.from<unknown, number>(
            {
              length: table.cols,
            },
            () => clampInteger(100 / table.cols, 1, 100),
          );
    widths[column] = clampInteger(width, 1, 100);
    return {
      ...table,
      colWidths: widths,
    };
  }
  bindRuntimeValue(runtime, "nodeAtPath", () => nodeAtPath);
  bindRuntimeValue(runtime, "updateNodeAtPath", () => updateNodeAtPath);
  bindRuntimeValue(runtime, "frameById", () => frameById);
  bindRuntimeValue(runtime, "updateSlideFrame", () => updateSlideFrame);
  bindRuntimeValue(runtime, "removeSlideFrame", () => removeSlideFrame);
  bindRuntimeValue(runtime, "appendSlideFrame", () => appendSlideFrame);
  bindRuntimeValue(
    runtime,
    "frameStackContentOffset",
    () => frameStackContentOffset,
  );
  bindRuntimeValue(runtime, "reorderSlideFrames", () => reorderSlideFrames);
  bindRuntimeValue(runtime, "removeOverlayLayer", () => removeOverlayLayer);
  bindRuntimeValue(runtime, "removeNestedNode", () => removeNestedNode);
  bindRuntimeValue(runtime, "removeSlideNode", () => removeSlideNode);
  bindRuntimeValue(runtime, "wrapNodeInContainer", () => wrapNodeInContainer);
  bindRuntimeValue(runtime, "isEditableTextNode", () => isEditableTextNode);
  bindRuntimeValue(runtime, "nodeIsBold", () => nodeIsBold);
  bindRuntimeValue(runtime, "toggleNodeBold", () => toggleNodeBold);
  bindRuntimeValue(runtime, "nodeIsItalic", () => nodeIsItalic);
  bindRuntimeValue(runtime, "toggleNodeItalic", () => toggleNodeItalic);
  bindRuntimeValue(runtime, "setNodeList", () => setNodeList);
  bindRuntimeValue(runtime, "nodeIsUnderlined", () => nodeIsUnderlined);
  bindRuntimeValue(runtime, "toggleNodeUnderline", () => toggleNodeUnderline);
  bindRuntimeValue(runtime, "patchNodeStyle", () => patchNodeStyle);
  bindRuntimeValue(runtime, "setTextFill", () => setTextFill);
  bindRuntimeValue(runtime, "setNodeRotation", () => setNodeRotation);
  bindRuntimeValue(runtime, "updatePositionedNode", () => updatePositionedNode);
  bindRuntimeValue(runtime, "pinNodeToRect", () => pinNodeToRect);
  bindRuntimeValue(runtime, "updatePinnedNodeRect", () => updatePinnedNodeRect);
  bindRuntimeValue(runtime, "smallerAxisSpec", () => smallerAxisSpec);
  bindRuntimeValue(runtime, "smallerMediaAxis", () => smallerMediaAxis);
  bindRuntimeValue(runtime, "hollowShapeOutline", () => hollowShapeOutline);
  bindRuntimeValue(runtime, "fillShapeFromOutline", () => fillShapeFromOutline);
  bindRuntimeValue(
    runtime,
    "minimumStrokeAdjustedSize",
    () => minimumStrokeAdjustedSize,
  );
  bindRuntimeValue(runtime, "minimumLineThickness", () => minimumLineThickness);
  bindRuntimeValue(runtime, "nodeThicknessInfo", () => nodeThicknessInfo);
  bindRuntimeValue(runtime, "nodeThickness", () => nodeThickness);
  bindRuntimeValue(
    runtime,
    "nodeThicknessIsWritable",
    () => nodeThicknessIsWritable,
  );
  bindRuntimeValue(runtime, "setNodeThickness", () => setNodeThickness);
  bindRuntimeValue(runtime, "setTableCellColor", () => setTableCellColor);
  bindRuntimeValue(
    runtime,
    "setTableColumnAlignment",
    () => setTableColumnAlignment,
  );
  bindRuntimeValue(runtime, "nodeUniformLink", () => nodeUniformLink);
  bindRuntimeValue(runtime, "setNodeLink", () => setNodeLink);
  bindRuntimeValue(
    runtime,
    "hasPerSideBorderWidths",
    () => hasPerSideBorderWidths,
  );
  bindRuntimeValue(runtime, "borderWidthsBySide", () => borderWidthsBySide);
  bindRuntimeValue(
    runtime,
    "setBorderWidthsPreservingSides",
    () => setBorderWidthsPreservingSides,
  );
  bindRuntimeValue(
    runtime,
    "borderPatchFromWidths",
    () => borderPatchFromWidths,
  );
  bindRuntimeValue(runtime, "hasPerCornerRadius", () => hasPerCornerRadius);
  bindRuntimeValue(runtime, "borderRadiiByCorner", () => borderRadiiByCorner);
  bindRuntimeValue(runtime, "borderRadiusPatch", () => borderRadiusPatch);
  bindRuntimeValue(
    runtime,
    "looksLikeMediaFilename",
    () => looksLikeMediaFilename,
  );
  bindRuntimeValue(runtime, "imageHasPoster", () => imageHasPoster);
  bindRuntimeValue(runtime, "imageHasMedia", () => imageHasMedia);
  bindRuntimeValue(runtime, "replaceImageAsset", () => replaceImageAsset);
  bindRuntimeValue(runtime, "setImageFit", () => setImageFit);
  bindRuntimeValue(runtime, "resetImageDimensions", () => resetImageDimensions);
  bindRuntimeValue(runtime, "setVideoStartMode", () => setVideoStartMode);
  bindRuntimeValue(runtime, "setVideoLink", () => setVideoLink);
  bindRuntimeValue(runtime, "setVideoSound", () => setVideoSound);
  bindRuntimeValue(runtime, "clearImageMedia", () => clearImageMedia);
  bindRuntimeValue(runtime, "nodeDisplayLabel", () => nodeDisplayLabel);
  bindRuntimeValue(runtime, "nodeTextLabel", () => nodeTextLabel);
  bindRuntimeValue(runtime, "nodeFallbackLabel", () => nodeFallbackLabel);
  bindRuntimeValue(runtime, "slideDisplayLabel", () => slideDisplayLabel);
  bindRuntimeValue(runtime, "isTableNode", () => isTableNode);
  bindRuntimeValue(runtime, "clampInteger", () => clampInteger);
  bindRuntimeValue(runtime, "countNodeTableCells", () => countNodeTableCells);
  bindRuntimeValue(runtime, "countSlideTableCells", () => countSlideTableCells);
  bindRuntimeValue(runtime, "countDeckTableCells", () => countDeckTableCells);
  bindRuntimeValue(runtime, "countNodeEmbeds", () => countNodeEmbeds);
  bindRuntimeValue(runtime, "countSlideEmbeds", () => countSlideEmbeds);
  bindRuntimeValue(runtime, "setTableCellText", () => setTableCellText);
  bindRuntimeValue(runtime, "tableCellExists", () => tableCellExists);
  bindRuntimeValue(runtime, "resizeTable", () => resizeTable);
  bindRuntimeValue(runtime, "remapTableCellStyles", () => remapTableCellStyles);
  bindRuntimeValue(runtime, "remapTableRowStyles", () => remapTableRowStyles);
  bindRuntimeValue(runtime, "insertTableRow", () => insertTableRow);
  bindRuntimeValue(runtime, "setTableColumnWidth", () => setTableColumnWidth);
  bindRuntimeValue(
    runtime,
    "borderSideNames",
    () => borderSideNames,
    (value) => {
      borderSideNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "borderSideWidthFields",
    () => borderSideWidthFields,
    (value) => {
      borderSideWidthFields = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyBorderSideWidthPatch",
    () => emptyBorderSideWidthPatch,
    (value) => {
      emptyBorderSideWidthPatch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "borderCornerRadiusFields",
    () => borderCornerRadiusFields,
    (value) => {
      borderCornerRadiusFields = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "borderCornerNames",
    () => borderCornerNames,
    (value) => {
      borderCornerNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyCornerRadiusPatch",
    () => emptyCornerRadiusPatch,
    (value) => {
      emptyCornerRadiusPatch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "headingTextRoles",
    () => headingTextRoles,
    (value) => {
      headingTextRoles = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeModelEditing",
    () => initializeModelEditing,
    (value) => {
      initializeModelEditing = value;
    },
  );
  return () => {
    initializeModelEditing = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeTypographyInference)();
      (0, runtime.initializeModelGeometry)();
      (0, runtime.initializeHtmlWriter)();
      (0, runtime.initializeVideoLinks)();
      borderSideNames = ["top", "right", "bottom", "left"];
      borderSideWidthFields = {
        top: "borderTopWidth",
        right: "borderRightWidth",
        bottom: "borderBottomWidth",
        left: "borderLeftWidth",
      };
      emptyBorderSideWidthPatch = {
        borderTopWidth: undefined,
        borderRightWidth: undefined,
        borderBottomWidth: undefined,
        borderLeftWidth: undefined,
      };
      borderCornerRadiusFields = {
        tl: "borderTopLeftRadius",
        tr: "borderTopRightRadius",
        br: "borderBottomRightRadius",
        bl: "borderBottomLeftRadius",
      };
      borderCornerNames = ["tl", "tr", "br", "bl"];
      emptyCornerRadiusPatch = {
        borderTopLeftRadius: undefined,
        borderTopRightRadius: undefined,
        borderBottomRightRadius: undefined,
        borderBottomLeftRadius: undefined,
      };
      headingTextRoles = ["display", "h1", "h2", "h3"];
    });
  };
}
