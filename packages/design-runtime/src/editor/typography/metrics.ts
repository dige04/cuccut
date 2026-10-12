/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorTypographyMetrics(
  runtime: RuntimeBindings,
): () => void {
  var TypographyMetricsSansSerifMonoConfig: Dynamic;
  var TypographyMetricsMin: Dynamic;
  var TypographyMetricsHandler: Dynamic;
  var TypographyMetricsHandler_2: Dynamic;
  var TypographyMetricsFontSize: Dynamic;
  var TypographyMetricsLineHeight: Dynamic;
  var TypographyMetricsLetterSpacing: Dynamic;
  function typographyStyleEdits(input?: Dynamic): Dynamic {
    let items: Dynamic = [
        ["font-size", String(TypographyMetricsFontSize(input)) + "px"],
        ["line-height", String(TypographyMetricsLineHeight(input))],
        ["font-weight", String(TypographyMetricsHandler(input.fontWeight))],
        [
          "letter-spacing",
          String(TypographyMetricsLetterSpacing(input)) + "px",
        ],
        ["font-style", input.italic ? "italic" : "normal"],
      ],
      value: Dynamic = normalizeTypographyFamily(input.family);
    value !== undefined && items.push(["font-family", value]);
    return items;
  }
  function normalizeTypographyFamily(input?: Dynamic): Dynamic {
    if (input === undefined) return;
    let callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let value2: Dynamic = null;
        for (let value3 of input2 as Dynamic)
          value2 =
            value2 === null
              ? value3 === '"' || value3 === "'"
                ? value3
                : null
              : value3 === value2
                ? null
                : value2;
        return value2 === null;
      },
      callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        runtime.InspectorComputedDataPattern.test(input2) &&
        callback(input2) &&
        (typeof CSS === "undefined" ||
          typeof CSS.supports != "function" ||
          CSS.supports("font-family", input2));
    if (callback2(input.stack)) return input.stack;
    let value: Dynamic =
      '"' +
      input.name.replace(/"/g, "") +
      '", ' +
      TypographyMetricsSansSerifMonoConfig[input.generic];
    return input.name !== "" && callback2(value)
      ? value
      : TypographyMetricsSansSerifMonoConfig[input.generic];
  }
  function matchedDesignSystemTextStyle(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let {
      size: value,
      weight: value2,
      italic: value3,
      leading: value4,
      tracking: value5,
      face: value6,
    }: Dynamic = options;
    if (
      value === undefined ||
      value2 === undefined ||
      value3 === undefined ||
      value4 === undefined ||
      value5 === undefined
    )
      return;
    let callback: Dynamic = (
        input2?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
        value9?: Dynamic,
      ): Dynamic =>
        TypographyMetricsHandler_2(context) === options2
          ? 0
          : Math.abs(input2 - context) / value9,
      value7: Dynamic,
      value8: Dynamic = 1 / 0;
    for (let value9 of input as Dynamic) {
      let style: Dynamic = value9.style;
      if (
        TypographyMetricsHandler(style.fontWeight) !==
          TypographyMetricsHandler(value2) ||
        style.italic !== value3 ||
        (style.family !== undefined &&
          (0, runtime.displayFontFamily)(
            normalizeTypographyFamily(style.family) ?? "",
          ).toLowerCase() !== value6)
      )
        continue;
      let items: Dynamic = [
        callback(style.fontSize, TypographyMetricsFontSize(style), value, 0.05),
        callback(
          style.lineHeight,
          TypographyMetricsLineHeight(style),
          value4,
          0.02,
        ),
        callback(
          style.letterSpacing,
          TypographyMetricsLetterSpacing(style),
          value5,
          0.05,
        ),
      ];
      if (items.some((input2?: Dynamic): Dynamic => input2 > 1 + 1e-9))
        continue;
      let value10: Dynamic = items[0] + items[1] + items[2];
      value10 < value8 && ((value7 = value9), (value8 = value10));
    }
    return value7;
  }
  function readTypographyMetrics(input?: Dynamic, options?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let value2: Dynamic =
          input2 == null ? null : /^\s*(-?\d+(?:\.\d+)?)px\s*$/.exec(input2);
        return value2 ? parseFloat(value2[1]) : undefined;
      },
      callback2: Dynamic = (input2?: Dynamic): Dynamic => {
        let value2: Dynamic =
          input2 == null ? null : /^\s*(\d+(?:\.\d+)?)\s*$/.exec(input2);
        return value2 ? parseFloat(value2[1]) : undefined;
      },
      callback3: Dynamic = (input2?: Dynamic): Dynamic => {
        if (input2 == null) return;
        if (input2 === "bold") return 700;
        if (input2 === "normal") return 400;
        let value2: Dynamic = Number.parseFloat(input2);
        return Number.isFinite(value2) ? value2 : undefined;
      },
      value: Dynamic = input("font-style") ?? options.fontStyle ?? "normal";
    return {
      size: callback(input("font-size")) ?? callback(options.fontSize),
      weight: callback3(input("font-weight") ?? options.fontWeight),
      italic:
        value === "italic" ? true : value === "normal" ? false : undefined,
      leading: callback2(input("line-height")) ?? callback2(options.lineHeight),
      tracking:
        callback(input("letter-spacing")) ?? callback(options.letterSpacing),
      face: (0, runtime.displayFontFamily)(
        input("font-family") ?? options.fontFamily ?? "",
      ).toLowerCase(),
    };
  }
  function authoredTypographyMetrics(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let entries: Dynamic = new Map(
        (0, runtime.parseStyleDeclarations)(options).map(
          (input2?: Dynamic): Dynamic => [input2.prop, input2.value],
        ),
      ),
      value: Dynamic = (0, runtime.normalizeInspectorComputedData)("text", {
        tag: input,
        computed: context,
      });
    return readTypographyMetrics(
      (input2?: Dynamic): Dynamic => entries.get(input2),
      value,
    );
  }
  function resolvedTypographyMetrics(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return readTypographyMetrics(
      (input2?: Dynamic): Dynamic =>
        input.get(input2) ??
        (input2 === "font-size"
          ? options?.fontSize
          : input2 === "font-family"
            ? options?.fontFamily
            : undefined) ??
        undefined,
      {
        fontSize: options?.rendered?.fontSizePx,
        fontWeight: options?.rendered?.fontWeight,
        fontStyle: options?.rendered?.fontStyle,
        lineHeight: options?.rendered?.lineHeight,
        letterSpacing: options?.rendered?.letterSpacing,
        fontFamily: options?.rendered?.fontFamily,
      },
    );
  }
  bindRuntimeValue(
    runtime,
    "TypographyMetricsSansSerifMonoConfig",
    () => TypographyMetricsSansSerifMonoConfig,
    (value) => {
      TypographyMetricsSansSerifMonoConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyMetricsMin",
    () => TypographyMetricsMin,
    (value) => {
      TypographyMetricsMin = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyMetricsHandler",
    () => TypographyMetricsHandler,
    (value) => {
      TypographyMetricsHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyMetricsHandler_2",
    () => TypographyMetricsHandler_2,
    (value) => {
      TypographyMetricsHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyMetricsFontSize",
    () => TypographyMetricsFontSize,
    (value) => {
      TypographyMetricsFontSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyMetricsLineHeight",
    () => TypographyMetricsLineHeight,
    (value) => {
      TypographyMetricsLineHeight = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyMetricsLetterSpacing",
    () => TypographyMetricsLetterSpacing,
    (value) => {
      TypographyMetricsLetterSpacing = value;
    },
  );
  bindRuntimeValue(runtime, "typographyStyleEdits", () => typographyStyleEdits);
  bindRuntimeValue(
    runtime,
    "normalizeTypographyFamily",
    () => normalizeTypographyFamily,
  );
  bindRuntimeValue(
    runtime,
    "matchedDesignSystemTextStyle",
    () => matchedDesignSystemTextStyle,
  );
  bindRuntimeValue(
    runtime,
    "readTypographyMetrics",
    () => readTypographyMetrics,
  );
  bindRuntimeValue(
    runtime,
    "authoredTypographyMetrics",
    () => authoredTypographyMetrics,
  );
  bindRuntimeValue(
    runtime,
    "resolvedTypographyMetrics",
    () => resolvedTypographyMetrics,
  );
  return () => {
    TypographyMetricsSansSerifMonoConfig = {
      sans: "sans-serif",
      serif: "serif",
      mono: "monospace",
    };
    TypographyMetricsMin = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => Math.min(context, Math.max(options, input));
    TypographyMetricsHandler = (input?: Dynamic): Dynamic =>
      TypographyMetricsMin(Math.round(input / 100) * 100, 100, 900);
    TypographyMetricsHandler_2 = (input?: Dynamic): Dynamic =>
      Math.round(input * 100) / 100;
    TypographyMetricsFontSize = (input?: Dynamic): Dynamic =>
      TypographyMetricsHandler_2(TypographyMetricsMin(input.fontSize, 1, 9999));
    TypographyMetricsLineHeight = (input?: Dynamic): Dynamic =>
      TypographyMetricsHandler_2(
        TypographyMetricsMin(input.lineHeight, 0.1, 99),
      );
    TypographyMetricsLetterSpacing = (input?: Dynamic): Dynamic =>
      TypographyMetricsHandler_2(
        TypographyMetricsMin(input.letterSpacing, -999, 999),
      );
  };
}
