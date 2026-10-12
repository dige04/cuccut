/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportCaptureFlow(runtime: RuntimeBindings): () => void {
  function calculateFlowTail(
    doc?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (context !== doc.body) return 0;
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
        parseFloat(input) || 0,
      value: Dynamic = options(context),
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        /^(block|list-item)$/.test(input.display) &&
        callback(input.paddingTop) === 0 &&
        callback(input.borderTopWidth) === 0;
    if (!callback2(value) || options(doc.documentElement).display !== "block")
      return 0;
    let callback3: Dynamic = (input?: Dynamic): Dynamic =>
      input === undefined || input === "" || input === "none";
    if (
      value.position !== "static" ||
      value.float !== "none" ||
      !callback3(value.transform) ||
      !callback3(value.translate) ||
      !callback3(value.rotate) ||
      !callback3(value.scale)
    )
      return 0;
    let callback4: Dynamic = (input?: Dynamic): Dynamic => {
        for (
          let firstChild: Dynamic = input.firstChild;
          firstChild !== null;
          firstChild = firstChild.nextSibling
        ) {
          if (firstChild.nodeType === 3 && firstChild.data.trim() !== "")
            return null;
          if (firstChild.nodeType !== 1) continue;
          let value9: Dynamic = options(firstChild);
          if (
            !(
              value9.display === "none" ||
              value9.position === "absolute" ||
              value9.position === "fixed" ||
              value9.float !== "none"
            )
          )
            return /^(inline|contents|ruby)/.test(value9.display)
              ? null
              : firstChild;
        }
        return null;
      },
      value2: Dynamic = callback4(context);
    if (value2 === null) return 0;
    let bounds: Dynamic = context.getBoundingClientRect(),
      value3: Dynamic = context.offsetWidth || 0,
      value4: Dynamic =
        value3 > 0 && bounds.width > 0 ? bounds.width / value3 : 1;
    if (value2.getBoundingClientRect().top - bounds.top > 0.5) return 0;
    let documentElement: Dynamic = doc.documentElement,
      value5: Dynamic = options(documentElement),
      value6: Dynamic =
        (bounds.top -
          (documentElement.getBoundingClientRect().top +
            callback(value5.borderTopWidth) +
            callback(value5.paddingTop))) /
        value4,
      value7: Dynamic = callback(value.marginTop);
    if (
      doc.compatMode !== "BackCompat" &&
      (value7 <= 0 || value6 > value7 + 0.5)
    )
      return Math.max(0, value6);
    let index: Dynamic = 0,
      value8: Dynamic = value2;
    for (
      let index2: Dynamic = 0;
      value8 !== null &&
      index2 < 32 &&
      !(value8.getBoundingClientRect().top - bounds.top > 0.5);
      index2++
    ) {
      let value9: Dynamic = options(value8);
      if (callback(value9.marginTop) < 0) return 0;
      index = Math.max(index, callback(value9.marginTop));
      if (!callback2(value9) || value9.overflowY !== "visible") break;
      value8 = callback4(value8);
    }
    return doc.compatMode === "BackCompat"
      ? index
      : Math.min(index, Math.max(0, value6));
  }
  bindRuntimeValue(runtime, "calculateFlowTail", () => calculateFlowTail);
  return () => {};
}
