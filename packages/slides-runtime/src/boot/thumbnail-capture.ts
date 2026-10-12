/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Resolves once the thumbnail's resources (fonts, images, first paint) are settled. */
export type ThumbnailResourceWait = () => Promise<void>;

declare module "../bindings" {
  interface RuntimeBindings {
    /** Attribute the thumbnail service waits for on `<html>`. */
    THUMBNAIL_READY_ATTRIBUTE: string;
    /** Attribute marking the blank overlay shown while a thumbnail is captured. */
    BLANK_THUMBNAIL_ATTRIBUTE: string;
    prepareSlidesThumbnailCapture: (document2?: Document) => void;
    waitForThumbnailResources: (
      wait?: ThumbnailResourceWait,
      document2?: Document,
    ) => void;
    markThumbnailReady: (document2?: Document) => void;
    createBlankThumbnailOverlay: (document2: Document) => void;
    getThumbnailPageBackground: (document2: Document) => string;
    waitForThumbnailAssets: (document2?: Document) => Promise<void>;
    waitForSlidesRootContent: (document2: Document) => Promise<void>;
  }
}

export function installBootThumbnailCapture(
  runtime: RuntimeBindings,
): () => void {
  var THUMBNAIL_READY_ATTRIBUTE: string;
  var BLANK_THUMBNAIL_ATTRIBUTE: string;
  function prepareSlidesThumbnailCapture(document2: Document = document) {
    if ((0, runtime.detectCompiledPageStorageMode)(document2) !== "db") {
      return;
    }
    if (!(0, runtime.isFrameCaptureMode)(document2)) {
      return waitForThumbnailResources(
        () => waitForThumbnailAssets(document2),
        document2,
      );
    }
    createBlankThumbnailOverlay(document2);
    markThumbnailReady(document2);
  }
  function waitForThumbnailResources(
    wait: ThumbnailResourceWait = () => waitForThumbnailAssets(),
    document2: Document = document,
  ) {
    let ready = () => markThumbnailReady(document2);
    wait().then(ready, ready);
  }
  function markThumbnailReady(document2: Document = document) {
    document2.documentElement.setAttribute(THUMBNAIL_READY_ATTRIBUTE, "");
  }
  function createBlankThumbnailOverlay(document2: Document) {
    if (
      document2.querySelector("[" + BLANK_THUMBNAIL_ATTRIBUTE + "]") !== null
    ) {
      return;
    }
    for (let value of [document2.documentElement, document2.body])
      value.style.overflow = "hidden";
    let overlay = document2.createElement("div");
    overlay.setAttribute(BLANK_THUMBNAIL_ATTRIBUTE, "");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;background:" +
      getThumbnailPageBackground(document2);
    document2.body.appendChild(overlay);
  }
  function getThumbnailPageBackground(document2: Document) {
    let window2 = document2.defaultView;
    for (let value of [document2.body, document2.documentElement]) {
      let value2 =
        window2?.getComputedStyle(value).backgroundColor ?? "";
      if (
        value2 !== "" &&
        value2 !== "transparent" &&
        !/^rgba\(.*,\s*0\)$/.test(value2)
      ) {
        return value2;
      }
    }
    return "#fff";
  }
  async function waitForThumbnailAssets(
    document2: Document = document,
  ): Promise<void> {
    await waitForSlidesRootContent(document2);
    let window2 = document2.defaultView,
      nextFrame = () =>
        new Promise<void>(
          (input) =>
            window2?.requestAnimationFrame
              ? window2.requestAnimationFrame(() => input())
              : setTimeout(input, 16),
        );
    await nextFrame();
    await nextFrame();
    await document2.fonts?.ready;
    let images = Array.from(document2.images).filter(
      (input) =>
        !(input.loading === "lazy" && !input.complete) &&
        typeof input.decode === "function",
    );
    await Promise.all(
      images.map(
        (input) =>
          input.decode().catch(() => {
            return;
          }),
      ),
    );
    await nextFrame();
  }
  function waitForSlidesRootContent(document2: Document): Promise<void> {
    let root = document2.getElementById("root"),
      hasContent = () =>
        root !== null &&
        Array.from(root.children).some(
          (input) => !input.hasAttribute("data-placeholder"),
        );
    if (root === null || hasContent()) {
      return Promise.resolve();
    }
    let Observer = document2.defaultView?.MutationObserver;
    if (Observer === undefined) {
      return Promise.resolve();
    }
    return new Promise<void>((input) => {
      let value = new Observer(() => {
        if (!hasContent()) {
          return;
        }
        value.disconnect();
        input();
      });
      value.observe(root, {
        childList: true,
      });
    });
  }
  bindRuntimeValue(
    runtime,
    "THUMBNAIL_READY_ATTRIBUTE",
    () => THUMBNAIL_READY_ATTRIBUTE,
    (value) => {
      THUMBNAIL_READY_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BLANK_THUMBNAIL_ATTRIBUTE",
    () => BLANK_THUMBNAIL_ATTRIBUTE,
    (value) => {
      BLANK_THUMBNAIL_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "prepareSlidesThumbnailCapture",
    () => prepareSlidesThumbnailCapture,
  );
  bindRuntimeValue(
    runtime,
    "waitForThumbnailResources",
    () => waitForThumbnailResources,
  );
  bindRuntimeValue(runtime, "markThumbnailReady", () => markThumbnailReady);
  bindRuntimeValue(
    runtime,
    "createBlankThumbnailOverlay",
    () => createBlankThumbnailOverlay,
  );
  bindRuntimeValue(
    runtime,
    "getThumbnailPageBackground",
    () => getThumbnailPageBackground,
  );
  bindRuntimeValue(
    runtime,
    "waitForThumbnailAssets",
    () => waitForThumbnailAssets,
  );
  bindRuntimeValue(
    runtime,
    "waitForSlidesRootContent",
    () => waitForSlidesRootContent,
  );
  return () => {
    (0, runtime.initializeCompiledPage)();
    THUMBNAIL_READY_ATTRIBUTE = "data-thumb-ready";
    BLANK_THUMBNAIL_ATTRIBUTE = "data-thumb-blank";
  };
}
