/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorKeyboardEditActions(
  runtime: RuntimeBindings,
): () => void {
  var reactKeyboardEditActions: Dynamic;
  var jsxKeyboardEditActions: Dynamic;
  var KeyboardEditActionsCutCopyPasteConfig: Dynamic;
  var isContextMenuShortcut: Dynamic;

  bindRuntimeValue(
    runtime,
    "reactKeyboardEditActions",
    () => reactKeyboardEditActions,
    (value) => {
      reactKeyboardEditActions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxKeyboardEditActions",
    () => jsxKeyboardEditActions,
    (value) => {
      jsxKeyboardEditActions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "KeyboardEditActionsCutCopyPasteConfig",
    () => KeyboardEditActionsCutCopyPasteConfig,
    (value) => {
      KeyboardEditActionsCutCopyPasteConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isContextMenuShortcut",
    () => isContextMenuShortcut,
    (value) => {
      isContextMenuShortcut = value;
    },
  );
  return () => {
    reactKeyboardEditActions = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    (0, runtime.initializePlatformCdsIsland)();
    (0, runtime.initializeCdsIndex)();
    jsxKeyboardEditActions = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    KeyboardEditActionsCutCopyPasteConfig = {
      cut: {
        label: "Cut",
        shortcut: "cmd+x",
      },
      copy: {
        label: "Copy",
        shortcut: "cmd+c",
      },
      paste: {
        label: "Paste",
        shortcut: "cmd+v",
      },
      duplicate: {
        label: "Duplicate",
        shortcut: "cmd+d",
      },
      front: {
        label: "Bring to front",
        shortcut: "]",
      },
      back: {
        label: "Send to back",
        shortcut: "[",
      },
      group: {
        label: "Group",
        shortcut: "cmd+g",
      },
      ungroup: {
        label: "Ungroup",
        shortcut: "shift+cmd+g",
      },
      delete: {
        label: "Delete",
        shortcut: "backspace",
      },
      "select-all": {
        label: "Select all",
        shortcut: "cmd+a",
      },
    };
    isContextMenuShortcut = (input?: Dynamic): Dynamic =>
      input.key === "ContextMenu" || (input.key === "F10" && input.shiftKey);
    (0, runtime.initializeCdsIndex)();
  };
}
