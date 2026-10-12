/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type * as React from "react";

export interface VideoPlaybackActionsProps {
  /** Clip registry key of the video. */
  at: string;
  /** Embedded player (such as YouTube) instead of an inline video. */
  player?: boolean;
}
/** Pointer or keyboard activation: keyboard clicks report `detail` 0. */
export interface ActivationEvent {
  detail: number;
  buttons?: number;
  nativeEvent: Event & { mozInputSource?: number };
}

declare module "../bindings" {
  interface RuntimeBindings {
    jsxHe0: JsxNamespace;
    videoPlaybackDisabledReason: (available: boolean, failed: boolean, ready: boolean) => string | undefined;
    VideoPlaybackActions: (props: VideoPlaybackActionsProps) => React.ReactElement;
    isKeyboardOrPrimaryActivation: (event: ActivationEvent) => boolean;
  }
}

export function installUiVideoPlaybackActions(
  runtime: RuntimeBindings,
): () => void {
  var jsxHe0: JsxNamespace;
  function videoPlaybackDisabledReason(
    available: boolean,
    failed: boolean,
    ready: boolean,
  ): string | undefined {
    if (failed) {
      return "This video couldn’t be loaded.";
    }
    if (!available) {
      return "This video isn’t playing here right now.";
    }
    if (ready) {
      return undefined;
    } else {
      return "The video hasn’t loaded yet.";
    }
  }
  function VideoPlaybackActions({ at: at, player = false }: VideoPlaybackActionsProps): React.ReactElement {
    let value = (0, runtime.useClipController)(at),
      value2 = (0, runtime.useClipPlaybackState)(value),
      value3 =
        (0, runtime.useClipIsLive)(at) || value2?.failed === true,
      value4 =
        player && value3
          ? "YouTube videos can’t play here. Use Open on YouTube."
          : videoPlaybackDisabledReason(
              value !== undefined && value2 !== undefined,
              value3,
              value2?.ready === true,
            ),
      value5 = value2?.paused !== false,
      value6 = player
        ? value5
          ? "Load the YouTube player"
          : "Close the YouTube player"
        : value5
          ? "Play video"
          : "Pause video";
    return jsxHe0.jsx(runtime.ToolbarStripButton, {
      "data-testid": "sl-strip-playpause",
      icon: value5
        ? runtime.playbackActionIcons.play
        : player
          ? "X"
          : runtime.playbackActionIcons.pause,
      "aria-label": value6,
      title: value4 ?? value6,
      disabled: value4 !== undefined,
      onClick: () => value?.toggle(),
    });
  }
  function isKeyboardOrPrimaryActivation(event: ActivationEvent): boolean {
    return (
      event.detail === 0 ||
      event.buttons === 1 ||
      event.nativeEvent.mozInputSource === 0
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxHe0",
    () => jsxHe0,
    (value) => {
      jsxHe0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "videoPlaybackDisabledReason",
    () => videoPlaybackDisabledReason,
  );
  bindRuntimeValue(runtime, "VideoPlaybackActions", () => VideoPlaybackActions);
  bindRuntimeValue(
    runtime,
    "isKeyboardOrPrimaryActivation",
    () => isKeyboardOrPrimaryActivation,
  );
  return () => {
    (0, runtime.initializeRenderingTheme)();
    (0, runtime.initializeModelEditing)();
    (0, runtime.initializeTypographyInference)();
    (0, runtime.initializeModelSelection)();
    (0, runtime.initializeUiInputs210)();
    (0, runtime.initializeUiPropertyLabels)();
    (0, runtime.initializeVideoAssets)();
    (0, runtime.initializeVideoLinks)();
    (0, runtime.initializeVideoController)();
    (0, runtime.initializeClipRegistry)();
    (0, runtime.initializeVideoController)();
    (0, runtime.initializeClipRegistry)();
    jsxHe0 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
  };
}
