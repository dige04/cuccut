/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { Slide } from "../deck-contracts";
import type { TypographyStyle } from "../model/typography";
import type {
  CommentAreaAnchor,
  CommentFrameAnchor,
  CommentSlideAnchor,
  ParsedCommentAnchor,
  ParsedCommentAreaAnchor,
} from "./anchors";
import type {
  CommentUnitPoint,
  CommentUnitRect,
} from "./area-geometry";
import type { CommentBox } from "./keyboard";
import type {
  CommentAnchorDescription,
  CommentAreaDescription,
  CommentNodeRef,
  CommentTableCell,
} from "./labels";

/** What a pointer hit on a frame (or one of its nodes) resolved to. */
export interface CommentFrameHit {
  anchor: CommentFrameAnchor;
  /** The element the anchor's fractions are measured against. */
  el: Element;
  /** The table cell under the pointer, when the hit is inside a table. */
  cell?: CommentTableCell;
}
/** What a pointer hit on the bare slide surface resolved to. */
export interface CommentSlideHit {
  anchor: CommentSlideAnchor;
  el: Element;
}
/** The result of hit testing a pointer position for a point comment. */
export interface CommentHit {
  anchor: CommentSlideAnchor | CommentFrameAnchor;
  el: Element;
  cell?: CommentTableCell;
}

/** A node (or empty frame) a marquee area can be measured against, with its box on the slide. */
export interface CommentAreaTarget {
  el: Element;
  ref: CommentNodeRef;
  /** `client` as fractions of the slide surface. */
  rect: CommentUnitRect;
  /** The element's bounding box in client pixels. */
  client: DOMRect;
}
/** The commentable nodes of a slide surface plus the surface's own box. */
export interface CommentAreaTargets {
  surface: DOMRect;
  els: CommentAreaTarget[];
}

/** An encoded anchor with the label people read and the detail the agent reads; `area` marks a marquee. */
export interface DescribedCommentAnchor extends CommentAnchorDescription {
  anchor: string;
  area?: true;
}

declare module "../bindings" {
  interface RuntimeBindings {
    /** The whole board: used as a host that covers everything. */
    FULL_COMMENT_AREA_RECT: CommentUnitRect;
    normalizeCommentPoint: (
      coordinate: number,
      origin: number,
      size: number,
    ) => number;
    parseCommentNodePath: (path: string | null) => number[];
    /** The box of `element` relative to the top-left of `origin`. */
    getCommentElementRect: (
      element: Element,
      origin: Pick<CommentBox, "left" | "top">,
    ) => CommentBox;
    /** True when both boxes are the same box (or both absent / the same object). */
    parseCommentCell: (
      element: CommentBox | null | undefined,
      options: CommentBox | null | undefined,
    ) => boolean;
    /** Clips `rect` to the area 0..width x topInset..height; null when nothing is left. */
    collectCommentableNodeElements: (
      rect: CommentBox,
      width: number,
      height: number,
      topInset?: number,
    ) => CommentBox | null;
    /** `unit` as fractions of `board`. */
    commentNodeUnitKey: (unit: CommentBox, board: CommentBox) => CommentUnitRect;
    hitTestFrameCommentAnchor: (
      slideId: string,
      surface: Element,
      target: Element,
      clientX: number,
      clientY: number,
    ) => CommentFrameHit | null;
    hitTestSlideCommentAnchor: (
      slideId: string,
      surface: Element,
      clientX: number,
      clientY: number,
    ) => CommentSlideHit;
    resolveCommentAnchorElement: (
      anchor: ParsedCommentAnchor,
      slide: Slide | null | undefined,
      container: Element,
      surface: Element | null,
    ) => Element | null;
    commentAnchorPoint: (
      element: Element,
      anchor: ParsedCommentAnchor,
    ) => CommentUnitPoint | null;
    commentAnchorAreaRect: (
      element: Element,
      anchor: ParsedCommentAreaAnchor,
      origin: Pick<CommentBox, "left" | "top">,
    ) => CommentBox | null;
    collectSlideCommentAreaTargets: (
      slide: Slide,
      surface: Element,
      container: Element,
      measure: string,
    ) => CommentAreaTargets;
    createCommentAnchorDescription: (
      hit: CommentHit,
      slideNumber: number,
      slide: Slide,
      typeStyles?: TypographyStyle[],
    ) => DescribedCommentAnchor | null;
    describeSlideCommentArea: (
      area: CommentUnitRect,
      corner: number | null | undefined,
      elements: readonly CommentAreaTarget[],
      slideNumber: number,
      slide: Slide,
      typeStyles?: TypographyStyle[],
    ) => DescribedCommentAnchor | null;
  }
}

export function installCommentsHitTesting(
  runtime: RuntimeBindings,
): () => void {
  var FULL_COMMENT_AREA_RECT: CommentUnitRect;
  var normalizeCommentPoint: RuntimeBindings["normalizeCommentPoint"];
  var parseCommentNodePath: RuntimeBindings["parseCommentNodePath"];
  var getCommentElementRect: RuntimeBindings["getCommentElementRect"];
  var parseCommentCell: RuntimeBindings["parseCommentCell"];
  var collectCommentableNodeElements: RuntimeBindings["collectCommentableNodeElements"];
  var commentNodeUnitKey: RuntimeBindings["commentNodeUnitKey"];
  function hitTestFrameCommentAnchor(
    slideId: string,
    surface: Element,
    target: Element,
    clientX: number,
    clientY: number,
  ): CommentFrameHit | null {
    let ancestor = target.closest("[data-frame-id]");
    if (!ancestor || !surface.contains(ancestor)) {
      return null;
    }
    let ancestor2 = target.closest("[data-node-path]"),
      value = ancestor2 && ancestor.contains(ancestor2) ? ancestor2 : ancestor,
      bounds = value.getBoundingClientRect(),
      ancestor3 = target.closest("[data-cell]"),
      value2 =
        ancestor3 && value.contains(ancestor3)
          ? /^(\d+)\.(\d+)$/.exec(ancestor3.getAttribute("data-cell") ?? "")
          : null;
    return {
      anchor: {
        kind: "frame",
        slideId: slideId,
        frameId: ancestor.getAttribute("data-frame-id") ?? "",
        path:
          value === ancestor
            ? []
            : parseCommentNodePath(value.getAttribute("data-node-path")),
        fx: normalizeCommentPoint(clientX, bounds.left, bounds.width),
        fy: normalizeCommentPoint(clientY, bounds.top, bounds.height),
      },
      el: value,
      ...(value2
        ? {
            cell: {
              r: Number(value2[1]),
              c: Number(value2[2]),
            },
          }
        : {}),
    };
  }
  function hitTestSlideCommentAnchor(
    slideId: string,
    surface: Element,
    clientX: number,
    clientY: number,
  ): CommentSlideHit {
    let bounds = surface.getBoundingClientRect();
    return {
      anchor: {
        kind: "slide",
        slideId: slideId,
        fx: normalizeCommentPoint(clientX, bounds.left, bounds.width),
        fy: normalizeCommentPoint(clientY, bounds.top, bounds.height),
      },
      el: surface,
    };
  }
  function resolveCommentAnchorElement(
    anchor: ParsedCommentAnchor,
    slide: Slide | null | undefined,
    container: Element,
    surface: Element | null,
  ): Element | null {
    if (
      anchor.kind === "slide" ||
      (anchor.kind === "area" && anchor.frameHash === null)
    ) {
      return surface;
    }
    let value = slide
      ? (0, runtime.resolvePromotedCommentFrame)(anchor, slide)
      : null;
    if (value === null) {
      return null;
    }
    if (value.kind === "surface") {
      return surface ?? container.querySelector("[data-slide-surface]");
    }
    let element = container.querySelector(
      '[data-frame-id="' + CSS.escape(value.frameId) + '"]',
    );
    if (!element) {
      return null;
    }
    if (value.kind === "piece") {
      return element;
    }
    return (
      (anchor.path.length > 0 &&
        element.querySelector(
          '[data-node-path="' + anchor.path.join(".") + '"]',
        )) ||
      element
    );
  }
  function commentAnchorPoint(
    element: Element,
    anchor: ParsedCommentAnchor,
  ): CommentUnitPoint | null {
    let bounds = element.getBoundingClientRect();
    if (bounds.width === 0 && bounds.height === 0) {
      return null;
    }
    if (anchor.kind === "area") {
      return (0, runtime.commentBoxCornerPoint)(
        (0, runtime.normalizedCommentBoxToRect)(
          {
            x: bounds.left,
            y: bounds.top,
            w: bounds.width,
            h: bounds.height,
          },
          anchor.box,
        ),
        anchor.box.corner,
      );
    } else {
      return {
        x: bounds.left + anchor.fx * bounds.width,
        y: bounds.top + anchor.fy * bounds.height,
      };
    }
  }
  function commentAnchorAreaRect(
    element: Element,
    anchor: ParsedCommentAreaAnchor,
    origin: Pick<CommentBox, "left" | "top">,
  ): CommentBox | null {
    let value = getCommentElementRect(element, origin);
    if (value.width === 0 && value.height === 0) {
      return null;
    }
    let value2 = (0, runtime.normalizedCommentBoxToRect)(
      {
        x: value.left,
        y: value.top,
        w: value.width,
        h: value.height,
      },
      anchor.box,
    );
    return {
      left: value2.x,
      top: value2.y,
      width: value2.w,
      height: value2.h,
    };
  }
  function collectSlideCommentAreaTargets(
    slide: Slide,
    surface: Element,
    container: Element,
    measure: string,
  ): CommentAreaTargets {
    let bounds = container.getBoundingClientRect(),
      value = (0, runtime.slidePrimaryLayoutFrame)(slide)?.id,
      values = new Set(
        slide.frames
          .filter(
            (input) =>
              input.id === value || (0, runtime.isEmptyBackgroundFrame)(input),
          )
          .map((input) => input.id),
      ),
      items: CommentAreaTarget[] = [];
    for (let value2 of surface.querySelectorAll<Element>(
      "[data-frame-id] [data-node-path]",
    )) {
      let ancestor = value2.closest("[data-frame-id]");
      if (!ancestor || value2.closest(measure)) {
        continue;
      }
      let value3 = ancestor.getAttribute("data-frame-id") ?? "",
        value4 = parseCommentNodePath(value2.getAttribute("data-node-path"));
      if (value4.length === 0 && values.has(value3)) {
        continue;
      }
      let value5 = value4.length === 0 ? ancestor : value2,
        bounds2 = value5.getBoundingClientRect();
      items.push({
        el: value5,
        ref: {
          frameId: value3,
          path: value4,
        },
        rect: commentNodeUnitKey(bounds2, bounds),
        client: bounds2,
      });
    }
    return {
      surface: bounds,
      els: items,
    };
  }
  function createCommentAnchorDescription(
    hit: CommentHit,
    slideNumber: number,
    slide: Slide,
    typeStyles?: TypographyStyle[],
  ): DescribedCommentAnchor | null {
    let { anchor: anchor, cell: cell } = hit,
      value = (0, runtime.encodeSlideCommentAnchor)(anchor);
    if (value === null && anchor.kind === "frame") {
      anchor = {
        ...anchor,
        path: [],
      };
      cell = undefined;
      value = (0, runtime.encodeSlideCommentAnchor)(anchor);
    }
    if (value === null) {
      return null;
    }
    return {
      anchor: value,
      ...(0, runtime.describeFrameCommentAnchor)(
        slideNumber,
        slide,
        anchor.kind === "frame"
          ? {
              ...anchor,
              cell: cell,
            }
          : anchor,
        typeStyles,
      ),
    };
  }
  /**
   * The restored parameter names are shifted: `slide` is the pin corner (0..3) of the area, `typeStyles`
   * is the slide being commented on and `corner` is the deck's type styles.
   */
  function describeSlideCommentArea(
    area: CommentUnitRect,
    slide: number | null | undefined,
    elements: readonly CommentAreaTarget[],
    slideNumber: number,
    typeStyles: Slide,
    corner?: TypographyStyle[],
  ): DescribedCommentAnchor | null {
    let [value] = (0, runtime.rankCommentAreaHosts)(area, [
      {
        board: FULL_COMMENT_AREA_RECT,
        frame: FULL_COMMENT_AREA_RECT,
      },
    ]);
    if (!value) {
      return null;
    }
    let value2 = (0, runtime.describeCommentAreaCoverage)(
        area,
        elements.map(
          (input: CommentAreaTarget): { el: CommentAreaTarget; rect: CommentUnitRect } => ({
            el: input,
            rect: input.rect,
          }),
        ),
        (input: CommentAreaTarget, options: CommentAreaTarget): boolean =>
          input.el.contains(options.el),
      ),
      callback = (input: CommentAreaTarget): boolean =>
        ((0, runtime.rankCommentAreaHosts)(input.rect, [
          {
            board: FULL_COMMENT_AREA_RECT,
            frame: FULL_COMMENT_AREA_RECT,
          },
        ])[0]?.cov ?? 0) >= runtime.COMMENT_AREA_COVERAGE_THRESHOLD,
      value3 =
        value2.enclosing && !callback(value2.enclosing)
          ? value2.enclosing
          : null,
      { covered: covered } = value2,
      state: CommentAreaAnchor = {
        kind: "area",
        slideId: typeStyles.id,
        frameId: null,
        path: [],
        box: {
          ...value.b,
          ...(slide != null
            ? {
                corner: slide,
              }
            : {}),
        },
      },
      value4: CommentAreaTarget | null | undefined = null;
    for (let value7 of value3
      ? [
          value3,
          elements.find(
            (input: CommentAreaTarget): boolean =>
              input.ref.frameId === value3.ref.frameId &&
              input.ref.path.length === 0,
          ),
        ]
      : []) {
      let value8 = value7
          ? (0, runtime.commentHostNormalizedBox)(value, value7.rect)
          : null,
        value9: CommentAreaAnchor | null =
          value7 && value8
            ? {
                kind: "area",
                slideId: typeStyles.id,
                frameId: value7.ref.frameId,
                path: value7.ref.path,
                box: {
                  ...value8,
                  ...(slide != null
                    ? {
                        corner: slide,
                      }
                    : {}),
                },
              }
            : null;
      if (value9 && (0, runtime.encodeSlideCommentAnchor)(value9) !== null) {
        state = value9;
        value4 = value7;
        break;
      }
    }
    let value5 = (0, runtime.encodeSlideCommentAnchor)(state);
    if (value5 === null) {
      return null;
    }
    let box = state.box,
      value6 = (0, runtime.describeCommentBoxPart)(
        box,
        value4 ? (box.x1 - box.x0) * (box.y1 - box.y0) : value.cov,
      ),
      state2: CommentAreaDescription = {
        within: value4?.ref ?? null,
        part: value6,
        covered: covered
          .filter((input: CommentAreaTarget): boolean => input !== value4)
          .map((input: CommentAreaTarget): CommentNodeRef => input.ref),
      };
    return {
      anchor: value5,
      label: (0, runtime.describeAreaCommentAnchor)(
        slideNumber,
        typeStyles,
        state2,
        corner,
      ),
      detail: (0, runtime.formatAreaCommentDetail)(
        slideNumber,
        typeStyles,
        state2,
      ),
      area: true,
    };
  }
  bindRuntimeValue(
    runtime,
    "FULL_COMMENT_AREA_RECT",
    () => FULL_COMMENT_AREA_RECT,
    (value) => {
      FULL_COMMENT_AREA_RECT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeCommentPoint",
    () => normalizeCommentPoint,
    (value) => {
      normalizeCommentPoint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseCommentNodePath",
    () => parseCommentNodePath,
    (value) => {
      parseCommentNodePath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getCommentElementRect",
    () => getCommentElementRect,
    (value) => {
      getCommentElementRect = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseCommentCell",
    () => parseCommentCell,
    (value) => {
      parseCommentCell = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collectCommentableNodeElements",
    () => collectCommentableNodeElements,
    (value) => {
      collectCommentableNodeElements = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentNodeUnitKey",
    () => commentNodeUnitKey,
    (value) => {
      commentNodeUnitKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hitTestFrameCommentAnchor",
    () => hitTestFrameCommentAnchor,
  );
  bindRuntimeValue(
    runtime,
    "hitTestSlideCommentAnchor",
    () => hitTestSlideCommentAnchor,
  );
  bindRuntimeValue(
    runtime,
    "resolveCommentAnchorElement",
    () => resolveCommentAnchorElement,
  );
  bindRuntimeValue(runtime, "commentAnchorPoint", () => commentAnchorPoint);
  bindRuntimeValue(
    runtime,
    "commentAnchorAreaRect",
    () => commentAnchorAreaRect,
  );
  bindRuntimeValue(
    runtime,
    "collectSlideCommentAreaTargets",
    () => collectSlideCommentAreaTargets,
  );
  bindRuntimeValue(
    runtime,
    "createCommentAnchorDescription",
    () => createCommentAnchorDescription,
  );
  bindRuntimeValue(
    runtime,
    "describeSlideCommentArea",
    () => describeSlideCommentArea,
  );
  return () => {
    (0, runtime.initializeModelEditing)();
    (0, runtime.initializeSlideModel)();
    FULL_COMMENT_AREA_RECT = {
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    };
    normalizeCommentPoint = (
      coordinate: number,
      origin: number,
      size: number,
    ): number =>
      Math.min(1, Math.max(0, size > 0 ? (coordinate - origin) / size : 0.5));
    parseCommentNodePath = (path: string | null): number[] =>
      path === null || path === "" ? [] : path.split(".").map(Number);
    getCommentElementRect = (
      element: Element,
      origin: Pick<CommentBox, "left" | "top">,
    ): CommentBox => {
      let bounds = element.getBoundingClientRect();
      return {
        left: bounds.left - origin.left,
        top: bounds.top - origin.top,
        width: bounds.width,
        height: bounds.height,
      };
    };
    parseCommentCell = (
      element: CommentBox | null | undefined,
      options: CommentBox | null | undefined,
    ): boolean =>
      element === options ||
      (!!element &&
        !!options &&
        element.left === options.left &&
        element.top === options.top &&
        element.width === options.width &&
        element.height === options.height);
    collectCommentableNodeElements = (
      root: CommentBox,
      options: number,
      context: number,
      value: number = 0,
    ): CommentBox | null => {
      let value2 = Math.max(0, root.left),
        value3 = Math.max(Math.min(value, context), root.top),
        value4 = Math.min(options, root.left + root.width),
        value5 = Math.min(context, root.top + root.height);
      if (value4 > value2 && value5 > value3) {
        return {
          left: value2,
          top: value3,
          width: value4 - value2,
          height: value5 - value3,
        };
      } else {
        return null;
      }
    };
    commentNodeUnitKey = (unit: CommentBox, options: CommentBox): CommentUnitRect => ({
      x: (unit.left - options.left) / (options.width || 1),
      y: (unit.top - options.top) / (options.height || 1),
      w: unit.width / (options.width || 1),
      h: unit.height / (options.height || 1),
    });
  };
}
