/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorGeometryFlipElements(
  runtime: RuntimeBindings,
): () => void {
  var GeometryFlipElementsLabel: Dynamic;
  var ThisComponentManagesItselfSoItMessage: Dynamic;
  var GeometryFlipElementsLabel_2: Dynamic;
  var ThisOnlyWrapsOtherLayersSoMessage: Dynamic;
  var ThisHasNoWidthOfItsMessage: Dynamic;
  var ThisHasNoHeightOfItsMessage: Dynamic;
  var ThisIsnTShownOnThePageMessage: Dynamic;
  var GeometryFlipElementsLabel_3: Dynamic;
  var GeometryFlipElementsLabel_4: Dynamic;
  var GeometryFlipElementsLabel_5: Dynamic;
  var ThisRepeatedElementCanTBeFlippedMessage: Dynamic;
  var FlippingThisWayWouldnTChangeItMessage: Dynamic;
  var FinishEditingThisDrawingSPointsToMessage: Dynamic;
  var GeometryFlipElementsLabel_6: Dynamic;
  var CouldnTFlipRightNowTryAgainMessage: Dynamic;
  var GeometryFlipElementsYtMytOytConfig: Dynamic;
  var GeometryFlipElementsTransformRotateScaleValues: Dynamic;
  var GeometryFlipElementsLimit: Dynamic;
  var GeometryFlipElementsLimit_2: Dynamic;
  var GeometryFlipElementsTranslateTranslatexTranslateyConfig: Dynamic;
  var GeometryFlipElementsDegRadTurnConfig: Dynamic;
  var GeometryFlipElementsHandler: Dynamic;
  var GeometryFlipElementsScIfScForPattern: Dynamic;
  function parseFlipInspection(input?: Dynamic): Dynamic {
    if (typeof input != "object" || input === null) return null;
    let value: Dynamic = input;
    if (
      typeof value.pose == "object" &&
      value.pose !== null &&
      value.pose.boxless === true
    )
      return {
        boxless: true,
      };
    if (value.missing === true || value.rendered === false)
      return {
        unrendered: true,
      };
    if (
      typeof value.computed != "object" ||
      value.computed === null ||
      typeof value.pose != "object" ||
      value.pose === null
    )
      return null;
    let computed: Dynamic = value.computed,
      pose: Dynamic = value.pose,
      value2: Dynamic =
        typeof pose.flat == "object" && pose.flat !== null ? pose.flat : {},
      value3: Dynamic =
        typeof pose.centre == "object" && pose.centre !== null
          ? pose.centre
          : {},
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        typeof input2 == "number" &&
        Number.isFinite(input2) &&
        Math.abs(input2) <= GeometryFlipElementsLimit;
    if (
      !callback(value3.x) ||
      !callback(value3.y) ||
      typeof pose.inline != "boolean"
    )
      return null;
    let callback2: Dynamic = (input2?: Dynamic): Dynamic =>
      typeof computed[input2] == "string" &&
      !["", "none"].includes(computed[input2].trim());
    return {
      centre: {
        x: value3.x,
        y: value3.y,
      },
      ...(pose.inline
        ? {
            inline: true,
          }
        : {}),
      ...(value2.x === true || value2.y === true
        ? {
            flat: {
              x: value2.x === true,
              y: value2.y === true,
            },
          }
        : {}),
      ...(callback2("transform")
        ? {
            transformed: true,
          }
        : {}),
      ...(callback2("rotate") || callback2("scale") || callback2("translate")
        ? {
            axisProps: true,
          }
        : {}),
    };
  }
  async function inspectFlipSelection(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Promise<Dynamic> {
    let callback: Dynamic = async (
        input2?: Dynamic,
        options2?: Dynamic,
      ): Promise<Dynamic> =>
        parseFlipInspection(
          await context(
            input2,
            GeometryFlipElementsTransformRotateScaleValues,
            options2,
          ).catch((): Dynamic => null),
        ),
      callback2: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        options2 != null &&
        options2.unrendered !== true &&
        (options2.transformed === true) ===
          ["", "none"].includes(
            input.effectiveStyleValue(input2, "transform").trim(),
          ),
      value: Dynamic = flipSelectionTargets(input, options),
      value2: Dynamic = await Promise.all(
        value.map(async (input2?: Dynamic): Promise<Dynamic> => {
          let value3: Dynamic = await callback(input2, false);
          return callback2(input2, value3) ? callback(input2, true) : value3;
        }),
      );
    return new Map(
      value.flatMap(
        (input2?: Dynamic, options2?: Dynamic): Dynamic =>
          value2[options2] ? [[input2, value2[options2]]] : [],
      ),
    );
  }
  function isOrderedSimpleTransform(input?: Dynamic): Dynamic {
    let index: Dynamic = 0;
    for (let [, value] of input.matchAll(/([a-zA-Z]+)\(/g) as Dynamic) {
      let value2: Dynamic = value.toLowerCase();
      if (
        !Object.hasOwn(
          GeometryFlipElementsTranslateTranslatexTranslateyConfig,
          value2,
        ) ||
        GeometryFlipElementsTranslateTranslatexTranslateyConfig[value2] < index
      )
        return false;
      index = GeometryFlipElementsTranslateTranslatexTranslateyConfig[value2];
    }
    return true;
  }
  function serializeFlipTransform(input?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic =>
        (/e/i.test(String(input2))
          ? input2.toFixed(12).replace(/\.?0+$/, "")
          : String(input2 || 0)) + options,
      items: Dynamic = [];
    (input.x.value !== 0 || input.y.value !== 0) &&
      items.push(
        "translate(" +
          callback(input.x.value, input.x.unit || "px") +
          ", " +
          callback(input.y.value, input.y.unit || "px") +
          ")",
      );
    input.rotate.value !== 0 &&
      items.push(
        "rotate(" +
          callback(input.rotate.value, input.rotate.unit || "deg") +
          ")",
      );
    (input.scaleX !== 1 || input.scaleY !== 1) &&
      items.push(
        input.scaleX === input.scaleY
          ? "scale(" + callback(input.scaleX, "") + ")"
          : input.scaleY === 1
            ? "scaleX(" + callback(input.scaleX, "") + ")"
            : input.scaleX === 1
              ? "scaleY(" + callback(input.scaleY, "") + ")"
              : "scale(" +
                callback(input.scaleX, "") +
                ", " +
                callback(input.scaleY, "") +
                ")",
      );
    return items.join(" ");
  }
  function flipElementTransform(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.parseCssTransform)(input);
    if (!value || !isOrderedSimpleTransform(input ?? "")) return null;
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        typeof input2 == "number" &&
        Number.isFinite(input2) &&
        Math.abs(input2) <= GeometryFlipElementsLimit
          ? input2
          : 0,
      value2: Dynamic =
        value.rotate.value *
        (GeometryFlipElementsDegRadTurnConfig[
          value.rotate.unit.toLowerCase() || "deg"
        ] ?? Math.PI / 180),
      [items, items2]: Dynamic = [
        callback(context?.x) * value.scaleX,
        callback(context?.y) * value.scaleY,
      ],
      value3: Dynamic =
        options === "horizontal"
          ? 2 * (Math.cos(value2) * items - Math.sin(value2) * items2)
          : 2 * (Math.sin(value2) * items + Math.cos(value2) * items2),
      value4: Dynamic = Math.abs(value3) >= GeometryFlipElementsLimit_2,
      value5: Dynamic = options === "horizontal" ? value.x : value.y;
    if (value4 && value5.value !== 0 && value5.unit.toLowerCase() !== "px")
      return "offset";
    let state: Dynamic = {
      value: GeometryFlipElementsHandler(value5.value + value3),
      unit: "px",
    };
    return serializeFlipTransform({
      x: value4 && options === "horizontal" ? state : value.x,
      y: value4 && options === "vertical" ? state : value.y,
      rotate: {
        value: -value.rotate.value || 0,
        unit: value.rotate.unit,
      },
      scaleX: options === "horizontal" ? -value.scaleX || 0 : value.scaleX,
      scaleY: options === "vertical" ? -value.scaleY || 0 : value.scaleY,
    });
  }
  function flipSelectionTargets(input?: Dynamic, options?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic => {
      let value: Dynamic = input.element(input2),
        value2: Dynamic =
          value?.tagName.toLowerCase() === "picture"
            ? value.querySelector("img[" + runtime.DcTplAttribute + "]")
            : null;
      for (
        let value4: Dynamic = value?.parentElement ?? null;
        value4;
        value4 = value4.parentElement
      )
        value4.tagName.toLowerCase() === "svg" && (value2 = value4);
      let value3: Dynamic = value2
        ? parseInt(value2.getAttribute(runtime.DcTplAttribute) ?? "", 10)
        : NaN;
      return Number.isFinite(value3) ? value3 : input2;
    };
    return (0, runtime.selectedRootElementIds)(input, [
      ...new Set(
        options
          .filter((input2?: Dynamic): Dynamic => input.element(input2) != null)
          .map(callback),
      ),
    ]);
  }
  function getSvgFlipEndpoints(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic =
        input.tagName(options) === "svg" ? input.element(options) : null,
      value2: Dynamic = value ? (0, runtime.inspectSvgArrow)(value) : null,
      value3: Dynamic = (0, runtime.parseCssTransform)(
        input.effectiveStyleValue(options, "transform"),
      );
    if (!value2 || !value3 || (0, runtime.serializeCssTransform)(value3) !== "")
      return null;
    let value4: Dynamic = parseInt(
        value2.shaft.getAttribute(runtime.DcTplAttribute) ?? "",
        10,
      ),
      value5: Dynamic = input.attributes(options),
      value6: Dynamic = (value5.viewBox ?? "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);
    return !Number.isFinite(value4) ||
      value6.length !== 4 ||
      value6.some((input2?: Dynamic): Dynamic => !Number.isFinite(input2)) ||
      !(value6[2] > 0) ||
      !(value6[3] > 0) ||
      !/^(none|xMidYMid)\b/.test(
        (value5.preserveAspectRatio ?? "xMidYMid").trim(),
      )
      ? null
      : {
          shaft: value2,
          shaftTid: value4,
          x: value6[0],
          y: value6[1],
          w: value6[2],
          h: value6[3],
        };
  }
  function elementFlipRefusal(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = input.tagName(options) ?? "";
    if (value2 === "dc-import" || value2 === "x-import")
      return GeometryFlipElementsLabel;
    if (GeometryFlipElementsScIfScForPattern.test(value2))
      return GeometryFlipElementsLabel_2;
    if (input.isUneditable(options))
      return ThisComponentManagesItselfSoItMessage;
    if (!context) return CouldnTFlipRightNowTryAgainMessage;
    if (context.boxless) return ThisOnlyWrapsOtherLayersSoMessage;
    if (context.unrendered) return ThisIsnTShownOnThePageMessage;
    let value3: Dynamic = input.effectiveStyleValue(options, "transform");
    if (
      context.axisProps ||
      (context.transformed && ["", "none"].includes(value3.trim()))
    )
      return GeometryFlipElementsLabel_3;
    let value4: Dynamic = getSvgFlipEndpoints(input, options);
    if (value4)
      return (
        value === "horizontal"
          ? value4.shaft.sx === value4.shaft.ex &&
            2 * value4.x + value4.w === 2 * value4.shaft.sx
          : value4.shaft.sy === value4.shaft.ey &&
            2 * value4.y + value4.h === 2 * value4.shaft.sy
      )
        ? FlippingThisWayWouldnTChangeItMessage
        : undefined;
    if (context.inline) return GeometryFlipElementsLabel_4;
    if (value === "horizontal" ? context.flat?.x : context.flat?.y)
      return value === "horizontal"
        ? ThisHasNoWidthOfItsMessage
        : ThisHasNoHeightOfItsMessage;
    let value5: Dynamic = flipElementTransform(value3, value, context.centre);
    return value5 === null
      ? GeometryFlipElementsLabel_3
      : value5 === "offset"
        ? GeometryFlipElementsLabel_5
        : input.isLoopDriven(options) &&
            value5 !== flipElementTransform(value3, value)
          ? ThisRepeatedElementCanTBeFlippedMessage
          : undefined;
  }
  function selectionFlipRefusal(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic;
    for (let value3 of flipSelectionTargets(input, options) as Dynamic) {
      let value4: Dynamic = elementFlipRefusal(
        input,
        value3,
        value.get(value3),
        context,
      );
      if (value4 === undefined) return;
      value2 ??= value4;
    }
    return value2;
  }
  function canFlipSelection(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return selectionFlipRefusal(
      input,
      options,
      context,
      new Map(
        flipSelectionTargets(input, options).map(
          (input2?: Dynamic): Dynamic => [
            input2,
            {
              centre: {
                x: 0,
                y: 0,
              },
            },
          ],
        ),
      ),
    );
  }
  function selectionNeedsFlipInspection(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return flipSelectionTargets(input, options).some(
      (input2?: Dynamic): Dynamic =>
        elementFlipRefusal(input, input2, context.get(input2), "horizontal") ===
        CouldnTFlipRightNowTryAgainMessage,
    );
  }
  function flipModelSelection(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = flipSelectionTargets(input, options),
      value3: Dynamic = value2.map(
        (input2?: Dynamic): Dynamic =>
          elementFlipRefusal(input, input2, value.get(input2), context),
      );
    if (value3.includes(CouldnTFlipRightNowTryAgainMessage))
      return {
        flipped: [],
        refused: CouldnTFlipRightNowTryAgainMessage,
      };
    let items: Dynamic = [],
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        Math.round(input2 * 1e4) / 1e4 || 0,
      callback2: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        context === "horizontal"
          ? callback(2 * input2.x + input2.w - options2)
          : options2,
      callback3: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        context === "vertical"
          ? callback(2 * input2.y + input2.h - options2)
          : options2;
    value2.forEach((input2?: Dynamic, options2?: Dynamic): Dynamic => {
      if (value3[options2] !== undefined) return;
      let value5: Dynamic = getSvgFlipEndpoints(input, input2);
      if (value5) {
        let {
          shaft: shaft,
          sx: shaft2,
          sy: shaft3,
          ex: shaft4,
          ey: shaft5,
          legacy: shaft6,
        }: Dynamic = value5.shaft;
        if (shaft6) {
          let value6: Dynamic = (shaft.getAttribute("d") ?? "")
              .match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)
              .map(Number),
            callback4: Dynamic = (input3?: Dynamic): Dynamic =>
              String(callback2(value5, value6[2 * input3])) +
              " " +
              String(callback3(value5, value6[2 * input3 + 1]));
          input.setAttribute(
            value5.shaftTid,
            "d",
            "M " +
              callback4(0) +
              " L " +
              callback4(1) +
              " M " +
              callback4(2) +
              " L " +
              callback4(3) +
              " L " +
              callback4(4),
          );
        } else
          (0, runtime.setSvgLineEndpoints)(
            input,
            value5.shaftTid,
            callback2(value5, shaft2),
            callback3(value5, shaft3),
            callback2(value5, shaft4),
            callback3(value5, shaft5),
          );
      } else {
        let value6: Dynamic = flipElementTransform(
            input.effectiveStyleValue(input2, "transform"),
            context,
            value.get(input2)?.centre,
          ),
          value7: Dynamic =
            (0, runtime.getStyleProperty)(
              input.classOnlyStyleAttr(input2),
              "transform",
            ) !== "";
        input.setStyleProperty(
          input2,
          "transform",
          value6 || (value7 ? "none" : null),
        );
      }
      items.push(input2);
    });
    let value4: Dynamic =
      value3.find(
        (input2?: Dynamic): Dynamic =>
          input2 !== undefined &&
          input2 !== FlippingThisWayWouldnTChangeItMessage,
      ) ??
      (items.length === 0
        ? value3.find((input2?: Dynamic): Dynamic => input2 !== undefined)
        : undefined);
    return value4 === undefined
      ? {
          flipped: items,
        }
      : {
          flipped: items,
          refused: value4,
        };
  }
  function partialFlipMessage(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = {},
  ): Dynamic {
    let value: Dynamic =
      GeometryFlipElementsYtMytOytConfig[input] ?? context[input];
    return options
      ? value !== undefined
        ? "Couldn\u2019t flip " + value + ". The rest flipped."
        : "Part of the selection couldn\u2019t be flipped. The rest flipped."
      : input.endsWith(".")
        ? input
        : input + ".";
  }
  bindRuntimeValue(
    runtime,
    "GeometryFlipElementsLabel",
    () => GeometryFlipElementsLabel,
    (value) => {
      GeometryFlipElementsLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisComponentManagesItselfSoItMessage",
    () => ThisComponentManagesItselfSoItMessage,
    (value) => {
      ThisComponentManagesItselfSoItMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipElementsLabel_2",
    () => GeometryFlipElementsLabel_2,
    (value) => {
      GeometryFlipElementsLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisOnlyWrapsOtherLayersSoMessage",
    () => ThisOnlyWrapsOtherLayersSoMessage,
    (value) => {
      ThisOnlyWrapsOtherLayersSoMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisHasNoWidthOfItsMessage",
    () => ThisHasNoWidthOfItsMessage,
    (value) => {
      ThisHasNoWidthOfItsMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisHasNoHeightOfItsMessage",
    () => ThisHasNoHeightOfItsMessage,
    (value) => {
      ThisHasNoHeightOfItsMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisIsnTShownOnThePageMessage",
    () => ThisIsnTShownOnThePageMessage,
    (value) => {
      ThisIsnTShownOnThePageMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipElementsLabel_3",
    () => GeometryFlipElementsLabel_3,
    (value) => {
      GeometryFlipElementsLabel_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipElementsLabel_4",
    () => GeometryFlipElementsLabel_4,
    (value) => {
      GeometryFlipElementsLabel_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipElementsLabel_5",
    () => GeometryFlipElementsLabel_5,
    (value) => {
      GeometryFlipElementsLabel_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisRepeatedElementCanTBeFlippedMessage",
    () => ThisRepeatedElementCanTBeFlippedMessage,
    (value) => {
      ThisRepeatedElementCanTBeFlippedMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FlippingThisWayWouldnTChangeItMessage",
    () => FlippingThisWayWouldnTChangeItMessage,
    (value) => {
      FlippingThisWayWouldnTChangeItMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FinishEditingThisDrawingSPointsToMessage",
    () => FinishEditingThisDrawingSPointsToMessage,
    (value) => {
      FinishEditingThisDrawingSPointsToMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipElementsLabel_6",
    () => GeometryFlipElementsLabel_6,
    (value) => {
      GeometryFlipElementsLabel_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CouldnTFlipRightNowTryAgainMessage",
    () => CouldnTFlipRightNowTryAgainMessage,
    (value) => {
      CouldnTFlipRightNowTryAgainMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipElementsYtMytOytConfig",
    () => GeometryFlipElementsYtMytOytConfig,
    (value) => {
      GeometryFlipElementsYtMytOytConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipElementsTransformRotateScaleValues",
    () => GeometryFlipElementsTransformRotateScaleValues,
    (value) => {
      GeometryFlipElementsTransformRotateScaleValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipElementsLimit",
    () => GeometryFlipElementsLimit,
    (value) => {
      GeometryFlipElementsLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipElementsLimit_2",
    () => GeometryFlipElementsLimit_2,
    (value) => {
      GeometryFlipElementsLimit_2 = value;
    },
  );
  bindRuntimeValue(runtime, "parseFlipInspection", () => parseFlipInspection);
  bindRuntimeValue(runtime, "inspectFlipSelection", () => inspectFlipSelection);
  bindRuntimeValue(
    runtime,
    "GeometryFlipElementsTranslateTranslatexTranslateyConfig",
    () => GeometryFlipElementsTranslateTranslatexTranslateyConfig,
    (value) => {
      GeometryFlipElementsTranslateTranslatexTranslateyConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isOrderedSimpleTransform",
    () => isOrderedSimpleTransform,
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipElementsDegRadTurnConfig",
    () => GeometryFlipElementsDegRadTurnConfig,
    (value) => {
      GeometryFlipElementsDegRadTurnConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GeometryFlipElementsHandler",
    () => GeometryFlipElementsHandler,
    (value) => {
      GeometryFlipElementsHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "serializeFlipTransform",
    () => serializeFlipTransform,
  );
  bindRuntimeValue(runtime, "flipElementTransform", () => flipElementTransform);
  bindRuntimeValue(runtime, "flipSelectionTargets", () => flipSelectionTargets);
  bindRuntimeValue(runtime, "getSvgFlipEndpoints", () => getSvgFlipEndpoints);
  bindRuntimeValue(
    runtime,
    "GeometryFlipElementsScIfScForPattern",
    () => GeometryFlipElementsScIfScForPattern,
    (value) => {
      GeometryFlipElementsScIfScForPattern = value;
    },
  );
  bindRuntimeValue(runtime, "elementFlipRefusal", () => elementFlipRefusal);
  bindRuntimeValue(runtime, "selectionFlipRefusal", () => selectionFlipRefusal);
  bindRuntimeValue(runtime, "canFlipSelection", () => canFlipSelection);
  bindRuntimeValue(
    runtime,
    "selectionNeedsFlipInspection",
    () => selectionNeedsFlipInspection,
  );
  bindRuntimeValue(runtime, "flipModelSelection", () => flipModelSelection);
  bindRuntimeValue(runtime, "partialFlipMessage", () => partialFlipMessage);
  return () => {
    GeometryFlipElementsLabel = "A component instance can\u2019t be flipped";
    ThisComponentManagesItselfSoItMessage =
      "This component manages itself, so it can\u2019t be flipped";
    GeometryFlipElementsLabel_2 =
      "A conditional or repeating group can\u2019t be flipped. Flip what is inside it.";
    ThisOnlyWrapsOtherLayersSoMessage =
      "This only wraps other layers, so it can\u2019t be flipped. Flip what is inside it.";
    ThisHasNoWidthOfItsMessage =
      "This has no width of its own, so it can\u2019t be flipped this way. Flip what\u2019s inside it.";
    ThisHasNoHeightOfItsMessage =
      "This has no height of its own, so it can\u2019t be flipped this way. Flip what\u2019s inside it.";
    ThisIsnTShownOnThePageMessage =
      "This isn\u2019t shown on the page right now, so it can\u2019t be flipped. Show it first.";
    GeometryFlipElementsLabel_3 =
      // CucCut: user-facing copy calls the agent "the agent", not Claude.
      "Its rotation or scale is set in code the editor can\u2019t change, so it can\u2019t be flipped here. Ask the agent in chat to flip it.";
    GeometryFlipElementsLabel_4 =
      "Part of a line of text can\u2019t be flipped on its own. Flip the whole text block.";
    GeometryFlipElementsLabel_5 =
      "Its position is set in a way the editor can\u2019t adjust, so it can\u2019t be flipped in place. Ask the agent in chat to flip it.";
    ThisRepeatedElementCanTBeFlippedMessage =
      "This repeated element can\u2019t be flipped in place. Ask the agent in chat to flip it.";
    FlippingThisWayWouldnTChangeItMessage =
      "Flipping this way wouldn\u2019t change it";
    FinishEditingThisDrawingSPointsToMessage =
      "Finish editing this drawing\u2019s points to flip it";
    GeometryFlipElementsLabel_6 = "Finish cropping to flip";
    CouldnTFlipRightNowTryAgainMessage =
      "Couldn\u2019t flip right now. Try again.";
    GeometryFlipElementsYtMytOytConfig = {
      [GeometryFlipElementsLabel]: "a component instance",
      [ThisComponentManagesItselfSoItMessage]:
        "a component that manages itself",
      [GeometryFlipElementsLabel_2]: "a conditional or repeating group",
      [ThisOnlyWrapsOtherLayersSoMessage]: "a layer that only wraps others",
      [ThisHasNoWidthOfItsMessage]: "a layer with no width of its own",
      [ThisHasNoHeightOfItsMessage]: "a layer with no height of its own",
      [ThisIsnTShownOnThePageMessage]: "a hidden layer",
      [GeometryFlipElementsLabel_3]: "an element rotated or scaled in code",
      [GeometryFlipElementsLabel_4]: "part of a line of text",
      [GeometryFlipElementsLabel_5]: "an element positioned in code",
      [ThisRepeatedElementCanTBeFlippedMessage]: "a repeated element",
    };
    GeometryFlipElementsTransformRotateScaleValues = [
      "transform",
      "rotate",
      "scale",
      "translate",
    ];
    GeometryFlipElementsLimit = 1e5;
    GeometryFlipElementsLimit_2 = 1;
    GeometryFlipElementsTranslateTranslatexTranslateyConfig = {
      translate: 0,
      translatex: 0,
      translatey: 0,
      rotate: 1,
      scale: 2,
      scalex: 2,
      scaley: 2,
    };
    GeometryFlipElementsDegRadTurnConfig = {
      deg: Math.PI / 180,
      rad: 1,
      turn: 2 * Math.PI,
      grad: Math.PI / 200,
    };
    GeometryFlipElementsHandler = (input?: Dynamic): Dynamic =>
      Math.round(input * 100) / 100 || 0;
    GeometryFlipElementsScIfScForPattern = /^(sc-if|sc-for|helmet|sc-helmet)$/i;
  };
}
