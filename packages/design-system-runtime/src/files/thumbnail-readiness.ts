import type * as Boot from "../contracts/boot";
import type * as Model from "../contracts";
import type * as Storage from "../contracts/model-storage";
import type * as Dom from "../contracts/dom";
import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesThumbnailReadiness(
  runtime: RuntimeBindings,
): () => void {
  var THUMBNAIL_READY_ATTRIBUTE: string;
  var BLANK_THUMBNAIL_ATTRIBUTE: string;
  function stateEnvelopeTitle(envelope: Boot.RawEnvelope): string | undefined {
    let title = envelope.title;
    if (typeof title === "string" && title.length > 0) {
      return (0, runtime.truncateUtf16Safely)(title, 200);
    } else {
      return undefined;
    }
  }
  function isFrameCaptureMode(document2: Document = document): boolean {
    return document2.documentElement.hasAttribute("data-frame-capture");
  }
  function observeDocumentThumbnailReadiness(
    input: Boot.ThumbnailLoadDocument,
    options: Boot.ThumbnailOptions = {},
  ): () => void {
    let value = options.document ?? document,
      flag: boolean = false,
      value2: (() => void) | undefined,
      callback = (): void => {
        if (flag) {
          return;
        }
        let value3 = input.loadState();
        if (value3 === "loading") {
          return;
        }
        flag = true;
        value2?.();
        if (value3 === "live") {
          waitForThumbnailResources(
            options.whenPainted ?? (() => waitForThumbnailAssets(value)),
            value,
          );
        } else {
          prepareDesignSystemThumbnailCapture(value);
        }
      };
    value2 = input.subscribeLoad(callback);
    callback();
    return (): void => {
      flag = true;
      value2?.();
    };
  }
  function prepareDesignSystemThumbnailCapture(
    document2: Document = document,
  ): void {
    if ((0, runtime.detectCompiledPageStorageMode)(document2) !== "db") {
      return;
    }
    if (!isFrameCaptureMode(document2)) {
      return waitForThumbnailResources(
        () => waitForThumbnailAssets(document2),
        document2,
      );
    }
    createBlankThumbnailOverlay(document2);
    markThumbnailReady(document2);
  }
  function waitForThumbnailResources(
    ready: () => PromiseLike<unknown> = () => waitForThumbnailAssets(),
    document2: Document = document,
  ): void {
    let callback = () => markThumbnailReady(document2);
    ready().then(callback, callback);
  }
  function markThumbnailReady(document2: Document = document): void {
    document2.documentElement.setAttribute(THUMBNAIL_READY_ATTRIBUTE, "");
  }
  function createBlankThumbnailOverlay(document2: Document): void {
    if (
      document2.querySelector("[" + BLANK_THUMBNAIL_ATTRIBUTE + "]") !== null
    ) {
      return;
    }
    for (let value of [document2.documentElement, document2.body]) {
      value.style.overflow = "hidden";
    }
    let overlay = document2.createElement("div");
    overlay.setAttribute(BLANK_THUMBNAIL_ATTRIBUTE, "");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;background:" +
      getThumbnailPageBackground(document2);
    document2.body.appendChild(overlay);
  }
  function getThumbnailPageBackground(document2: Document): string {
    let window2 = document2.defaultView;
    for (let value of [document2.body, document2.documentElement]) {
      let value2 = window2?.getComputedStyle(value).backgroundColor ?? "";
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
    nextFrame: Document = document,
  ): Promise<void> {
    await waitForDesignSystemRootContent(nextFrame);
    let window2 = nextFrame.defaultView,
      images = () =>
        new Promise<void>((input) =>
          window2?.requestAnimationFrame
            ? window2.requestAnimationFrame(() => input())
            : setTimeout(input, 16),
        );
    await images();
    await images();
    await nextFrame.fonts?.ready;
    let value = Array.from(nextFrame.images).filter(
      (input) =>
        !(input.loading === "lazy" && !input.complete) &&
        typeof input.decode === "function",
    );
    await Promise.all(
      value.map((input) =>
        input.decode().catch((): void => {
          return;
        }),
      ),
    );
    await images();
  }
  function waitForDesignSystemRootContent(document2: Document): Promise<void> {
    let root = document2.getElementById("root"),
      hasContent = () =>
        root !== null &&
        Array.from(root.children).some(
          (input): boolean => !input.hasAttribute("data-placeholder"),
        );
    if (root === null || hasContent()) {
      return Promise.resolve();
    }
    let Observer = (document2.defaultView as Dom.BrowserWindow | null)
      ?.MutationObserver;
    if (Observer === undefined) {
      return Promise.resolve();
    }
    return new Promise<void>((input): void => {
      let value = new Observer((): void => {
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
  bindRuntimeValue(runtime, "stateEnvelopeTitle", () => stateEnvelopeTitle);
  bindRuntimeValue(runtime, "isFrameCaptureMode", () => isFrameCaptureMode);
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
    "observeDocumentThumbnailReadiness",
    () => observeDocumentThumbnailReadiness,
  );
  bindRuntimeValue(
    runtime,
    "prepareDesignSystemThumbnailCapture",
    () => prepareDesignSystemThumbnailCapture,
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
    "waitForDesignSystemRootContent",
    () => waitForDesignSystemRootContent,
  );
  return () => {
    THUMBNAIL_READY_ATTRIBUTE = "data-thumb-ready";
    BLANK_THUMBNAIL_ATTRIBUTE = "data-thumb-blank";
  };
}
