/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";
import type { VideoController, VideoControllerState } from "./video-controller";

declare module "../bindings" {
  interface RuntimeBindings {
    ClipRegistryReact: ReactNamespace;
    /** Live video controllers by clip key (see `clipRegistryKey`). */
    clipControllers: Map<string, VideoController>;
    clipRegistrySubscribers: Set<() => void>;
    /** Wakes every registry subscriber after a controller or live-clip change. */
    notifyClipRegistry: () => void;
    /** Builds the registry key of the clip at `path` inside frame `frameId`. */
    clipRegistryKey: (frameId: string, path: string) => string;
    clipControllerByKey: (key: string) => VideoController | undefined;
    liveClipKeys: Set<string>;
    subscribeClipRegistry: (listener: () => void) => () => void;
    registerClipController: (
      key: string,
      controller: VideoController,
    ) => () => void;
    registerLiveClip: (key: string) => () => void;
    useClipIsLive: (key?: string) => boolean;
    useClipController: (key?: string) => VideoController | undefined;
    useClipPaused: (controller?: VideoController) => boolean | undefined;
    useClipPlaybackState: (
      controller?: VideoController,
    ) => VideoControllerState | undefined;
    initializeClipRegistry: () => void;
  }
}

export function installMediaClipRegistry(runtime: RuntimeBindings): () => void {
  var ClipRegistryReact: ReactNamespace;
  var clipControllers: RuntimeBindings["clipControllers"];
  var clipRegistrySubscribers: RuntimeBindings["clipRegistrySubscribers"];
  var notifyClipRegistry: RuntimeBindings["notifyClipRegistry"];
  var clipRegistryKey: RuntimeBindings["clipRegistryKey"];
  var clipControllerByKey: RuntimeBindings["clipControllerByKey"];
  var liveClipKeys: RuntimeBindings["liveClipKeys"];
  var subscribeClipRegistry: RuntimeBindings["subscribeClipRegistry"];
  var initializeClipRegistry: RuntimeBindings["initializeClipRegistry"];
  function registerClipController(
    key: string,
    controller: VideoController,
  ): () => void {
    clipControllers.set(key, controller);
    notifyClipRegistry();
    return (): void => {
      if (clipControllers.get(key) !== controller) {
        return;
      }
      clipControllers.delete(key);
      notifyClipRegistry();
    };
  }
  function registerLiveClip(key: string): () => void {
    liveClipKeys.add(key);
    notifyClipRegistry();
    return (): void => {
      if (liveClipKeys.delete(key)) {
        notifyClipRegistry();
      }
    };
  }
  function useClipIsLive(key?: string): boolean {
    return ClipRegistryReact.useSyncExternalStore(
      subscribeClipRegistry,
      (): boolean => key !== undefined && liveClipKeys.has(key),
      (): boolean => false,
    );
  }
  function useClipController(key?: string): VideoController | undefined {
    return ClipRegistryReact.useSyncExternalStore(
      subscribeClipRegistry,
      (): VideoController | undefined =>
        key === undefined ? undefined : clipControllers.get(key),
      (): VideoController | undefined => {
        return;
      },
    );
  }
  function useClipPaused(controller?: VideoController): boolean | undefined {
    let [value, value2] = ClipRegistryReact.useState<boolean | undefined>(
      undefined,
    );
    ClipRegistryReact.useLayoutEffect((): void | (() => void) => {
      if (controller === undefined) {
        return value2(undefined);
      }
      return controller.subscribe(
        (input: VideoControllerState): void => value2(input.paused),
      );
    }, [controller]);
    if (controller === undefined) {
      return undefined;
    } else {
      return value;
    }
  }
  function useClipPlaybackState(
    controller?: VideoController,
  ): VideoControllerState | undefined {
    let [value, value2] = ClipRegistryReact.useState<
      VideoControllerState | undefined
    >(undefined);
    ClipRegistryReact.useLayoutEffect((): void | (() => void) => {
      if (controller === undefined) {
        return value2(undefined);
      }
      return controller.subscribe(value2);
    }, [controller]);
    if (controller === undefined) {
      return undefined;
    } else {
      return value;
    }
  }
  bindRuntimeValue(
    runtime,
    "registerClipController",
    () => registerClipController,
  );
  bindRuntimeValue(runtime, "registerLiveClip", () => registerLiveClip);
  bindRuntimeValue(runtime, "useClipIsLive", () => useClipIsLive);
  bindRuntimeValue(runtime, "useClipController", () => useClipController);
  bindRuntimeValue(runtime, "useClipPaused", () => useClipPaused);
  bindRuntimeValue(runtime, "useClipPlaybackState", () => useClipPlaybackState);
  bindRuntimeValue(
    runtime,
    "ClipRegistryReact",
    () => ClipRegistryReact,
    (value) => {
      ClipRegistryReact = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clipControllers",
    () => clipControllers,
    (value) => {
      clipControllers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clipRegistrySubscribers",
    () => clipRegistrySubscribers,
    (value) => {
      clipRegistrySubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "notifyClipRegistry",
    () => notifyClipRegistry,
    (value) => {
      notifyClipRegistry = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clipRegistryKey",
    () => clipRegistryKey,
    (value) => {
      clipRegistryKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clipControllerByKey",
    () => clipControllerByKey,
    (value) => {
      clipControllerByKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "liveClipKeys",
    () => liveClipKeys,
    (value) => {
      liveClipKeys = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeClipRegistry",
    () => subscribeClipRegistry,
    (value) => {
      subscribeClipRegistry = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeClipRegistry",
    () => initializeClipRegistry,
    (value) => {
      initializeClipRegistry = value;
    },
  );
  return () => {
    notifyClipRegistry = (): void => {
      for (let value of [...clipRegistrySubscribers]) value();
    };
    clipRegistryKey = (input: string, options: string): string =>
      input + "/" + options;
    clipControllerByKey = (input: string): VideoController | undefined =>
      clipControllers.get(input);
    subscribeClipRegistry = (input: () => void): (() => void) => {
      clipRegistrySubscribers.add(input);
      return (): void => void clipRegistrySubscribers.delete(input);
    };
    initializeClipRegistry = (0, runtime.initializeOnce)((): void => {
      ClipRegistryReact = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      clipControllers = new Map();
      clipRegistrySubscribers = new Set();
      liveClipKeys = new Set();
    });
  };
}
