/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorGeometryFlipAnnotations(
  runtime: RuntimeBindings,
): () => void {
  var GeometryFlipAnnotationsLabel: Dynamic;
  var ThisDrawingHasTooManyPointsMessage: Dynamic;
  var ThisDrawingSSavedPathCouldnTBeMessage: Dynamic;
  var GeometryFlipAnnotationsLabel_2: Dynamic;
  var PartOfTheSelectionCouldnTBeMessage: Dynamic;
  var GeometryFlipAnnotationsLabel_3: Dynamic;
  var GeometryFlipAnnotationsWytKytYtConfig: Dynamic;
  var CropDoesNotWorkWhileThisMessage: Dynamic;
  var GeometryFlipAnnotationsPattern: Dynamic;
  var GeometryFlipAnnotationsHandler: Dynamic;
  var GeometryFlipAnnotationsConstant: Dynamic;
  function flipAnnotationPen(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = options === "horizontal" ? 0 : 1,
      value2: Dynamic = input.d.match(GeometryFlipAnnotationsPattern) ?? [],
      value3: Dynamic = value2
        .map(Number)
        .filter(
          (input2?: Dynamic, options2?: Dynamic): Dynamic =>
            options2 % 2 === value,
        ),
      [items, items2]: Dynamic = [Math.min(...value3), Math.max(...value3)],
      value4: Dynamic = Math.min(
        GeometryFlipAnnotationsConstant,
        Math.max(
          0,
          ...value2.map(
            (input2?: Dynamic): Dynamic => (input2.split(".")[1] ?? "").length,
          ),
        ),
      ),
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        value4 > 0
          ? input2.toFixed(value4).replace(/\.?0+$/, "")
          : input2.toFixed(0),
      index: Dynamic = 0,
      value5: Dynamic = input.d.replace(
        GeometryFlipAnnotationsPattern,
        (input2?: Dynamic): Dynamic =>
          index++ % 2 === value
            ? callback(items + items2 - Number(input2))
            : input2,
      ),
      [items3, items4]: Dynamic = [
        (0, runtime.annotationRotation)(input),
        (0, runtime.normalizeRotationDegrees)(
          -(0, runtime.annotationRotation)(input),
        ),
      ];
    if (value5 === input.d && items4 === items3) return "same";
    if ((0, runtime.PlatformFileContentTrim_2)(value5) !== value5) return null;
    let state: Dynamic = {
        d: input.d,
        ...(items4 !== items3
          ? {
              rotate: items3,
            }
          : {}),
      },
      state2: Dynamic = {
        d: value5,
        ...(items4 !== items3
          ? {
              rotate: items4,
            }
          : {}),
      },
      value6: Dynamic = value2.map(Number),
      value7: Dynamic = value6.filter(
        (input2?: Dynamic, options2?: Dynamic): Dynamic => options2 % 2 === 0,
      ),
      value8: Dynamic = value6.filter(
        (input2?: Dynamic, options2?: Dynamic): Dynamic => options2 % 2 === 1,
      ),
      callback2: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        ((Math.min(...input2) + Math.max(...input2)) /
          2 /
          Math.max(1, ...input2) -
          0.5) *
        options2,
      value9: Dynamic = Math.sin((items3 * Math.PI) / 180),
      [items5, items6]: Dynamic = [
        GeometryFlipAnnotationsHandler(
          -2 * callback2(value8, input.h) * value9,
        ),
        GeometryFlipAnnotationsHandler(2 * callback2(value7, input.w) * value9),
      ];
    items5 !== 0 &&
      ([state.x, state2.x] = [
        input.x,
        GeometryFlipAnnotationsHandler(input.x + items5),
      ]);
    items6 !== 0 &&
      ([state.y, state2.y] = [
        input.y,
        GeometryFlipAnnotationsHandler(input.y + items6),
      ]);
    return {
      id: input.id,
      from: state,
      to: state2,
    };
  }
  function flipAnnotation(source?: Dynamic, options?: Dynamic): Dynamic {
    if (!(0, runtime.isShapeAnnotation)(source))
      return GeometryFlipAnnotationsLabel;
    if (source.kind === "pen")
      try {
        let value2: Dynamic = flipAnnotationPen(source, options);
        return value2 === "same"
          ? null
          : (value2 ?? ThisDrawingHasTooManyPointsMessage);
      } catch {
        return ThisDrawingSSavedPathCouldnTBeMessage;
      }
    if (source.kind === "line" || source.kind === "arrow")
      return (
        options === "horizontal"
          ? source.x === source.x2
          : source.y === source.y2
      )
        ? null
        : options === "horizontal"
          ? {
              id: source.id,
              from: {
                x: source.x,
                x2: source.x2,
              },
              to: {
                x: source.x2,
                x2: source.x,
              },
            }
          : {
              id: source.id,
              from: {
                y: source.y,
                y2: source.y2,
              },
              to: {
                y: source.y2,
                y2: source.y,
              },
            };
    let value: Dynamic = options === "horizontal" ? "flipX" : "flipY",
      [items, items2]: Dynamic = [
        (0, runtime.annotationRotation)(source),
        (0, runtime.normalizeRotationDegrees)(
          -(0, runtime.annotationRotation)(source),
        ),
      ];
    return {
      id: source.id,
      from: {
        [value]: source[value],
        ...(items2 !== items
          ? {
              rotate: items,
            }
          : {}),
      },
      to: {
        [value]: source[value] === true ? undefined : true,
        ...(items2 !== items
          ? {
              rotate: items2,
            }
          : {}),
      },
    };
  }
  function flipAnnotations(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input.map(
        (input2?: Dynamic): Dynamic => flipAnnotation(input2, options),
      ),
      value2: Dynamic =
        value.find((input2?: Dynamic): Dynamic => typeof input2 == "string") ??
        (value.length > 0 &&
        value.every((input2?: Dynamic): Dynamic => input2 === null)
          ? runtime.FlippingThisWayWouldnTChangeItMessage
          : undefined),
      value3: Dynamic = value.filter(
        (input2?: Dynamic): Dynamic =>
          input2 !== null && typeof input2 != "string",
      );
    return value2 === undefined
      ? {
          flips: value3,
        }
      : {
          flips: value3,
          refused: value2,
        };
  }
  function imageFlipCss(input?: Dynamic): Dynamic {
    return input.flipX === true || input.flipY === true
      ? {
          transform:
            "scale(" +
            (input.flipX === true ? "-1" : "1") +
            ", " +
            (input.flipY === true ? "-1" : "1") +
            ")",
        }
      : undefined;
  }
  bindRuntimeValue(
    runtime,
    "GeometryFlipAnnotationsLabel",
    () => GeometryFlipAnnotationsLabel,
    (value) => {
      GeometryFlipAnnotationsLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisDrawingHasTooManyPointsMessage",
    () => ThisDrawingHasTooManyPointsMessage,
    (value) => {
      ThisDrawingHasTooManyPointsMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisDrawingSSavedPathCouldnTBeMessage",
    () => ThisDrawingSSavedPathCouldnTBeMessage,
    (value) => {
      ThisDrawingSSavedPathCouldnTBeMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipAnnotationsLabel_2",
    () => GeometryFlipAnnotationsLabel_2,
    (value) => {
      GeometryFlipAnnotationsLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PartOfTheSelectionCouldnTBeMessage",
    () => PartOfTheSelectionCouldnTBeMessage,
    (value) => {
      PartOfTheSelectionCouldnTBeMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipAnnotationsLabel_3",
    () => GeometryFlipAnnotationsLabel_3,
    (value) => {
      GeometryFlipAnnotationsLabel_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipAnnotationsWytKytYtConfig",
    () => GeometryFlipAnnotationsWytKytYtConfig,
    (value) => {
      GeometryFlipAnnotationsWytKytYtConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CropDoesNotWorkWhileThisMessage",
    () => CropDoesNotWorkWhileThisMessage,
    (value) => {
      CropDoesNotWorkWhileThisMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipAnnotationsPattern",
    () => GeometryFlipAnnotationsPattern,
    (value) => {
      GeometryFlipAnnotationsPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipAnnotationsHandler",
    () => GeometryFlipAnnotationsHandler,
    (value) => {
      GeometryFlipAnnotationsHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipAnnotationsConstant",
    () => GeometryFlipAnnotationsConstant,
    (value) => {
      GeometryFlipAnnotationsConstant = value;
    },
  );
  bindRuntimeValue(runtime, "flipAnnotationPen", () => flipAnnotationPen);
  bindRuntimeValue(runtime, "flipAnnotation", () => flipAnnotation);
  bindRuntimeValue(runtime, "flipAnnotations", () => flipAnnotations);
  bindRuntimeValue(runtime, "imageFlipCss", () => imageFlipCss);
  return () => {
    GeometryFlipAnnotationsLabel = "Notes and titles can\u2019t be flipped";
    ThisDrawingHasTooManyPointsMessage =
      "This drawing has too many points to flip";
    ThisDrawingSSavedPathCouldnTBeMessage =
      "This drawing\u2019s saved path couldn\u2019t be read, so it can\u2019t be flipped";
    GeometryFlipAnnotationsLabel_2 =
      "Artboards can\u2019t be flipped. Select what is inside one.";
    PartOfTheSelectionCouldnTBeMessage =
      "Part of the selection couldn\u2019t be flipped. Undo if you want it all to match.";
    GeometryFlipAnnotationsLabel_3 = "Still finishing the last flip";
    GeometryFlipAnnotationsWytKytYtConfig = {
      [GeometryFlipAnnotationsLabel]: "notes and titles",
      [ThisDrawingHasTooManyPointsMessage]: "a drawing with too many points",
      [ThisDrawingSSavedPathCouldnTBeMessage]:
        "a drawing whose saved path couldn\u2019t be read",
    };
    CropDoesNotWorkWhileThisMessage =
      "Crop does not work while this is flipped. Flip it back first.";
    GeometryFlipAnnotationsPattern = /\d+(?:\.\d+)?/g;
    GeometryFlipAnnotationsHandler = (input?: Dynamic): Dynamic =>
      Math.round(input * 100) / 100 || 0;
    GeometryFlipAnnotationsConstant = 6;
  };
}
