/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorSelectionNudge(
  runtime: RuntimeBindings,
): () => void {
  var SelectionNudgeDegRadTurnConfig: Dynamic;
  function canMovePositionedSelection(
    input?: Dynamic,
    items?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (items.length === 0) return false;
    for (let value of items as Dynamic) {
      let value2: Dynamic =
        input.inlineStyleValue(value, "position") ||
        (items.length === 1 ? (context ?? "") : "") ||
        "";
      if (value2 !== "absolute" && value2 !== "fixed") return false;
    }
    return true;
  }
  function ancestorTransformScale(input?: Dynamic, options?: Dynamic): Dynamic {
    let [items, items2]: Dynamic = [1, 1];
    for (
      let value: Dynamic = input.parentTid(options);
      value != null;
      value = input.parentTid(value)
    ) {
      if (
        ["rotate", "scale", "translate"].some(
          (input2?: Dynamic): Dynamic =>
            !["", "none"].includes(
              input.effectiveStyleValue(value, input2).trim(),
            ),
        )
      )
        return {
          x: 1,
          y: 1,
        };
      let value2: Dynamic = input
        .effectiveStyleValue(value, "transform")
        .trim();
      if (value2 === "" || value2 === "none") continue;
      let value3: Dynamic = /^matrix\(([^)]*)\)$/i
        .exec(value2)?.[1]!
        .split(",")
        .map(
          (input2?: Dynamic): Dynamic =>
            /^\s*[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?\s*$/i.test(input2)
              ? Number(input2)
              : NaN,
        );
      if (value3) {
        if (
          value3.length !== 6 ||
          value3.some(
            (input2?: Dynamic): Dynamic => !Number.isFinite(input2),
          ) ||
          value3[1] !== 0 ||
          value3[2] !== 0 ||
          value3[0] === 0 ||
          value3[3] === 0
        )
          return {
            x: 1,
            y: 1,
          };
        items *= Math.sign(value3[0]);
        items2 *= Math.sign(value3[3]);
        continue;
      }
      let value4: Dynamic = (0, runtime.parseCssTransform)(value2),
        value5: Dynamic = value4
          ? value4.rotate.value *
            (SelectionNudgeDegRadTurnConfig[
              value4.rotate.unit.toLowerCase() || "deg"
            ] ?? NaN)
          : NaN;
      if (!value4 || !(Math.abs(Math.sin(value5 * Math.PI)) <= 1e-4))
        return {
          x: 1,
          y: 1,
        };
      let value6: Dynamic = Math.round(value5) % 2 === 0 ? 1 : -1;
      items *= value6 * Math.sign(value4.scaleX || 1);
      items2 *= value6 * Math.sign(value4.scaleY || 1);
    }
    return {
      x: items < 0 ? -1 : 1,
      y: items2 < 0 ? -1 : 1,
    };
  }
  function nudgeModelSelection(
    input?: Dynamic,
    items?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = items.length === 1;
    for (let value3 of items as Dynamic) {
      let value4: Dynamic = ancestorTransformScale(input, value3),
        [items2, items3]: Dynamic = [context * value4.x, value * value4.y],
        callback: Dynamic = (input2?: Dynamic): Dynamic => {
          let value7: Dynamic = input.inlineStyleValue(value3, input2),
            value8: Dynamic = parseFloat(
              value7 || (value2 && extra ? (extra[input2] ?? "") : "") || "0",
            );
          return Number.isFinite(value8) ? value8 : 0;
        },
        callback2: Dynamic = (input2?: Dynamic): Dynamic =>
          !!input.inlineStyleValue(value3, input2),
        value5: Dynamic =
          callback2("right") && !callback2("left") ? "right" : "left",
        value6: Dynamic =
          callback2("bottom") && !callback2("top") ? "bottom" : "top";
      items2 !== 0 &&
        input.setStyleProperty(
          value3,
          value5,
          `${callback(value5) + (value5 === "right" ? -items2 : items2)}px`,
        );
      items3 !== 0 &&
        input.setStyleProperty(
          value3,
          value6,
          `${callback(value6) + (value6 === "bottom" ? -items3 : items3)}px`,
        );
    }
  }
  function hasPositionedSelectionAxes(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
      !!input.inlineStyleValue(input2, options2);
    return options.every(
      (input2?: Dynamic): Dynamic =>
        (context === 0 ||
          callback(input2, "left") ||
          callback(input2, "right")) &&
        (value === 0 || callback(input2, "top") || callback(input2, "bottom")),
    );
  }
  bindRuntimeValue(
    runtime,
    "canMovePositionedSelection",
    () => canMovePositionedSelection,
  );
  bindRuntimeValue(
    runtime,
    "SelectionNudgeDegRadTurnConfig",
    () => SelectionNudgeDegRadTurnConfig,
    (value) => {
      SelectionNudgeDegRadTurnConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ancestorTransformScale",
    () => ancestorTransformScale,
  );
  bindRuntimeValue(runtime, "nudgeModelSelection", () => nudgeModelSelection);
  bindRuntimeValue(
    runtime,
    "hasPositionedSelectionAxes",
    () => hasPositionedSelectionAxes,
  );
  return () => {
    SelectionNudgeDegRadTurnConfig = {
      deg: 1 / 180,
      rad: 1 / Math.PI,
      turn: 2,
      grad: 1 / 200,
    };
  };
}
