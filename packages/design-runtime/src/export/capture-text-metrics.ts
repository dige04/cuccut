/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportCaptureTextMetrics(
  runtime: RuntimeBindings,
): () => void {
  function adjustCaptureTextMetrics(doc?: Dynamic, options?: Dynamic): Dynamic {
    let documentElement: Dynamic = doc.documentElement;
    if (
      !documentElement ||
      documentElement.namespaceURI !== "http://www.w3.org/1999/xhtml"
    )
      return 0;
    let callback: Dynamic = (input?: Dynamic): Dynamic => {
      let callback2: Dynamic = (
          input2?: Dynamic,
          options2?: Dynamic,
        ): Dynamic =>
          Math.abs(Math.floor((input2 + 0.25) * options2) / options2 - input2) >
            0.2 &&
          Math.abs(Math.round((input2 + 0.25) * options2) / options2 - input2) >
            0.2,
        items: Dynamic = [];
      for (let count: Dynamic = 64; count < 1024 && items.length < 4; count++)
        (input === 1 || callback2(count, 1 / input)) &&
          callback2(count, 60 / (64 * input)) &&
          items.push(count);
      if (items.length < 4) return false;
      let value: Dynamic = doc.createElement("x-layout-probe");
      documentElement.appendChild(value);
      let callback3: Dynamic = (input2?: Dynamic): Dynamic => (
          (value.style.cssText =
            "all:initial;display:block;position:absolute;visibility:hidden;left:0;top:0;height:0;width:" +
            String(input2 / (64 * input)) +
            "px"),
          value.getBoundingClientRect().width * input * 64
        ),
        flag: Dynamic = true;
      for (let index: Dynamic = 0; index < items.length; index++)
        Math.abs(callback3(items[index] + 0.25) - items[index]) >= 0.05 &&
          (flag = false);
      let value2: Dynamic = callback3(items[0] + 0.625);
      Math.abs(value2 - Math.round(value2)) >= 0.05 && (flag = false);
      value.remove();
      return flag;
    };
    return isFinite(options) &&
      options > 0 &&
      options !== 1 &&
      callback(options)
      ? options
      : callback(1)
        ? 1
        : 0;
  }
  bindRuntimeValue(
    runtime,
    "adjustCaptureTextMetrics",
    () => adjustCaptureTextMetrics,
  );
  return () => {};
}
