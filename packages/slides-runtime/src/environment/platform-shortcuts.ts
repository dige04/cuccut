/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

declare module "../bindings" {
  interface RuntimeBindings {
    isApplePlatform: () => boolean;
    formatCommandShortcut: (
      key: string,
      options?: { shift?: boolean },
    ) => string;
    isDuplicateShortcut: (event: KeyboardEventLike) => boolean;
  }
}

/** The modifier and key state of a keyboard event (DOM or React). */
export interface KeyboardEventLike {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

export function installEnvironmentPlatformShortcuts(
  runtime: RuntimeBindings,
): () => void {
  function isApplePlatform() {
    if (typeof navigator === "undefined") {
      return false;
    }
    return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
  }
  function formatCommandShortcut(
    key: string,
    { shift = false }: { shift?: boolean } = {},
  ) {
    if (isApplePlatform()) {
      return (shift ? "⇧⌘" : "⌘") + key;
    }
    return "Ctrl+" + (shift ? "Shift+" : "") + key;
  }
  function isDuplicateShortcut(event: KeyboardEventLike) {
    return (
      (event.key === "d" || event.key === "D") &&
      !event.shiftKey &&
      !event.altKey &&
      (isApplePlatform() ? event.metaKey && !event.ctrlKey : event.ctrlKey)
    );
  }
  bindRuntimeValue(runtime, "isApplePlatform", () => isApplePlatform);
  bindRuntimeValue(
    runtime,
    "formatCommandShortcut",
    () => formatCommandShortcut,
  );
  bindRuntimeValue(runtime, "isDuplicateShortcut", () => isDuplicateShortcut);
  return () => {};
}
