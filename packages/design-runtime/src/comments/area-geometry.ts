/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCommentsAreaGeometry(
  runtime: RuntimeBindings,
): () => void {
  var clampCommentFraction: Dynamic;
  var intersectCommentRects: Dynamic;
  function artboardsCoveredByCommentArea(
    area?: Dynamic,
    artboards?: Dynamic,
    limit: Dynamic = 1 / 0,
  ): Dynamic {
    let value: Dynamic = Math.max(1e-6, area.w * area.h),
      items: Dynamic = [];
    artboards.forEach(({ board: board, frame: frame }: Dynamic): Dynamic => {
      let value2: Dynamic = intersectCommentRects(area, frame);
      if (!value2) return;
      let value3: Dynamic = value2.w * value2.h,
        value4: Dynamic = Math.max(1e-6, frame.w * frame.h);
      (value3 < 0.04 * value4 && value3 < 0.25 * value) ||
        items.push({
          board: board,
          frame: frame,
          inter: value2,
          cov: value3 / value4,
          b: {
            x0: (value2.x - frame.x) / frame.w,
            y0: (value2.y - frame.y) / frame.h,
            x1: (value2.x + value2.w - frame.x) / frame.w,
            y1: (value2.y + value2.h - frame.y) / frame.h,
          },
        });
    });
    if (items.length <= limit) return items;
    let values: Dynamic = new Set(
      [...items]
        .sort(
          (input?: Dynamic, options?: Dynamic): Dynamic =>
            options.inter.w * options.inter.h - input.inter.w * input.inter.h,
        )
        .slice(0, limit),
    );
    return items.filter((input?: Dynamic): Dynamic => values.has(input));
  }
  function commentAreaWithinArtboardContent(
    coveredArtboard?: Dynamic,
    contentBox?: Dynamic,
  ): Dynamic {
    if (!(contentBox.w > 0 && contentBox.h > 0)) return null;
    let value: Dynamic = coveredArtboard.inter.x - coveredArtboard.frame.x,
      value2: Dynamic = coveredArtboard.inter.y - coveredArtboard.frame.y,
      state: Dynamic = {
        x0: clampCommentFraction((value - contentBox.x) / contentBox.w),
        y0: clampCommentFraction((value2 - contentBox.y) / contentBox.h),
        x1: clampCommentFraction(
          (value + coveredArtboard.inter.w - contentBox.x) / contentBox.w,
        ),
        y1: clampCommentFraction(
          (value2 + coveredArtboard.inter.h - contentBox.y) / contentBox.h,
        ),
      };
    return state.x1 > state.x0 && state.y1 > state.y0 ? state : null;
  }
  function unionCommentRects(rects?: Dynamic): Dynamic {
    if (rects.length === 0) return null;
    let minX: Dynamic = 1 / 0,
      minY: Dynamic = 1 / 0,
      maxX: Dynamic = -1 / 0,
      maxY: Dynamic = -1 / 0;
    for (let value of rects as Dynamic) {
      minX = Math.min(minX, value.x);
      minY = Math.min(minY, value.y);
      maxX = Math.max(maxX, value.x + value.w);
      maxY = Math.max(maxY, value.y + value.h);
    }
    return {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
    };
  }
  function normalizeCommentArea(area?: Dynamic, box?: Dynamic): Dynamic {
    let width: Dynamic = Math.max(1e-6, box.w),
      height: Dynamic = Math.max(1e-6, box.h);
    return {
      x0: clampCommentFraction((area.x - box.x) / width),
      y0: clampCommentFraction((area.y - box.y) / height),
      x1: clampCommentFraction((area.x + area.w - box.x) / width),
      y1: clampCommentFraction((area.y + area.h - box.y) / height),
    };
  }
  function denormalizeCommentArea(box?: Dynamic, area?: Dynamic): Dynamic {
    return {
      x: box.x + area.x0 * box.w,
      y: box.y + area.y0 * box.h,
      w: (area.x1 - area.x0) * box.w,
      h: (area.y1 - area.y0) * box.h,
    };
  }
  function nearestCommentAreaCorner(box?: Dynamic, point?: Dynamic): Dynamic {
    let value: Dynamic = point.x > box.x + box.w / 2 ? 1 : 0,
      value2: Dynamic = point.y > box.y + box.h / 2 ? 2 : 0;
    return value + value2;
  }
  function commentAreaHandlePoint(box?: Dynamic, corner?: Dynamic): Dynamic {
    return corner == null
      ? {
          x: box.x + box.w / 2,
          y: box.y + box.h / 2,
        }
      : {
          x: corner & 1 ? box.x + box.w : box.x,
          y: corner & 2 ? box.y + box.h : box.y,
        };
  }
  function describeCommentAreaLocation(
    area?: Dynamic,
    coverage?: Dynamic,
  ): Dynamic {
    if (coverage >= 0.85) return "";
    if (area.x1 <= 0.15) return "left edge";
    if (area.x0 >= 0.85) return "right edge";
    if (area.y1 <= 0.15) return "top edge";
    if (area.y0 >= 0.85) return "bottom edge";
    let value: Dynamic = (area.y0 + area.y1) / 2,
      value2: Dynamic = (area.x0 + area.x1) / 2,
      value3: Dynamic =
        area.y1 <= 0.55 && value <= 0.35
          ? "top"
          : area.y0 >= 0.45 && value >= 0.65
            ? "bottom"
            : area.y1 - area.y0 <= 0.5
              ? "middle"
              : "",
      value4: Dynamic =
        area.x1 <= 0.55 && value2 <= 0.35
          ? "left"
          : area.x0 >= 0.45 && value2 >= 0.65
            ? "right"
            : area.x1 - area.x0 <= 0.5
              ? "centre"
              : "",
      value5: Dynamic = [value3, value4].filter(Boolean).join(" ");
    return value5 === "top" || value5 === "bottom"
      ? value5 + " half"
      : value5 === "left" || value5 === "right"
        ? value5 + " side"
        : value5 || "part";
  }
  function createCommentOperationToken(): Dynamic {
    let index: Dynamic = 0;
    return {
      begin(): Dynamic {
        index += 1;
        let value: Dynamic = index;
        return {
          get live(): Dynamic {
            return index === value;
          },
        };
      },
      cancel(): Dynamic {
        index += 1;
      },
    };
  }
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
  bindRuntimeValue(
    runtime,
    "artboardsCoveredByCommentArea",
    () => artboardsCoveredByCommentArea,
  );
  bindRuntimeValue(
    runtime,
    "commentAreaWithinArtboardContent",
    () => commentAreaWithinArtboardContent,
  );
  bindRuntimeValue(runtime, "unionCommentRects", () => unionCommentRects);
  bindRuntimeValue(runtime, "normalizeCommentArea", () => normalizeCommentArea);
  bindRuntimeValue(
    runtime,
    "denormalizeCommentArea",
    () => denormalizeCommentArea,
  );
  bindRuntimeValue(
    runtime,
    "nearestCommentAreaCorner",
    () => nearestCommentAreaCorner,
  );
  bindRuntimeValue(
    runtime,
    "commentAreaHandlePoint",
    () => commentAreaHandlePoint,
  );
  bindRuntimeValue(
    runtime,
    "describeCommentAreaLocation",
    () => describeCommentAreaLocation,
  );
  bindRuntimeValue(
    runtime,
    "createCommentOperationToken",
    () => createCommentOperationToken,
  );
  return () => {
    clampCommentFraction = (input?: Dynamic): Dynamic =>
      Math.min(1, Math.max(0, input));
    intersectCommentRects = (first?: Dynamic, second?: Dynamic): Dynamic => {
      let left: Dynamic = Math.max(first.x, second.x),
        top: Dynamic = Math.max(first.y, second.y),
        right: Dynamic = Math.min(first.x + first.w, second.x + second.w),
        bottom: Dynamic = Math.min(first.y + first.h, second.y + second.h);
      return right > left && bottom > top
        ? {
            x: left,
            y: top,
            w: right - left,
            h: bottom - top,
          }
        : null;
    };
  };
}
