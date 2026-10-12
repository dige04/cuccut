/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  Axis,
  FlowContainerNode,
  Frame,
  GridTrack,
  IconNode,
  ImageNode,
  NodePlacement,
  ShapeNode,
  SlideNode,
  TextNode,
  TransformValue,
} from "../deck-contracts";

/** Slide axis: `x` runs left to right, `y` top to bottom. */
export type SlideAxisName = "x" | "y";
/** Edge of a box on one axis: `near` is the left/top edge, `far` the right/bottom edge. */
export type ResizeEdge = "near" | "far";
/** Axis-aligned box in slide coordinates. */
export interface SlideRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** A box that may be rotated around its center; `rotation` is in radians. */
export interface RotatedSlideRect extends SlideRect {
  rotation?: number;
}
/** Start position and extent of a frame along one axis. */
export interface AxisExtent {
  start: number;
  size: number;
}
/** A movement or resize delta on both axes. */
export interface AxisDeltas {
  dx: number;
  dy: number;
}
/** CSS properties that place a frame along its axes. */
export type AxisCssProperty =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "width"
  | "height";
/** Inline CSS that positions a frame inside the slide. */
export interface FramePositionCss {
  left?: string;
  right?: string;
  top?: string;
  bottom?: string;
  width?: string;
  height?: string;
  transform?: string;
}
/** The parts of a frame that decide its CSS position (overlay layers pass a pseudo frame with an id). */
export type PositionedFrame = Pick<Frame, "x" | "y" | "node"> & {
  id?: string;
};
/** Nodes that carry their own explicit width and height. */
export type MediaSizeNode = ImageNode | IconNode | ShapeNode;
/** A resize of a node by its edge handles; an edge is `null` when that axis is not resized. */
export interface NodeEdgeResize extends AxisDeltas {
  xEdge: ResizeEdge | null;
  yEdge: ResizeEdge | null;
  /** Current width and height of the node. */
  w: number;
  h: number;
  /** Main axis of the parent stack, if the node sits in one. */
  mainAxis: SlideAxisName | undefined;
}
/** One axis of a resize gesture on a frame. */
export interface AxisResize {
  spec: Axis;
  edge: ResizeEdge;
  delta: number;
  currentSize: number;
  designSize: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    applyAxisSpecCss: (
      axis: Axis,
      nearProperty: AxisCssProperty,
      farProperty: AxisCssProperty,
      sizeProperty: AxisCssProperty,
      style: FramePositionCss,
      centers: string[],
    ) => void;
    framePositionCss: (frame: PositionedFrame) => FramePositionCss;
    resolveAxisSpec: (
      axis: Axis,
      designSize: number,
      intrinsicSize: number,
    ) => AxisExtent;
    frameBounds: (
      xAxis: Axis,
      yAxis: Axis,
      intrinsicWidth?: number,
      intrinsicHeight?: number,
    ) => SlideRect;
    moveAxisSpec: (axis: Axis, delta: number) => Axis;
    isTextNode: (node: SlideNode) => node is TextNode;
    implicitAxisAnchorPosition: (axis: Axis, designSize: number) => number;
    preserveImplicitAxisSize: (
      axis: Axis,
      movedAxis: Axis,
      designSize: number | undefined,
      currentSize: number,
    ) => Axis;
    moveAxisSpecPreservingSize: (
      axis: Axis,
      delta: number,
      designSize: number | undefined,
      currentSize: number,
    ) => Axis;
    minimumNodeResizeSize: (node: SlideNode, currentSize?: number) => number;
    axisSpecSize: (
      axis: Axis,
      currentSize: number,
      designSize: number,
    ) => number;
    resizeAxisSpec: (
      axis: Axis,
      edge: ResizeEdge,
      delta: number,
      currentSize: number,
      designSize: number,
      minimumSize?: number,
    ) => Axis;
    axisSpecFromRect: (
      previousAxis: Axis,
      start: number,
      size: number,
      designSize: number,
    ) => Axis;
    nodeSupportsSizing: (node: SlideNode) => boolean;
    isMediaSizeNode: (node: SlideNode) => node is MediaSizeNode;
    nodeSupportsSelfAlignment: (
      node: SlideNode,
      property: "alignSelf" | "justifySelf",
    ) => boolean;
    nodeExplicitAxisSize: (
      node: SlideNode,
      axis: SlideAxisName,
    ) => number | undefined;
    nodeSupportsIntrinsicSizing: (node: SlideNode) => boolean;
    nodeHasIntrinsicSize: (node: SlideNode, axis: SlideAxisName) => boolean;
    canResizeNodeAxis: (
      node: SlideNode,
      axis: SlideAxisName,
      parent: FlowContainerNode,
    ) => boolean;
    clearPlacementForExplicitSize: (
      placement: NodePlacement,
      axis: SlideAxisName,
      mainAxis: SlideAxisName | undefined,
    ) => void;
    setNodeAxisSize: (
      node: SlideNode,
      axis: SlideAxisName,
      size: number | undefined,
      parentDirection: SlideAxisName | undefined,
    ) => SlideNode;
    setNodeAxisIntrinsicSize: (
      node: SlideNode,
      axis: SlideAxisName,
      size: number | undefined,
      parentDirection: SlideAxisName | undefined,
    ) => SlideNode;
    clearPlacementAxisConstraints: (
      placement: NodePlacement,
      axis: SlideAxisName,
    ) => void;
    setNodePlacement: (node: SlideNode, placement: NodePlacement) => SlideNode;
    resizeNodeFromEdges: (
      node: SlideNode,
      resize: NodeEdgeResize,
      minimumWidth?: number,
      minimumHeight?: number,
    ) => SlideNode;
    aspectRatioResizeDeltas: (
      resize: NodeEdgeResize,
      minimumSize?: number,
    ) => AxisDeltas;
    aspectRatioAxisResizeDeltas: (
      xResize: AxisResize,
      yResize: AxisResize,
      minimumSize?: number,
    ) => AxisDeltas;
    axisResizeTravelLimit: (resize: Pick<AxisResize, "spec" | "edge">) => number;
    pointInRotatedRect: (
      rect: RotatedSlideRect,
      x: number,
      y: number,
    ) => boolean;
    rotatedRectBounds_Rn: (rect: RotatedSlideRect) => SlideRect;
    screenDeltaToLocalDelta: (
      deltaX: number,
      deltaY: number,
      rotation: number,
      scale: number,
    ) => AxisDeltas;
    snapRotation: (rotation: number, delta: number, snap: boolean) => number;
    angleBetweenPoints: (
      startX: number,
      startY: number,
      endX: number,
      endY: number,
    ) => number;
    moveFillAxisAsPinned: (
      axis: Axis,
      delta: number,
      designSize: number,
    ) => Axis;
    nodeTransform: (node?: SlideNode) => TransformValue | undefined;
    axisSpecCenter: (
      axis: Axis,
      designSize: number,
      intrinsicSize: number,
    ) => number;
    transformPositionCompensation: (
      deltaX: number,
      deltaY: number,
      rotation: number,
      scale: number,
    ) => AxisDeltas;
    minimumObjectSize: number;
    axisSpecsAreSized: (xAxis: Axis, yAxis: Axis) => boolean;
    shouldPreserveMediaAspect: (
      node: MediaSizeNode,
      hostSized: boolean,
      inStack: boolean,
    ) => boolean;
    nodeAxisHasSize: (node: SlideNode, axis: SlideAxisName) => boolean;
    initializeModelGeometry: () => void;
  }
}

export function installModelGeometry(runtime: RuntimeBindings): () => void {
  var minimumObjectSize: RuntimeBindings["minimumObjectSize"];
  var axisSpecsAreSized: RuntimeBindings["axisSpecsAreSized"];
  var shouldPreserveMediaAspect: RuntimeBindings["shouldPreserveMediaAspect"];
  var nodeAxisHasSize: RuntimeBindings["nodeAxisHasSize"];
  var initializeModelGeometry: RuntimeBindings["initializeModelGeometry"];
  function applyAxisSpecCss(
    axis: Axis,
    nearProperty: AxisCssProperty,
    farProperty: AxisCssProperty,
    sizeProperty: AxisCssProperty,
    style: FramePositionCss,
    centers: string[],
  ): void {
    switch (axis.anchor) {
      case "leading":
        if (
          ((style[nearProperty] = String(axis.margin) + "px"),
          axis.size !== undefined)
        ) {
          style[sizeProperty] = String(axis.size) + "px";
        }
        break;
      case "trailing":
        if (
          ((style[farProperty] = String(axis.margin) + "px"),
          axis.size !== undefined)
        ) {
          style[sizeProperty] = String(axis.size) + "px";
        }
        break;
      case "center":
        if (
          ((style[nearProperty] =
            axis.offset === 0
              ? "50%"
              : "calc(50% + " + String(axis.offset) + "px)"),
          centers.push("-50%"),
          axis.size !== undefined)
        ) {
          style[sizeProperty] = String(axis.size) + "px";
        }
        break;
      case "fill":
        style[nearProperty] = String(axis.margin) + "px";
        style[farProperty] = String(axis.margin) + "px";
        break;
    }
    if (axis.anchor !== "center") {
      centers.push("0");
    }
  }
  function framePositionCss(frame: PositionedFrame): FramePositionCss {
    let css: FramePositionCss = {},
      centers: string[] = [];
    applyAxisSpecCss(frame.x, "left", "right", "width", css, centers);
    applyAxisSpecCss(frame.y, "top", "bottom", "height", css, centers);
    if (frame.node.kind === "table") {
      delete css.height;
      if (frame.y.anchor === "fill") {
        delete css.bottom;
      }
    }
    if (centers[0] !== "0" || centers[1] !== "0") {
      css.transform = "translate(" + centers[0] + ", " + centers[1] + ")";
    }
    return css;
  }
  function resolveAxisSpec(
    axis: Axis,
    designSize: number,
    intrinsicSize: number,
  ): AxisExtent {
    let size: number =
      axis.anchor === "fill"
        ? designSize - 2 * axis.margin
        : (axis.size ?? intrinsicSize);
    switch (axis.anchor) {
      case "leading":
        return {
          start: axis.margin,
          size: size,
        };
      case "trailing":
        return {
          start: designSize - axis.margin - size,
          size: size,
        };
      case "center":
        return {
          start: designSize / 2 + axis.offset - size / 2,
          size: size,
        };
      case "fill":
        return {
          start: axis.margin,
          size: size,
        };
    }
  }
  function frameBounds(
    xAxis: Axis,
    yAxis: Axis,
    intrinsicWidth: number = 0,
    intrinsicHeight: number = 0,
  ): SlideRect {
    let x: AxisExtent = resolveAxisSpec(
        xAxis,
        runtime.SLIDE_WIDTH,
        intrinsicWidth,
      ),
      y: AxisExtent = resolveAxisSpec(
        yAxis,
        runtime.SLIDE_HEIGHT,
        intrinsicHeight,
      );
    return {
      x: x.start,
      y: y.start,
      w: x.size,
      h: y.size,
    };
  }
  function moveAxisSpec(axis: Axis, delta: number): Axis {
    switch (axis.anchor) {
      case "leading":
        return {
          ...axis,
          margin: Math.max(0, axis.margin + delta),
        };
      case "trailing":
        return {
          ...axis,
          margin: Math.max(0, axis.margin - delta),
        };
      case "center":
        return {
          ...axis,
          offset: axis.offset + delta,
        };
      case "fill":
        return axis;
    }
  }
  function isTextNode(node: SlideNode): node is TextNode {
    return node.kind === "text";
  }
  function implicitAxisAnchorPosition(axis: Axis, designSize: number): number {
    if (axis.anchor === "center") {
      return designSize / 2 - axis.offset;
    } else {
      return designSize - axis.margin;
    }
  }
  function preserveImplicitAxisSize(
    axis: Axis,
    movedAxis: Axis,
    designSize: number | undefined,
    currentSize: number,
  ): Axis {
    if (
      axis.anchor === "fill" ||
      axis.size !== undefined ||
      movedAxis.anchor === "fill" ||
      designSize === undefined
    ) {
      return movedAxis;
    }
    if (
      movedAxis.anchor === axis.anchor &&
      Math.abs(movedAxis.margin - axis.margin) < 0.01 &&
      Math.abs(movedAxis.offset - axis.offset) < 0.01
    ) {
      return axis;
    }
    let value: number = Math.max(1, Math.ceil(designSize));
    if (
      value >= implicitAxisAnchorPosition(axis, currentSize) - 0.5 ||
      value > implicitAxisAnchorPosition(movedAxis, currentSize)
    ) {
      return {
        ...movedAxis,
        size: value,
      };
    }
    if (movedAxis.size === undefined) {
      return movedAxis;
    }
    let { size: value2, ...value3 }: Axis = movedAxis;
    return value3;
  }
  function moveAxisSpecPreservingSize(
    axis: Axis,
    delta: number,
    designSize: number | undefined,
    currentSize: number,
  ): Axis {
    return preserveImplicitAxisSize(
      axis,
      moveAxisSpec(axis, delta),
      designSize,
      currentSize,
    );
  }
  function minimumNodeResizeSize(node: SlideNode, currentSize?: number): number {
    if (node.kind !== "shape" || node.shape !== "connector") {
      return minimumObjectSize;
    }
    let value: number = 2 * (0, runtime.connectorArrowInset)(node.strokeWidth);
    if (currentSize === undefined || currentSize <= 0 || currentSize >= value) {
      return value;
    }
    return Math.min(
      currentSize,
      node.strokeWidth ?? runtime.defaultShapeStrokeWidth,
    );
  }
  function axisSpecSize(
    axis: Axis,
    currentSize: number,
    designSize: number,
  ): number {
    if (axis.anchor === "fill") {
      return designSize - 2 * axis.margin;
    } else {
      return axis.size ?? currentSize;
    }
  }
  function resizeAxisSpec(
    axis: Axis,
    edge: ResizeEdge,
    delta: number,
    currentSize: number,
    designSize: number,
    minimumSize: number = minimumObjectSize,
  ): Axis {
    let value: number = axisSpecSize(axis, currentSize, designSize);
    if (axis.anchor === "fill") {
      let margin: number = axis.margin;
      if (edge === "near") {
        let value5: number = Math.max(0, margin + delta);
        return {
          anchor: "leading",
          margin: value5,
          offset: 0,
          size: Math.max(minimumSize, designSize - axis.margin - value5),
        };
      }
      return {
        anchor: "leading",
        margin: margin,
        offset: 0,
        size: Math.max(minimumSize, value + delta),
      };
    }
    if (axis.anchor === "leading") {
      if (edge === "far") {
        return {
          ...axis,
          size: Math.max(minimumSize, value + delta),
        };
      }
      let value5: number = Math.max(0, axis.margin + delta);
      return {
        ...axis,
        margin: value5,
        size: Math.max(minimumSize, value - (value5 - axis.margin)),
      };
    }
    if (axis.anchor === "trailing") {
      if (edge === "near") {
        return {
          ...axis,
          size: Math.max(minimumSize, value - delta),
        };
      }
      let value5: number = Math.max(0, axis.margin - delta);
      return {
        ...axis,
        margin: value5,
        size: Math.max(minimumSize, value - (value5 - axis.margin)),
      };
    }
    let value2: number = edge === "far" ? delta : -delta,
      value3: number = Math.max(minimumSize, value + value2),
      value4: number = value3 - value;
    return {
      ...axis,
      offset: axis.offset + (edge === "far" ? value4 / 2 : -value4 / 2),
      size: value3,
    };
  }
  function axisSpecFromRect(
    previousAxis: Axis,
    start: number,
    size: number,
    designSize: number,
  ): Axis {
    let state: Axis = {
      anchor: "center",
      margin: 0,
      offset: start + size / 2 - designSize / 2,
      size: size,
    };
    if (previousAxis.anchor === "center") {
      return {
        ...state,
        margin: previousAxis.margin,
      };
    }
    let value: number =
      previousAxis.anchor === "trailing" ? designSize - start - size : start;
    if (value < 0) {
      return state;
    } else {
      return {
        anchor: previousAxis.anchor === "trailing" ? "trailing" : "leading",
        margin: value,
        offset: 0,
        size: size,
      };
    }
  }
  function nodeSupportsSizing(node: SlideNode): boolean {
    switch (node.kind) {
      case "img":
      case "icon":
      case "shape":
      case "text":
      case "stack":
      case "grid":
        return true;
      case "overlay":
        return (
          (0, runtime.isFlowContainer)(node.base) &&
          node.base.place === undefined
        );
      default:
        return false;
    }
  }
  function isMediaSizeNode(node: SlideNode): node is MediaSizeNode {
    return node.kind === "img" || node.kind === "icon" || node.kind === "shape";
  }
  function nodeSupportsSelfAlignment(
    node: SlideNode,
    property: "alignSelf" | "justifySelf",
  ): boolean {
    if (node.kind === "img" || node.kind === "overlay") {
      return false;
    }
    if (property === "alignSelf" && node.kind === "table") {
      return false;
    }
    return true;
  }
  function nodeExplicitAxisSize(
    node: SlideNode,
    axis: SlideAxisName,
  ): number | undefined {
    if (isMediaSizeNode(node)) {
      if (axis === "x") {
        return node.w;
      } else {
        return node.h;
      }
    }
    let place: NodePlacement | undefined = node.place;
    if (axis === "y") {
      return place?.minH;
    }
    if (place?.minW !== undefined && place.minW === place.maxW) {
      return place.minW;
    } else {
      return undefined;
    }
  }
  function nodeSupportsIntrinsicSizing(node: SlideNode): boolean {
    return node.kind !== "icon" && node.kind !== "shape";
  }
  function nodeHasIntrinsicSize(node: SlideNode, axis: SlideAxisName): boolean {
    if (
      node.kind === "html" ||
      node.kind === "spacer" ||
      !nodeSupportsIntrinsicSizing(node)
    ) {
      return false;
    }
    if (node.kind === "text") {
      return node.text.trim() !== "";
    }
    if (node.kind === "overlay") {
      return nodeAxisHasSize(node.base, axis);
    }
    if (!(0, runtime.isFlowContainer)(node)) {
      return true;
    }
    return (
      (node.kind === "grid"
        ? axis === "x"
          ? node.columns
          : (node.rows ?? [])
        : []
      ).some(
        (input: GridTrack): boolean =>
          typeof input === "object" && "px" in input,
      ) ||
      node.children.some((input: SlideNode): boolean =>
        canResizeNodeAxis(input, axis, node),
      )
    );
  }
  function canResizeNodeAxis(
    node: SlideNode,
    axis: SlideAxisName,
    parent: FlowContainerNode,
  ): boolean {
    if (node.kind === "spacer") {
      return false;
    }
    if (nodeAxisHasSize(node, axis)) {
      return true;
    }
    if (node.kind === "icon" || node.kind === "shape") {
      return !(axis === "x" && node.kind === "shape" && node.shape === "line");
    }
    let place: NodePlacement | undefined = node.place,
      value: boolean = parent.kind === "stack" && parent.dir === "h";
    if (axis === "x") {
      return (
        place?.minW !== undefined ||
        (value && (place?.basis ?? 0) > 0 && place?.shrink === 0)
      );
    }
    if (parent.kind === "stack" && !value && (place?.basis ?? 0) > 0) {
      return true;
    }
    return (
      place?.aspect !== undefined &&
      (nodeExplicitAxisSize(node, "x") !== undefined ||
        place.minW !== undefined ||
        !value ||
        (place.grow ?? 0) > 0)
    );
  }
  function clearPlacementForExplicitSize(
    placement: NodePlacement,
    axis: SlideAxisName,
    mainAxis: SlideAxisName | undefined,
  ): void {
    clearPlacementAxisConstraints(placement, axis);
    if (axis === "y") {
      delete placement.aspect;
    }
    if (axis === mainAxis) {
      delete placement.grow;
      delete placement.basis;
    }
  }
  function setNodeAxisSize(
    node: SlideNode,
    axis: SlideAxisName,
    size: number | undefined,
    parentDirection: SlideAxisName | undefined,
  ): SlideNode {
    if (!nodeSupportsSizing(node)) {
      return node;
    }
    let state: NodePlacement = {
      ...node.place,
    };
    if (isMediaSizeNode(node)) {
      let state2: MediaSizeNode = {
        ...node,
      };
      if (axis === "x") {
        if (size === undefined) {
          delete state2.w;
        } else {
          state2.w = size;
        }
      } else if (size === undefined) {
        delete state2.h;
      } else {
        state2.h = size;
      }
      if (size === undefined && state2.kind === "img") {
        delete state2.crop;
      }
      if (size !== undefined) {
        clearPlacementForExplicitSize(state, axis, parentDirection);
        if (axis === parentDirection) {
          state.shrink = 0;
        }
      } else if (axis === parentDirection) {
        if (state.shrink === 0) {
          delete state.shrink;
        }
        if (state.grow === 0) {
          delete state.grow;
        }
      }
      return setNodePlacement(state2, state);
    }
    if (size === undefined) {
      if (axis === "x") {
        delete state.minW;
        delete state.maxW;
      } else if (state.maxH === state.minH) {
        clearPlacementAxisConstraints(state, "y");
      } else {
        delete state.minH;
      }
      return setNodePlacement(node, state);
    }
    clearPlacementForExplicitSize(state, axis, parentDirection);
    if (axis === "x") {
      state.minW = state.maxW = size;
    } else {
      state.minH = size;
    }
    return setNodePlacement(node, state);
  }
  function setNodeAxisIntrinsicSize(
    node: SlideNode,
    axis: SlideAxisName,
    size: number | undefined,
    parentDirection: SlideAxisName | undefined,
  ): SlideNode {
    if (!nodeSupportsSizing(node)) {
      return node;
    }
    if (size !== undefined && (isMediaSizeNode(node) || axis === "x")) {
      return setNodeAxisSize(node, axis, size, parentDirection);
    }
    let value: SlideNode = isMediaSizeNode(node)
        ? setNodeAxisSize(node, axis, undefined, parentDirection)
        : node,
      state: NodePlacement = {
        ...value.place,
      };
    if (size === undefined) {
      if (
        axis === "x" &&
        state.minW !== undefined &&
        state.minW === state.maxW
      ) {
        delete state.minW;
        delete state.maxW;
      }
      if (
        axis === "y" &&
        state.minH !== undefined &&
        state.minH === state.maxH
      ) {
        delete state.minH;
        delete state.maxH;
      }
      return setNodePlacement(value, state);
    }
    clearPlacementForExplicitSize(state, "y", parentDirection);
    state.minH = state.maxH = size;
    return setNodePlacement(node, state);
  }
  function clearPlacementAxisConstraints(
    placement: NodePlacement,
    axis: SlideAxisName,
  ): void {
    if (axis === "x") {
      delete placement.minW;
      delete placement.maxW;
      delete placement.minWFit;
    } else {
      delete placement.minH;
      delete placement.maxH;
    }
  }
  function setNodePlacement(
    node: SlideNode,
    placement: NodePlacement,
  ): SlideNode {
    let state: SlideNode = {
      ...node,
    };
    if (Object.keys(placement).length === 0) {
      delete state.place;
    } else {
      state.place = placement;
    }
    return state;
  }
  function resizeNodeFromEdges(
    node: SlideNode,
    resize: NodeEdgeResize,
    minimumWidth: number = minimumObjectSize,
    minimumHeight: number = minimumWidth,
  ): SlideNode {
    let callback = (input: number, options: number, context: number): number =>
        Math.round(
          Math.min(Math.max(context, options), Math.max(options, input)),
        ),
      value: SlideNode = node;
    if (resize.xEdge !== null) {
      let value2: number =
        resize.w + (resize.xEdge === "far" ? resize.dx : -resize.dx);
      value = setNodeAxisSize(
        value,
        "x",
        callback(value2, minimumWidth, Math.max(runtime.SLIDE_WIDTH, resize.w)),
        resize.mainAxis,
      );
    }
    if (resize.yEdge !== null) {
      let value2: number = callback(
          resize.h + (resize.yEdge === "far" ? resize.dy : -resize.dy),
          minimumHeight,
          Math.max(runtime.SLIDE_HEIGHT, resize.h),
        ),
        place: NodePlacement | undefined = node.place,
        value3: boolean =
          place?.maxH !== undefined && place.maxH <= resize.h + 1,
        value4: boolean =
          resize.mainAxis === "y" &&
          place?.basis !== undefined &&
          Math.abs(place.basis - resize.h) <= 1;
      if (!isMediaSizeNode(node) && (value3 || value4)) {
        let state: NodePlacement = {
          ...value.place,
        };
        clearPlacementForExplicitSize(state, "y", resize.mainAxis);
        state.minH = state.maxH = value2;
        return setNodePlacement(value, state);
      }
      let value5: boolean =
        (nodeExplicitAxisSize(node, "y") ?? 0) >= resize.h - 1 ||
        place?.aspect !== undefined ||
        (resize.mainAxis === "y" &&
          ((place?.grow ?? 0) > 0 || place?.basis !== undefined));
      if (
        isMediaSizeNode(node) ||
        Math.round(value2) > Math.round(resize.h) ||
        value5
      ) {
        value = setNodeAxisSize(value, "y", value2, resize.mainAxis);
      }
    }
    return value;
  }
  function aspectRatioResizeDeltas(
    resize: NodeEdgeResize,
    minimumSize: number = minimumObjectSize,
  ): AxisDeltas {
    if (
      resize.xEdge === null ||
      resize.yEdge === null ||
      resize.w <= 0 ||
      resize.h <= 0
    ) {
      return {
        dx: resize.dx,
        dy: resize.dy,
      };
    }
    let value: number = resize.xEdge === "far" ? resize.dx : -resize.dx,
      value2: number = resize.yEdge === "far" ? resize.dy : -resize.dy,
      value3: number = (resize.w + value) / resize.w,
      value4: number = (resize.h + value2) / resize.h,
      value5: number = Math.max(value3, value4);
    value5 = Math.min(
      value5,
      Math.max(runtime.SLIDE_WIDTH, resize.w) / resize.w,
      Math.max(runtime.SLIDE_HEIGHT, resize.h) / resize.h,
    );
    value5 = Math.max(
      value5,
      resize.w > minimumSize ? minimumSize / resize.w : 0,
      resize.h > minimumSize ? minimumSize / resize.h : 0,
    );
    let callback = (input: ResizeEdge, options: number): number =>
      input === "far" ? (value5 - 1) * options : (1 - value5) * options;
    return {
      dx: value5 === value3 ? resize.dx : callback(resize.xEdge, resize.w),
      dy: value5 === value4 ? resize.dy : callback(resize.yEdge, resize.h),
    };
  }
  function aspectRatioAxisResizeDeltas(
    xResize: AxisResize,
    yResize: AxisResize,
    minimumSize: number = minimumObjectSize,
  ): AxisDeltas {
    let value: number = axisSpecSize(
        xResize.spec,
        xResize.currentSize,
        xResize.designSize,
      ),
      value2: number = axisSpecSize(
        yResize.spec,
        yResize.currentSize,
        yResize.designSize,
      );
    if (value <= 0 || value2 <= 0) {
      return {
        dx: xResize.delta,
        dy: yResize.delta,
      };
    }
    let callback = (input: AxisResize): number =>
        input.edge === "far" ? input.delta : -input.delta,
      value3: number = (value + callback(xResize)) / value,
      value4: number = (value2 + callback(yResize)) / value2,
      value5: number = Math.max(value3, value4);
    value5 = Math.min(
      value5,
      (value + axisResizeTravelLimit(xResize)) / value,
      (value2 + axisResizeTravelLimit(yResize)) / value2,
    );
    value5 = Math.max(
      value5,
      value > minimumSize ? minimumSize / value : 0,
      value2 > minimumSize ? minimumSize / value2 : 0,
    );
    let callback2 = (input: AxisResize, options: number): number =>
      input.edge === "far" ? (value5 - 1) * options : (1 - value5) * options;
    return {
      dx: value5 === value3 ? xResize.delta : callback2(xResize, value),
      dy: value5 === value4 ? yResize.delta : callback2(yResize, value2),
    };
  }
  function axisResizeTravelLimit({
    spec: spec,
    edge: edge,
  }: Pick<AxisResize, "spec" | "edge">): number {
    if (spec.anchor === "center") {
      return 1 / 0;
    }
    if (spec.anchor === "trailing") {
      if (edge === "far") {
        return spec.margin;
      } else {
        return 1 / 0;
      }
    }
    if (edge === "near") {
      return spec.margin;
    } else {
      return 1 / 0;
    }
  }
  function pointInRotatedRect(
    rect: RotatedSlideRect,
    x: number,
    y: number,
  ): boolean {
    let value: number = rect.rotation ?? 0,
      value2: number = x - (rect.x + rect.w / 2),
      value3: number = y - (rect.y + rect.h / 2),
      value4: number = value2 * Math.cos(value) + value3 * Math.sin(value),
      value5: number = -value2 * Math.sin(value) + value3 * Math.cos(value);
    return Math.abs(value4) <= rect.w / 2 && Math.abs(value5) <= rect.h / 2;
  }
  function rotatedRectBounds_Rn(rect: RotatedSlideRect): SlideRect {
    let value: number = rect.rotation ?? 0,
      value2: number = Math.abs(Math.cos(value)),
      value3: number = Math.abs(Math.sin(value)),
      value4: number = rect.w * value2 + rect.h * value3,
      value5: number = rect.w * value3 + rect.h * value2;
    return {
      x: rect.x + (rect.w - value4) / 2,
      y: rect.y + (rect.h - value5) / 2,
      w: value4,
      h: value5,
    };
  }
  function screenDeltaToLocalDelta(
    deltaX: number,
    deltaY: number,
    rotation: number,
    scale: number,
  ): AxisDeltas {
    let value: number = Math.cos(rotation),
      value2: number = Math.sin(rotation);
    return {
      dx: (deltaX * value + deltaY * value2) / scale,
      dy: (-deltaX * value2 + deltaY * value) / scale,
    };
  }
  function snapRotation(
    rotation: number,
    delta: number,
    snap: boolean,
  ): number {
    let value: number = rotation + delta;
    if (snap) {
      value = Math.round(value / 15) * 15;
    } else {
      let value3: number = Math.round(value / 90) * 90;
      if (Math.abs(value - value3) <= 3) {
        value = value3;
      }
    }
    let value2: number =
      ((((Math.round(value) + 180) % 360) + 360) % 360) - 180;
    if (value2 === -180) {
      return 180;
    } else {
      return value2;
    }
  }
  function angleBetweenPoints(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): number {
    return (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI;
  }
  function moveFillAxisAsPinned(
    axis: Axis,
    delta: number,
    designSize: number,
  ): Axis {
    if (axis.anchor !== "fill" || Math.abs(delta) < 0.000000001) {
      return moveAxisSpec(axis, delta);
    }
    let value: number = designSize - 2 * axis.margin;
    return {
      anchor: "leading",
      margin: Math.max(0, axis.margin + delta),
      offset: 0,
      size: value,
    };
  }
  function nodeTransform(node?: SlideNode): TransformValue | undefined {
    if (node?.kind === "shape") {
      if (node.rotate !== undefined && node.rotate !== 0) {
        return {
          rotate: node.rotate,
        };
      } else {
        return undefined;
      }
    }
    let value: TransformValue | undefined = node?.style?.transform;
    if (value === undefined) {
      return;
    }
    if (
      (value.rotate ?? 0) !== 0 ||
      (value.scale ?? 1) !== 1 ||
      !!value.skewX ||
      !!value.skewY ||
      !!value.translateX ||
      !!value.translateY
    ) {
      return value;
    } else {
      return undefined;
    }
  }
  function axisSpecCenter(
    axis: Axis,
    designSize: number,
    intrinsicSize: number,
  ): number {
    let value: AxisExtent = resolveAxisSpec(axis, designSize, intrinsicSize);
    return value.start + value.size / 2;
  }
  function transformPositionCompensation(
    deltaX: number,
    deltaY: number,
    rotation: number,
    scale: number,
  ): AxisDeltas {
    let value: number = Math.cos(rotation),
      value2: number = Math.sin(rotation);
    return {
      dx: scale * (deltaX * value - deltaY * value2) - deltaX,
      dy: scale * (deltaX * value2 + deltaY * value) - deltaY,
    };
  }
  bindRuntimeValue(runtime, "applyAxisSpecCss", () => applyAxisSpecCss);
  bindRuntimeValue(runtime, "framePositionCss", () => framePositionCss);
  bindRuntimeValue(runtime, "resolveAxisSpec", () => resolveAxisSpec);
  bindRuntimeValue(runtime, "frameBounds", () => frameBounds);
  bindRuntimeValue(runtime, "moveAxisSpec", () => moveAxisSpec);
  bindRuntimeValue(runtime, "isTextNode", () => isTextNode);
  bindRuntimeValue(
    runtime,
    "implicitAxisAnchorPosition",
    () => implicitAxisAnchorPosition,
  );
  bindRuntimeValue(
    runtime,
    "preserveImplicitAxisSize",
    () => preserveImplicitAxisSize,
  );
  bindRuntimeValue(
    runtime,
    "moveAxisSpecPreservingSize",
    () => moveAxisSpecPreservingSize,
  );
  bindRuntimeValue(
    runtime,
    "minimumNodeResizeSize",
    () => minimumNodeResizeSize,
  );
  bindRuntimeValue(runtime, "axisSpecSize", () => axisSpecSize);
  bindRuntimeValue(runtime, "resizeAxisSpec", () => resizeAxisSpec);
  bindRuntimeValue(runtime, "axisSpecFromRect", () => axisSpecFromRect);
  bindRuntimeValue(runtime, "nodeSupportsSizing", () => nodeSupportsSizing);
  bindRuntimeValue(runtime, "isMediaSizeNode", () => isMediaSizeNode);
  bindRuntimeValue(
    runtime,
    "nodeSupportsSelfAlignment",
    () => nodeSupportsSelfAlignment,
  );
  bindRuntimeValue(runtime, "nodeExplicitAxisSize", () => nodeExplicitAxisSize);
  bindRuntimeValue(
    runtime,
    "nodeSupportsIntrinsicSizing",
    () => nodeSupportsIntrinsicSizing,
  );
  bindRuntimeValue(runtime, "nodeHasIntrinsicSize", () => nodeHasIntrinsicSize);
  bindRuntimeValue(runtime, "canResizeNodeAxis", () => canResizeNodeAxis);
  bindRuntimeValue(
    runtime,
    "clearPlacementForExplicitSize",
    () => clearPlacementForExplicitSize,
  );
  bindRuntimeValue(runtime, "setNodeAxisSize", () => setNodeAxisSize);
  bindRuntimeValue(
    runtime,
    "setNodeAxisIntrinsicSize",
    () => setNodeAxisIntrinsicSize,
  );
  bindRuntimeValue(
    runtime,
    "clearPlacementAxisConstraints",
    () => clearPlacementAxisConstraints,
  );
  bindRuntimeValue(runtime, "setNodePlacement", () => setNodePlacement);
  bindRuntimeValue(runtime, "resizeNodeFromEdges", () => resizeNodeFromEdges);
  bindRuntimeValue(
    runtime,
    "aspectRatioResizeDeltas",
    () => aspectRatioResizeDeltas,
  );
  bindRuntimeValue(
    runtime,
    "aspectRatioAxisResizeDeltas",
    () => aspectRatioAxisResizeDeltas,
  );
  bindRuntimeValue(
    runtime,
    "axisResizeTravelLimit",
    () => axisResizeTravelLimit,
  );
  bindRuntimeValue(runtime, "pointInRotatedRect", () => pointInRotatedRect);
  bindRuntimeValue(runtime, "rotatedRectBounds_Rn", () => rotatedRectBounds_Rn);
  bindRuntimeValue(
    runtime,
    "screenDeltaToLocalDelta",
    () => screenDeltaToLocalDelta,
  );
  bindRuntimeValue(runtime, "snapRotation", () => snapRotation);
  bindRuntimeValue(runtime, "angleBetweenPoints", () => angleBetweenPoints);
  bindRuntimeValue(runtime, "moveFillAxisAsPinned", () => moveFillAxisAsPinned);
  bindRuntimeValue(runtime, "nodeTransform", () => nodeTransform);
  bindRuntimeValue(runtime, "axisSpecCenter", () => axisSpecCenter);
  bindRuntimeValue(
    runtime,
    "transformPositionCompensation",
    () => transformPositionCompensation,
  );
  bindRuntimeValue(
    runtime,
    "minimumObjectSize",
    () => minimumObjectSize,
    (value) => {
      minimumObjectSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "axisSpecsAreSized",
    () => axisSpecsAreSized,
    (value) => {
      axisSpecsAreSized = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shouldPreserveMediaAspect",
    () => shouldPreserveMediaAspect,
    (value) => {
      shouldPreserveMediaAspect = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "nodeAxisHasSize",
    () => nodeAxisHasSize,
    (value) => {
      nodeAxisHasSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeModelGeometry",
    () => initializeModelGeometry,
    (value) => {
      initializeModelGeometry = value;
    },
  );
  return () => {
    minimumObjectSize = 24;
    axisSpecsAreSized = (input: Axis, options: Axis): boolean =>
      [input, options].every(
        (input2: Axis): boolean =>
          input2.anchor === "fill" || input2.size !== undefined,
      );
    shouldPreserveMediaAspect = (
      input: MediaSizeNode,
      options: boolean,
      context: boolean,
    ): boolean =>
      context ? input.w !== undefined && input.h !== undefined : options;
    nodeAxisHasSize = (input: SlideNode, options: SlideAxisName): boolean =>
      nodeExplicitAxisSize(input, options) !== undefined ||
      nodeHasIntrinsicSize(input, options);
    initializeModelGeometry = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
    });
  };
}
