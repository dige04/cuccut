/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { CommentAnchorBox } from "./anchors";

/** A rectangle given by its origin and size; the unit (pixels or fractions of a board) is up to the caller. */
export interface CommentUnitRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** A point, in the same unit as the rectangles it is compared with. */
export interface CommentUnitPoint {
  x: number;
  y: number;
}
/** A board (the surface being commented on) and the frame placed on it, both as unit rectangles. */
export interface CommentAreaHost {
  board: CommentUnitRect;
  frame: CommentUnitRect;
}
/** How much of a host an area covers: the overlap, its share of the frame and the same box relative to the frame. */
export interface CommentAreaHostMatch extends CommentAreaHost {
  /** The part of the area that lies inside the frame. */
  inter: CommentUnitRect;
  /** Share of the frame's size that `inter` covers. */
  cov: number;
  /** `inter` as fractions of the frame. */
  b: CommentAnchorBox;
}
/** An element that can be commented on, with its rectangle on the board. */
export interface CommentAreaElement<T> {
  el: T;
  rect: CommentUnitRect;
}
/** The elements a marquee area encloses (`enclosing`, the smallest one that fits it) and those it covers. */
export interface CommentAreaCoverage<T> {
  enclosing: T | null;
  covered: T[];
}
/** One async comment round trip; `live` turns false once a newer one began or the token was cancelled. */
export interface CommentOperation {
  readonly live: boolean;
}
/** Hands out `CommentOperation`s and cancels the outstanding one, so late async results can be ignored. */
export interface CommentOperationToken {
  begin(): CommentOperation;
  cancel(): void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    /** Share of a frame an area must cover to count as covering it. */
    COMMENT_AREA_COVERAGE_THRESHOLD: number;
    clampCommentFraction: (input: number) => number;
    intersectCommentRects: (
      input: CommentUnitRect,
      options: CommentUnitRect,
    ) => CommentUnitRect | null;
    rankCommentAreaHosts: (
      area: CommentUnitRect,
      hosts: readonly CommentAreaHost[],
      limit?: number,
    ) => CommentAreaHostMatch[];
    commentHostNormalizedBox: (
      host: Pick<CommentAreaHostMatch, "inter" | "frame">,
      nodeRect: CommentUnitRect,
    ) => CommentAnchorBox | null;
    normalizedCommentBoxToRect: (
      rect: CommentUnitRect,
      box: CommentAnchorBox,
    ) => CommentUnitRect;
    nearestCommentBoxCorner: (
      rect: CommentUnitRect,
      point: CommentUnitPoint,
    ) => number;
    commentBoxCornerPoint: (
      rect: CommentUnitRect,
      corner?: number | null,
    ) => CommentUnitPoint;
    describeCommentBoxPart: (box: CommentAnchorBox, coverage: number) => string;
    describeCommentAreaCoverage: <T>(
      area: CommentUnitRect,
      elements: readonly CommentAreaElement<T>[],
      contains: (outer: T, inner: T) => boolean,
    ) => CommentAreaCoverage<T>;
    createCommentOperationToken: () => CommentOperationToken;
  }
}

export function installCommentsAreaGeometry(
  runtime: RuntimeBindings,
): () => void {
  var COMMENT_AREA_COVERAGE_THRESHOLD: number;
  var clampCommentFraction: RuntimeBindings["clampCommentFraction"];
  var intersectCommentRects: RuntimeBindings["intersectCommentRects"];
  function rankCommentAreaHosts(
    area: CommentUnitRect,
    hosts: readonly CommentAreaHost[],
    limit: number = 1 / 0,
  ): CommentAreaHostMatch[] {
    let areaSize = Math.max(0.000001, area.w * area.h),
      matches: CommentAreaHostMatch[] = [];
    hosts.forEach(({ board: board, frame: frame }: CommentAreaHost): void => {
      let value = intersectCommentRects(area, frame);
      if (!value) {
        return;
      }
      let value2 = value.w * value.h,
        value3 = Math.max(0.000001, frame.w * frame.h);
      if (value2 < 0.04 * value3 && value2 < 0.25 * areaSize) {
        return;
      }
      matches.push({
        board: board,
        frame: frame,
        inter: value,
        cov: value2 / value3,
        b: {
          x0: (value.x - frame.x) / frame.w,
          y0: (value.y - frame.y) / frame.h,
          x1: (value.x + value.w - frame.x) / frame.w,
          y1: (value.y + value.h - frame.y) / frame.h,
        },
      });
    });
    if (matches.length <= limit) {
      return matches;
    }
    let values = new Set(
      [...matches]
        .sort(
          (input: CommentAreaHostMatch, options: CommentAreaHostMatch): number =>
            options.inter.w * options.inter.h - input.inter.w * input.inter.h,
        )
        .slice(0, limit),
    );
    return matches.filter((input: CommentAreaHostMatch): boolean =>
      values.has(input),
    );
  }
  function commentHostNormalizedBox(
    host: Pick<CommentAreaHostMatch, "inter" | "frame">,
    nodeRect: CommentUnitRect,
  ): CommentAnchorBox | null {
    if (!(nodeRect.w > 0 && nodeRect.h > 0)) {
      return null;
    }
    let offsetX = host.inter.x - host.frame.x,
      offsetY = host.inter.y - host.frame.y,
      box = {
        x0: clampCommentFraction((offsetX - nodeRect.x) / nodeRect.w),
        y0: clampCommentFraction((offsetY - nodeRect.y) / nodeRect.h),
        x1: clampCommentFraction(
          (offsetX + host.inter.w - nodeRect.x) / nodeRect.w,
        ),
        y1: clampCommentFraction(
          (offsetY + host.inter.h - nodeRect.y) / nodeRect.h,
        ),
      };
    if (box.x1 > box.x0 && box.y1 > box.y0) {
      return box;
    } else {
      return null;
    }
  }
  function normalizedCommentBoxToRect(
    rect: CommentUnitRect,
    box: CommentAnchorBox,
  ): CommentUnitRect {
    return {
      x: rect.x + box.x0 * rect.w,
      y: rect.y + box.y0 * rect.h,
      w: (box.x1 - box.x0) * rect.w,
      h: (box.y1 - box.y0) * rect.h,
    };
  }
  function nearestCommentBoxCorner(
    rect: CommentUnitRect,
    point: CommentUnitPoint,
  ): number {
    let horizontal = point.x > rect.x + rect.w / 2 ? 1 : 0,
      vertical = point.y > rect.y + rect.h / 2 ? 2 : 0;
    return horizontal + vertical;
  }
  function commentBoxCornerPoint(
    rect: CommentUnitRect,
    corner?: number | null,
  ): CommentUnitPoint {
    if (corner == null) {
      return {
        x: rect.x + rect.w / 2,
        y: rect.y + rect.h / 2,
      };
    }
    return {
      x: corner & 1 ? rect.x + rect.w : rect.x,
      y: corner & 2 ? rect.y + rect.h : rect.y,
    };
  }
  function describeCommentBoxPart(
    box: CommentAnchorBox,
    coverage: number,
  ): string {
    if (coverage >= 0.85) {
      return "";
    }
    if (box.x1 <= 0.15) {
      return "left edge";
    }
    if (box.x0 >= 0.85) {
      return "right edge";
    }
    if (box.y1 <= 0.15) {
      return "top edge";
    }
    if (box.y0 >= 0.85) {
      return "bottom edge";
    }
    let value = (box.y0 + box.y1) / 2,
      value2 = (box.x0 + box.x1) / 2,
      value3 =
        box.y1 <= 0.55 && value <= 0.35
          ? "top"
          : box.y0 >= 0.45 && value >= 0.65
            ? "bottom"
            : box.y1 - box.y0 <= 0.5
              ? "middle"
              : "",
      value4 =
        box.x1 <= 0.55 && value2 <= 0.35
          ? "left"
          : box.x0 >= 0.45 && value2 >= 0.65
            ? "right"
            : box.x1 - box.x0 <= 0.5
              ? "centre"
              : "",
      value5 = [value3, value4].filter(Boolean).join(" ");
    if (value5 === "top" || value5 === "bottom") {
      return value5 + " half";
    }
    if (value5 === "left" || value5 === "right") {
      return value5 + " side";
    } else {
      return value5 || "part";
    }
  }
  function describeCommentAreaCoverage<T>(
    area: CommentUnitRect,
    elements: readonly CommentAreaElement<T>[],
    contains: (outer: T, inner: T) => boolean,
  ): CommentAreaCoverage<T> {
    let areaSize = Math.max(0.000001, area.w * area.h),
      covered: { el: T; a: number }[] = [],
      inside: T[] = [];
    for (let { el: value3, rect: value4 } of elements) {
      let value5 = value4.w * value4.h;
      if (!(value5 > 0)) {
        continue;
      }
      let value6 = intersectCommentRects(area, value4),
        value7 = value6 ? value6.w * value6.h : 0;
      if (value7 >= 0.85 * areaSize) {
        covered.push({
          el: value3,
          a: value5,
        });
      }
      if (value7 >= 0.7 * value5) {
        inside.push(value3);
      }
    }
    covered.sort(
      (input: { el: T; a: number }, options: { el: T; a: number }): number =>
        input.a - options.a,
    );
    let value =
        covered.find((input: { el: T; a: number }): boolean =>
          inside.every(
            (input2: T): boolean =>
              input2 === input.el ||
              contains(input.el, input2) ||
              contains(input2, input.el),
          ),
        )?.el ?? null,
      value2 = inside.filter(
        (input: T): boolean =>
          value === null || (input !== value && contains(value, input)),
      );
    if (value2.length === 0 && value !== null && inside.includes(value)) {
      value2 = [value];
    }
    return {
      enclosing: value,
      covered: value2.filter(
        (input: T): boolean =>
          !value2.some(
            (input2: T): boolean =>
              input2 !== input && contains(input2, input),
          ),
      ),
    };
  }
  function createCommentOperationToken(): CommentOperationToken {
    let index = 0;
    return {
      begin(): CommentOperation {
        index += 1;
        let value = index;
        return {
          get live(): boolean {
            return index === value;
          },
        };
      },
      cancel(): void {
        index += 1;
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "COMMENT_AREA_COVERAGE_THRESHOLD",
    () => COMMENT_AREA_COVERAGE_THRESHOLD,
    (value) => {
      COMMENT_AREA_COVERAGE_THRESHOLD = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clampCommentFraction",
    () => clampCommentFraction,
    (value) => {
      clampCommentFraction = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "intersectCommentRects",
    () => intersectCommentRects,
    (value) => {
      intersectCommentRects = value;
    },
  );
  bindRuntimeValue(runtime, "rankCommentAreaHosts", () => rankCommentAreaHosts);
  bindRuntimeValue(
    runtime,
    "commentHostNormalizedBox",
    () => commentHostNormalizedBox,
  );
  bindRuntimeValue(
    runtime,
    "normalizedCommentBoxToRect",
    () => normalizedCommentBoxToRect,
  );
  bindRuntimeValue(
    runtime,
    "nearestCommentBoxCorner",
    () => nearestCommentBoxCorner,
  );
  bindRuntimeValue(
    runtime,
    "commentBoxCornerPoint",
    () => commentBoxCornerPoint,
  );
  bindRuntimeValue(
    runtime,
    "describeCommentBoxPart",
    () => describeCommentBoxPart,
  );
  bindRuntimeValue(
    runtime,
    "describeCommentAreaCoverage",
    () => describeCommentAreaCoverage,
  );
  bindRuntimeValue(
    runtime,
    "createCommentOperationToken",
    () => createCommentOperationToken,
  );
  return () => {
    COMMENT_AREA_COVERAGE_THRESHOLD = 0.85;
    clampCommentFraction = (input: number): number =>
      Math.min(1, Math.max(0, input));
    intersectCommentRects = (
      input: CommentUnitRect,
      options: CommentUnitRect,
    ): CommentUnitRect | null => {
      let value = Math.max(input.x, options.x),
        value2 = Math.max(input.y, options.y),
        value3 = Math.min(input.x + input.w, options.x + options.w),
        value4 = Math.min(input.y + input.h, options.y + options.h);
      if (value3 > value && value4 > value2) {
        return {
          x: value,
          y: value2,
          w: value3 - value,
          h: value4 - value2,
        };
      } else {
        return null;
      }
    };
  };
}
