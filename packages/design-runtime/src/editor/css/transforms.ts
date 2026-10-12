/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorCssTransforms(
  runtime: RuntimeBindings,
): () => void {
  var CssTransformsTranslateTranslatexTranslateyConfig: Dynamic;
  function parseCssTransform(input?: Dynamic): Dynamic {
    let value: Dynamic = (input ?? "").trim(),
      state: Dynamic = {
        x: {
          value: 0,
          unit: "px",
        },
        y: {
          value: 0,
          unit: "px",
        },
        rotate: {
          value: 0,
          unit: "deg",
        },
        scaleX: 1,
        scaleY: 1,
      };
    if (!value || value === "none") return state;
    if ((0, runtime.classifyStyleValue)(value).kind !== "literal") return null;
    let value2: Dynamic = /([a-zA-Z]+)\(([^)]*)\)/g;
    if (value.replace(value2, "").trim() !== "") return null;
    let values: Dynamic = new Set(),
      value3: Dynamic;
    for (; (value3 = value2.exec(value)); ) {
      let value4: Dynamic = value3[1].toLowerCase(),
        value5: Dynamic = value3[2]
          .split(",")
          .map((input2?: Dynamic): Dynamic => input2.trim()),
        value6: Dynamic = (0, runtime.parseCssNumber)(value5[0] ?? ""),
        value7: Dynamic = (0, runtime.parseCssNumber)(value5[1] ?? "");
      if (
        !value6 ||
        !Object.hasOwn(CssTransformsTranslateTranslatexTranslateyConfig, value4)
      )
        return null;
      for (let value8 of CssTransformsTranslateTranslatexTranslateyConfig[
        value4
      ] as Dynamic) {
        if (values.has(value8)) return null;
        values.add(value8);
      }
      if (
        value5.length >
        CssTransformsTranslateTranslatexTranslateyConfig[value4].length
      )
        return null;
      let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        !!input2 && !input2.unit && input2.value !== 0;
      if (!value4.startsWith("scale") && (callback(value6) || callback(value7)))
        return null;
      if (value4 === "translate") {
        state.x = value6;
        if (value5.length > 1) {
          if (!value7) return null;
          state.y = value7;
        }
      } else if (value4 === "translatex") state.x = value6;
      else if (value4 === "translatey") state.y = value6;
      else if (value4 === "rotate") {
        if (!/^(deg|rad|turn|grad)?$/i.test(value6.unit)) return null;
        state.rotate = {
          value: value6.value,
          unit: value6.unit || "deg",
        };
      } else if (value4 === "scale") {
        if ((value5.length > 1 && !value7) || value6.unit || value7?.unit)
          return null;
        state.scaleX = value6.value;
        state.scaleY = value7 ? value7.value : value6.value;
      } else if (value4 === "scalex" || value4 === "scaley") {
        if (value6.unit) return null;
        value4 === "scalex"
          ? (state.scaleX = value6.value)
          : (state.scaleY = value6.value);
      } else return null;
    }
    return state;
  }
  function serializeCssTransform(input?: Dynamic): Dynamic {
    let items: Dynamic = [];
    (input.x.value !== 0 || input.y.value !== 0) &&
      items.push(
        `translate(${(0, runtime.formatCssNumber)(input.x.value, input.x.unit || "px")}, ${(0, runtime.formatCssNumber)(input.y.value, input.y.unit || "px")})`,
      );
    input.rotate.value !== 0 &&
      items.push(
        `rotate(${(0, runtime.formatCssNumber)(input.rotate.value, input.rotate.unit || "deg")})`,
      );
    (input.scaleX !== 1 || input.scaleY !== 1) &&
      (input.scaleX === input.scaleY
        ? items.push(`scale(${(0, runtime.formatCssNumber)(input.scaleX, "")})`)
        : input.scaleY === 1
          ? items.push(
              `scaleX(${(0, runtime.formatCssNumber)(input.scaleX, "")})`,
            )
          : input.scaleX === 1
            ? items.push(
                `scaleY(${(0, runtime.formatCssNumber)(input.scaleY, "")})`,
              )
            : items.push(
                `scale(${(0, runtime.formatCssNumber)(input.scaleX, "")}, ${(0, runtime.formatCssNumber)(input.scaleY, "")})`,
              ));
    return items.join(" ");
  }
  bindRuntimeValue(runtime, "parseCssTransform", () => parseCssTransform);
  bindRuntimeValue(
    runtime,
    "CssTransformsTranslateTranslatexTranslateyConfig",
    () => CssTransformsTranslateTranslatexTranslateyConfig,
    (value) => {
      CssTransformsTranslateTranslatexTranslateyConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "serializeCssTransform",
    () => serializeCssTransform,
  );
  return () => {
    CssTransformsTranslateTranslatexTranslateyConfig = {
      translate: ["x", "y"],
      translatex: ["x"],
      translatey: ["y"],
      rotate: ["r"],
      scale: ["sx", "sy"],
      scalex: ["sx"],
      scaley: ["sy"],
    };
  };
}
