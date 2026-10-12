/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCommentsObjectGeometry(
  runtime: RuntimeBindings,
): () => void {
  var clampObjectCommentFraction: Dynamic;
  var rotateObjectCommentPoint: Dynamic;
  var objectCommentFractions: Dynamic;
  var commentRectOverlapArea: Dynamic;
  var commentObjectCoverageThreshold: Dynamic;
  function normalizeObjectCommentPoint(
    object?: Dynamic,
    box?: Dynamic,
    point?: Dynamic,
  ): Dynamic {
    if (object.kind === "line" || object.kind === "arrow") {
      let [items, items2]: Dynamic = [
          object.x2 - object.x,
          object.y2 - object.y,
        ],
        value2: Dynamic = items * items + items2 * items2;
      return {
        fx:
          value2 > 0
            ? clampObjectCommentFraction(
                ((point.x - object.x) * items + (point.y - object.y) * items2) /
                  value2,
              )
            : 0.5,
        fy: 0.5,
      };
    }
    let value: Dynamic = objectCommentFractions(object, box, point);
    return {
      fx: box.w > 0 ? clampObjectCommentFraction(value.fx) : 0.5,
      fy: box.h > 0 ? clampObjectCommentFraction(value.fy) : 0.5,
    };
  }
  function objectCommentPoint(
    object?: Dynamic,
    box?: Dynamic,
    fractions?: Dynamic,
  ): Dynamic {
    if (object.kind === "line" || object.kind === "arrow")
      return {
        x: object.x + fractions.fx * (object.x2 - object.x),
        y: object.y + fractions.fx * (object.y2 - object.y),
      };
    let [items, items2]: Dynamic = [
      object.flipX === true ? 1 - fractions.fx : fractions.fx,
      object.flipY === true ? 1 - fractions.fy : fractions.fy,
    ];
    return rotateObjectCommentPoint(
      {
        x: box.x + items * box.w,
        y: box.y + items2 * box.h,
      },
      {
        x: box.x + box.w / 2,
        y: box.y + box.h / 2,
      },
      (0, runtime.annotationRotation)(object),
    );
  }
  function pointWithinCommentObject(
    object?: Dynamic,
    box?: Dynamic,
    point?: Dynamic,
  ): Dynamic {
    let { fx: value, fy: value2 }: Dynamic = objectCommentFractions(
      object,
      box,
      point,
    );
    return object.kind === "oval"
      ? (2 * value - 1) ** 2 + (2 * value2 - 1) ** 2 <= 1
      : value >= 0 && value <= 1 && value2 >= 0 && value2 <= 1;
  }
  function objectsCoveredByCommentArea(
    area?: Dynamic,
    objects?: Dynamic,
    limit?: Dynamic,
  ): Dynamic {
    let value: Dynamic = area.w * area.h;
    if (!(value > 0)) return [];
    let callback: Dynamic = (input?: Dynamic): Dynamic => ({
        x: input.x + input.w / 2,
        y: input.y + input.h / 2,
      }),
      callback2: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
        objects.some(
          (input2?: Dynamic, options2?: Dynamic): Dynamic =>
            options2 > options &&
            input2.hides &&
            input2.on(callback(input)) &&
            input2.on(callback(area)) &&
            commentRectOverlapArea(input, input2.bounds) >=
              0.85 * input.w * input.h,
        ),
      value2: Dynamic = objects
        .map(
          (input?: Dynamic, options?: Dynamic): Dynamic => ({
            o: input,
            i: options,
            ov: commentRectOverlapArea(area, input.bounds),
            own: input.bounds.w * input.bounds.h,
          }),
        )
        .filter(({ o: o, i: i }: Dynamic): Dynamic => !callback2(o.bounds, i))
        .reverse(),
      value3: Dynamic = value2.filter(
        ({ o: o, ov: ov }: Dynamic): Dynamic =>
          o.solid && o.on(callback(area)) && ov >= 0.85 * value,
      ),
      value4: Dynamic =
        value3.find(({ o: o }: Dynamic): Dynamic => o.hides)?.i ?? -1,
      value5: Dynamic = value2.filter(
        ({ o: o, i: i, ov: ov, own: own2 }: Dynamic): Dynamic =>
          i >= value4 &&
          own2 > 0 &&
          ov >= 0.7 * own2 &&
          ov >= commentObjectCoverageThreshold * value &&
          (o.hides || !limit),
      );
    return [
      ...new Set(
        [...value5, ...value3].map(
          (input?: Dynamic): Dynamic => input.o.object,
        ),
      ),
    ];
  }
  function normalizeObjectCommentArea(
    object?: Dynamic,
    box?: Dynamic,
    area?: Dynamic,
    cornerIndex?: Dynamic,
  ): Dynamic {
    if (
      !(box.w > 0 && box.h > 0) ||
      object.kind === "line" ||
      object.kind === "arrow"
    )
      return null;
    let value: Dynamic = [area.y, area.y + area.h].flatMap(
        (input?: Dynamic): Dynamic =>
          [area.x, area.x + area.w].map(
            (input2?: Dynamic): Dynamic =>
              objectCommentFractions(object, box, {
                x: input2,
                y: input,
              }),
          ),
      ),
      [items, items2]: Dynamic = [
        value.map((input?: Dynamic): Dynamic => input.fx),
        value.map((input?: Dynamic): Dynamic => input.fy),
      ],
      state: Dynamic = {
        x0: clampObjectCommentFraction(Math.min(...items)),
        y0: clampObjectCommentFraction(Math.min(...items2)),
        x1: clampObjectCommentFraction(Math.max(...items)),
        y1: clampObjectCommentFraction(Math.max(...items2)),
      };
    return state.x1 > state.x0 && state.y1 > state.y0
      ? cornerIndex == null
        ? state
        : {
            ...state,
            corner: (0, runtime.nearestCommentAreaCorner)(
              {
                x: state.x0,
                y: state.y0,
                w: state.x1 - state.x0,
                h: state.y1 - state.y0,
              },
              {
                x: value[cornerIndex].fx,
                y: value[cornerIndex].fy,
              },
            ),
          }
      : null;
  }
  function objectCommentAreaRect(
    object?: Dynamic,
    box?: Dynamic,
    area?: Dynamic,
  ): Dynamic {
    let value: Dynamic = objectCommentPoint(object, box, {
        fx: (area.x0 + area.x1) / 2,
        fy: (area.y0 + area.y1) / 2,
      }),
      [items, items2]: Dynamic = [
        (area.x1 - area.x0) * box.w,
        (area.y1 - area.y0) * box.h,
      ];
    return {
      x: value.x - items / 2,
      y: value.y - items2 / 2,
      w: items,
      h: items2,
      deg: (0, runtime.annotationRotation)(object),
    };
  }
  function objectCommentAreaHandlePoint(
    object?: Dynamic,
    box?: Dynamic,
    area?: Dynamic,
  ): Dynamic {
    let corner: Dynamic = area.corner;
    return objectCommentPoint(
      object,
      box,
      corner == null
        ? {
            fx: (area.x0 + area.x1) / 2,
            fy: (area.y0 + area.y1) / 2,
          }
        : {
            fx: corner & 1 ? area.x1 : area.x0,
            fy: corner & 2 ? area.y1 : area.y0,
          },
    );
  }
  function moveObjectCommentArea(
    object?: Dynamic,
    box?: Dynamic,
    area?: Dynamic,
    startPoint?: Dynamic,
    endPoint?: Dynamic,
  ): Dynamic {
    if (!(box.w > 0 && box.h > 0)) return area;
    let [items, items2]: Dynamic = [
        objectCommentFractions(object, box, startPoint),
        objectCommentFractions(object, box, endPoint),
      ],
      callback: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic =>
        Math.min(
          1 - context,
          Math.max(-options, Math.round(input * 100) / 100),
        ),
      [items3, items4]: Dynamic = [
        callback(items2.fx - items.fx, area.x0, area.x1),
        callback(items2.fy - items.fy, area.y0, area.y1),
      ];
    return {
      ...area,
      x0: area.x0 + items3,
      y0: area.y0 + items4,
      x1: area.x1 + items3,
      y1: area.y1 + items4,
    };
  }
  bindRuntimeValue(
    runtime,
    "clampObjectCommentFraction",
    () => clampObjectCommentFraction,
    (value) => {
      clampObjectCommentFraction = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rotateObjectCommentPoint",
    () => rotateObjectCommentPoint,
    (value) => {
      rotateObjectCommentPoint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "objectCommentFractions",
    () => objectCommentFractions,
    (value) => {
      objectCommentFractions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeObjectCommentPoint",
    () => normalizeObjectCommentPoint,
  );
  bindRuntimeValue(runtime, "objectCommentPoint", () => objectCommentPoint);
  bindRuntimeValue(
    runtime,
    "commentRectOverlapArea",
    () => commentRectOverlapArea,
    (value) => {
      commentRectOverlapArea = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pointWithinCommentObject",
    () => pointWithinCommentObject,
  );
  bindRuntimeValue(
    runtime,
    "commentObjectCoverageThreshold",
    () => commentObjectCoverageThreshold,
    (value) => {
      commentObjectCoverageThreshold = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "objectsCoveredByCommentArea",
    () => objectsCoveredByCommentArea,
  );
  bindRuntimeValue(
    runtime,
    "normalizeObjectCommentArea",
    () => normalizeObjectCommentArea,
  );
  bindRuntimeValue(
    runtime,
    "objectCommentAreaRect",
    () => objectCommentAreaRect,
  );
  bindRuntimeValue(
    runtime,
    "objectCommentAreaHandlePoint",
    () => objectCommentAreaHandlePoint,
  );
  bindRuntimeValue(
    runtime,
    "moveObjectCommentArea",
    () => moveObjectCommentArea,
  );
  return () => {
    clampObjectCommentFraction = (input?: Dynamic): Dynamic =>
      Math.min(1, Math.max(0, input));
    rotateObjectCommentPoint = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => {
      if (!context) return input;
      let value: Dynamic = (context * Math.PI) / 180,
        [items, items2, items3, items4]: Dynamic = [
          Math.cos(value),
          Math.sin(value),
          input.x - options.x,
          input.y - options.y,
        ];
      return {
        x: options.x + items3 * items - items4 * items2,
        y: options.y + items3 * items2 + items4 * items,
      };
    };
    objectCommentFractions = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => {
      let value: Dynamic = rotateObjectCommentPoint(
          context,
          {
            x: options.x + options.w / 2,
            y: options.y + options.h / 2,
          },
          -(0, runtime.annotationRotation)(input),
        ),
        [items, items2]: Dynamic = [
          (value.x - options.x) / options.w,
          (value.y - options.y) / options.h,
        ];
      return {
        fx: input.flipX === true ? 1 - items : items,
        fy: input.flipY === true ? 1 - items2 : items2,
      };
    };
    commentRectOverlapArea = (input?: Dynamic, options?: Dynamic): Dynamic =>
      Math.max(
        0,
        Math.min(input.x + input.w, options.x + options.w) -
          Math.max(input.x, options.x),
      ) *
      Math.max(
        0,
        Math.min(input.y + input.h, options.y + options.h) -
          Math.max(input.y, options.y),
      );
    commentObjectCoverageThreshold = 0.5;
  };
}
