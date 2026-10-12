/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";
import type { CommandHistory } from "../editor/command-history";

/** The slice of the command history the keyboard shortcuts drive. */
export type UndoKeyHistory = Pick<CommandHistory, "undo" | "redo">;
export type UndoRedoKeyCommand = "undo" | "redo";

declare module "../bindings" {
  interface RuntimeBindings {
    reactX20: ReactNamespace;
    undoRedoKeyCommand: (event: KeyboardEvent) => UndoRedoKeyCommand | undefined;
    isUndoEditingTarget: (target: EventTarget | null) => boolean;
    createUndoKeyHandler: (
      history: UndoKeyHistory,
    ) => (event: KeyboardEvent) => void;
    useUndoKeys: (
      history: UndoKeyHistory | null | undefined,
      enabled?: boolean,
    ) => void;
  }
}

export function installUiUndoKeys(runtime: RuntimeBindings): () => void {
  var reactX20: ReactNamespace;
  function undoRedoKeyCommand(
    event: KeyboardEvent,
  ): UndoRedoKeyCommand | undefined {
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
  function isUndoEditingTarget(target: EventTarget | null): boolean {
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
  function createUndoKeyHandler(
    history: UndoKeyHistory,
  ): (event: KeyboardEvent) => void {
    return (event: KeyboardEvent): void => {
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
        history.redo();
      } else {
        history.undo();
      }
    };
  }
  function useUndoKeys(
    history: UndoKeyHistory | null | undefined,
    enabled: boolean = true,
  ): void {
    reactX20.useEffect(() => {
      if (!history || !enabled) {
        return;
      }
      let value = createUndoKeyHandler(history);
      window.addEventListener("keydown", value);
      return (): void => window.removeEventListener("keydown", value);
    }, [history, enabled]);
  }
  bindRuntimeValue(
    runtime,
    "reactX20",
    () => reactX20,
    (value) => {
      reactX20 = value;
    },
  );
  bindRuntimeValue(runtime, "undoRedoKeyCommand", () => undoRedoKeyCommand);
  bindRuntimeValue(runtime, "isUndoEditingTarget", () => isUndoEditingTarget);
  bindRuntimeValue(runtime, "createUndoKeyHandler", () => createUndoKeyHandler);
  bindRuntimeValue(runtime, "useUndoKeys", () => useUndoKeys);
  return () => {
    (0, runtime.initializeUiPropertyFocus)();
    reactX20 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
  };
}
