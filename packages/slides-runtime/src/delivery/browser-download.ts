/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

declare module "../bindings" {
  interface RuntimeBindings {
    /** Saves a blob through a temporary download link (no shell involved). */
    downloadBlobInBrowser: (blob: Blob, filename: string) => void;
  }
}

export function installDeliveryBrowserDownload(
  runtime: RuntimeBindings,
): () => void {
  function downloadBlobInBrowser(blob: Blob, filename: string) {
    let url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  bindRuntimeValue(
    runtime,
    "downloadBlobInBrowser",
    () => downloadBlobInBrowser,
  );
  return () => {};
}
