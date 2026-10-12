/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasFocus(runtime: RuntimeBindings): () => void {
  var CanvasFocusDelayMs: Dynamic;
  var CanvasFocusDelayMs_2: Dynamic;
  function focusCanvasDocument(): Dynamic {
    if (!(document as Dynamic).hasFocus()) {
      blurCanvasActiveElement(true);
      temporaryFocusSink();
      (window as Dynamic).focus();
      return;
    }
    blurCanvasActiveElement(false);
  }
  function temporaryFocusSink(): Dynamic {
    let value: Dynamic = (document as Dynamic).createElement("div");
    value.tabIndex = -1;
    value.style.cssText =
      "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;outline:none";
    let value2: Dynamic,
      callback: Dynamic = (): Dynamic => {
        clearTimeout(value2);
        (window as Dynamic).removeEventListener("focus", callback2);
        value.remove();
      },
      callback2: Dynamic = (): Dynamic => {
        clearTimeout(value2);
        value2 = setTimeout(callback, CanvasFocusDelayMs);
      };
    (window as Dynamic).addEventListener("focus", callback2);
    value2 = setTimeout(callback, CanvasFocusDelayMs_2);
    (document as Dynamic).body.appendChild(value);
    value.focus({
      preventScroll: true,
    });
  }
  function blurCanvasActiveElement(input?: Dynamic): Dynamic {
    let activeElement: Dynamic = (document as Dynamic).activeElement;
    activeElement instanceof HTMLElement &&
      activeElement !== (document as Dynamic).body &&
      (input || activeElement.tagName !== "IFRAME") &&
      activeElement.blur();
  }
  bindRuntimeValue(runtime, "focusCanvasDocument", () => focusCanvasDocument);
  bindRuntimeValue(
    runtime,
    "CanvasFocusDelayMs",
    () => CanvasFocusDelayMs,
    (value) => {
      CanvasFocusDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasFocusDelayMs_2",
    () => CanvasFocusDelayMs_2,
    (value) => {
      CanvasFocusDelayMs_2 = value;
    },
  );
  bindRuntimeValue(runtime, "temporaryFocusSink", () => temporaryFocusSink);
  bindRuntimeValue(
    runtime,
    "blurCanvasActiveElement",
    () => blurCanvasActiveElement,
  );
  return () => {
    CanvasFocusDelayMs = 100;
    CanvasFocusDelayMs_2 = 1e3;
  };
}
