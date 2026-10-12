/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";

/** Props of the small play badge drawn over a video clip frame. */
export interface ClipBadgeProps {
  /** CSS scale factor the badge is counter-scaled by (a number or a CSS `var()` expression). */
  scale?: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ClipBadgeJsx: JsxNamespace;
    ClipBadge: (props: ClipBadgeProps) => ReactElement;
    initializeClipBadge: () => void;
  }
}

export function installMediaClipBadge(runtime: RuntimeBindings): () => void {
  var ClipBadgeJsx: JsxNamespace;
  var initializeClipBadge: RuntimeBindings["initializeClipBadge"];
  function ClipBadge({ scale = "1" }: ClipBadgeProps): ReactElement {
    let value = "calc(1 / " + scale + ")";
    return ClipBadgeJsx.jsx("span", {
      "data-clip-mark": "",
      "aria-hidden": "true",
      style: {
        position: "absolute",
        left: "calc(12px * " + value + ")",
        bottom: "calc(12px * " + value + ")",
        width: 32,
        height: 32,
        transform: "scale(" + value + ")",
        transformOrigin: "0 100%",
        borderRadius: "50%",
        background: "rgba(20,20,19,0.6)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      },
      children: ClipBadgeJsx.jsx(runtime.Icon, {
        name: runtime.playbackActionIcons.play,
        size: "sm",
      }),
    });
  }
  bindRuntimeValue(runtime, "ClipBadge", () => ClipBadge);
  bindRuntimeValue(
    runtime,
    "ClipBadgeJsx",
    () => ClipBadgeJsx,
    (value) => {
      ClipBadgeJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeClipBadge",
    () => initializeClipBadge,
    (value) => {
      initializeClipBadge = value;
    },
  );
  return () => {
    initializeClipBadge = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeUiInputs210)();
      (0, runtime.initializeVideoController)();
      ClipBadgeJsx = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
  };
}
