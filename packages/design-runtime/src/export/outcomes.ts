/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportOutcomes(runtime: RuntimeBindings): () => void {
  var ExportOutcomesRenderFailureInternalValues: Dynamic;
  var ExportOutcomesOpenAbortedValues: Dynamic;
  var exportOperationNames: Dynamic;
  var downloadOutcomeNames: Dynamic;
  var ExportOutcomesTooLargeRateLimitedSet: Dynamic;
  var ExportOutcomesTooLargeNotLoadedEmptySet: Dynamic;
  function classifyImageSaveOutcome(input?: Dynamic): Dynamic {
    let image: Dynamic = exportOperationNames.image;
    if (input === null) return [image, "success"];
    let value: Dynamic = downloadOutcomeNames[input.outcome];
    return value !== "refused"
      ? [image, value]
      : ExportOutcomesTooLargeRateLimitedSet.has(input.code)
        ? [image, "aborted"]
        : [image, "failure", "capability_error"];
  }
  function classifyExportSaveOutcome(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = downloadOutcomeNames[options];
    return [
      exportOperationNames[input],
      value === "refused" ? "success" : value,
    ];
  }
  function classifyExportFailure(input?: Dynamic): Dynamic {
    return [
      exportOperationNames[input],
      "failure",
      input === "zip" || input === "html" ? "internal" : "render",
    ];
  }
  function classifyExportAbort(input?: Dynamic): Dynamic {
    return [exportOperationNames[input], "aborted"];
  }
  function classifyExportDeliveryOutcome(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = exportOperationNames[input];
    switch (options.outcome) {
      case "delivered":
        return [value, "success"];
      case "declined":
      case "withheld":
        return [value, "aborted"];
      case "failed":
        return context ? [value, "aborted"] : classifyExportFailure(input);
      case "unsupported":
        return ExportOutcomesTooLargeRateLimitedSet.has(options.code) ||
          options.code === "request_unknown"
          ? [value, "aborted"]
          : [value, "failure", "capability_error"];
    }
  }
  function classifyHtmlDelivery(input?: Dynamic, options?: Dynamic): Dynamic {
    return classifyExportDeliveryOutcome(
      "html",
      input,
      options !== undefined &&
        ExportOutcomesTooLargeNotLoadedEmptySet.has(options),
    );
  }
  function classifyPdfDelivery(input?: Dynamic, options?: Dynamic): Dynamic {
    return classifyExportDeliveryOutcome("pdf", input, options);
  }
  function classifyImageDelivery(input?: Dynamic, options?: Dynamic): Dynamic {
    return classifyExportDeliveryOutcome("image", input, options);
  }
  bindRuntimeValue(
    runtime,
    "ExportOutcomesRenderFailureInternalValues",
    () => ExportOutcomesRenderFailureInternalValues,
    (value) => {
      ExportOutcomesRenderFailureInternalValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportOutcomesOpenAbortedValues",
    () => ExportOutcomesOpenAbortedValues,
    (value) => {
      ExportOutcomesOpenAbortedValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportOperationNames",
    () => exportOperationNames,
    (value) => {
      exportOperationNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "downloadOutcomeNames",
    () => downloadOutcomeNames,
    (value) => {
      downloadOutcomeNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportOutcomesTooLargeRateLimitedSet",
    () => ExportOutcomesTooLargeRateLimitedSet,
    (value) => {
      ExportOutcomesTooLargeRateLimitedSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "classifyImageSaveOutcome",
    () => classifyImageSaveOutcome,
  );
  bindRuntimeValue(
    runtime,
    "classifyExportSaveOutcome",
    () => classifyExportSaveOutcome,
  );
  bindRuntimeValue(
    runtime,
    "classifyExportFailure",
    () => classifyExportFailure,
  );
  bindRuntimeValue(runtime, "classifyExportAbort", () => classifyExportAbort);
  bindRuntimeValue(
    runtime,
    "ExportOutcomesTooLargeNotLoadedEmptySet",
    () => ExportOutcomesTooLargeNotLoadedEmptySet,
    (value) => {
      ExportOutcomesTooLargeNotLoadedEmptySet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "classifyExportDeliveryOutcome",
    () => classifyExportDeliveryOutcome,
  );
  bindRuntimeValue(runtime, "classifyHtmlDelivery", () => classifyHtmlDelivery);
  bindRuntimeValue(runtime, "classifyPdfDelivery", () => classifyPdfDelivery);
  bindRuntimeValue(
    runtime,
    "classifyImageDelivery",
    () => classifyImageDelivery,
  );
  return () => {
    ExportOutcomesRenderFailureInternalValues = [
      "render",
      "failure",
      "internal",
    ];
    ExportOutcomesOpenAbortedValues = ["open", "aborted"];
    exportOperationNames = {
      image: "download",
      pdf: "export",
      zip: "download",
      html: "export",
    };
    downloadOutcomeNames = {
      saved: "success",
      declined: "aborted",
      withheld: "aborted",
      unsupported: "refused",
    };
    ExportOutcomesTooLargeRateLimitedSet = new Set([
      "too_large",
      "rate_limited",
    ]);
    ExportOutcomesTooLargeNotLoadedEmptySet = new Set([
      "too_large",
      "not_loaded",
      "empty",
      "timeout",
    ]);
  };
}
