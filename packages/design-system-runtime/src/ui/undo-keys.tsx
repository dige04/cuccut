/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  UndoKeyEvent,
  UndoCommand,
  UndoActions,
} from "../contracts/composition";
export function installUiUndoKeys(runtime: RuntimeBindings): () => void {
  function undoRedoKeyCommand(event: UndoKeyEvent): UndoCommand | undefined {
    if (event.altKey) {
      return;
    }
    if (!(event.metaKey || event.ctrlKey)) {
      return;
    }
    let value = event.key.toLowerCase();
    if (value === "z") {
      if (event.shiftKey) {
        return "redo";
      } else {
        return "undo";
      }
    }
    if (value === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey) {
      return "redo";
    }
    return;
  }
  function isUndoEditingTarget(target: EventTarget | null) {
    if (
      typeof HTMLElement === "undefined" ||
      !(target instanceof HTMLElement)
    ) {
      return false;
    }
    return (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable
    );
  }
  function createUndoKeyHandler(history2: UndoActions) {
    return (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      let value = undoRedoKeyCommand(event);
      if (!value) {
        return;
      }
      if (isUndoEditingTarget(event.target)) {
        return;
      }
      if (typeof document !== "undefined" && (0, runtime.overlaysBlockUndo)()) {
        return;
      }
      event.preventDefault();
      if (value === "redo") {
        history2.redo();
      } else {
        history2.undo();
      }
    };
  }
  function useUndoKeys(
    history2: UndoActions | null | undefined,
    enabled: boolean = true,
  ) {
    runtime.reactForPlatformFrameChrome.useEffect(() => {
      if (!history2 || !enabled) {
        return;
      }
      let value = createUndoKeyHandler(history2);
      window.addEventListener("keydown", value);
      return () => window.removeEventListener("keydown", value);
    }, [history2, enabled]);
  }
  bindRuntimeValue(runtime, "undoRedoKeyCommand", () => undoRedoKeyCommand);
  bindRuntimeValue(runtime, "isUndoEditingTarget", () => isUndoEditingTarget);
  bindRuntimeValue(runtime, "createUndoKeyHandler", () => createUndoKeyHandler);
  bindRuntimeValue(runtime, "useUndoKeys", () => useUndoKeys);
  return () => {};
}
