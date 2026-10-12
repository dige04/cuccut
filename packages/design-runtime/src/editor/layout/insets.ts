/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorLayoutInsets(
  runtime: RuntimeBindings,
): () => void {
  function parseAuthoredInsets(input?: Dynamic): Dynamic {
    let state: Dynamic = {
      inset: {
        top: "auto",
        right: "auto",
        bottom: "auto",
        left: "auto",
      },
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    };
    for (let value of input.split(";") as Dynamic) {
      let value2: Dynamic = value.indexOf(":"),
        value3: Dynamic =
          value2 < 0 ? "" : value.slice(0, value2).trim().toLowerCase(),
        value4: Dynamic =
          value2 < 0
            ? []
            : value
                .slice(value2 + 1)
                .replace(/!important/i, "")
                .trim()
                .toLowerCase()
                .split(/\s+/),
        value5: Dynamic = /^(?:margin-)?(top|right|bottom|left)$/.exec(
          value3,
        )?.[1],
        value6: Dynamic = /^(?:inset|margin)-(inline|block)$/.exec(value3)?.[1],
        value7: Dynamic =
          /^(inset|margin)(-inline|-block)?$/.exec(value3)?.[1] ??
          (value5 == null
            ? null
            : value3.startsWith("margin-")
              ? "margin"
              : "inset");
      (value7 !== "inset" && value7 !== "margin") ||
        value4[0] == null ||
        (value5
          ? (state[value7][value5] = value4[0])
          : value6 === "inline"
            ? Object.assign(state[value7], {
                left: value4[0],
                right: value4[1] ?? value4[0],
              })
            : value6 === "block"
              ? Object.assign(state[value7], {
                  top: value4[0],
                  bottom: value4[1] ?? value4[0],
                })
              : Object.assign(state[value7], {
                  top: value4[0],
                  right: value4[1] ?? value4[0],
                  bottom: value4[2] ?? value4[0],
                  left: value4[3] ?? value4[1] ?? value4[0],
                }));
    }
    return state;
  }
  function isUnconstrainedAbsoluteElement(
    element?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = element.getAttribute("style") ?? "",
      value2: Dynamic = (0, runtime.getStyleProperty)(value, "position").trim();
    if (value2 !== "absolute" && value2 !== "fixed") return false;
    let { inset: value3, margin: value4 }: Dynamic = parseAuthoredInsets(value),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        /^0(px)?$/.test(value3[input]) &&
        /^100(%|vw|vh)$/.test(
          (0, runtime.getStyleProperty)(
            value,
            input === "left" ? "width" : "height",
          ).trim(),
        ),
      value5: Dynamic = callback("left") && callback("top"),
      callback2: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic =>
        ((value3[input] !== "auto" && value3[options2] !== "auto") || value5) &&
        !(value4[input] === "auto" && value4[options2] === "auto"),
      value6: Dynamic = [...element.children].some(
        (input?: Dynamic): Dynamic =>
          !runtime.SelectionActionsHelmetScHelmetPattern.test(input.tagName) &&
          !runtime.HtmlTagNormalizationSubscribers.has(
            input.tagName.toLowerCase(),
          ),
      );
    return !(
      (callback2("left", "right") || callback2("top", "bottom")) &&
      (value6 || options)
    );
  }
  bindRuntimeValue(runtime, "parseAuthoredInsets", () => parseAuthoredInsets);
  bindRuntimeValue(
    runtime,
    "isUnconstrainedAbsoluteElement",
    () => isUnconstrainedAbsoluteElement,
  );
  return () => {};
}
