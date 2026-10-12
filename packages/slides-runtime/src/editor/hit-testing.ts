/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

declare module "../bindings" {
  interface RuntimeBindings {
    editableElementAtPoint: (
      clientX: number,
      clientY: number,
      selectors?: readonly string[],
    ) => Element | null;
  }
}

export function installEditorHitTesting(runtime: RuntimeBindings): () => void {
  function editableElementAtPoint(
    clientX: number,
    clientY: number,
    selectors: readonly string[] = ["[data-cell]", "[data-text-path]"],
  ): Element | null {
    if (
      typeof document === "undefined" ||
      typeof document.elementsFromPoint !== "function"
    ) {
      return null;
    }
    for (let value of document.elementsFromPoint(clientX, clientY)) {
      if (value.closest("[data-resize-handle]") !== null) {
        continue;
      }
      for (let value2 of selectors) {
        let ancestor = value.closest(value2);
        if (ancestor !== null) {
          return ancestor;
        }
      }
      return null;
    }
    return null;
  }
  bindRuntimeValue(
    runtime,
    "editableElementAtPoint",
    () => editableElementAtPoint,
  );
  return () => {
    (0, runtime.initializeUiInspectorIcons)();
    (0, runtime.initializeGradientEditor)();
    (0, runtime.initializeUiPropertyLabels)();
    (0, runtime.initializeUiNumberControls)();
  };
}
