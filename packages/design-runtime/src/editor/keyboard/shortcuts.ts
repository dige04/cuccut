/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorKeyboardShortcuts(
  runtime: RuntimeBindings,
): () => void {
  function isApplePlatform(): Dynamic {
    return typeof navigator === "undefined"
      ? false
      : /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
  }
  function keyboardShortcutLabel(
    input?: Dynamic,
    { shift: options = false }: Dynamic = {},
  ): Dynamic {
    return isApplePlatform()
      ? (options ? "\u21E7\u2318" : "\u2318") + input
      : "Ctrl+" + (options ? "Shift+" : "") + input;
  }
  function isDuplicateShortcut(input?: Dynamic): Dynamic {
    return (
      (input.key === "d" || input.key === "D") &&
      !input.shiftKey &&
      !input.altKey &&
      (isApplePlatform() ? input.metaKey && !input.ctrlKey : input.ctrlKey)
    );
  }
  bindRuntimeValue(runtime, "isApplePlatform", () => isApplePlatform);
  bindRuntimeValue(
    runtime,
    "keyboardShortcutLabel",
    () => keyboardShortcutLabel,
  );
  bindRuntimeValue(runtime, "isDuplicateShortcut", () => isDuplicateShortcut);
  return () => {};
}
