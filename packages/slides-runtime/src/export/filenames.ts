/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

declare module "../bindings" {
  interface RuntimeBindings {
    /** Draws the capture fallback once; assigned during initialization. */
    initializeCaptureFallback: () => void;
    bytesToBase64: (bytes: Uint8Array) => string;
    exportFilename: (title: string, extension: string) => string;
    slideExportFilename: (
      title: string,
      slideNumber: number,
      extension: string,
    ) => string;
  }
}

export function installExportFilenames(runtime: RuntimeBindings): () => void {
  var initializeCaptureFallback: RuntimeBindings["initializeCaptureFallback"];
  function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 32768)
      binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    return btoa(binary);
  }
  function exportFilename(title: string, extension: string): string {
    return (
      (title
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || "presentation") +
      "." +
      extension
    );
  }
  function slideExportFilename(
    title: string,
    slideNumber: number,
    extension: string,
  ): string {
    let suffix = " - slide " + String(slideNumber),
      basename = [
        ...exportFilename(title, extension).slice(0, -(extension.length + 1)),
      ].slice(0, 120 - suffix.length),
      utf8Length = (input: string): number =>
        new TextEncoder().encode(input).length;
    while (
      basename.length > 1 &&
      utf8Length(basename.join("") + suffix + "." + extension) > 240
    )
      basename.pop();
    return basename.join("").trimEnd() + suffix + "." + extension;
  }
  bindRuntimeValue(
    runtime,
    "initializeCaptureFallback",
    () => initializeCaptureFallback,
    (value) => {
      initializeCaptureFallback = value;
    },
  );
  bindRuntimeValue(runtime, "bytesToBase64", () => bytesToBase64);
  bindRuntimeValue(runtime, "exportFilename", () => exportFilename);
  bindRuntimeValue(runtime, "slideExportFilename", () => slideExportFilename);
  return () => {
    initializeCaptureFallback = (): void => {};
  };
}
