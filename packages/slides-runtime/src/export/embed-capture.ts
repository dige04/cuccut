/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** One web embed to rasterize; `w`/`h` are its size in CSS pixels. */
export interface EmbedCaptureRequest {
  key: string;
  html: string;
  w: number;
  h: number;
}

/** A rasterized web embed: a PNG data URI plus its pixel size. */
export interface EmbedCaptureResult {
  dataUri: string;
  w: number;
  h: number;
}

/** Pixel size an embed is rendered at (CSS size scaled down to the capture limits). */
export interface EmbedCaptureSize {
  w: number;
  h: number;
}

/** Result of `host.render`: raw RGBA pixels of the embed frame. */
interface RenderedEmbedPixels {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}

/** The part of `createEmbedFrame`'s result this module uses. */
interface CapturedEmbedMount {
  iframe: HTMLIFrameElement;
  host: {
    ready: boolean;
    render: (
      version: number,
      props: Record<string, never>,
      width: number,
      height: number,
    ) => Promise<RenderedEmbedPixels | null>;
  };
  dispose: () => void;
}

/** Bookkeeping for one embed mounted in the off-screen capture container. */
interface EmbedCaptureItem {
  req: EmbedCaptureRequest;
  mounted: CapturedEmbedMount;
  wrapper: HTMLDivElement;
  failed: boolean;
}

/** Lease returned by `beginPlayerCapture`: `clear` is false while a video player still holds focus. */
interface PlayerCaptureLease {
  clear: boolean;
  done: () => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    embedCaptureScale: number;
    maxEmbedCaptureEdge: number;
    embedCaptureTimeoutMs: number;
    embedCaptureSettleMs: number;
    embedCaptureDeadlineMs: number;
    embedCaptureBatchSize: number;
    initializeEmbedCapture: () => void;
    embedCaptureDimensions: (width: number, height: number) => EmbedCaptureSize;
    captureHtmlEmbeds: (
      requests: EmbedCaptureRequest[],
    ) => Promise<Map<string, EmbedCaptureResult>>;
    captureEmbedFramesOffscreen: (
      requests: Map<string, EmbedCaptureResult>,
      captureLease: EmbedCaptureRequest[],
    ) => Promise<void>;
  }
}

export function installExportEmbedCapture(
  runtime: RuntimeBindings,
): () => void {
  var embedCaptureScale: RuntimeBindings["embedCaptureScale"];
  var maxEmbedCaptureEdge: RuntimeBindings["maxEmbedCaptureEdge"];
  var embedCaptureTimeoutMs: RuntimeBindings["embedCaptureTimeoutMs"];
  var embedCaptureSettleMs: RuntimeBindings["embedCaptureSettleMs"];
  var embedCaptureDeadlineMs: RuntimeBindings["embedCaptureDeadlineMs"];
  var embedCaptureBatchSize: RuntimeBindings["embedCaptureBatchSize"];
  var initializeEmbedCapture: RuntimeBindings["initializeEmbedCapture"];
  function embedCaptureDimensions(
    width: number,
    height: number,
  ): EmbedCaptureSize {
    let scale = Math.min(
      embedCaptureScale,
      maxEmbedCaptureEdge / Math.max(1, Math.max(width, height)),
    );
    return {
      w: Math.max(1, Math.round(width * scale)),
      h: Math.max(1, Math.round(height * scale)),
    };
  }
  async function captureHtmlEmbeds(
    requests: EmbedCaptureRequest[],
  ): Promise<Map<string, EmbedCaptureResult>> {
    let captures = new Map<string, EmbedCaptureResult>(),
      validRequests = requests.filter(
        (input) => input.html !== "" && input.w > 0 && input.h > 0,
      );
    if (validRequests.length === 0 || typeof document === "undefined") {
      return captures;
    }
    (0, runtime.installEmbedRuntimeGuard)(runtime.slideEmbedGuardConfig);
    if ((0, runtime.embedsDisabled)(runtime.slideEmbedGuardConfig)) {
      return captures;
    }
    let captureLease: PlayerCaptureLease = await (0, runtime.beginPlayerCapture)();
    try {
      if (captureLease.clear) {
        await captureEmbedFramesOffscreen(captures, validRequests);
      }
    } finally {
      captureLease.done();
    }
    return captures;
  }
  async function captureEmbedFramesOffscreen(
    requests: Map<string, EmbedCaptureResult>,
    captureLease: EmbedCaptureRequest[],
  ): Promise<void> {
    let value = document.createElement("div");
    value.style.cssText =
      "position:fixed;left:0;top:0;z-index:-1;opacity:0;pointer-events:none;";
    document.body.appendChild(value);
    let items: EmbedCaptureItem[] = [],
      value2: () => void = (0, runtime.subscribeEmbedsDisabled)(
        runtime.slideEmbedGuardConfig,
        (): void => {
          for (let value3 of items) {
            value3.failed = true;
            value3.mounted.dispose();
          }
        },
      ),
      callback = (input: EmbedCaptureRequest): EmbedCaptureItem => {
        let value3 = document.createElement("div");
        value3.style.cssText =
          "position:absolute;left:0;top:0;width:" +
          String(input.w) +
          "px;height:" +
          String(input.h) +
          "px;";
        value.appendChild(value3);
        let state: EmbedCaptureItem = {
          req: input,
          mounted: null!, // assigned right below, before anything reads it
          wrapper: value3,
          failed: false,
        };
        state.mounted = (0, runtime.createEmbedFrame)({
          html: input.html,
          allowScripts: runtime.allowEmbedScripts,
          markerAttr: runtime.htmlEmbedMarkerAttribute,
          title: "Export render (sandboxed web embed)",
          renderTimeoutMs: embedCaptureDeadlineMs,
          onNavigated: (): void => {
            state.failed = true;
            state.mounted.dispose();
          },
        });
        value3.appendChild(state.mounted.iframe);
        items.push(state);
        return state;
      },
      callback2 = async (input: EmbedCaptureItem): Promise<void> => {
        try {
          if (input.failed || !input.mounted.host.ready) {
            return;
          }
          let value3 = embedCaptureDimensions(input.req.w, input.req.h),
            value4 = await input.mounted.host.render(
              0,
              {},
              value3.w,
              value3.h,
            );
          if (value4 === null || input.failed) {
            return;
          }
          let value5 = document.createElement("canvas");
          value5.width = value4.width;
          value5.height = value4.height;
          let value6 = value5.getContext("2d");
          if (value6 === null) {
            return;
          }
          let value7 = value6.createImageData(
            value4.width,
            value4.height,
          );
          value7.data.set(value4.pixels);
          value6.putImageData(value7, 0, 0);
          requests.set(input.req.key, {
            dataUri: value5.toDataURL("image/png"),
            w: value4.width,
            h: value4.height,
          });
        } catch {}
      };
    try {
      for (
        let index = 0;
        index < captureLease.length;
        index += embedCaptureBatchSize
      ) {
        if ((0, runtime.embedsDisabled)(runtime.slideEmbedGuardConfig)) {
          break;
        }
        let value3 = captureLease
            .slice(index, index + embedCaptureBatchSize)
            .map(callback),
          value4 = Date.now() + embedCaptureTimeoutMs;
        await Promise.all(
          value3.map(async (input): Promise<void> => {
            while (
              !input.mounted.host.ready &&
              !input.failed &&
              Date.now() < value4
            )
              await new Promise<void>((input2) => setTimeout(input2, 50));
          }),
        );
        await new Promise<void>((input) =>
          setTimeout(input, embedCaptureSettleMs),
        );
        await Promise.all(value3.map(callback2));
        for (let value5 of value3) {
          value5.mounted.dispose();
          value5.wrapper.remove();
        }
      }
    } finally {
      value2();
      for (let value3 of items) value3.mounted.dispose();
      value.remove();
    }
  }
  bindRuntimeValue(
    runtime,
    "embedCaptureDimensions",
    () => embedCaptureDimensions,
  );
  bindRuntimeValue(runtime, "captureHtmlEmbeds", () => captureHtmlEmbeds);
  bindRuntimeValue(
    runtime,
    "captureEmbedFramesOffscreen",
    () => captureEmbedFramesOffscreen,
  );
  bindRuntimeValue(
    runtime,
    "embedCaptureScale",
    () => embedCaptureScale,
    (value) => {
      embedCaptureScale = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxEmbedCaptureEdge",
    () => maxEmbedCaptureEdge,
    (value) => {
      maxEmbedCaptureEdge = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "embedCaptureTimeoutMs",
    () => embedCaptureTimeoutMs,
    (value) => {
      embedCaptureTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "embedCaptureSettleMs",
    () => embedCaptureSettleMs,
    (value) => {
      embedCaptureSettleMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "embedCaptureDeadlineMs",
    () => embedCaptureDeadlineMs,
    (value) => {
      embedCaptureDeadlineMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "embedCaptureBatchSize",
    () => embedCaptureBatchSize,
    (value) => {
      embedCaptureBatchSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeEmbedCapture",
    () => initializeEmbedCapture,
    (value) => {
      initializeEmbedCapture = value;
    },
  );
  return () => {
    embedCaptureScale = 2;
    maxEmbedCaptureEdge = 4096;
    embedCaptureTimeoutMs = 3000;
    embedCaptureSettleMs = 250;
    embedCaptureDeadlineMs = 4000;
    embedCaptureBatchSize = 8;
    initializeEmbedCapture = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeEmbeds)();
      (0, runtime.initializeSlideRenderer)();
      (0, runtime.initializeVideoLinkPlayer)();
    });
  };
}
