/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";

/** The 16px and 20px outline paths of a shape's toolbar icon. */
export interface ShapeIconPath {
  d16: string;
  d20: string;
}
export interface ShapeIconPaths {
  stroke: number;
  icons: Record<string, ShapeIconPath>;
}
export interface ShapeIconProps {
  /** Shape variant name, e.g. "rect" or "arrow-right". */
  shape: string;
  /** Pixel size, or a CSS length such as "100%" to let the container size it. */
  size?: number | string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ShapeIconJsx: JsxNamespace;
    SHAPE_ICON_PATHS: ShapeIconPaths;
    ShapeIcon: (props: ShapeIconProps) => ReactElement;
  }
}

export function installEditorShapeIcons(runtime: RuntimeBindings): () => void {
  var SHAPE_ICON_PATHS: RuntimeBindings["SHAPE_ICON_PATHS"];
  var ShapeIconJsx: JsxNamespace;
  function ShapeIcon({ shape: shape, size = 26 }: ShapeIconProps): ReactElement {
    let state = {
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 5.6,
        strokeLinejoin: "round",
      },
      value = SHAPE_ICON_PATHS.icons[shape],
      value2 = ShapeIconJsx.jsx("svg", {
        viewBox: "-6 -6 112 112",
        width: size,
        height: size,
        "aria-hidden": true,
        className: value === undefined ? undefined : "sl-shape-mark",
        children:
          shape === "rect"
            ? ShapeIconJsx.jsx("rect", {
                x: "4",
                y: "18",
                width: "92",
                height: "64",
                ...state,
              })
            : shape === "rounded"
              ? ShapeIconJsx.jsx("rect", {
                  x: "4",
                  y: "18",
                  width: "92",
                  height: "64",
                  rx: "18",
                  ...state,
                })
              : shape === "ellipse"
                ? ShapeIconJsx.jsx("ellipse", {
                    cx: "50",
                    cy: "50",
                    rx: "46",
                    ry: "34",
                    ...state,
                  })
                : shape === "line"
                  ? ShapeIconJsx.jsx("line", {
                      x1: "4",
                      y1: "50",
                      x2: "96",
                      y2: "50",
                      ...state,
                      strokeWidth: 7.2,
                    })
                  : shape === "connector"
                    ? ShapeIconJsx.jsx("path", {
                        d: "M4 82 L96 18 M66 16 L96 18 L90 46",
                        ...state,
                        strokeWidth: 7.2,
                        strokeLinecap: "round",
                      })
                    : ShapeIconJsx.jsx("polygon", {
                        points: runtime.shapeClipPaths[shape],
                        ...state,
                      }),
      });
    if (value === undefined) {
      return value2;
    }
    let callback = (input: number, options: string): ReactElement =>
      ShapeIconJsx.jsx("svg", {
        viewBox: "0 0 " + String(input) + " " + String(input),
        width: size,
        height: size,
        fill: "none",
        "aria-hidden": true,
        className: "sl-shape-drawing" + options,
        style: {
          display: "none",
        },
        children: ShapeIconJsx.jsx("path", {
          d: input === 16 ? value.d16 : value.d20,
          stroke: "currentColor",
          strokeWidth: SHAPE_ICON_PATHS.stroke,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }),
      });
    return ShapeIconJsx.jsxs(ShapeIconJsx.Fragment, {
      children: [
        value2,
        typeof size !== "number"
          ? ShapeIconJsx.jsxs(ShapeIconJsx.Fragment, {
              children: [
                callback(16, " sl-shape-fine"),
                callback(20, " sl-shape-coarse"),
              ],
            })
          : callback(size > 18 ? 20 : 16, ""),
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "SHAPE_ICON_PATHS",
    () => SHAPE_ICON_PATHS,
    (value) => {
      SHAPE_ICON_PATHS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ShapeIconJsx",
    () => ShapeIconJsx,
    (value) => {
      ShapeIconJsx = value;
    },
  );
  bindRuntimeValue(runtime, "ShapeIcon", () => ShapeIcon);
  return () => {
    SHAPE_ICON_PATHS = {
      stroke: 1.25,
      icons: {
        rect: {
          d16: "M1.625 3.62H14.375V12.38H1.625Z",
          d20: "M2.625 4.62H17.375V15.38H2.625Z",
        },
        rounded: {
          d16: "M11.375 3.62L4.625 3.62C2.968 3.62 1.625 4.97 1.625 6.62L1.625 9.38C1.625 11.03 2.968 12.38 4.625 12.38L11.375 12.38C13.032 12.38 14.375 11.03 14.375 9.38L14.375 6.62C14.375 4.97 13.032 3.62 11.375 3.62Z",
          d20: "M13.875 4.62L6.125 4.62C4.192 4.62 2.625 6.19 2.625 8.12L2.625 11.88C2.625 13.81 4.192 15.38 6.125 15.38L13.875 15.38C15.808 15.38 17.375 13.81 17.375 11.88L17.375 8.12C17.375 6.19 15.808 4.62 13.875 4.62Z",
        },
        ellipse: {
          d16: "M2.625 8A5.375 5.375 0 1 0 13.375 8A5.375 5.375 0 1 0 2.625 8Z",
          d20: "M3.625 10A6.375 6.375 0 1 0 16.375 10A6.375 6.375 0 1 0 3.625 10Z",
        },
        diamond: {
          d16: "M14.098 7.421L8.477 2.795C8.2 2.567 7.8 2.567 7.524 2.795L1.901 7.421C1.536 7.721 1.536 8.279 1.901 8.579L7.524 13.206C7.8 13.434 8.2 13.434 8.477 13.206L14.098 8.579C14.463 8.279 14.463 7.721 14.098 7.421Z",
          d20: "M17.017 9.236L10.645 3.859C10.273 3.544 9.728 3.544 9.355 3.859L2.984 9.236C2.51 9.636 2.51 10.365 2.984 10.765L9.355 16.141C9.728 16.455 10.273 16.455 10.645 16.141L17.017 10.765C17.49 10.365 17.49 9.636 17.017 9.236Z",
        },
        "arrow-right": {
          d16: "M7.875 6.125L2.375 6.125C1.961 6.125 1.625 6.461 1.625 6.875L1.625 9.125C1.625 9.54 1.961 9.875 2.375 9.875L7.875 9.875C8.289 9.875 8.625 10.211 8.625 10.625L8.625 11.621C8.625 12.26 9.374 12.606 9.861 12.192L14.113 8.571C14.465 8.272 14.465 7.729 14.113 7.429L9.861 3.809C9.374 3.394 8.625 3.74 8.625 4.38L8.625 5.375C8.625 5.79 8.289 6.125 7.875 6.125Z",
          d20: "M9.875 7.625L3.375 7.625C2.961 7.625 2.625 7.961 2.625 8.375L2.625 11.625C2.625 12.039 2.961 12.375 3.375 12.375L9.875 12.375C10.289 12.375 10.625 12.711 10.625 13.125L10.625 14.622C10.625 15.267 11.386 15.611 11.87 15.185L17.122 10.563C17.462 10.264 17.462 9.736 17.122 9.437L11.87 4.816C11.386 4.39 10.625 4.734 10.625 5.379L10.625 6.875C10.625 7.289 10.289 7.625 9.875 7.625Z",
        },
        "arrow-left": {
          d16: "M8.125 6.125L13.624 6.125C14.038 6.125 14.374 6.461 14.374 6.875L14.374 9.125C14.374 9.54 14.038 9.875 13.624 9.875L8.125 9.875C7.71 9.875 7.375 10.211 7.375 10.625L7.375 11.62C7.375 12.259 6.625 12.606 6.138 12.191L1.887 8.571C1.535 8.272 1.535 7.729 1.887 7.429L6.138 3.809C6.625 3.395 7.375 3.741 7.375 4.38L7.375 5.375C7.375 5.79 7.71 6.125 8.125 6.125Z",
          d20: "M10.125 7.625L16.625 7.625C17.039 7.625 17.375 7.961 17.375 8.375L17.375 11.625C17.375 12.039 17.039 12.375 16.625 12.375L10.125 12.375C9.711 12.375 9.375 12.711 9.375 13.125L9.375 14.622C9.375 15.267 8.614 15.611 8.129 15.185L2.879 10.563C2.539 10.264 2.539 9.736 2.879 9.437L8.129 4.816C8.614 4.39 9.375 4.734 9.375 5.379L9.375 6.875C9.375 7.289 9.711 7.625 10.125 7.625Z",
        },
        "arrow-up": {
          d16: "M6.125 8.125L6.125 13.624C6.125 14.038 6.461 14.374 6.875 14.374L9.125 14.374C9.54 14.374 9.875 14.038 9.875 13.624L9.875 8.125C9.875 7.71 10.211 7.375 10.625 7.375L11.62 7.375C12.259 7.375 12.606 6.625 12.191 6.138L8.571 1.887C8.272 1.535 7.729 1.535 7.429 1.887L3.809 6.138C3.395 6.625 3.741 7.375 4.38 7.375L5.375 7.375C5.79 7.375 6.125 7.71 6.125 8.125Z",
          d20: "M7.625 10.125L7.625 16.625C7.625 17.039 7.961 17.375 8.375 17.375L11.625 17.375C12.039 17.375 12.375 17.039 12.375 16.625L12.375 10.125C12.375 9.711 12.711 9.375 13.125 9.375L14.622 9.375C15.267 9.375 15.611 8.614 15.185 8.129L10.563 2.879C10.264 2.539 9.736 2.539 9.437 2.879L4.816 8.129C4.39 8.614 4.734 9.375 5.379 9.375L6.875 9.375C7.289 9.375 7.625 9.711 7.625 10.125Z",
        },
        "arrow-down": {
          d16: "M9.875 7.875L9.875 2.375C9.875 1.961 9.54 1.625 9.125 1.625L6.875 1.625C6.461 1.625 6.125 1.961 6.125 2.375L6.125 7.875C6.125 8.289 5.79 8.625 5.375 8.625L4.38 8.625C3.74 8.625 3.394 9.374 3.809 9.861L7.429 14.113C7.729 14.465 8.272 14.465 8.571 14.113L12.192 9.861C12.606 9.374 12.26 8.625 11.621 8.625L10.625 8.625C10.211 8.625 9.875 8.289 9.875 7.875Z",
          d20: "M12.375 9.875L12.375 3.375C12.375 2.961 12.039 2.625 11.625 2.625L8.375 2.625C7.961 2.625 7.625 2.961 7.625 3.375L7.625 9.875C7.625 10.289 7.289 10.625 6.875 10.625L5.379 10.625C4.734 10.625 4.39 11.386 4.816 11.87L9.437 17.122C9.736 17.462 10.264 17.462 10.563 17.122L15.185 11.87C15.611 11.386 15.267 10.625 14.622 10.625L13.125 10.625C12.711 10.625 12.375 10.289 12.375 9.875Z",
        },
        line: {
          d16: "M3.625 12.38L12.375 3.62",
          d20: "M4.625 15.38L15.375 4.62",
        },
        connector: {
          d16: "M3.625 12.375L12.375 3.625M12.375 9.282L12.375 3.625L6.718 3.625",
          d20: "M4.625 15.375L15.375 4.625M15.375 11.696L15.375 4.625L8.304 4.625",
        },
      },
    };
    (0, runtime.initializeSlideRenderer)();
    ShapeIconJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
  };
}
