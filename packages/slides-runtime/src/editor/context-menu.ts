/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";

/** A menu entry with its own label (as opposed to a built-in command id such as "cut"). */
export interface ContextMenuCommandItem {
  id: string;
  label: string;
  shortcut?: string;
}
/** One separator-delimited group of context menu commands. */
export type ContextMenuGroup = Array<string | ContextMenuCommandItem>;
export interface CanvasContextMenuProps {
  /** Number of selected objects; 0 means the slide itself. */
  objects: number;
  /** Label of the "fit" command shown when nothing is selected. */
  fitLabel: string;
  /** Everything else goes to the shared edit context menu (`at`, `refusals`, `onCommand`, `onClose`, ...). */
  [prop: string]: unknown;
}

declare module "../bindings" {
  interface RuntimeBindings {
    CanvasContextMenuJsx: JsxNamespace;
    ENABLE_OBJECT_PROPERTIES_MENU: boolean;
    OBJECT_PROPERTIES_MENU_GROUPS: ContextMenuGroup[];
    OBJECT_CONTEXT_MENU_GROUPS: ContextMenuGroup[];
    CanvasContextMenu: (props: CanvasContextMenuProps) => ReactElement;
  }
}

export function installEditorContextMenu(runtime: RuntimeBindings): () => void {
  var CanvasContextMenuJsx: JsxNamespace;
  var ENABLE_OBJECT_PROPERTIES_MENU: RuntimeBindings["ENABLE_OBJECT_PROPERTIES_MENU"];
  var OBJECT_PROPERTIES_MENU_GROUPS: RuntimeBindings["OBJECT_PROPERTIES_MENU_GROUPS"];
  var OBJECT_CONTEXT_MENU_GROUPS: RuntimeBindings["OBJECT_CONTEXT_MENU_GROUPS"];
  function CanvasContextMenu({
    objects: objects,
    fitLabel: fitLabel,
    ...props
  }: CanvasContextMenuProps): ReactElement {
    let value =
      objects === 0
        ? "Slide actions"
        : objects === 1
          ? "Object actions"
          : "Actions for " + String(objects) + " objects";
    return CanvasContextMenuJsx.jsx(runtime.EditContextMenu, {
      ...props,
      name: value,
      className: "min-w-52",
      groups:
        objects > 0
          ? OBJECT_CONTEXT_MENU_GROUPS
          : [
              ["paste"],
              [
                {
                  id: "fit",
                  label: fitLabel,
                  shortcut: "cmd+0",
                },
              ],
            ],
    });
  }
  bindRuntimeValue(
    runtime,
    "CanvasContextMenuJsx",
    () => CanvasContextMenuJsx,
    (value) => {
      CanvasContextMenuJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ENABLE_OBJECT_PROPERTIES_MENU",
    () => ENABLE_OBJECT_PROPERTIES_MENU,
    (value) => {
      ENABLE_OBJECT_PROPERTIES_MENU = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OBJECT_PROPERTIES_MENU_GROUPS",
    () => OBJECT_PROPERTIES_MENU_GROUPS,
    (value) => {
      OBJECT_PROPERTIES_MENU_GROUPS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OBJECT_CONTEXT_MENU_GROUPS",
    () => OBJECT_CONTEXT_MENU_GROUPS,
    (value) => {
      OBJECT_CONTEXT_MENU_GROUPS = value;
    },
  );
  bindRuntimeValue(runtime, "CanvasContextMenu", () => CanvasContextMenu);
  return () => {
    (0, runtime.initializeModelSelection)();
    CanvasContextMenuJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    ENABLE_OBJECT_PROPERTIES_MENU = false;
    OBJECT_PROPERTIES_MENU_GROUPS = ENABLE_OBJECT_PROPERTIES_MENU
      ? [
          [
            {
              id: "properties",
              label: "Properties",
            },
          ],
        ]
      : [];
    OBJECT_CONTEXT_MENU_GROUPS = [
      ["cut", "copy", "paste", "duplicate"],
      ["front", "back", "group", "ungroup"],
      ...OBJECT_PROPERTIES_MENU_GROUPS,
      ["delete"],
    ];
  };
}
