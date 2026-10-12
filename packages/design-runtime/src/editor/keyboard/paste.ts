/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorKeyboardPaste(
  runtime: RuntimeBindings,
): () => void {
  var KeyboardPasteLabel: Dynamic;
  var KeyboardPasteLabel_2: Dynamic;
  var KeyboardPasteReplace: Dynamic;
  var KeyboardPasteJoinValue: Dynamic;
  var KeyboardPasteLabel_3: Dynamic;
  var KeyboardPasteLabel_4: Dynamic;
  var RoleSwitchValue: Dynamic;
  var KeyboardPasteSubscribers: Dynamic;
  function imagePasteRefusal(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = "",
    value: Dynamic = "image",
  ): Dynamic {
    let value2: Dynamic = input,
      value3: Dynamic =
        value2 != null &&
        (value2.tagName === "TEXTAREA" || value2.isContentEditable === true),
      value4: Dynamic =
        value3 ||
        value2?.closest?.("[data-note-typing-strip],[data-link-mode]") != null;
    if ((value3 || value2?.tagName === "INPUT") && context.trim() !== "")
      return {
        to: "chrome",
      };
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      value === "video" ? KeyboardPasteReplace(input2) : input2;
    return (0, runtime.hasBlockingOverlay)(value2?.ownerDocument ?? document)
      ? options
        ? {
            to: "nobody",
            say: callback(KeyboardPasteLabel),
          }
        : {
            to: "chrome",
          }
      : options
        ? value4
          ? {
              to: "nobody",
              say: callback(KeyboardPasteLabel_2),
            }
          : {
              to: "canvas",
            }
        : {
            to: (0, runtime.isEditingInputTarget)(input) ? "chrome" : "canvas",
          };
  }
  function isControlTarget(input?: Dynamic): Dynamic {
    let value: Dynamic = input;
    return (
      value != null &&
      typeof value.matches == "function" &&
      value.matches(KeyboardPasteJoinValue)
    );
  }
  function shouldKeepLocalKeyboardEvent(event?: Dynamic): Dynamic {
    if (event.defaultPrevented) return true;
    let target: Dynamic = event.target;
    return target == null ||
      typeof target.closest != "function" ||
      event.metaKey ||
      event.ctrlKey
      ? false
      : target.closest(KeyboardPasteLabel_3) != null
        ? true
        : event.shiftKey || event.altKey
          ? false
          : (event.key === "Enter" &&
                target.closest('button, [role="button"]') != null) ||
              ((event.key === "Enter" || event.key === " ") &&
                target.closest(RoleSwitchValue) != null)
            ? true
            : KeyboardPasteSubscribers.has(event.key) &&
              target.closest(KeyboardPasteLabel_4) != null;
  }
  function isCanvasEnterAction(event?: Dynamic): Dynamic {
    return event.key !== "Enter" ||
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      !(event.target instanceof Element)
      ? false
      : event.target.matches(
          '[data-posture="sheet"] [data-testid="dc-mode-pro"][aria-selected="true"]',
        );
  }
  bindRuntimeValue(
    runtime,
    "KeyboardPasteLabel",
    () => KeyboardPasteLabel,
    (value) => {
      KeyboardPasteLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "KeyboardPasteLabel_2",
    () => KeyboardPasteLabel_2,
    (value) => {
      KeyboardPasteLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "KeyboardPasteReplace",
    () => KeyboardPasteReplace,
    (value) => {
      KeyboardPasteReplace = value;
    },
  );
  bindRuntimeValue(runtime, "imagePasteRefusal", () => imagePasteRefusal);
  bindRuntimeValue(
    runtime,
    "KeyboardPasteJoinValue",
    () => KeyboardPasteJoinValue,
    (value) => {
      KeyboardPasteJoinValue = value;
    },
  );
  bindRuntimeValue(runtime, "isControlTarget", () => isControlTarget);
  bindRuntimeValue(
    runtime,
    "KeyboardPasteLabel_3",
    () => KeyboardPasteLabel_3,
    (value) => {
      KeyboardPasteLabel_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "KeyboardPasteLabel_4",
    () => KeyboardPasteLabel_4,
    (value) => {
      KeyboardPasteLabel_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RoleSwitchValue",
    () => RoleSwitchValue,
    (value) => {
      RoleSwitchValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "KeyboardPasteSubscribers",
    () => KeyboardPasteSubscribers,
    (value) => {
      KeyboardPasteSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shouldKeepLocalKeyboardEvent",
    () => shouldKeepLocalKeyboardEvent,
  );
  bindRuntimeValue(runtime, "isCanvasEnterAction", () => isCanvasEnterAction);
  return () => {
    KeyboardPasteLabel =
      "The image wasn't pasted. Close the open menu or popup, then paste again.";
    KeyboardPasteLabel_2 =
      "The image wasn't pasted. Click the design, then paste again.";
    KeyboardPasteReplace = (input?: Dynamic): Dynamic =>
      input.replace("The image", "The video");
    KeyboardPasteJoinValue = [
      "button",
      "summary",
      '[role="button"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="switch"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="menuitemcheckbox"]',
      '[role="menuitemradio"]',
      '[role="option"]',
      '[role="combobox"]',
    ]
      .map((input?: Dynamic): Dynamic => input + ':not([aria-disabled="true"])')
      .join(", ");
    KeyboardPasteLabel_3 =
      '[role="menu"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="listbox"], [role="option"]';
    KeyboardPasteLabel_4 =
      '[role="tablist"], [role="radiogroup"], [aria-haspopup="menu"], [aria-haspopup="listbox"]';
    RoleSwitchValue = '[role="switch"]';
    KeyboardPasteSubscribers = new Set([
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "Enter",
      " ",
    ]);
  };
}
