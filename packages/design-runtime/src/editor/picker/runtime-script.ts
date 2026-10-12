/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorPickerRuntimeScript(
  runtime: RuntimeBindings,
): () => void {
  var PickerRuntimeScriptTAppAccentConfig: Dynamic;
  var DcEditorEvtValue: Dynamic;
  var DcLinkNewAttribute: Dynamic;
  var pickerCursorCss: Dynamic;
  var buildPickerRuntimeScript: Dynamic;
  function parseDirectiveMap(input?: Dynamic): Dynamic {
    if (typeof input != "object" || input == null) return null;
    let value: Dynamic = Object.entries(input);
    if (value.length > 2048) return null;
    let state: Dynamic = {};
    for (let [value2, value3] of value as Dynamic) {
      let value4: Dynamic = Number(value2);
      if (
        !Number.isInteger(value4) ||
        value4 < 0 ||
        typeof value3 != "object" ||
        value3 == null
      )
        continue;
      let { on: value5, count: value6 }: Dynamic = value3;
      typeof value5 == "boolean"
        ? (state[value4] = {
            on: value5,
          })
        : typeof value6 == "number" &&
          Number.isFinite(value6) &&
          value6 >= 0 &&
          (state[value4] = {
            count: Math.floor(value6),
          });
    }
    return state;
  }
  function pickerElementSignature(
    element?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic => {
        let value2: Dynamic = (
          input.localName ||
          input.tagName ||
          ""
        ).toLowerCase();
        return value2.indexOf("sc-raw-") === 0 ? value2.slice(7) : value2;
      },
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        let value2: Dynamic = callback(input);
        return (
          /^(svg|img|video|audio|canvas|picture|iframe|object|embed|input|textarea|select|button|hr|dc-import|x-import)$/.test(
            value2,
          ) ||
          value2.indexOf("-") > 0 ||
          input.hasAttribute("data-sc-name") ||
          !!(input.classList && input.classList.contains("sc-host-x"))
        );
      };
    if (
      callback2(element) ||
      options(callback(element)) ||
      element.querySelector("[data-dc-tpl]")
    )
      return false;
    let value: Dynamic = element.querySelectorAll("*");
    for (let index: Dynamic = 0; index < value.length; index++)
      if (callback2(value[index])) return false;
    return !(element.textContent || "").trim();
  }
  function computedWidth(input?: Dynamic): Dynamic {
    let value: Dynamic = parseFloat(input.width);
    return value > 0 ? Math.ceil(value * 100) / 100 : 0;
  }
  function emptyElementHeight(element?: Dynamic, options?: Dynamic): Dynamic {
    let text: Dynamic = "img,svg,video,canvas,iframe,picture";
    if (
      (element.textContent || "").trim() !== "" ||
      element.matches(text) ||
      element.querySelector(text)
    )
      return 0;
    let value: Dynamic = parseFloat(options.height);
    return value > 0 ? Math.ceil(value * 100) / 100 : 0;
  }
  function computedTextMetrics(
    input?: Dynamic,
    options?: Dynamic,
    items?: Dynamic,
  ): Dynamic {
    let value: Dynamic =
      options.display === "list-item" || input.tagName === "LI";
    if (!value && (input.textContent || "").trim() === "") return null;
    let state: Dynamic = {};
    for (let index: Dynamic = 0; index < items.length; index++) {
      let value2: Dynamic = items[index];
      if (
        (value2 === "list-style-type" && !value) ||
        (value2 === "text-align" && options.display === "inline")
      )
        continue;
      let value3: Dynamic = options.getPropertyValue(value2);
      value3 && (state[value2] = value3);
    }
    return state;
  }
  bindRuntimeValue(
    runtime,
    "PickerRuntimeScriptTAppAccentConfig",
    () => PickerRuntimeScriptTAppAccentConfig,
    (value) => {
      PickerRuntimeScriptTAppAccentConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DcEditorEvtValue",
    () => DcEditorEvtValue,
    (value) => {
      DcEditorEvtValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DcLinkNewAttribute",
    () => DcLinkNewAttribute,
    (value) => {
      DcLinkNewAttribute = value;
    },
  );
  bindRuntimeValue(runtime, "parseDirectiveMap", () => parseDirectiveMap);
  bindRuntimeValue(
    runtime,
    "pickerElementSignature",
    () => pickerElementSignature,
  );
  bindRuntimeValue(runtime, "computedWidth", () => computedWidth);
  bindRuntimeValue(runtime, "emptyElementHeight", () => emptyElementHeight);
  bindRuntimeValue(runtime, "computedTextMetrics", () => computedTextMetrics);
  bindRuntimeValue(
    runtime,
    "pickerCursorCss",
    () => pickerCursorCss,
    (value) => {
      pickerCursorCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buildPickerRuntimeScript",
    () => buildPickerRuntimeScript,
    (value) => {
      buildPickerRuntimeScript = value;
    },
  );
  return () => {
    PickerRuntimeScriptTAppAccentConfig = {
      "--t-app-accent": "var(--cds-fill-accent, #2a78d6)",
    };
    DcEditorEvtValue = "__dcEditorEvt";
    DcLinkNewAttribute = "data-dc-link-new";
    pickerCursorCss =
      "url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2216%22%20height=%2216%22%20viewBox=%220%200%2016%2016%22%3E%3Cpath%20d=%22M2%2014l1-4%208-8a2.1%202.1%200%200%201%203%203l-8%208-4%201z%22%20fill=%22%23333%22%20stroke=%22%23fff%22%20stroke-width=%221%22/%3E%3C/svg%3E') 1 15, crosshair";
    buildPickerRuntimeScript = (): Dynamic => runtime.injected_E7t;
  };
}
