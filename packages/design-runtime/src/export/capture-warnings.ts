/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportCaptureWarnings(
  runtime: RuntimeBindings,
): () => void {
  var ExportCaptureWarningsItems: Dynamic;
  var ExportCaptureWarningsItems_2: Dynamic;
  function dataUrlToBytes(dataUrl?: Dynamic): Dynamic {
    let separator: Dynamic = dataUrl.indexOf(",");
    if (separator < 0 || !dataUrl.slice(0, separator).endsWith(";base64"))
      return new Uint8Array(0);
    try {
      let value: Dynamic = atob(dataUrl.slice(separator + 1)),
        value2: Dynamic = new Uint8Array(value.length);
      for (let index: Dynamic = 0; index < value.length; index++)
        value2[index] = value.charCodeAt(index);
      return value2;
    } catch {
      return new Uint8Array(0);
    }
  }
  function countMatchingExportWarnings(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return matchingExportWarnings(input, options).length;
  }
  function matchingExportWarnings(input?: Dynamic, options?: Dynamic): Dynamic {
    return Array.isArray(input)
      ? input.filter(
          (input2?: Dynamic): Dynamic =>
            typeof input2 == "string" &&
            options.some(
              (input3?: Dynamic): Dynamic => input2.includes(input3),
            ),
        )
      : [];
  }
  function mergeExportWarnings(input?: Dynamic, options?: Dynamic): Dynamic {
    let items: Dynamic = [...input];
    for (let value of new Set(options) as Dynamic) {
      let value2: Dynamic =
        options.filter((input2?: Dynamic): Dynamic => input2 === value).length -
        input.filter((input2?: Dynamic): Dynamic => input2 === value).length;
      for (let index: Dynamic = 0; index < value2; index++) items.push(value);
    }
    return items;
  }
  function collectCaptureWarnings(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return mergeExportWarnings(
      input,
      matchingExportWarnings(
        options !== null && "w" in options ? options.w : undefined,
        context,
      ),
    );
  }
  function describeCaptureFailure(input?: Dynamic): Dynamic {
    let value: Dynamic = input instanceof Error ? input.message : "";
    return /^executeJavaScript timed out/.test(value)
      ? "it took too long to draw; try again once it has finished loading"
      : /^preview is blocked/.test(value)
        ? "its preview is stopped; reload it first"
        : /svg load failed|URI/.test(value)
          ? "something in its HTML can\u2019t be drawn as an image"
          : "its page hit an error while it was being drawn";
  }
  bindRuntimeValue(runtime, "dataUrlToBytes", () => dataUrlToBytes);
  bindRuntimeValue(
    runtime,
    "ExportCaptureWarningsItems",
    () => ExportCaptureWarningsItems,
    (value) => {
      ExportCaptureWarningsItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportCaptureWarningsItems_2",
    () => ExportCaptureWarningsItems_2,
    (value) => {
      ExportCaptureWarningsItems_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "countMatchingExportWarnings",
    () => countMatchingExportWarnings,
  );
  bindRuntimeValue(
    runtime,
    "matchingExportWarnings",
    () => matchingExportWarnings,
  );
  bindRuntimeValue(runtime, "mergeExportWarnings", () => mergeExportWarnings);
  bindRuntimeValue(
    runtime,
    "collectCaptureWarnings",
    () => collectCaptureWarnings,
  );
  bindRuntimeValue(
    runtime,
    "describeCaptureFailure",
    () => describeCaptureFailure,
  );
  return () => {
    ExportCaptureWarningsItems = ["image could not be embedded"];
    ExportCaptureWarningsItems_2 = [
      "a fallback face is used",
      "fonts may fall back",
    ];
  };
}
