/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorTextTypingTarget(
  runtime: RuntimeBindings,
): () => void {
  var blockingOverlaySelectorAlias: Dynamic;
  var TextTypingTargetRangeCheckboxPattern: Dynamic;
  function hasBlockingEditorOverlay(): Dynamic {
    for (let value of (document as Dynamic).querySelectorAll(
      blockingOverlaySelectorAlias,
    ) as Dynamic)
      if (!(0, runtime.isClosedOverlay)(value)) return true;
    return false;
  }
  function hasHeldUndoOverlay(element: Dynamic = document): Dynamic {
    return (
      element.querySelector(
        "[" + runtime.heldUndoStepOverlayAttribute + "]",
      ) !== null
    );
  }
  function isCanvasTypingTarget(input?: Dynamic): Dynamic {
    if (input instanceof HTMLElement) {
      if (input.closest("[data-tweak-popup],[data-tweaks-surface]") != null)
        return false;
      if (
        input.tagName === "TEXTAREA" ||
        input.isContentEditable ||
        (input instanceof HTMLInputElement &&
          !TextTypingTargetRangeCheckboxPattern.test(input.type)) ||
        input.closest("[data-note-typing-strip]") != null
      )
        return true;
    }
    if (!(0, runtime.isUndoBlockedByOverlay)()) return false;
    if (hasHeldUndoOverlay()) return true;
    for (let value of (document as Dynamic).querySelectorAll(
      blockingOverlaySelectorAlias,
    ) as Dynamic)
      if (
        !(
          value.matches("[data-tweak-popup]") ||
          value.querySelector("[data-tweak-popup]") != null
        ) &&
        !(0, runtime.isClosedOverlay)(value)
      )
        return true;
    return false;
  }
  bindRuntimeValue(
    runtime,
    "blockingOverlaySelectorAlias",
    () => blockingOverlaySelectorAlias,
    (value) => {
      blockingOverlaySelectorAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasBlockingEditorOverlay",
    () => hasBlockingEditorOverlay,
  );
  bindRuntimeValue(
    runtime,
    "TextTypingTargetRangeCheckboxPattern",
    () => TextTypingTargetRangeCheckboxPattern,
    (value) => {
      TextTypingTargetRangeCheckboxPattern = value;
    },
  );
  bindRuntimeValue(runtime, "hasHeldUndoOverlay", () => hasHeldUndoOverlay);
  bindRuntimeValue(runtime, "isCanvasTypingTarget", () => isCanvasTypingTarget);
  return () => {
    blockingOverlaySelectorAlias = runtime.blockingOverlaySelector;
    TextTypingTargetRangeCheckboxPattern =
      /^(range|checkbox|radio|button|submit|reset|color|file|image)$/;
  };
}
