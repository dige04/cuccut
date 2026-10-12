/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasHeaderTheme(runtime: RuntimeBindings): () => void {
  var quickActionImagePreviewMaxBytes: Dynamic;
  var defaultDarkHeaderColor: Dynamic;
  var defaultLightHeaderColor: Dynamic;
  var opaqueHeaderColorPattern: Dynamic;
  var headerColorCanvasContext: Dynamic;
  function parseHeaderCssColor(color?: Dynamic): Dynamic {
    if (color.length > 64 || /currentcolor/i.test(color)) return;
    if (headerColorCanvasContext === undefined) {
      let value3: Dynamic =
        typeof document === "undefined"
          ? null
          : (document as Dynamic).createElement("canvas");
      value3 && (value3.width = value3.height = 1);
      headerColorCanvasContext = value3?.getContext("2d") ?? null;
    }
    let value: Dynamic = headerColorCanvasContext;
    if (!value) return (0, runtime.normalizeCssColor)(color);
    let callback: Dynamic = (input?: Dynamic): Dynamic => (
        (value.fillStyle = input),
        (value.fillStyle = color),
        String(value.fillStyle)
      ),
      value2: Dynamic = callback("#010203");
    return value2 === callback("#030201") ? value2 : undefined;
  }
  function artboardHeaderTheme(
    theme?: Dynamic,
    parseColor: Dynamic = parseHeaderCssColor,
  ): Dynamic {
    let value: Dynamic = theme ? theme.background || theme.backgroundColor : "";
    if (!theme || !value) return null;
    let value2: Dynamic = Object.hasOwn(theme.vars, value)
        ? theme.vars[value]
        : value,
      value3: Dynamic = typeof value2 == "string" ? value2.trim() : "",
      value4: Dynamic = value3 === "" ? undefined : parseColor(value3),
      value5: Dynamic =
        value4 === undefined || opaqueHeaderColorPattern.test(value4)
          ? value4
          : (0, runtime.normalizeCssColor)(value3),
      value6: Dynamic =
        value5 !== undefined && opaqueHeaderColorPattern.test(value5)
          ? (0, runtime.parseRgbaColor)(value5)
          : undefined;
    return value5 === undefined || value6 === undefined
      ? null
      : {
          bg: value5,
          lightInk:
            (0, runtime.contrastRatio)(defaultLightHeaderColor, value6) >
            (0, runtime.contrastRatio)(defaultDarkHeaderColor, value6),
        };
  }
  bindRuntimeValue(
    runtime,
    "quickActionImagePreviewMaxBytes",
    () => quickActionImagePreviewMaxBytes,
    (value) => {
      quickActionImagePreviewMaxBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultDarkHeaderColor",
    () => defaultDarkHeaderColor,
    (value) => {
      defaultDarkHeaderColor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultLightHeaderColor",
    () => defaultLightHeaderColor,
    (value) => {
      defaultLightHeaderColor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "opaqueHeaderColorPattern",
    () => opaqueHeaderColorPattern,
    (value) => {
      opaqueHeaderColorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "headerColorCanvasContext",
    () => headerColorCanvasContext,
    (value) => {
      headerColorCanvasContext = value;
    },
  );
  bindRuntimeValue(runtime, "parseHeaderCssColor", () => parseHeaderCssColor);
  bindRuntimeValue(runtime, "artboardHeaderTheme", () => artboardHeaderTheme);
  return () => {
    quickActionImagePreviewMaxBytes = 256 * 1024;
    defaultDarkHeaderColor = {
      r: 20 / 255,
      g: 20 / 255,
      b: 19 / 255,
      a: 1,
    };
    defaultLightHeaderColor = {
      r: 1,
      g: 1,
      b: 1,
      a: 1,
    };
    opaqueHeaderColorPattern = /^#[0-9a-f]{6}$/;
  };
}
