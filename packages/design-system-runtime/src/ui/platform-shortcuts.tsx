/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as C from "../contracts/controls";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiPlatformShortcuts(
  runtime: RuntimeBindings,
): () => void {
  var reactPlatformShortcuts: typeof React;
  var jsxPlatformShortcuts: typeof import("react/jsx-runtime");
  function isApplePlatform() {
    if (typeof navigator === "undefined") {
      return false;
    }
    return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
  }
  function formatCommandShortcut(key: string, { shift = false } = {}) {
    if (isApplePlatform()) {
      return (shift ? "⇧⌘" : "⌘") + key;
    }
    return "Ctrl+" + (shift ? "Shift+" : "") + key;
  }
  bindRuntimeValue(
    runtime,
    "reactPlatformShortcuts",
    () => reactPlatformShortcuts,
    (value) => {
      reactPlatformShortcuts = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPlatformShortcuts",
    () => jsxPlatformShortcuts,
    (value) => {
      jsxPlatformShortcuts = value;
    },
  );
  bindRuntimeValue(runtime, "isApplePlatform", () => isApplePlatform);
  bindRuntimeValue(
    runtime,
    "formatCommandShortcut",
    () => formatCommandShortcut,
  );
  return () => {
    reactPlatformShortcuts = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxPlatformShortcuts = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
  };
}
