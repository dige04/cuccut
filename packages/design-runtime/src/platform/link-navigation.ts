/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformLinkNavigation(
  runtime: RuntimeBindings,
): () => void {
  function openPreviewExternalLink(
    items?: Dynamic,
    options: Dynamic = runtime.externalLinkLimiter,
  ): Dynamic {
    if (
      typeof items != "string" ||
      items.length > 8192 ||
      navigator.userActivation?.isActive !== true
    )
      return;
    let value: Dynamic;
    try {
      value = new URL(items);
    } catch {
      return;
    }
    if (
      (value.protocol !== "http:" && value.protocol !== "https:") ||
      value.origin === (0, runtime.currentHttpOrigin)() ||
      !options.take()
    )
      return;
    let value2: Dynamic =
        (0, runtime.getEmbedContext)() !== null &&
        (window as Dynamic).parent !== window
          ? (window as Dynamic).parent.document
          : document,
      value3: Dynamic = value2.createElement("a");
    value3.href = value.href;
    value3.target = "_blank";
    value3.rel = "noopener noreferrer";
    value2.body.append(value3);
    value3.click();
    value3.remove();
  }
  bindRuntimeValue(
    runtime,
    "openPreviewExternalLink",
    () => openPreviewExternalLink,
  );
  return () => {};
}
