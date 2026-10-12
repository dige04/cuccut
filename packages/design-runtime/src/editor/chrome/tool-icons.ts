/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorChromeToolIcons(
  runtime: RuntimeBindings,
): () => void {
  var ChromeToolIconsRectOvalConfig: Dynamic;
  var ChromeToolIconsColumnRowTextConfig: Dynamic;
  var ChromeToolIconsNoteTitleRectConfig: Dynamic;

  bindRuntimeValue(
    runtime,
    "ChromeToolIconsRectOvalConfig",
    () => ChromeToolIconsRectOvalConfig,
    (value) => {
      ChromeToolIconsRectOvalConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromeToolIconsColumnRowTextConfig",
    () => ChromeToolIconsColumnRowTextConfig,
    (value) => {
      ChromeToolIconsColumnRowTextConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromeToolIconsNoteTitleRectConfig",
    () => ChromeToolIconsNoteTitleRectConfig,
    (value) => {
      ChromeToolIconsNoteTitleRectConfig = value;
    },
  );
  return () => {
    ChromeToolIconsRectOvalConfig = {
      rect: {
        name: "Rect",
        viewBox: 16,
        paths: [
          {
            d: "M3.5 4.5h9a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z",
            strokeWidth: 1,
          },
        ],
      },
      oval: {
        name: "Oval",
        viewBox: 16,
        paths: [
          {
            d: "M8 3a5 5 0 1 0 0 10a5 5 0 1 0 0-10Z",
            strokeWidth: 1,
          },
        ],
      },
    };
    ChromeToolIconsColumnRowTextConfig = {
      column: {
        name: "AlignStretch",
      },
      row: {
        name: "Reorder",
      },
      text: {
        name: "TextT",
      },
      frame: {
        name: "FrameHash",
      },
      grid: {
        name: "Grid",
      },
      rect: {
        name: "Stop",
      },
      oval: {
        custom: ChromeToolIconsRectOvalConfig.oval,
      },
      line: {
        name: "LineSegment",
      },
      image: {
        name: "Image",
      },
      table: {
        name: "Table",
      },
      link: {
        name: "Link",
      },
      component: {
        name: "Box",
      },
    };
    ChromeToolIconsNoteTitleRectConfig = {
      note: {
        name: "Note",
      },
      title: {
        name: "TextT",
      },
      rect: {
        name: "Stop",
      },
      oval: {
        custom: ChromeToolIconsRectOvalConfig.oval,
      },
      line: {
        name: "LineSegment",
      },
      arrow: {
        name: "ArrowLine",
      },
      pen: {
        name: "Edit",
      },
      image: {
        name: "Image",
      },
    };
  };
}
