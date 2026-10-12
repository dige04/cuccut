/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorInspectorPropertySchema(
  runtime: RuntimeBindings,
): () => void {
  var InspectorPropertySchemaBackgroundFontWeightFontStyleConfig: Dynamic;
  var InspectorPropertySchemaItems: Dynamic;
  var InspectorPropertySchemaTextPattern: Dynamic;
  var InspectorPropertySchemaBackdropFilterConfig: Dynamic;
  var InspectorPropertySchemaHandler: Dynamic;
  var InspectorPropertySchemaHandler_2: Dynamic;
  var InspectorPropertySchemaItems_2: Dynamic;
  var InspectorPropertySchemaCache: Dynamic;
  var InspectorPropertySchemaCursorPointerEventsObjectFitValues: Dynamic;
  function hasTextBackgroundClip(input?: Dynamic): Dynamic {
    return (
      InspectorPropertySchemaTextPattern.test(input("background-clip") ?? "") ||
      InspectorPropertySchemaTextPattern.test(
        input("-webkit-background-clip") ?? "",
      )
    );
  }
  function getPropertySpecification(input?: Dynamic): Dynamic {
    return InspectorPropertySchemaCache.get(input.toLowerCase());
  }
  function normalizePropertyNumber(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = options.trim(),
      value2: Dynamic = (0, runtime.parseCssNumber)(value);
    return !value2 ||
      input.startsWith("@") ||
      /^(line-height|opacity|font-weight|z-index|order|flex|flex-grow|flex-shrink)$/.test(
        input,
      ) ||
      !/(width|height|top|left|right|bottom|gap|radius|size|spacing|margin|padding|inset|indent|basis)/.test(
        input,
      ) ||
      value === "0" ||
      (value2.unit && (0, runtime.normalizeCssUnit)(value2.unit))
      ? value
      : `${value2.value}px`;
  }
  bindRuntimeValue(
    runtime,
    "InspectorPropertySchemaBackgroundFontWeightFontStyleConfig",
    () => InspectorPropertySchemaBackgroundFontWeightFontStyleConfig,
    (value) => {
      InspectorPropertySchemaBackgroundFontWeightFontStyleConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorPropertySchemaItems",
    () => InspectorPropertySchemaItems,
    (value) => {
      InspectorPropertySchemaItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorPropertySchemaTextPattern",
    () => InspectorPropertySchemaTextPattern,
    (value) => {
      InspectorPropertySchemaTextPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasTextBackgroundClip",
    () => hasTextBackgroundClip,
  );
  bindRuntimeValue(
    runtime,
    "InspectorPropertySchemaBackdropFilterConfig",
    () => InspectorPropertySchemaBackdropFilterConfig,
    (value) => {
      InspectorPropertySchemaBackdropFilterConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorPropertySchemaHandler",
    () => InspectorPropertySchemaHandler,
    (value) => {
      InspectorPropertySchemaHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorPropertySchemaHandler_2",
    () => InspectorPropertySchemaHandler_2,
    (value) => {
      InspectorPropertySchemaHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorPropertySchemaItems_2",
    () => InspectorPropertySchemaItems_2,
    (value) => {
      InspectorPropertySchemaItems_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorPropertySchemaCache",
    () => InspectorPropertySchemaCache,
    (value) => {
      InspectorPropertySchemaCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getPropertySpecification",
    () => getPropertySpecification,
  );
  bindRuntimeValue(
    runtime,
    "InspectorPropertySchemaCursorPointerEventsObjectFitValues",
    () => InspectorPropertySchemaCursorPointerEventsObjectFitValues,
    (value) => {
      InspectorPropertySchemaCursorPointerEventsObjectFitValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizePropertyNumber",
    () => normalizePropertyNumber,
  );
  return () => {
    InspectorPropertySchemaBackgroundFontWeightFontStyleConfig = {
      background: "background-color",
      "font-weight": "font-style",
      "font-style": "text-decoration-line",
      "backdrop-filter": "-webkit-backdrop-filter",
    };
    InspectorPropertySchemaItems = [
      "background-image",
      "background-size",
      "background-position",
      "background-repeat",
      "background-clip",
      "-webkit-background-clip",
      "-webkit-text-fill-color",
    ];
    InspectorPropertySchemaTextPattern = /^\s*text\s*$/i;
    InspectorPropertySchemaBackdropFilterConfig = {
      "backdrop-filter": "-webkit-backdrop-filter",
    };
    InspectorPropertySchemaHandler = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      value: Dynamic = {},
    ): Dynamic => ({
      prop: input,
      label: options,
      editor: "number",
      section: context,
      unit: "px",
      ...value,
    });
    InspectorPropertySchemaHandler_2 = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      value?: Dynamic,
      extra: Dynamic = {},
    ): Dynamic => ({
      prop: input,
      label: options,
      editor: "select",
      section: context,
      options: value,
      ...extra,
    });
    InspectorPropertySchemaItems_2 = [
      {
        prop: "font-family",
        label: "Font",
        editor: "font",
        section: "typography",
        defaultValue: "",
      },
      {
        prop: "font-weight",
        label: "Weight",
        editor: "fontFace",
        section: "typography",
        defaultValue: "400",
      },
      InspectorPropertySchemaHandler("font-size", "Size", "typography", {
        min: 1,
        max: 400,
        defaultValue: "16px",
      }),
      InspectorPropertySchemaHandler(
        "line-height",
        "Line height",
        "typography",
        {
          unit: "",
          step: 0.05,
          scrub: 0.05,
          min: 0,
          hint: "Unitless multiplies the font size (1.5); for a length such as 24px use right-click \u2192 Edit as text",
          scrubFrom: 1.2,
        },
      ),
      InspectorPropertySchemaHandler(
        "letter-spacing",
        "Letter spacing",
        "typography",
        {
          step: 0.1,
          scrub: 0.1,
          defaultValue: "0px",
          hint: "Length \u2014 em scales with the font size, px is fixed; for another unit use right-click \u2192 Edit as text",
        },
      ),
      {
        prop: "color",
        label: "Color",
        editor: "color",
        section: "typography",
      },
      {
        prop: "font-style",
        label: "Emphasis",
        editor: "typeStyle",
        section: "typography",
        defaultValue: "normal",
        longTail: true,
      },
      {
        prop: "text-align",
        label: "Align",
        editor: "flexSeg",
        section: "typography",
        options: ["left", "center", "right", "justify"],
        defaultValue: "left",
      },
      InspectorPropertySchemaHandler_2(
        "text-transform",
        "Case",
        "typography",
        ["none", "uppercase", "lowercase", "capitalize"],
        {
          defaultValue: "none",
          longTail: true,
        },
      ),
      {
        prop: "display",
        label: "Layout",
        editor: "select",
        section: "layout",
        options: ["block", "flex", "grid"],
        optionLabels: {
          block: "Block",
          flex: "Stack",
          grid: "Grid",
        },
        defaultValue: "block",
      },
      {
        prop: "flex-direction",
        label: "Direction",
        editor: "flexSeg",
        section: "layout",
        options: ["row", "column", "row-reverse", "column-reverse"],
        defaultValue: "row",
      },
      InspectorPropertySchemaHandler_2(
        "flex-wrap",
        "Wrap",
        "layout",
        ["nowrap", "wrap", "wrap-reverse"],
        {
          defaultValue: "nowrap",
        },
      ),
      {
        prop: "justify-content",
        label: "Justify",
        editor: "flexSeg",
        section: "layout",
        options: [
          "flex-start",
          "center",
          "flex-end",
          "space-between",
          "space-around",
          "space-evenly",
        ],
        optionLabels: {
          "flex-start": "Start",
          center: "Center",
          "flex-end": "End",
          "space-between": "Space between",
          "space-around": "Space around",
          "space-evenly": "Space evenly",
        },
        defaultValue: "flex-start",
      },
      {
        prop: "justify-items",
        label: "Justify",
        editor: "flexSeg",
        section: "layout",
        options: ["start", "center", "end", "stretch"],
        optionLabels: {
          start: "Start",
          center: "Center",
          end: "End",
          stretch: "Stretch",
        },
        defaultValue: "stretch",
      },
      {
        prop: "align-items",
        label: "Align",
        editor: "flexSeg",
        section: "layout",
        options: ["flex-start", "center", "flex-end", "stretch", "baseline"],
        optionLabels: {
          stretch: "Stretch",
          "flex-start": "Start",
          center: "Center",
          "flex-end": "End",
          baseline: "Baseline",
        },
        defaultValue: "stretch",
      },
      InspectorPropertySchemaHandler("gap", "Gap", "layout", {
        min: 0,
        defaultValue: "0px",
      }),
      {
        prop: "grid-template-columns",
        label: "Columns",
        editor: "gridTracks",
        section: "layout",
        min: 1,
        max: 12,
        hint: "Track count (equal columns), or any CSS track list (160px 1fr)",
      },
      {
        prop: "grid-template-rows",
        label: "Rows",
        editor: "gridTracks",
        section: "layout",
        min: 1,
        max: 12,
        hint: "Track count (equal rows); unset lets rows size to content",
      },
      InspectorPropertySchemaHandler_2(
        "position",
        "",
        "position",
        ["static", "relative", "absolute", "fixed", "sticky"],
        {
          defaultValue: "static",
        },
      ),
      InspectorPropertySchemaHandler("top", "Top", "position", {
        defaultValue: "auto",
      }),
      InspectorPropertySchemaHandler("left", "Left", "position", {
        defaultValue: "auto",
      }),
      InspectorPropertySchemaHandler("bottom", "Bottom", "position", {
        defaultValue: "auto",
        longTail: true,
      }),
      InspectorPropertySchemaHandler("right", "Right", "position", {
        defaultValue: "auto",
        longTail: true,
      }),
      InspectorPropertySchemaHandler("z-index", "Z-index", "advanced", {
        unit: "",
        step: 1,
        defaultValue: "auto",
      }),
      InspectorPropertySchemaHandler("padding-top", "Top", "padding", {
        min: 0,
        defaultValue: "0px",
      }),
      InspectorPropertySchemaHandler("padding-right", "Right", "padding", {
        min: 0,
        defaultValue: "0px",
      }),
      InspectorPropertySchemaHandler("padding-bottom", "Bottom", "padding", {
        min: 0,
        defaultValue: "0px",
      }),
      InspectorPropertySchemaHandler("padding-left", "Left", "padding", {
        min: 0,
        defaultValue: "0px",
      }),
      InspectorPropertySchemaHandler("margin-top", "Top", "margin", {
        defaultValue: "0px",
      }),
      InspectorPropertySchemaHandler("margin-right", "Right", "margin", {
        defaultValue: "0px",
      }),
      InspectorPropertySchemaHandler("margin-bottom", "Bottom", "margin", {
        defaultValue: "0px",
      }),
      InspectorPropertySchemaHandler("margin-left", "Left", "margin", {
        defaultValue: "0px",
      }),
      {
        prop: "width",
        label: "Width",
        editor: "size",
        section: "sizing",
      },
      {
        prop: "height",
        label: "Height",
        editor: "size",
        section: "sizing",
      },
      InspectorPropertySchemaHandler("min-width", "Min width", "sizing", {
        min: 0,
        longTail: true,
      }),
      InspectorPropertySchemaHandler("max-width", "Max width", "sizing", {
        min: 0,
        longTail: true,
      }),
      InspectorPropertySchemaHandler("min-height", "Min height", "sizing", {
        min: 0,
        longTail: true,
      }),
      InspectorPropertySchemaHandler("max-height", "Max height", "sizing", {
        min: 0,
        longTail: true,
      }),
      InspectorPropertySchemaHandler("flex-grow", "Grow", "sizing", {
        unit: "",
        min: 0,
        step: 1,
        defaultValue: "0",
      }),
      {
        prop: "align-self",
        label: "Align self",
        editor: "flexSeg",
        section: "sizing",
        options: ["auto", "flex-start", "center", "flex-end", "stretch"],
        optionLabels: {
          auto: "Auto",
          "flex-start": "Start",
          center: "Center",
          "flex-end": "End",
          stretch: "Stretch",
        },
        defaultValue: "auto",
      },
      {
        prop: "grid-column",
        label: "Column span",
        editor: "gridSpan",
        section: "sizing",
        min: 1,
        max: 12,
        defaultValue: "auto",
      },
      {
        prop: "grid-row",
        label: "Row span",
        editor: "gridSpan",
        section: "sizing",
        min: 1,
        max: 12,
        defaultValue: "auto",
      },
      {
        prop: "justify-self",
        label: "Justify self",
        editor: "flexSeg",
        section: "sizing",
        options: ["auto", "start", "center", "end", "stretch"],
        optionLabels: {
          auto: "Auto",
          start: "Start",
          center: "Center",
          end: "End",
          stretch: "Stretch",
        },
        defaultValue: "auto",
      },
      {
        prop: "background",
        label: "Fill",
        editor: "fill",
        section: "appearance",
      },
      InspectorPropertySchemaHandler("opacity", "Opacity", "appearance", {
        unit: "",
        min: 0,
        max: 1,
        step: 0.01,
        scrub: 0.01,
        defaultValue: "1",
      }),
      InspectorPropertySchemaHandler("border-radius", "Radius", "appearance", {
        min: 0,
        defaultValue: "0px",
      }),
      InspectorPropertySchemaHandler(
        "border-top-left-radius",
        "Radius top left",
        "radius",
        {
          min: 0,
          defaultValue: "0px",
        },
      ),
      InspectorPropertySchemaHandler(
        "border-top-right-radius",
        "Radius top right",
        "radius",
        {
          min: 0,
          defaultValue: "0px",
        },
      ),
      InspectorPropertySchemaHandler(
        "border-bottom-right-radius",
        "Radius bottom right",
        "radius",
        {
          min: 0,
          defaultValue: "0px",
        },
      ),
      InspectorPropertySchemaHandler(
        "border-bottom-left-radius",
        "Radius bottom left",
        "radius",
        {
          min: 0,
          defaultValue: "0px",
        },
      ),
      InspectorPropertySchemaHandler("border-width", "Border width", "border", {
        min: 0,
        defaultValue: "0px",
      }),
      InspectorPropertySchemaHandler(
        "border-top-width",
        "Border width top",
        "borderSides",
        {
          min: 0,
          defaultValue: "0px",
        },
      ),
      InspectorPropertySchemaHandler(
        "border-right-width",
        "Border width right",
        "borderSides",
        {
          min: 0,
          defaultValue: "0px",
        },
      ),
      InspectorPropertySchemaHandler(
        "border-bottom-width",
        "Border width bottom",
        "borderSides",
        {
          min: 0,
          defaultValue: "0px",
        },
      ),
      InspectorPropertySchemaHandler(
        "border-left-width",
        "Border width left",
        "borderSides",
        {
          min: 0,
          defaultValue: "0px",
        },
      ),
      InspectorPropertySchemaHandler_2(
        "border-style",
        "Border style",
        "border",
        ["none", "solid", "dashed", "dotted", "double"],
        {
          defaultValue: "none",
        },
      ),
      {
        prop: "border-color",
        label: "Border color",
        editor: "color",
        section: "border",
      },
      InspectorPropertySchemaHandler_2(
        "overflow",
        "Overflow",
        "advanced",
        ["visible", "hidden", "auto", "scroll"],
        {
          defaultValue: "visible",
        },
      ),
      {
        prop: "box-shadow",
        label: "Shadow",
        editor: "shadow",
        section: "effects",
        defaultValue: "none",
        longTail: true,
      },
      {
        prop: "text-shadow",
        label: "Text shadow",
        editor: "shadow",
        section: "effects",
        defaultValue: "none",
        longTail: true,
      },
      {
        prop: "filter",
        label: "Filter",
        editor: "string",
        section: "effects",
        longTail: true,
      },
      {
        prop: "backdrop-filter",
        label: "Backdrop filter",
        editor: "string",
        section: "effects",
        longTail: true,
      },
      {
        prop: "transform",
        label: "Transform",
        editor: "transform",
        section: "effects",
        longTail: true,
      },
    ];
    InspectorPropertySchemaCache = new Map(
      InspectorPropertySchemaItems_2.map(
        (input?: Dynamic): Dynamic => [input.prop, input],
      ),
    );
    InspectorPropertySchemaCursorPointerEventsObjectFitValues = [
      "cursor",
      "pointer-events",
      "object-fit",
      "overflow-x",
      "overflow-y",
      "white-space",
      "text-overflow",
      "text-decoration-color",
      "box-sizing",
      "aspect-ratio",
      "grid-template-columns",
      "grid-template-rows",
      "transition",
      "animation",
      "top",
      "right",
      "bottom",
      "left",
    ];
  };
}
