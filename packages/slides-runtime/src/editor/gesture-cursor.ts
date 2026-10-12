/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

declare module "../bindings" {
  interface RuntimeBindings {
    setGestureCursor: (cursor: string) => void;
    clearGestureCursor: () => void;
  }
}

export function installEditorGestureCursor(
  runtime: RuntimeBindings,
): () => void {
  function setGestureCursor(cursor: string): void {
    let documentElement = document.documentElement;
    documentElement.style.setProperty("--gesture-cursor", cursor);
    documentElement.setAttribute("data-gesture-cursor", "");
  }
  function clearGestureCursor(): void {
    let documentElement = document.documentElement;
    documentElement.removeAttribute("data-gesture-cursor");
    documentElement.style.removeProperty("--gesture-cursor");
  }
  bindRuntimeValue(runtime, "setGestureCursor", () => setGestureCursor);
  bindRuntimeValue(runtime, "clearGestureCursor", () => clearGestureCursor);
  return () => {};
}
