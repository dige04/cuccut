/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportCaptureScript(
  runtime: RuntimeBindings,
): () => void {
  var ExportCaptureScriptZoomDprUntilConfig: Dynamic;
  function getBrowserZoomMetrics(): Dynamic {
    if (typeof document === "undefined" || typeof window === "undefined")
      return {
        zoom: 0,
        dpr: 0,
      };
    let value: Dynamic = (window as Dynamic).devicePixelRatio || 1;
    if (
      ExportCaptureScriptZoomDprUntilConfig &&
      ExportCaptureScriptZoomDprUntilConfig.dpr === value &&
      Date.now() < ExportCaptureScriptZoomDprUntilConfig.until
    )
      return ExportCaptureScriptZoomDprUntilConfig;
    let value2: Dynamic = (0, runtime.adjustCaptureTextMetrics)(
      document,
      value,
    );
    ExportCaptureScriptZoomDprUntilConfig = {
      zoom: value2,
      dpr: value,
      until: value2 === value ? 1 / 0 : Date.now() + 5e3,
    };
    return ExportCaptureScriptZoomDprUntilConfig;
  }
  function buildCaptureScript(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = 0,
    extra: Dynamic = false,
    detail: Dynamic = false,
    argument: Dynamic = 0,
    argument2: Dynamic = "",
    argument3: Dynamic = false,
    argument4: Dynamic = false,
    argument5: Dynamic = false,
    argument6: Dynamic = "",
    argument7: Dynamic = "",
    argument8: Dynamic = "",
    argument9: Dynamic = false,
    argument10: Dynamic = false,
    argument11: Dynamic = null,
    argument12: Dynamic = null,
    argument13: Dynamic = getBrowserZoomMetrics(),
  ): Dynamic {
    let state: Dynamic = {
      __FMT__: JSON.stringify(input),
      __Q__: String(options),
      __MAX__: String(context),
      __SCALE__: String(value),
      __VP__: extra ? "1" : "0",
      __CROP__: detail ? "1" : "0",
      __CAP__: String(argument),
      __MATTE__: JSON.stringify(argument2),
      __SETTLE__: argument3 ? "1" : "0",
      __SEL__: argument4 ? "1" : "0",
      __FREEZE__: argument5 ? "1" : "0",
      __SELBG__: JSON.stringify(argument6),
      __SELROOT__: JSON.stringify(argument7),
      __OVERLAY__: JSON.stringify(argument8),
      __SELVIS__: argument9 ? "1" : "0",
      __TEXT__: argument10 ? "1" : "0",
      __FRAME__:
        argument11 &&
        typeof argument11.w == "number" &&
        typeof argument11.h == "number" &&
        Number.isFinite(argument11.w) &&
        Number.isFinite(argument11.h) &&
        argument11.w > 0 &&
        argument11.h > 0
          ? JSON.stringify({
              w: argument11.w,
              h: argument11.h,
              ...(argument11.full === true
                ? {
                    full: true,
                  }
                : {}),
            })
          : "null",
      __PAGES__:
        argument12 &&
        Number.isFinite(argument12.h) &&
        argument12.h > 0 &&
        Number.isInteger(argument12.max) &&
        argument12.max > 0
          ? JSON.stringify({
              h: argument12.h,
              max: argument12.max,
              m: Math.max(0, Number(argument12.margin) || 0),
              from: Math.max(0, Math.floor(Number(argument12.from) || 0)),
              n: Math.max(0, Math.floor(Number(argument12.count) || 0)),
              tops: (argument12.tops ?? []).filter(
                (input2?: Dynamic): Dynamic => Number.isFinite(input2),
              ),
            })
          : "null",
      __LAYOUT__: JSON.stringify(
        [argument13.zoom, argument13.dpr].every(
          (input2?: Dynamic): Dynamic =>
            typeof input2 == "number" &&
            Number.isFinite(input2) &&
            input2 > 0 &&
            input2 <= 8,
        ) &&
          (argument13.zoom === 1 || argument13.zoom === argument13.dpr)
          ? {
              zoom: argument13.zoom,
              dpr: argument13.dpr,
            }
          : {
              zoom: 0,
              dpr: 0,
            },
      ),
    };
    return runtime.imageCaptureRuntimeScript.replace(
      /__[A-Z]+__/g,
      (input2?: Dynamic): Dynamic => state[input2] ?? input2,
    );
  }
  bindRuntimeValue(
    runtime,
    "ExportCaptureScriptZoomDprUntilConfig",
    () => ExportCaptureScriptZoomDprUntilConfig,
    (value) => {
      ExportCaptureScriptZoomDprUntilConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getBrowserZoomMetrics",
    () => getBrowserZoomMetrics,
  );
  bindRuntimeValue(runtime, "buildCaptureScript", () => buildCaptureScript);
  return () => {
    ExportCaptureScriptZoomDprUntilConfig = null;
  };
}
