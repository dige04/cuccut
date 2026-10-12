import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorPreviewFit(runtime: RuntimeBindings): () => void {
  var reactPreviewFit: typeof import("react");
  var jsxPreviewFit: typeof import("react/jsx-runtime");
  var previewFitScale: (containerWidth: number, previewWidth: number) => number;
  function PreviewFitBox({
    width: width,
    height: height,
    "data-testid": dataTestid,
    children: children,
  }: Editor.PreviewFitBoxProps): React.ReactElement {
    let ref = reactPreviewFit.useRef<HTMLDivElement | null>(null),
      ref2 = reactPreviewFit.useRef<HTMLDivElement | null>(null),
      [value, value2] = reactPreviewFit.useState(height);
    reactPreviewFit.useLayoutEffect(() => {
      let current = ref.current,
        current2 = ref2.current;
      if (current === null || current2 === null) {
        return;
      }
      let callback = (): void => {
        current2.style.transform =
          "scale(" +
          String(
            previewFitScale(current.getBoundingClientRect().width, width),
          ) +
          ")";
        let offsetHeight = current2.offsetHeight;
        if (offsetHeight > 0) {
          value2(offsetHeight);
        }
      };
      callback();
      if (typeof ResizeObserver === "undefined") {
        return;
      }
      let observer = new ResizeObserver(callback);
      observer.observe(current);
      observer.observe(current2);
      return () => observer.disconnect();
    }, [width]);
    let value3: number = Math.max(height, value);
    return (
      <div
        ref={ref}
        className={"relative w-full overflow-hidden"}
        style={{
          maxWidth: width,
          aspectRatio: String(width) + " / " + String(value3),
          maxHeight: value3,
        }}
        data-testid={dataTestid + "-box"}
      >
        <div
          ref={ref2}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: width,
            minHeight: height,
            transformOrigin: "top left",
          }}
          data-testid={dataTestid + "-stage"}
        >
          {children}
        </div>
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactPreviewFit",
    () => reactPreviewFit,
    (value) => {
      reactPreviewFit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPreviewFit",
    () => jsxPreviewFit,
    (value) => {
      jsxPreviewFit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewFitScale",
    () => previewFitScale,
    (value) => {
      previewFitScale = value;
    },
  );
  bindRuntimeValue(runtime, "PreviewFitBox", () => PreviewFitBox);
  return () => {
    reactPreviewFit = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxPreviewFit = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    previewFitScale = (containerWidth: number, previewWidth: number) =>
      containerWidth <= 0 || containerWidth >= previewWidth - 2
        ? 1
        : containerWidth / previewWidth;
  };
}
