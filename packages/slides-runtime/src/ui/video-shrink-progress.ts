/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type * as React from "react";
import type { VideoShrinkJobSnapshot } from "../media/video-shrink-queue";

/** A queued video re-encode as the UI sees it (see the video shrink queue). */
export type VideoShrinkJob = VideoShrinkJobSnapshot;
export interface VideoProgressBarProps {
  /** Progress from 0 to 1. */
  value: number;
  label?: string;
  className?: string;
}
export interface VideoShrinkToastBridgeProps {
  hidden?: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactwF: ReactNamespace;
    jsxtq0: JsxNamespace;
    jsxCW: JsxNamespace;
    VideoProgressBar: (props: VideoProgressBarProps) => React.ReactElement;
    primaryVideoShrinkJob: (jobs: VideoShrinkJob[]) => VideoShrinkJob | undefined;
    VideoShrinkProgress: () => React.ReactElement | null;
    CancelVideoShrinkButton: () => React.ReactElement | null;
    VideoShrinkToastBridge: (props: VideoShrinkToastBridgeProps) => null;
  }
}

export function installUiVideoShrinkProgress(
  runtime: RuntimeBindings,
): () => void {
  var reactwF: ReactNamespace;
  var jsxtq0: JsxNamespace;
  var jsxCW: JsxNamespace;
  function VideoProgressBar({
    value: value,
    label: label,
    className: className,
  }: VideoProgressBarProps): React.ReactElement {
    let value2 = Math.round(
      Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0)) * 100,
    );
    return jsxtq0.jsx("div", {
      role: "progressbar",
      "aria-label": label,
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-valuenow": value2,
      className: (0, runtime.joinClassNames)(
        "h-1.5 w-full overflow-hidden rounded-full bg-alpha-2",
        className,
      ),
      children: jsxtq0.jsx("div", {
        className:
          "h-full rounded-full bg-fill-accent transition-[width] duration-150 motion-reduce:transition-none",
        style: {
          width: String(value2) + "%",
        },
      }),
    });
  }
  function primaryVideoShrinkJob(jobs: VideoShrinkJob[]): VideoShrinkJob | undefined {
    return (
      jobs.find(
        (input) =>
          input.state === "placing" && input.waitingFor !== null,
      ) ??
      jobs.find((input) => input.state === "encoding") ??
      jobs.find((input) => input.state === "placing") ??
      jobs[0]
    );
  }
  function VideoShrinkProgress(): React.ReactElement | null {
    let value: VideoShrinkJob[] = reactwF.useSyncExternalStore(
        runtime.subscribeVideoShrinkJobs,
        runtime.getVideoShrinkJobs,
      ),
      value2 = primaryVideoShrinkJob(value);
    if (value2 === undefined) {
      return null;
    }
    let length = value.filter(
        (input) =>
          input.state === "queued" && input !== value2,
      ).length,
      value3 =
        (value2.state === "placing" ? value2.waitingFor : null) !== null
          ? "Video ready. It’ll be added when you click out of the text box."
          : value2.state === "placing"
            ? "Adding the video…"
            : value2.attempt > 1
              ? "Still too big, trying a smaller size…"
              : "Shrinking video…";
    return jsxCW.jsxs("span", {
      className: "flex flex-col gap-1.5",
      children: [
        jsxCW.jsxs("span", {
          children: [
            value3,
            value2.state === "placing"
              ? null
              : jsxCW.jsx("span", {
                  "aria-hidden": "true",
                  className: "tabular-nums",
                  children:
                    " " + String(Math.round(value2.progress * 100)) + "%",
                }),
          ],
        }),
        value2.state === "placing"
          ? null
          : jsxCW.jsx(VideoProgressBar, {
              value: value2.progress,
              label: "Shrinking video",
            }),
        jsxCW.jsxs("span", {
          className: "text-xs font-normal text-secondary",
          children: [
            value2.state === "placing"
              ? ""
              : "Videos can be up to " +
                String(runtime.maxVideoUploadBytes / 1048576) +
                " MB. ",
            "Keep this tab open until it’s done.",
            length > 0
              ? " " +
                String(length) +
                (length === 1
                  ? " more video waiting."
                  : " more videos waiting.")
              : "",
          ],
        }),
      ],
    });
  }
  function CancelVideoShrinkButton(): React.ReactElement | null {
    let value = primaryVideoShrinkJob(
        reactwF.useSyncExternalStore(
          runtime.subscribeVideoShrinkJobs,
          runtime.getVideoShrinkJobs,
        ),
      ),
      ref = reactwF.useRef(false);
    if (value === undefined) {
      return null;
    }
    let callback = () => void (ref.current = false);
    return jsxCW.jsx(runtime.Button, {
      size: "sm",
      variant: "secondary",
      onPointerDown: () => {
        ref.current = value.waitingFor !== null;
        if (ref.current) {
          (0, runtime.cancelVideoShrink)(value.id);
        }
      },
      onPointerCancel: callback,
      onClick: () => {
        if (!ref.current) {
          (0, runtime.cancelVideoShrink)(value.id);
        }
        callback();
      },
      children: "Cancel",
    });
  }
  function VideoShrinkToastBridge({ hidden = false }: VideoShrinkToastBridgeProps): null {
    let value = reactwF.useSyncExternalStore(
      runtime.subscribeVideoShrinkJobs,
      () => (0, runtime.getVideoShrinkJobs)().length > 0,
    );
    reactwF.useEffect(() => {
      if (!value || hidden) {
        return;
      }
      (0, runtime.setPinnedToast)({
        title: jsxCW.jsx(VideoShrinkProgress, {}),
        action: jsxCW.jsx(CancelVideoShrinkButton, {}),
      });
      return () => (0, runtime.setPinnedToast)(null);
    }, [value, hidden]);
    return null;
  }
  bindRuntimeValue(
    runtime,
    "reactwF",
    () => reactwF,
    (value) => {
      reactwF = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxtq0",
    () => jsxtq0,
    (value) => {
      jsxtq0 = value;
    },
  );
  bindRuntimeValue(runtime, "VideoProgressBar", () => VideoProgressBar);
  bindRuntimeValue(
    runtime,
    "jsxCW",
    () => jsxCW,
    (value) => {
      jsxCW = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "primaryVideoShrinkJob",
    () => primaryVideoShrinkJob,
  );
  bindRuntimeValue(runtime, "VideoShrinkProgress", () => VideoShrinkProgress);
  bindRuntimeValue(
    runtime,
    "CancelVideoShrinkButton",
    () => CancelVideoShrinkButton,
  );
  bindRuntimeValue(
    runtime,
    "VideoShrinkToastBridge",
    () => VideoShrinkToastBridge,
  );
  return () => {
    (0, runtime.initializeUiInputs210)();
    (0, runtime.initializeVideoAssets)();
    reactwF = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxtq0 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    jsxCW = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
  };
}
