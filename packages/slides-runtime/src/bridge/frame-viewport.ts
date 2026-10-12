/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactDomNamespace,
  type ReactNamespace,
} from "../bindings";

/** Decides whether a window `message` origin belongs to the hosting frame. */
export type HostMessageOriginCheck = (origin: string) => boolean;
/** Untrusted `postMessage` payload; only objects tagged `__frame_viewport` are acted on. */
export type FrameViewportPayload =
  | { __frame_viewport?: unknown; bottomInset?: unknown }
  | string
  | number
  | boolean
  | null
  | undefined;
/** The parts of a `message` event the viewport parser reads. */
export type FrameViewportMessageEvent = Pick<
  MessageEvent<FrameViewportPayload>,
  "source" | "origin" | "data"
>;
/** Receives the smoothed bottom inset in pixels. */
export type BottomInsetChange = (inset: number) => void;
type TimerHandle = ReturnType<typeof setTimeout>;
/** Feeds raw bottom insets in; grows apply at once, shrinks are delayed. */
export type BottomInsetSmoother = (inset: number) => void;

declare module "../bindings" {
  interface RuntimeBindings {
    FrameViewportReactDom: ReactDomNamespace;
    ReactFrameViewport: ReactNamespace;
    MAX_FRAME_BOTTOM_INSET: number;
    FRAME_BOTTOM_INSET_SHRINK_DELAY_MS: number;
    frameBottomInset: number;
    frameBottomInsetSubscribers: Set<() => void>;
    updateFrameBottomInset: BottomInsetSmoother;
    parseFrameViewportMessage: (
      event: FrameViewportMessageEvent,
      parent: Window | null,
      originAllowed: HostMessageOriginCheck,
    ) => number | null;
    createBottomInsetSmoother: (
      onChange: BottomInsetChange,
      schedule?: (handler: () => void, delay: number) => TimerHandle,
      cancel?: (handle: TimerHandle) => void,
    ) => BottomInsetSmoother;
    subscribeFrameBottomInset: (listener: () => void) => () => boolean;
    useFrameBottomInset: () => number;
  }
}

export function installBridgeFrameViewport(
  runtime: RuntimeBindings,
): () => void {
  var FrameViewportReactDom: ReactDomNamespace;
  var ReactFrameViewport: ReactNamespace;
  var MAX_FRAME_BOTTOM_INSET: number;
  var FRAME_BOTTOM_INSET_SHRINK_DELAY_MS: number;
  var frameBottomInset: number;
  var frameBottomInsetSubscribers: Set<() => void>;
  var updateFrameBottomInset: BottomInsetSmoother;
  function parseFrameViewportMessage(
    event: FrameViewportMessageEvent,
    parent: Window | null,
    originAllowed: HostMessageOriginCheck,
  ): number | null {
    if (
      parent === null ||
      event.source !== parent ||
      !originAllowed(event.origin)
    ) {
      return null;
    }
    let data = event.data;
    if (
      typeof data !== "object" ||
      data === null ||
      data.__frame_viewport !== true
    ) {
      return null;
    }
    let bottomInset = data.bottomInset;
    if (typeof bottomInset === "number" && Number.isFinite(bottomInset)) {
      return Math.min(
        MAX_FRAME_BOTTOM_INSET,
        Math.max(0, Math.round(bottomInset)),
      );
    } else {
      return 0;
    }
  }
  function createBottomInsetSmoother(
    onChange: BottomInsetChange,
    schedule: (handler: () => void, delay: number) => TimerHandle = setTimeout,
    cancel: (handle: TimerHandle) => void = (input) => clearTimeout(input),
  ): BottomInsetSmoother {
    let current = 0,
      pending: TimerHandle | null = null;
    return (input) => {
      if (pending !== null) {
        cancel(pending);
      }
      pending = null;
      if (input > current) {
        onChange((current = input));
      } else if (input < current) {
        pending = schedule(() => {
          pending = null;
          return onChange((current = input));
        }, FRAME_BOTTOM_INSET_SHRINK_DELAY_MS);
      }
    };
  }
  function subscribeFrameBottomInset(listener: () => void) {
    frameBottomInsetSubscribers.add(listener);
    return () => frameBottomInsetSubscribers.delete(listener);
  }
  function useFrameBottomInset() {
    return ReactFrameViewport.useSyncExternalStore(
      subscribeFrameBottomInset,
      () => frameBottomInset,
      () => 0,
    );
  }
  bindRuntimeValue(
    runtime,
    "FrameViewportReactDom",
    () => FrameViewportReactDom,
    (value) => {
      FrameViewportReactDom = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ReactFrameViewport",
    () => ReactFrameViewport,
    (value) => {
      ReactFrameViewport = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FRAME_BOTTOM_INSET",
    () => MAX_FRAME_BOTTOM_INSET,
    (value) => {
      MAX_FRAME_BOTTOM_INSET = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseFrameViewportMessage",
    () => parseFrameViewportMessage,
  );
  bindRuntimeValue(
    runtime,
    "FRAME_BOTTOM_INSET_SHRINK_DELAY_MS",
    () => FRAME_BOTTOM_INSET_SHRINK_DELAY_MS,
    (value) => {
      FRAME_BOTTOM_INSET_SHRINK_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createBottomInsetSmoother",
    () => createBottomInsetSmoother,
  );
  bindRuntimeValue(
    runtime,
    "frameBottomInset",
    () => frameBottomInset,
    (value) => {
      frameBottomInset = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "frameBottomInsetSubscribers",
    () => frameBottomInsetSubscribers,
    (value) => {
      frameBottomInsetSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "updateFrameBottomInset",
    () => updateFrameBottomInset,
    (value) => {
      updateFrameBottomInset = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeFrameBottomInset",
    () => subscribeFrameBottomInset,
  );
  bindRuntimeValue(runtime, "useFrameBottomInset", () => useFrameBottomInset);
  return () => {
    (0, runtime.initializeRenderingTheme)();
    (0, runtime.initializeImageDownsampling)();
    FrameViewportReactDom = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomNamespace)(),
      1,
    );
    ReactFrameViewport = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    MAX_FRAME_BOTTOM_INSET = 9999;
    FRAME_BOTTOM_INSET_SHRINK_DELAY_MS = 400;
    frameBottomInset = 0;
    frameBottomInsetSubscribers = new Set();
    updateFrameBottomInset = createBottomInsetSmoother(
      (input) => {
        frameBottomInset = input;
        for (let value of frameBottomInsetSubscribers) value();
      },
    );
    if (
      typeof window !== "undefined" &&
      window.parent !== window
    ) {
      window.addEventListener(
        "message",
        (dataset) => {
          if (
            dataset.source !== window.parent ||
            !(0, runtime.isAllowedHostMessageOrigin)(dataset.origin)
          ) {
            return;
          }
          let value = parseFrameViewportMessage(
            dataset,
            window.parent,
            runtime.isAllowedHostMessageOrigin,
          );
          if (value !== null) {
            updateFrameBottomInset(value);
          }
        },
      );
    }
  };
}
