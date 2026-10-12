/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasFrameEnvironment(
  runtime: RuntimeBindings,
): () => void {
  var frameCaptureAttribute: Dynamic;
  var forceRefreshEventName: Dynamic;
  var remoteFilesEventName: Dynamic;
  function isFrameCaptureDocument(targetDocument: Dynamic = document): Dynamic {
    return targetDocument.documentElement.hasAttribute(frameCaptureAttribute);
  }
  bindRuntimeValue(
    runtime,
    "frameCaptureAttribute",
    () => frameCaptureAttribute,
    (value) => {
      frameCaptureAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isFrameCaptureDocument",
    () => isFrameCaptureDocument,
  );
  bindRuntimeValue(
    runtime,
    "forceRefreshEventName",
    () => forceRefreshEventName,
    (value) => {
      forceRefreshEventName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "remoteFilesEventName",
    () => remoteFilesEventName,
    (value) => {
      remoteFilesEventName = value;
    },
  );
  return () => {
    frameCaptureAttribute = "data-frame-capture";
    forceRefreshEventName = "appifact:force-refresh";
    remoteFilesEventName = "appifact:remote-files";
  };
}
