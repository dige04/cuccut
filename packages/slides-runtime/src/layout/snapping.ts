/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { Axis, Frame } from "../deck-contracts";

/** Slide axis a snap guide lives on. */
export type SnapAxis = "x" | "y";
/** Edge of a moving box that is compared against the guides. */
export type SnapLine = "near" | "center" | "far";
/** What a guide candidate is anchored to. */
export type SnapGuideKind =
  | "slide-edge"
  | "slide-center"
  | "margin"
  | "sibling-edge"
  | "sibling-center";
/** A guide position the moving box may snap to. */
export interface SnapCandidate {
  axis: SnapAxis;
  pos: number;
  kind: SnapGuideKind;
  label?: string;
}
/** Axis-aligned box in slide coordinates. */
export interface SnapRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** One edge/center of the moving box and its current coordinate. */
export interface SnapMovingLine {
  line: SnapLine;
  value: number;
}
/** The guide a box line snapped to. */
export interface AxisSnap {
  line: SnapLine;
  candidate: SnapCandidate;
}
/** Snap result per axis. */
export interface AxisSnaps {
  x?: AxisSnap;
  y?: AxisSnap;
}
/** Closest snap found on one axis. */
export interface SnapMatch {
  adjust: number;
  dist: number;
  snap: AxisSnap;
}
/** Outcome of snapping a moved or resized rectangle. */
export interface SnapResult {
  dx: number;
  dy: number;
  snaps: AxisSnaps;
  guides: SnapCandidate[];
}
/** Which axes take part in snapping. */
export interface SnapAxisToggles {
  x: boolean;
  y: boolean;
}
/** Connector attachment point a line end can snap to. */
export interface SnapAttachmentPoint {
  x: number;
  y: number;
}
/** Point in slide coordinates. */
export type SnapPoint = readonly [number, number];
/** Result of snapping the free end of a line. */
export interface SnapLineEndpointResult {
  point: [number, number];
  site: SnapAttachmentPoint | null;
}

declare module "../bindings" {
  interface RuntimeBindings {
    SNAP_SLIDE_MARGIN: number;
    SNAP_GUIDE_PRIORITY: Record<SnapGuideKind, number>;
    SNAP_DISTANCE_TIE_EPSILON: number;
    buildSlideSnapCandidates: (axis: SnapAxis) => SnapCandidate[];
    buildSiblingSnapCandidates: (
      siblings: readonly SnapRect[],
    ) => SnapCandidate[];
    snapLineMatchesGuide: (line: SnapLine, guideKind: SnapGuideKind) => boolean;
    findClosestSnap: (
      candidates: readonly SnapCandidate[],
      axis: SnapAxis,
      movingLines: readonly SnapMovingLine[],
      threshold: number,
    ) => SnapMatch | undefined;
    snapMovingRectangle: (
      rect: SnapRect,
      dx: number,
      dy: number,
      candidates: readonly SnapCandidate[],
      threshold: number,
      enabledAxes?: SnapAxisToggles,
    ) => SnapResult;
    snapResizingRectangle: (
      rect: SnapRect,
      xHandle: "near" | "far" | null | undefined,
      yHandle: "near" | "far" | null | undefined,
      dx: number,
      dy: number,
      candidates: readonly SnapCandidate[],
      threshold: number,
    ) => SnapResult;
    preserveExplicitAxisSize: (axis: Axis, previousAxis: Axis) => Axis;
    applyAxisSnapAnchor: (
      axis: Axis,
      snap: AxisSnap | undefined,
      extent: number,
    ) => Axis;
    applyFrameSnapAnchors: (frame: Frame, snaps: AxisSnaps) => Frame;
    snapLineEndpoint: (
      start: SnapPoint,
      end: SnapPoint,
      candidates: readonly SnapAttachmentPoint[],
      threshold: number,
      constrainAngle: boolean | undefined,
    ) => SnapLineEndpointResult;
  }
}

export function installLayoutSnapping(runtime: RuntimeBindings): () => void {
  var SNAP_SLIDE_MARGIN: RuntimeBindings["SNAP_SLIDE_MARGIN"];
  var SNAP_GUIDE_PRIORITY: RuntimeBindings["SNAP_GUIDE_PRIORITY"];
  var SNAP_DISTANCE_TIE_EPSILON: RuntimeBindings["SNAP_DISTANCE_TIE_EPSILON"];
  function buildSlideSnapCandidates(axis: SnapAxis): SnapCandidate[] {
    let extent: number =
      axis === "x" ? runtime.SLIDE_WIDTH : runtime.SLIDE_HEIGHT;
    return [
      {
        axis: axis,
        pos: 0,
        kind: "slide-edge",
      },
      {
        axis: axis,
        pos: extent,
        kind: "slide-edge",
      },
      {
        axis: axis,
        pos: extent / 2,
        kind: "slide-center",
        label: "center",
      },
      {
        axis: axis,
        pos: SNAP_SLIDE_MARGIN,
        kind: "margin",
        label: "margin " + String(SNAP_SLIDE_MARGIN),
      },
      {
        axis: axis,
        pos: extent - SNAP_SLIDE_MARGIN,
        kind: "margin",
        label: "margin " + String(SNAP_SLIDE_MARGIN),
      },
    ];
  }
  function buildSiblingSnapCandidates(
    siblings: readonly SnapRect[],
  ): SnapCandidate[] {
    let candidates: SnapCandidate[] = [
      ...buildSlideSnapCandidates("x"),
      ...buildSlideSnapCandidates("y"),
    ];
    for (let value of siblings)
      candidates.push(
        {
          axis: "x",
          pos: value.x,
          kind: "sibling-edge",
        },
        {
          axis: "x",
          pos: value.x + value.w / 2,
          kind: "sibling-center",
        },
        {
          axis: "x",
          pos: value.x + value.w,
          kind: "sibling-edge",
        },
        {
          axis: "y",
          pos: value.y,
          kind: "sibling-edge",
        },
        {
          axis: "y",
          pos: value.y + value.h / 2,
          kind: "sibling-center",
        },
        {
          axis: "y",
          pos: value.y + value.h,
          kind: "sibling-edge",
        },
      );
    return candidates;
  }
  function snapLineMatchesGuide(
    line: SnapLine,
    guideKind: SnapGuideKind,
  ): boolean {
    let isCenterGuide: boolean =
      guideKind === "slide-center" || guideKind === "sibling-center";
    if (line === "center") {
      return isCenterGuide;
    } else {
      return !isCenterGuide;
    }
  }
  function findClosestSnap(
    candidates: readonly SnapCandidate[],
    axis: SnapAxis,
    movingLines: readonly SnapMovingLine[],
    threshold: number,
  ): SnapMatch | undefined {
    let matches: SnapMatch[] = [];
    for (let value3 of candidates) {
      if (value3.axis !== axis) {
        continue;
      }
      for (let value4 of movingLines) {
        if (!snapLineMatchesGuide(value4.line, value3.kind)) {
          continue;
        }
        let value5: number = value3.pos - value4.value,
          value6: number = Math.abs(value5);
        if (value6 <= threshold) {
          matches.push({
            adjust: value5,
            dist: value6,
            snap: {
              line: value4.line,
              candidate: value3,
            },
          });
        }
      }
    }
    let value: number = Math.min(
        ...matches.map((input: SnapMatch): number => input.dist),
      ),
      value2: SnapMatch | undefined;
    for (let value3 of matches) {
      if (value3.dist - value > SNAP_DISTANCE_TIE_EPSILON) {
        continue;
      }
      if (value2 === undefined) {
        value2 = value3;
      } else {
        let value4: number =
          SNAP_GUIDE_PRIORITY[value2.snap.candidate.kind] -
          SNAP_GUIDE_PRIORITY[value3.snap.candidate.kind];
        if (value4 > 0 || (value4 === 0 && value3.dist < value2.dist)) {
          value2 = value3;
        }
      }
    }
    return value2;
  }
  function snapMovingRectangle(
    rect: SnapRect,
    dx: number,
    dy2: number,
    candidates: readonly SnapCandidate[],
    threshold: number,
    enabledAxes: SnapAxisToggles = {
      x: true,
      y: true,
    },
  ): SnapResult {
    let result: SnapResult = {
      dx: dx,
      dy: dy2,
      snaps: {},
      guides: [],
    };
    if (enabledAxes.x) {
      let value: number = rect.x + dx,
        value2: SnapMatch | undefined = findClosestSnap(
          candidates,
          "x",
          [
            {
              line: "near",
              value: value,
            },
            {
              line: "center",
              value: value + rect.w / 2,
            },
            {
              line: "far",
              value: value + rect.w,
            },
          ],
          threshold,
        );
      if (value2) {
        result.dx = dx + value2.adjust;
        result.snaps.x = value2.snap;
        result.guides.push(value2.snap.candidate);
      }
    }
    if (enabledAxes.y) {
      let value: number = rect.y + dy2,
        value2: SnapMatch | undefined = findClosestSnap(
          candidates,
          "y",
          [
            {
              line: "near",
              value: value,
            },
            {
              line: "center",
              value: value + rect.h / 2,
            },
            {
              line: "far",
              value: value + rect.h,
            },
          ],
          threshold,
        );
      if (value2) {
        result.dy = dy2 + value2.adjust;
        result.snaps.y = value2.snap;
        result.guides.push(value2.snap.candidate);
      }
    }
    return result;
  }
  function snapResizingRectangle(
    rect: SnapRect,
    xHandle: "near" | "far" | null | undefined,
    yHandle: "near" | "far" | null | undefined,
    dx: number,
    dy2: number,
    candidates: readonly SnapCandidate[],
    threshold: number,
  ): SnapResult {
    let result: SnapResult = {
      dx: dx,
      dy: dy2,
      snaps: {},
      guides: [],
    };
    if (xHandle) {
      let value: number =
          xHandle === "near" ? rect.x + dx : rect.x + rect.w + dx,
        value2: SnapMatch | undefined = findClosestSnap(
          candidates,
          "x",
          [
            {
              line: xHandle,
              value: value,
            },
          ],
          threshold,
        );
      if (value2) {
        result.dx = dx + value2.adjust;
        result.guides.push(value2.snap.candidate);
      }
    }
    if (yHandle) {
      let value: number =
          yHandle === "near" ? rect.y + dy2 : rect.y + rect.h + dy2,
        value2: SnapMatch | undefined = findClosestSnap(
          candidates,
          "y",
          [
            {
              line: yHandle,
              value: value,
            },
          ],
          threshold,
        );
      if (value2) {
        result.dy = dy2 + value2.adjust;
        result.guides.push(value2.snap.candidate);
      }
    }
    return result;
  }
  function preserveExplicitAxisSize(axis: Axis, previousAxis: Axis): Axis {
    if (previousAxis.size !== undefined) {
      return {
        ...axis,
        size: previousAxis.size,
      };
    } else {
      return axis;
    }
  }
  function applyAxisSnapAnchor(
    axis: Axis,
    snap: AxisSnap | undefined,
    extent: number,
  ): Axis {
    if (!snap || axis.anchor === "fill") {
      return axis;
    }
    let { line: line, candidate: candidate }: AxisSnap = snap;
    if (
      candidate.kind === "sibling-edge" ||
      candidate.kind === "sibling-center"
    ) {
      return axis;
    }
    if (line === "center" && candidate.kind === "slide-center") {
      return preserveExplicitAxisSize(
        {
          anchor: "center",
          margin: 0,
          offset: 0,
        },
        axis,
      );
    }
    if (
      line === "near" &&
      (candidate.kind === "slide-edge" || candidate.kind === "margin")
    ) {
      if (candidate.pos >= extent) {
        return axis;
      }
      return preserveExplicitAxisSize(
        {
          anchor: "leading",
          margin: candidate.pos,
          offset: 0,
        },
        axis,
      );
    }
    if (
      line === "far" &&
      (candidate.kind === "slide-edge" || candidate.kind === "margin")
    ) {
      if (candidate.pos <= 0) {
        return axis;
      }
      return preserveExplicitAxisSize(
        {
          anchor: "trailing",
          margin: extent - candidate.pos,
          offset: 0,
        },
        axis,
      );
    }
    return axis;
  }
  function applyFrameSnapAnchors(frame: Frame, snaps: AxisSnaps): Frame {
    let x: Axis = applyAxisSnapAnchor(frame.x, snaps.x, runtime.SLIDE_WIDTH),
      y: Axis = applyAxisSnapAnchor(frame.y, snaps.y, runtime.SLIDE_HEIGHT);
    if (x === frame.x && y === frame.y) {
      return frame;
    }
    return {
      ...frame,
      x: x,
      y: y,
    };
  }
  function snapLineEndpoint(
    start: SnapPoint,
    end: SnapPoint,
    candidates: readonly SnapAttachmentPoint[],
    threshold: number,
    constrainAngle: boolean | undefined,
  ): SnapLineEndpointResult {
    if (constrainAngle) {
      let value2: number = end[0] - start[0],
        value3: number = end[1] - start[1],
        value4: number = Math.hypot(value2, value3),
        value5: number =
          Math.round(Math.atan2(value3, value2) / (Math.PI / 4)) *
          (Math.PI / 4);
      return {
        point: [
          start[0] + value4 * Math.cos(value5),
          start[1] + value4 * Math.sin(value5),
        ],
        site: null,
      };
    }
    let value: SnapAttachmentPoint | null = (0, runtime.nearestAttachmentPoint)(
      candidates,
      end[0],
      end[1],
      threshold,
    );
    if (value) {
      return {
        point: [value.x, value.y],
        site: value,
      };
    } else {
      return {
        point: [end[0], end[1]],
        site: null,
      };
    }
  }
  bindRuntimeValue(
    runtime,
    "SNAP_SLIDE_MARGIN",
    () => SNAP_SLIDE_MARGIN,
    (value) => {
      SNAP_SLIDE_MARGIN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SNAP_GUIDE_PRIORITY",
    () => SNAP_GUIDE_PRIORITY,
    (value) => {
      SNAP_GUIDE_PRIORITY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buildSlideSnapCandidates",
    () => buildSlideSnapCandidates,
  );
  bindRuntimeValue(
    runtime,
    "buildSiblingSnapCandidates",
    () => buildSiblingSnapCandidates,
  );
  bindRuntimeValue(
    runtime,
    "SNAP_DISTANCE_TIE_EPSILON",
    () => SNAP_DISTANCE_TIE_EPSILON,
    (value) => {
      SNAP_DISTANCE_TIE_EPSILON = value;
    },
  );
  bindRuntimeValue(runtime, "snapLineMatchesGuide", () => snapLineMatchesGuide);
  bindRuntimeValue(runtime, "findClosestSnap", () => findClosestSnap);
  bindRuntimeValue(runtime, "snapMovingRectangle", () => snapMovingRectangle);
  bindRuntimeValue(
    runtime,
    "snapResizingRectangle",
    () => snapResizingRectangle,
  );
  bindRuntimeValue(
    runtime,
    "preserveExplicitAxisSize",
    () => preserveExplicitAxisSize,
  );
  bindRuntimeValue(runtime, "applyAxisSnapAnchor", () => applyAxisSnapAnchor);
  bindRuntimeValue(
    runtime,
    "applyFrameSnapAnchors",
    () => applyFrameSnapAnchors,
  );
  bindRuntimeValue(runtime, "snapLineEndpoint", () => snapLineEndpoint);
  return () => {
    (0, runtime.initializeModelSelection)();
    (0, runtime.initializeObjectNavigation)();
    (0, runtime.initializeSlideModel)();
    SNAP_SLIDE_MARGIN = 128;
    SNAP_GUIDE_PRIORITY = {
      "slide-center": 0,
      "slide-edge": 1,
      margin: 2,
      "sibling-center": 3,
      "sibling-edge": 4,
    };
    SNAP_DISTANCE_TIE_EPSILON = 0.5;
  };
}
