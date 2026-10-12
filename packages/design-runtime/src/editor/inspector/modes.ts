/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorInspectorModes(
  runtime: RuntimeBindings,
): () => void {
  var OutlineValue: Dynamic;
  function getInspectorMode(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return input === "tweaks"
      ? "tweaks"
      : input === "code"
        ? "code"
        : options !== "wide" && context === "outline"
          ? "outline"
          : "pro";
  }
  function inspectorModeState(input?: Dynamic): Dynamic {
    switch (input) {
      case "tweaks":
        return {
          mode: "tweaks",
          sheetTab: null,
        };
      case "code":
        return {
          mode: "code",
          sheetTab: "edit",
        };
      case "outline":
        return {
          mode: "pro",
          sheetTab: "outline",
        };
      case "pro":
        return {
          mode: "pro",
          sheetTab: "edit",
        };
    }
  }
  function isOutlineKeyboardFocus(input?: Dynamic, options?: Dynamic): Dynamic {
    return options ||
      input?.closest(
        `[data-testid="dc-outline"], [data-menu-owner="${OutlineValue}"]`,
      ) == null
      ? false
      : input.matches(":focus-visible") &&
          !input.matches("input, textarea, [contenteditable]");
  }
  bindRuntimeValue(runtime, "getInspectorMode", () => getInspectorMode);
  bindRuntimeValue(runtime, "inspectorModeState", () => inspectorModeState);
  bindRuntimeValue(
    runtime,
    "OutlineValue",
    () => OutlineValue,
    (value) => {
      OutlineValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isOutlineKeyboardFocus",
    () => isOutlineKeyboardFocus,
  );
  return () => {
    OutlineValue = "outline";
  };
}
