/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import * as React from "react";
import type * as Color from "../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiInspectorIcons(runtime: RuntimeBindings): () => void {
  var ColorSelectReact: typeof import("react");
  var reactInspectorIcons: typeof import("react");
  var reactForUiInspectorIcons: typeof import("react");
  var iconStrokePath: (
    path: string,
    strokeWidth?: number,
  ) => Color.PropertyIconPath;
  var BORDER_WEIGHT_ICON: Color.PropertyIconDefinition;
  var BORDER_SIDES_ICON: Color.PropertyIconDefinition;
  var CORNER_RADIUS_ICON: Color.PropertyIconDefinition;
  var INDIVIDUAL_CORNERS_ICON: Color.PropertyIconDefinition;
  var SPACING_ICON: Color.PropertyIconDefinition;
  var SOLID_STROKE_ICON: Color.PropertyIconDefinition;
  var DASHED_STROKE_ICON: Color.PropertyIconDefinition;
  var DOTTED_STROKE_ICON: Color.PropertyIconDefinition;
  var TABLE_ROWS_ICON: Color.PropertyIconDefinition;
  var TABLE_COLUMNS_ICON: Color.PropertyIconDefinition;
  var SOLID_FILL_ICON: Color.PropertyIconDefinition;
  var GRADIENT_FILL_ICON: Color.PropertyIconDefinition;
  var ANGLE_ICON: Color.PropertyIconDefinition;
  var FILL_MODE_ICONS: Partial<Record<string, Color.PropertyIconDefinition>>;
  function fillModeOption(
    mode: string,
    tooltip: string,
    disabled?: boolean,
  ): Color.FillModeOption {
    let state = {
      value: mode,
      tooltip: tooltip,
      ...(disabled !== undefined
        ? {
            disabled: disabled,
          }
        : {}),
    };
    if (mode === "image") {
      return {
        ...state,
        icon: "Image",
      };
    }
    let value = FILL_MODE_ICONS[mode];
    if (value === undefined) {
      return {
        ...state,
        label: tooltip,
      };
    }
    return {
      ...state,
      label: (
        <reactForUiInspectorIcons.Fragment>
          <PropertyIcon icon={value} />
          <span className={"sr-only"}>{tooltip}</span>
        </reactForUiInspectorIcons.Fragment>
      ),
    };
  }
  function PropertyIcon({
    icon: icon,
    className: className,
  }: Color.PropertyIconProps): React.ReactElement {
    let value = className ?? "shrink-0";
    if (typeof icon === "string") {
      return <runtime.Icon name={icon} size={"auto"} className={value} />;
    } else {
      return <runtime.Icon customIcon={icon} size={"auto"} className={value} />;
    }
  }
  bindRuntimeValue(
    runtime,
    "ColorSelectReact",
    () => ColorSelectReact,
    (value) => {
      ColorSelectReact = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactInspectorIcons",
    () => reactInspectorIcons,
    (value) => {
      reactInspectorIcons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiInspectorIcons",
    () => reactForUiInspectorIcons,
    (value) => {
      reactForUiInspectorIcons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "iconStrokePath",
    () => iconStrokePath,
    (value) => {
      iconStrokePath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BORDER_WEIGHT_ICON",
    () => BORDER_WEIGHT_ICON,
    (value) => {
      BORDER_WEIGHT_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BORDER_SIDES_ICON",
    () => BORDER_SIDES_ICON,
    (value) => {
      BORDER_SIDES_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CORNER_RADIUS_ICON",
    () => CORNER_RADIUS_ICON,
    (value) => {
      CORNER_RADIUS_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "INDIVIDUAL_CORNERS_ICON",
    () => INDIVIDUAL_CORNERS_ICON,
    (value) => {
      INDIVIDUAL_CORNERS_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPACING_ICON",
    () => SPACING_ICON,
    (value) => {
      SPACING_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SOLID_STROKE_ICON",
    () => SOLID_STROKE_ICON,
    (value) => {
      SOLID_STROKE_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DASHED_STROKE_ICON",
    () => DASHED_STROKE_ICON,
    (value) => {
      DASHED_STROKE_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DOTTED_STROKE_ICON",
    () => DOTTED_STROKE_ICON,
    (value) => {
      DOTTED_STROKE_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TABLE_ROWS_ICON",
    () => TABLE_ROWS_ICON,
    (value) => {
      TABLE_ROWS_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TABLE_COLUMNS_ICON",
    () => TABLE_COLUMNS_ICON,
    (value) => {
      TABLE_COLUMNS_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SOLID_FILL_ICON",
    () => SOLID_FILL_ICON,
    (value) => {
      SOLID_FILL_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRADIENT_FILL_ICON",
    () => GRADIENT_FILL_ICON,
    (value) => {
      GRADIENT_FILL_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ANGLE_ICON",
    () => ANGLE_ICON,
    (value) => {
      ANGLE_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILL_MODE_ICONS",
    () => FILL_MODE_ICONS,
    (value) => {
      FILL_MODE_ICONS = value;
    },
  );
  bindRuntimeValue(runtime, "fillModeOption", () => fillModeOption);
  bindRuntimeValue(runtime, "PropertyIcon", () => PropertyIcon);
  return () => {
    ColorSelectReact = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactInspectorIcons = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactForUiInspectorIcons = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    iconStrokePath = (input: string, options: number = 1) => ({
      d: input,
      strokeWidth: options,
    });
    BORDER_WEIGHT_ICON = {
      name: "BorderWeight",
      viewBox: 16,
      paths: [
        iconStrokePath("M3.2 3H12.8"),
        iconStrokePath("M3.2 8H12.8", 1.5),
        iconStrokePath("M3.2 13H12.8", 2),
      ],
    };
    BORDER_SIDES_ICON = {
      name: "BorderSides",
      viewBox: 16,
      paths: [
        iconStrokePath(
          "M5.327 2.655H10.673M5.327 13.345H10.673M2.655 5.328V10.673M13.345 5.328V10.673",
        ),
      ],
    };
    CORNER_RADIUS_ICON = {
      name: "CornerRadius",
      viewBox: 16,
      paths: [iconStrokePath("M3 14V9C3 5.686 5.686 3 9 3H14")],
    };
    INDIVIDUAL_CORNERS_ICON = {
      name: "CornerEach",
      viewBox: 16,
      paths: [
        iconStrokePath(
          "M2.739 5.826V4.739C2.739 3.634 3.634 2.739 4.739 2.739H5.826M10.174 2.739H11.261C12.366 2.739 13.261 3.634 13.261 4.739V5.826M13.261 10.174V11.261C13.261 12.366 12.366 13.261 11.261 13.261H10.174M5.826 13.261H4.739C3.634 13.261 2.739 12.366 2.739 11.261V10.174",
        ),
      ],
    };
    SPACING_ICON = {
      name: "Spacing",
      viewBox: 16,
      paths: [
        iconStrokePath(
          "M2 4V3C2 2.448 2.448 2 3 2H4M12 2H13C13.552 2 14 2.448 14 3V4M14 12V13C14 13.552 13.552 14 13 14H12M2 12V13C2 13.552 2.448 14 3 14H4M7 2H9M7 14H9M2 7V9M14 7V9",
        ),
        iconStrokePath(
          "M6 5.6H10C10.221 5.6 10.4 5.779 10.4 6V10C10.4 10.221 10.221 10.4 10 10.4H6C5.779 10.4 5.6 10.221 5.6 10V6C5.6 5.779 5.779 5.6 6 5.6Z",
        ),
      ],
    };
    SOLID_STROKE_ICON = {
      name: "StrokeSolid",
      viewBox: 16,
      paths: [iconStrokePath("M2 8H14", 1.5)],
    };
    DASHED_STROKE_ICON = {
      name: "StrokeDashed",
      viewBox: 16,
      paths: [iconStrokePath("M1.5 8H4.5M6.5 8H9.5M11.5 8H14.5", 1.5)],
    };
    DOTTED_STROKE_ICON = {
      name: "StrokeDotted",
      viewBox: 16,
      paths: [
        iconStrokePath(
          "M2 8H2.01M5 8H5.01M8 8H8.01M11 8H11.01M14 8H14.01",
          1.5,
        ),
      ],
    };
    TABLE_ROWS_ICON = {
      name: "TableRows",
      viewBox: 16,
      paths: [iconStrokePath("M3.865 4H12.135M3.865 8H12.135M3.865 12H12.135")],
    };
    TABLE_COLUMNS_ICON = {
      name: "TableColumns",
      viewBox: 16,
      paths: [iconStrokePath("M4 3.865V12.135M8 3.865V12.135M12 3.865V12.135")],
    };
    SOLID_FILL_ICON = {
      name: "FillSolid",
      viewBox: 16,
      paths: [
        "M4.25 3H11.75C12.44 3 13 3.56 13 4.25V11.75C13 12.44 12.44 13 11.75 13H4.25C3.56 13 3 12.44 3 11.75V4.25C3 3.56 3.56 3 4.25 3Z",
      ],
    };
    GRADIENT_FILL_ICON = {
      name: "FillGradient",
      viewBox: 16,
      paths: [
        iconStrokePath(
          "M4.25 3.5H11.75C12.164 3.5 12.5 3.836 12.5 4.25V11.75C12.5 12.164 12.164 12.5 11.75 12.5H4.25C3.836 12.5 3.5 12.164 3.5 11.75V4.25C3.5 3.836 3.836 3.5 4.25 3.5Z",
        ),
        "M12 6V11.75C12 11.888 11.888 12 11.75 12H6L12 6Z",
        "M10.2 4L4 10.2V8.5L8.5 4H10.2Z",
      ],
    };
    ANGLE_ICON = {
      name: "Angle",
      viewBox: 16,
      paths: [
        iconStrokePath(
          "M3.5 8A4.5 4.5 0 0 1 12.5 8A4.5 4.5 0 0 1 3.5 8ZM8 8L11.2 4.8",
        ),
      ],
    };
    FILL_MODE_ICONS = {
      color: SOLID_FILL_ICON,
      gradient: GRADIENT_FILL_ICON,
    };
  };
}
