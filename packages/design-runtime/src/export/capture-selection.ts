/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportCaptureSelection(
  runtime: RuntimeBindings,
): () => void {
  function captureSelectionSvg(
    element?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let element2: Dynamic = element.querySelector(
      options || "[data-dc-editor-selected]",
    );
    if (!element2)
      return {
        e: "no-selection",
      };
    let value2: Dynamic =
        (element2.ownerSVGElement != null && element2.closest("svg")) ||
        element2,
      value3: Dynamic = value2.offsetWidth || 0,
      value4: Dynamic = value2.offsetHeight || 0;
    if (!value3 || !value4) {
      let bounds: Dynamic = value2.getBoundingClientRect(),
        count: Dynamic = 1;
      for (
        let parentElement: Dynamic = value2.parentElement;
        parentElement;
        parentElement = parentElement.parentElement
      )
        if (parentElement.offsetWidth > 0) {
          let bounds2: Dynamic = parentElement.getBoundingClientRect();
          if (bounds2.width > 0) {
            count = bounds2.width / parentElement.offsetWidth;
            break;
          }
        }
      value3 = Math.round(bounds.width / count) || value3;
      value4 = Math.round(bounds.height / count) || value4;
    }
    context &&
      value3 > 0 &&
      ((value3 = context.w),
      (value4 = Math.max(
        context.h,
        value4,
        (value && value2.scrollHeight) || 0,
      )));
    return !value3 || !value4
      ? {
          e: "zero-size",
        }
      : {
          root: value2,
          w: value3,
          h: value4,
        };
  }
  bindRuntimeValue(runtime, "captureSelectionSvg", () => captureSelectionSvg);
  return () => {};
}
