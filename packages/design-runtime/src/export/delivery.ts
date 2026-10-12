/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportDelivery(runtime: RuntimeBindings): () => void {
  var exportDeliveryEventName: Dynamic;
  var ExportDeliveryCapMsFinishAnimationsEagerImagesConfig: Dynamic;
  var ExportDeliveryCapMsFinishAnimationsConfig: Dynamic;
  function triggerBrowserDownload(input?: Dynamic, options?: Dynamic): Dynamic {
    try {
      let value: Dynamic = (document as Dynamic).createElement("a");
      value.href = input;
      value.download = options;
      value.rel = "noopener";
      value.style.display = "none";
      (document as Dynamic).body.appendChild(value);
      value.click();
      value.remove();
    } catch {}
  }
  bindRuntimeValue(
    runtime,
    "exportDeliveryEventName",
    () => exportDeliveryEventName,
    (value) => {
      exportDeliveryEventName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "triggerBrowserDownload",
    () => triggerBrowserDownload,
  );
  bindRuntimeValue(
    runtime,
    "ExportDeliveryCapMsFinishAnimationsEagerImagesConfig",
    () => ExportDeliveryCapMsFinishAnimationsEagerImagesConfig,
    (value) => {
      ExportDeliveryCapMsFinishAnimationsEagerImagesConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportDeliveryCapMsFinishAnimationsConfig",
    () => ExportDeliveryCapMsFinishAnimationsConfig,
    (value) => {
      ExportDeliveryCapMsFinishAnimationsConfig = value;
    },
  );
  return () => {
    exportDeliveryEventName = "appifact:export-delivery";
    ExportDeliveryCapMsFinishAnimationsEagerImagesConfig = {
      capMs: 1500,
      finishAnimations: true,
      eagerImages: true,
    };
    ExportDeliveryCapMsFinishAnimationsConfig = {
      capMs: 1500,
      finishAnimations: true,
    };
  };
}
