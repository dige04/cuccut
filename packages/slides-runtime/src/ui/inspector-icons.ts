/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement, ReactNode } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";

/** One stroked path of a custom inspector icon. */
export interface InspectorStrokePath {
  d: string;
  strokeWidth: number;
}

/** Custom SVG icon description rendered by the shared Icon component. */
export interface InspectorCustomIcon {
  name: string;
  /** Square viewBox edge. */
  viewBox: number;
  /** Plain strings are filled outlines; objects are stroked paths. */
  paths: (string | InspectorStrokePath)[];
}

/** Icon name or custom icon description. */
export type InspectorIcon = string | InspectorCustomIcon;

export interface PropertyIconProps {
  icon: InspectorIcon;
  className?: string;
}

/** Segmented-control option produced for a fill mode. */
export interface FillModeOption {
  value: string;
  tooltip: ReactNode;
  disabled?: boolean;
  icon?: string;
  label?: ReactNode;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactForUiInspectorIcons: ReactNamespace;
    propertyIconPath: (d: string, strokeWidth?: number) => InspectorStrokePath;
    FILL_MODE_ICONS: Record<string, InspectorCustomIcon | undefined>;
    initializeUiInspectorIcons: () => void;
    TEXT_ALIGN_LEFT_ICON: string;
    TEXT_ALIGN_CENTER_ICON: string;
    TEXT_ALIGN_RIGHT_ICON: string;
    TEXT_ALIGN_JUSTIFY_ICON: string;
    LINE_HEIGHT_ICON: string;
    CROP_ICON: string;
    BORDER_WEIGHT_ICON: InspectorCustomIcon;
    BORDER_SIDES_ICON: InspectorCustomIcon;
    CORNER_RADIUS_ICON: InspectorCustomIcon;
    INDIVIDUAL_CORNERS_ICON: InspectorCustomIcon;
    SPACING_ICON: InspectorCustomIcon;
    BORDER_SOLID_ICON: InspectorCustomIcon;
    BORDER_DASHED_ICON: InspectorCustomIcon;
    BORDER_DOTTED_ICON: InspectorCustomIcon;
    TABLE_ROWS_ICON: InspectorCustomIcon;
    TABLE_COLUMNS_ICON: InspectorCustomIcon;
    FILL_SOLID_ICON: InspectorCustomIcon;
    FILL_GRADIENT_ICON: InspectorCustomIcon;
    ANGLE_ICON: InspectorCustomIcon;
    fillModeOption: (
      mode: string,
      tooltip: ReactNode,
      disabled?: boolean,
    ) => FillModeOption;
    PropertyIcon: (props: PropertyIconProps) => ReactElement;
  }
}

export function installUiInspectorIcons(runtime: RuntimeBindings): () => void {
  var reactForUiInspectorIcons: ReactNamespace;
  var propertyIconPath: (d: string, strokeWidth?: number) => InspectorStrokePath;
  var TEXT_ALIGN_LEFT_ICON: string;
  var TEXT_ALIGN_CENTER_ICON: string;
  var TEXT_ALIGN_RIGHT_ICON: string;
  var TEXT_ALIGN_JUSTIFY_ICON: string;
  var LINE_HEIGHT_ICON: string;
  var BORDER_WEIGHT_ICON: InspectorCustomIcon;
  var BORDER_SIDES_ICON: InspectorCustomIcon;
  var CORNER_RADIUS_ICON: InspectorCustomIcon;
  var INDIVIDUAL_CORNERS_ICON: InspectorCustomIcon;
  var CROP_ICON: string;
  var SPACING_ICON: InspectorCustomIcon;
  var BORDER_SOLID_ICON: InspectorCustomIcon;
  var BORDER_DASHED_ICON: InspectorCustomIcon;
  var BORDER_DOTTED_ICON: InspectorCustomIcon;
  var TABLE_ROWS_ICON: InspectorCustomIcon;
  var TABLE_COLUMNS_ICON: InspectorCustomIcon;
  var FILL_SOLID_ICON: InspectorCustomIcon;
  var FILL_GRADIENT_ICON: InspectorCustomIcon;
  var ANGLE_ICON: InspectorCustomIcon;
  var FILL_MODE_ICONS: Record<string, InspectorCustomIcon | undefined>;
  var initializeUiInspectorIcons: () => void;
  function fillModeOption(
    mode: string,
    tooltip: ReactNode,
    disabled?: boolean,
  ): FillModeOption {
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
      label: reactForUiInspectorIcons.createElement(
        reactForUiInspectorIcons.Fragment,
        null,
        reactForUiInspectorIcons.createElement(PropertyIcon, {
          icon: value,
        }),
        reactForUiInspectorIcons.createElement(
          "span",
          {
            className: "sr-only",
          },
          tooltip,
        ),
      ),
    };
  }
  function PropertyIcon({
    icon: icon,
    className: className,
  }: PropertyIconProps): ReactElement {
    let value = className ?? "shrink-0";
    if (typeof icon === "string") {
      return reactForUiInspectorIcons.createElement(runtime.Icon, {
        name: icon,
        size: "auto",
        className: value,
      });
    } else {
      return reactForUiInspectorIcons.createElement(runtime.Icon, {
        customIcon: icon,
        size: "auto",
        className: value,
      });
    }
  }
  bindRuntimeValue(runtime, "fillModeOption", () => fillModeOption);
  bindRuntimeValue(runtime, "PropertyIcon", () => PropertyIcon);
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
    "propertyIconPath",
    () => propertyIconPath,
    (value) => {
      propertyIconPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_ALIGN_LEFT_ICON",
    () => TEXT_ALIGN_LEFT_ICON,
    (value) => {
      TEXT_ALIGN_LEFT_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_ALIGN_CENTER_ICON",
    () => TEXT_ALIGN_CENTER_ICON,
    (value) => {
      TEXT_ALIGN_CENTER_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_ALIGN_RIGHT_ICON",
    () => TEXT_ALIGN_RIGHT_ICON,
    (value) => {
      TEXT_ALIGN_RIGHT_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_ALIGN_JUSTIFY_ICON",
    () => TEXT_ALIGN_JUSTIFY_ICON,
    (value) => {
      TEXT_ALIGN_JUSTIFY_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LINE_HEIGHT_ICON",
    () => LINE_HEIGHT_ICON,
    (value) => {
      LINE_HEIGHT_ICON = value;
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
    "CROP_ICON",
    () => CROP_ICON,
    (value) => {
      CROP_ICON = value;
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
    "BORDER_SOLID_ICON",
    () => BORDER_SOLID_ICON,
    (value) => {
      BORDER_SOLID_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BORDER_DASHED_ICON",
    () => BORDER_DASHED_ICON,
    (value) => {
      BORDER_DASHED_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BORDER_DOTTED_ICON",
    () => BORDER_DOTTED_ICON,
    (value) => {
      BORDER_DOTTED_ICON = value;
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
    "FILL_SOLID_ICON",
    () => FILL_SOLID_ICON,
    (value) => {
      FILL_SOLID_ICON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILL_GRADIENT_ICON",
    () => FILL_GRADIENT_ICON,
    (value) => {
      FILL_GRADIENT_ICON = value;
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
  bindRuntimeValue(
    runtime,
    "initializeUiInspectorIcons",
    () => initializeUiInspectorIcons,
    (value) => {
      initializeUiInspectorIcons = value;
    },
  );
  return () => {
    propertyIconPath = (d: string, strokeWidth = 1) => ({
      d: d,
      strokeWidth: strokeWidth,
    });
    TEXT_ALIGN_LEFT_ICON = "TextAlignLeft";
    TEXT_ALIGN_CENTER_ICON = "TextAlignCenter";
    TEXT_ALIGN_RIGHT_ICON = "TextAlignRight";
    TEXT_ALIGN_JUSTIFY_ICON = "TextAlignJustify";
    LINE_HEIGHT_ICON = "LineHeight";
    CROP_ICON = "Crop";
    initializeUiInspectorIcons = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeUiInputs210)();
      reactForUiInspectorIcons = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      BORDER_WEIGHT_ICON = {
        name: "BorderWeight",
        viewBox: 16,
        paths: [
          propertyIconPath("M3.2 3H12.8"),
          propertyIconPath("M3.2 8H12.8", 1.5),
          propertyIconPath("M3.2 13H12.8", 2),
        ],
      };
      BORDER_SIDES_ICON = {
        name: "BorderSides",
        viewBox: 16,
        paths: [
          propertyIconPath(
            "M5.327 2.655H10.673M5.327 13.345H10.673M2.655 5.328V10.673M13.345 5.328V10.673",
          ),
        ],
      };
      CORNER_RADIUS_ICON = {
        name: "CornerRadius",
        viewBox: 16,
        paths: [propertyIconPath("M3 14V9C3 5.686 5.686 3 9 3H14")],
      };
      INDIVIDUAL_CORNERS_ICON = {
        name: "CornerEach",
        viewBox: 16,
        paths: [
          propertyIconPath(
            "M2.739 5.826V4.739C2.739 3.634 3.634 2.739 4.739 2.739H5.826M10.174 2.739H11.261C12.366 2.739 13.261 3.634 13.261 4.739V5.826M13.261 10.174V11.261C13.261 12.366 12.366 13.261 11.261 13.261H10.174M5.826 13.261H4.739C3.634 13.261 2.739 12.366 2.739 11.261V10.174",
          ),
        ],
      };
      SPACING_ICON = {
        name: "Spacing",
        viewBox: 16,
        paths: [
          propertyIconPath(
            "M2 4V3C2 2.448 2.448 2 3 2H4M12 2H13C13.552 2 14 2.448 14 3V4M14 12V13C14 13.552 13.552 14 13 14H12M2 12V13C2 13.552 2.448 14 3 14H4M7 2H9M7 14H9M2 7V9M14 7V9",
          ),
          propertyIconPath(
            "M6 5.6H10C10.221 5.6 10.4 5.779 10.4 6V10C10.4 10.221 10.221 10.4 10 10.4H6C5.779 10.4 5.6 10.221 5.6 10V6C5.6 5.779 5.779 5.6 6 5.6Z",
          ),
        ],
      };
      BORDER_SOLID_ICON = {
        name: "StrokeSolid",
        viewBox: 16,
        paths: [propertyIconPath("M2 8H14", 1.5)],
      };
      BORDER_DASHED_ICON = {
        name: "StrokeDashed",
        viewBox: 16,
        paths: [propertyIconPath("M1.5 8H4.5M6.5 8H9.5M11.5 8H14.5", 1.5)],
      };
      BORDER_DOTTED_ICON = {
        name: "StrokeDotted",
        viewBox: 16,
        paths: [
          propertyIconPath(
            "M2 8H2.01M5 8H5.01M8 8H8.01M11 8H11.01M14 8H14.01",
            1.5,
          ),
        ],
      };
      TABLE_ROWS_ICON = {
        name: "TableRows",
        viewBox: 16,
        paths: [
          propertyIconPath("M3.865 4H12.135M3.865 8H12.135M3.865 12H12.135"),
        ],
      };
      TABLE_COLUMNS_ICON = {
        name: "TableColumns",
        viewBox: 16,
        paths: [
          propertyIconPath("M4 3.865V12.135M8 3.865V12.135M12 3.865V12.135"),
        ],
      };
      FILL_SOLID_ICON = {
        name: "FillSolid",
        viewBox: 16,
        paths: [
          "M4.25 3H11.75C12.44 3 13 3.56 13 4.25V11.75C13 12.44 12.44 13 11.75 13H4.25C3.56 13 3 12.44 3 11.75V4.25C3 3.56 3.56 3 4.25 3Z",
        ],
      };
      FILL_GRADIENT_ICON = {
        name: "FillGradient",
        viewBox: 16,
        paths: [
          propertyIconPath(
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
          propertyIconPath(
            "M3.5 8A4.5 4.5 0 0 1 12.5 8A4.5 4.5 0 0 1 3.5 8ZM8 8L11.2 4.8",
          ),
        ],
      };
      FILL_MODE_ICONS = {
        color: FILL_SOLID_ICON,
        gradient: FILL_GRADIENT_ICON,
      };
    });
  };
}
