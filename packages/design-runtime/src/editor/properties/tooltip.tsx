/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesTooltip(
  runtime: RuntimeBindings,
): () => void {
  var jsxPropertiesTooltip: Dynamic;
  var reactPropertiesTooltip: Dynamic;
  var reactPropertiesTooltip_2: Dynamic;
  var reactPropertiesTooltip_3: Dynamic;
  var PropertiesTooltipHandler: Dynamic;
  var TextAlignLeftValue: Dynamic;
  var TextAlignCenterValue: Dynamic;
  var TextAlignRightValue: Dynamic;
  var TextAlignJustifyValue: Dynamic;
  var LineHeightValue: Dynamic;
  var PropertiesTooltipNameViewBoxPathsConfig: Dynamic;
  var PropertiesTooltipNameViewBoxPathsConfig_2: Dynamic;
  var PropertiesTooltipNameViewBoxPathsConfig_3: Dynamic;
  var PropertiesTooltipNameViewBoxPathsConfig_4: Dynamic;
  var CropValue: Dynamic;
  var PropertiesTooltipNameViewBoxPathsConfig_5: Dynamic;
  var PropertiesTooltipNameViewBoxPathsConfig_6: Dynamic;
  var PropertiesTooltipNameViewBoxPathsConfig_7: Dynamic;
  var PropertiesTooltipNameViewBoxPathsConfig_8: Dynamic;
  var PropertiesTooltipNameViewBoxPathsConfig_9: Dynamic;
  var PropertiesTooltipNameViewBoxPathsConfig_10: Dynamic;
  var PropertiesTooltipNameViewBoxPathsConfig_11: Dynamic;
  var PropertiesTooltipNameViewBoxPathsConfig_12: Dynamic;
  var PropertiesTooltipNameViewBoxPathsConfig_13: Dynamic;
  var PropertiesTooltipColorGradientConfig: Dynamic;
  function EditorTooltip({
    tip: tip,
    shortcut: shortcut,
    side = "top",
    align = "center",
    wrap = false,
    delay: delay,
    className: className,
    children: children,
  }: Dynamic): Dynamic {
    return (
      <runtime.Tooltip
        content={tip}
        shortcut={shortcut}
        side={side}
        align={
          align === "right" ? "end" : align === "left" ? "start" : "center"
        }
        multiline={wrap}
        delay={delay}
        hoverable={false}
      >
        <span
          data-tip={typeof tip == "string" ? tip : undefined}
          className={(0, runtime.joinClassNames)(
            "relative inline-flex align-top",
            className,
          )}
        >
          {children}
        </span>
      </runtime.Tooltip>
    );
  }
  bindRuntimeValue(runtime, "EditorTooltip", () => EditorTooltip);
  bindRuntimeValue(
    runtime,
    "jsxPropertiesTooltip",
    () => jsxPropertiesTooltip,
    (value) => {
      jsxPropertiesTooltip = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactPropertiesTooltip",
    () => reactPropertiesTooltip,
    (value) => {
      reactPropertiesTooltip = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactPropertiesTooltip_2",
    () => reactPropertiesTooltip_2,
    (value) => {
      reactPropertiesTooltip_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactPropertiesTooltip_3",
    () => reactPropertiesTooltip_3,
    (value) => {
      reactPropertiesTooltip_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesTooltipHandler",
    () => PropertiesTooltipHandler,
    (value) => {
      PropertiesTooltipHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TextAlignLeftValue",
    () => TextAlignLeftValue,
    (value) => {
      TextAlignLeftValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TextAlignCenterValue",
    () => TextAlignCenterValue,
    (value) => {
      TextAlignCenterValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TextAlignRightValue",
    () => TextAlignRightValue,
    (value) => {
      TextAlignRightValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TextAlignJustifyValue",
    () => TextAlignJustifyValue,
    (value) => {
      TextAlignJustifyValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LineHeightValue",
    () => LineHeightValue,
    (value) => {
      LineHeightValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesTooltipNameViewBoxPathsConfig",
    () => PropertiesTooltipNameViewBoxPathsConfig,
    (value) => {
      PropertiesTooltipNameViewBoxPathsConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesTooltipNameViewBoxPathsConfig_2",
    () => PropertiesTooltipNameViewBoxPathsConfig_2,
    (value) => {
      PropertiesTooltipNameViewBoxPathsConfig_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesTooltipNameViewBoxPathsConfig_3",
    () => PropertiesTooltipNameViewBoxPathsConfig_3,
    (value) => {
      PropertiesTooltipNameViewBoxPathsConfig_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesTooltipNameViewBoxPathsConfig_4",
    () => PropertiesTooltipNameViewBoxPathsConfig_4,
    (value) => {
      PropertiesTooltipNameViewBoxPathsConfig_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CropValue",
    () => CropValue,
    (value) => {
      CropValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesTooltipNameViewBoxPathsConfig_5",
    () => PropertiesTooltipNameViewBoxPathsConfig_5,
    (value) => {
      PropertiesTooltipNameViewBoxPathsConfig_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesTooltipNameViewBoxPathsConfig_6",
    () => PropertiesTooltipNameViewBoxPathsConfig_6,
    (value) => {
      PropertiesTooltipNameViewBoxPathsConfig_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesTooltipNameViewBoxPathsConfig_7",
    () => PropertiesTooltipNameViewBoxPathsConfig_7,
    (value) => {
      PropertiesTooltipNameViewBoxPathsConfig_7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesTooltipNameViewBoxPathsConfig_8",
    () => PropertiesTooltipNameViewBoxPathsConfig_8,
    (value) => {
      PropertiesTooltipNameViewBoxPathsConfig_8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesTooltipNameViewBoxPathsConfig_9",
    () => PropertiesTooltipNameViewBoxPathsConfig_9,
    (value) => {
      PropertiesTooltipNameViewBoxPathsConfig_9 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesTooltipNameViewBoxPathsConfig_10",
    () => PropertiesTooltipNameViewBoxPathsConfig_10,
    (value) => {
      PropertiesTooltipNameViewBoxPathsConfig_10 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesTooltipNameViewBoxPathsConfig_11",
    () => PropertiesTooltipNameViewBoxPathsConfig_11,
    (value) => {
      PropertiesTooltipNameViewBoxPathsConfig_11 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesTooltipNameViewBoxPathsConfig_12",
    () => PropertiesTooltipNameViewBoxPathsConfig_12,
    (value) => {
      PropertiesTooltipNameViewBoxPathsConfig_12 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesTooltipNameViewBoxPathsConfig_13",
    () => PropertiesTooltipNameViewBoxPathsConfig_13,
    (value) => {
      PropertiesTooltipNameViewBoxPathsConfig_13 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesTooltipColorGradientConfig",
    () => PropertiesTooltipColorGradientConfig,
    (value) => {
      PropertiesTooltipColorGradientConfig = value;
    },
  );
  return () => {
    jsxPropertiesTooltip = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    reactPropertiesTooltip = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    reactPropertiesTooltip_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    reactPropertiesTooltip_3 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    PropertiesTooltipHandler = (
      input?: Dynamic,
      options: Dynamic = 1,
    ): Dynamic => ({
      d: input,
      strokeWidth: options,
    });
    TextAlignLeftValue = "TextAlignLeft";
    TextAlignCenterValue = "TextAlignCenter";
    TextAlignRightValue = "TextAlignRight";
    TextAlignJustifyValue = "TextAlignJustify";
    LineHeightValue = "LineHeight";
    PropertiesTooltipNameViewBoxPathsConfig = {
      name: "BorderWeight",
      viewBox: 16,
      paths: [
        PropertiesTooltipHandler("M3.2 3H12.8"),
        PropertiesTooltipHandler("M3.2 8H12.8", 1.5),
        PropertiesTooltipHandler("M3.2 13H12.8", 2),
      ],
    };
    PropertiesTooltipNameViewBoxPathsConfig_2 = {
      name: "BorderSides",
      viewBox: 16,
      paths: [
        PropertiesTooltipHandler(
          "M5.327 2.655H10.673M5.327 13.345H10.673M2.655 5.328V10.673M13.345 5.328V10.673",
        ),
      ],
    };
    PropertiesTooltipNameViewBoxPathsConfig_3 = {
      name: "CornerRadius",
      viewBox: 16,
      paths: [PropertiesTooltipHandler("M3 14V9C3 5.686 5.686 3 9 3H14")],
    };
    PropertiesTooltipNameViewBoxPathsConfig_4 = {
      name: "CornerEach",
      viewBox: 16,
      paths: [
        PropertiesTooltipHandler(
          "M2.739 5.826V4.739C2.739 3.634 3.634 2.739 4.739 2.739H5.826M10.174 2.739H11.261C12.366 2.739 13.261 3.634 13.261 4.739V5.826M13.261 10.174V11.261C13.261 12.366 12.366 13.261 11.261 13.261H10.174M5.826 13.261H4.739C3.634 13.261 2.739 12.366 2.739 11.261V10.174",
        ),
      ],
    };
    CropValue = "Crop";
    PropertiesTooltipNameViewBoxPathsConfig_5 = {
      name: "Spacing",
      viewBox: 16,
      paths: [
        PropertiesTooltipHandler(
          "M2 4V3C2 2.448 2.448 2 3 2H4M12 2H13C13.552 2 14 2.448 14 3V4M14 12V13C14 13.552 13.552 14 13 14H12M2 12V13C2 13.552 2.448 14 3 14H4M7 2H9M7 14H9M2 7V9M14 7V9",
        ),
        PropertiesTooltipHandler(
          "M6 5.6H10C10.221 5.6 10.4 5.779 10.4 6V10C10.4 10.221 10.221 10.4 10 10.4H6C5.779 10.4 5.6 10.221 5.6 10V6C5.6 5.779 5.779 5.6 6 5.6Z",
        ),
      ],
    };
    PropertiesTooltipNameViewBoxPathsConfig_6 = {
      name: "StrokeSolid",
      viewBox: 16,
      paths: [PropertiesTooltipHandler("M2 8H14", 1.5)],
    };
    PropertiesTooltipNameViewBoxPathsConfig_7 = {
      name: "StrokeDashed",
      viewBox: 16,
      paths: [
        PropertiesTooltipHandler("M1.5 8H4.5M6.5 8H9.5M11.5 8H14.5", 1.5),
      ],
    };
    PropertiesTooltipNameViewBoxPathsConfig_8 = {
      name: "StrokeDotted",
      viewBox: 16,
      paths: [
        PropertiesTooltipHandler(
          "M2 8H2.01M5 8H5.01M8 8H8.01M11 8H11.01M14 8H14.01",
          1.5,
        ),
      ],
    };
    PropertiesTooltipNameViewBoxPathsConfig_9 = {
      name: "TableRows",
      viewBox: 16,
      paths: [
        PropertiesTooltipHandler(
          "M3.865 4H12.135M3.865 8H12.135M3.865 12H12.135",
        ),
      ],
    };
    PropertiesTooltipNameViewBoxPathsConfig_10 = {
      name: "TableColumns",
      viewBox: 16,
      paths: [
        PropertiesTooltipHandler(
          "M4 3.865V12.135M8 3.865V12.135M12 3.865V12.135",
        ),
      ],
    };
    PropertiesTooltipNameViewBoxPathsConfig_11 = {
      name: "FillSolid",
      viewBox: 16,
      paths: [
        "M4.25 3H11.75C12.44 3 13 3.56 13 4.25V11.75C13 12.44 12.44 13 11.75 13H4.25C3.56 13 3 12.44 3 11.75V4.25C3 3.56 3.56 3 4.25 3Z",
      ],
    };
    PropertiesTooltipNameViewBoxPathsConfig_12 = {
      name: "FillGradient",
      viewBox: 16,
      paths: [
        PropertiesTooltipHandler(
          "M4.25 3.5H11.75C12.164 3.5 12.5 3.836 12.5 4.25V11.75C12.5 12.164 12.164 12.5 11.75 12.5H4.25C3.836 12.5 3.5 12.164 3.5 11.75V4.25C3.5 3.836 3.836 3.5 4.25 3.5Z",
        ),
        "M12 6V11.75C12 11.888 11.888 12 11.75 12H6L12 6Z",
        "M10.2 4L4 10.2V8.5L8.5 4H10.2Z",
      ],
    };
    PropertiesTooltipNameViewBoxPathsConfig_13 = {
      name: "Angle",
      viewBox: 16,
      paths: [
        PropertiesTooltipHandler(
          "M3.5 8A4.5 4.5 0 0 1 12.5 8A4.5 4.5 0 0 1 3.5 8ZM8 8L11.2 4.8",
        ),
      ],
    };
    PropertiesTooltipColorGradientConfig = {
      color: PropertiesTooltipNameViewBoxPathsConfig_11,
      gradient: PropertiesTooltipNameViewBoxPathsConfig_12,
    };
  };
}
