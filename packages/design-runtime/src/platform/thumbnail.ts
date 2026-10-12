/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformThumbnail(runtime: RuntimeBindings): () => void {
  var THUMBNAIL_READY_ATTRIBUTE: Dynamic;
  var THUMBNAIL_BLANK_ATTRIBUTE: Dynamic;
  function watchThumbnailDocumentReady(
    doc?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    let document2: Dynamic = options.document ?? document,
      finished: Dynamic = false,
      unsubscribe: Dynamic,
      checkReady: Dynamic = (): Dynamic => {
        if (finished) return;
        let value: Dynamic = doc.loadState();
        value !== "loading" &&
          ((finished = true),
          unsubscribe?.(),
          value === "live"
            ? completeThumbnailAfterPromise(
                options.whenPainted ??
                  ((): Dynamic => waitForThumbnailPaint(document2)),
                document2,
              )
            : initializeDatabaseThumbnail(document2));
      };
    unsubscribe = doc.subscribeLoad(checkReady);
    checkReady();
    return (): Dynamic => {
      finished = true;
      unsubscribe?.();
    };
  }
  function initializeDatabaseThumbnail(input: Dynamic = document): Dynamic {
    if ((0, runtime.detectDocumentStorageMode)(input) === "db") {
      if (!(0, runtime.isFrameCaptureDocument)(input))
        return completeThumbnailAfterPromise(
          (): Dynamic => waitForThumbnailPaint(input),
          input,
        );
      blankThumbnailDocument(input);
      markThumbnailReady(input);
    }
  }
  function completeThumbnailAfterPromise(
    input: Dynamic = (): Dynamic => waitForThumbnailPaint(),
    options: Dynamic = document,
  ): Dynamic {
    let callback: Dynamic = (): Dynamic => markThumbnailReady(options);
    input().then(callback, callback);
  }
  function markThumbnailReady(doc: Dynamic = document): Dynamic {
    doc.documentElement.setAttribute(THUMBNAIL_READY_ATTRIBUTE, "");
  }
  function blankThumbnailDocument(document2?: Dynamic): Dynamic {
    if (document2.querySelector("[" + THUMBNAIL_BLANK_ATTRIBUTE + "]") !== null)
      return;
    for (let value2 of [document2.documentElement, document2.body] as Dynamic)
      value2.style.overflow = "hidden";
    let value: Dynamic = document2.createElement("div");
    value.setAttribute(THUMBNAIL_BLANK_ATTRIBUTE, "");
    value.setAttribute("aria-hidden", "true");
    value.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;background:" +
      hasOpaqueThumbnailBackground(document2);
    document2.body.appendChild(value);
  }
  function hasOpaqueThumbnailBackground(document2?: Dynamic): Dynamic {
    let window2: Dynamic = document2.defaultView;
    for (let value of [document2.body, document2.documentElement] as Dynamic) {
      let value2: Dynamic =
        window2?.getComputedStyle(value).backgroundColor ?? "";
      if (
        value2 !== "" &&
        value2 !== "transparent" &&
        !/^rgba\(.*,\s*0\)$/.test(value2)
      )
        return value2;
    }
    return "#fff";
  }
  async function waitForThumbnailPaint(
    document2: Dynamic = document,
  ): Promise<Dynamic> {
    await waitForRootContent(document2);
    let window2: Dynamic = document2.defaultView,
      nextFrame: Dynamic = (): Dynamic =>
        new Promise(
          (input?: Dynamic): Dynamic =>
            window2?.requestAnimationFrame
              ? window2.requestAnimationFrame((): Dynamic => input())
              : setTimeout(input, 16),
        );
    await nextFrame();
    await nextFrame();
    await document2.fonts?.ready;
    let value: Dynamic = Array.from(document2.images).filter(
      (input?: Dynamic): Dynamic =>
        !(input.loading === "lazy" && !input.complete) &&
        typeof input.decode == "function",
    );
    await Promise.all(
      value.map(
        (input?: Dynamic): Dynamic => input.decode().catch((): Dynamic => {}),
      ),
    );
    await nextFrame();
  }
  function waitForRootContent(document2?: Dynamic): Dynamic {
    let root: Dynamic = document2.getElementById("root"),
      hasContent: Dynamic = (): Dynamic =>
        root !== null &&
        Array.from(root.children).some(
          (input?: Dynamic): Dynamic => !input.hasAttribute("data-placeholder"),
        );
    if (root === null || hasContent()) return Promise.resolve();
    let value: Dynamic = document2.defaultView?.MutationObserver;
    return value === undefined
      ? Promise.resolve()
      : new Promise((input?: Dynamic): Dynamic => {
          let value2: Dynamic = new value((): Dynamic => {
            hasContent() && (value2.disconnect(), input());
          });
          value2.observe(root, {
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
    "THUMBNAIL_BLANK_ATTRIBUTE",
    () => THUMBNAIL_BLANK_ATTRIBUTE,
    (value) => {
      THUMBNAIL_BLANK_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "watchThumbnailDocumentReady",
    () => watchThumbnailDocumentReady,
  );
  bindRuntimeValue(
    runtime,
    "initializeDatabaseThumbnail",
    () => initializeDatabaseThumbnail,
  );
  bindRuntimeValue(
    runtime,
    "completeThumbnailAfterPromise",
    () => completeThumbnailAfterPromise,
  );
  bindRuntimeValue(runtime, "markThumbnailReady", () => markThumbnailReady);
  bindRuntimeValue(
    runtime,
    "blankThumbnailDocument",
    () => blankThumbnailDocument,
  );
  bindRuntimeValue(
    runtime,
    "hasOpaqueThumbnailBackground",
    () => hasOpaqueThumbnailBackground,
  );
  bindRuntimeValue(
    runtime,
    "waitForThumbnailPaint",
    () => waitForThumbnailPaint,
  );
  bindRuntimeValue(runtime, "waitForRootContent", () => waitForRootContent);
  return () => {
    THUMBNAIL_READY_ATTRIBUTE = "data-thumb-ready";
    THUMBNAIL_BLANK_ATTRIBUTE = "data-thumb-blank";
  };
}
