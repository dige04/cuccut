/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type * as React from "react";

export interface TooltipWrapperProps {
  /** Tooltip content; also exposed as `data-tip` when it is a string. */
  tip: React.ReactNode;
  /** Keyboard shortcut shown next to the tip. */
  shortcut?: string | string[];
  side?: "top" | "right" | "bottom" | "left";
  align?: "left" | "center" | "right";
  /** Allow the tip to wrap onto several lines. */
  wrap?: boolean;
  delay?: number;
  className?: string;
  children?: React.ReactNode;
}

declare module "../bindings" {
  interface RuntimeBindings {
    TooltipWrapperJsx: JsxNamespace;
    TooltipWrapper: (props: TooltipWrapperProps) => React.ReactElement;
    initializeTooltipWrapper: () => void;
  }
}

export function installUiTooltipWrapper(runtime: RuntimeBindings): () => void {
  var TooltipWrapperJsx: JsxNamespace;
  var initializeTooltipWrapper: () => void;
  function TooltipWrapper({
    tip: tip,
    shortcut: shortcut,
    side = "top",
    align = "center",
    wrap = false,
    delay: delay,
    className: className,
    children: children,
  }: TooltipWrapperProps): React.ReactElement {
    return TooltipWrapperJsx.jsx(runtime.Tooltip, {
      content: tip,
      shortcut: shortcut,
      side: side,
      align: align === "right" ? "end" : align === "left" ? "start" : "center",
      multiline: wrap,
      delay: delay,
      hoverable: false,
      children: TooltipWrapperJsx.jsx("span", {
        "data-tip": typeof tip === "string" ? tip : undefined,
        className: (0, runtime.joinClassNames)(
          "relative inline-flex align-top",
          className,
        ),
        children: children,
      }),
    });
  }
  bindRuntimeValue(runtime, "TooltipWrapper", () => TooltipWrapper);
  bindRuntimeValue(
    runtime,
    "TooltipWrapperJsx",
    () => TooltipWrapperJsx,
    (value) => {
      TooltipWrapperJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeTooltipWrapper",
    () => initializeTooltipWrapper,
    (value) => {
      initializeTooltipWrapper = value;
    },
  );
  return () => {
    initializeTooltipWrapper = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeUiInputs210)();
      TooltipWrapperJsx = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
  };
}
