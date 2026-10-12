import type * as React from "react";
import type * as Color from "../../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installUiColorGradientStops(
  runtime: RuntimeBindings,
): () => void {
  var jsxGradientStopKeyboardHandlers: typeof import("react/jsx-runtime");
  var gradientStopKeyboardHandlers: {
    onKeyDownCapture: React.KeyboardEventHandler<HTMLElement>;
  };
  var TooltipWrapperJsx: typeof import("react/jsx-runtime");
  function TooltipWrapper({
    tip: tip,
    shortcut: shortcut,
    side = "top",
    align = "center",
    wrap = false,
    delay: delay,
    className: className,
    children: children,
  }: Color.TooltipWrapperProps): React.ReactElement {
    return (
      <runtime.Tooltip
        content={tip}
        shortcut={shortcut}
        side={side}
        align={
          align === "right" ? "end" : align === "left" ? "start" : "center"
        }
        multiline={wrap}
        delay={delay}
        hoverable={false}
      >
        <span
          data-tip={typeof tip === "string" ? tip : undefined}
          className={(0, runtime.joinClassNames)(
            "relative inline-flex align-top",
            className,
          )}
        >
          {children}
        </span>
      </runtime.Tooltip>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxGradientStopKeyboardHandlers",
    () => jsxGradientStopKeyboardHandlers,
    (value) => {
      jsxGradientStopKeyboardHandlers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "gradientStopKeyboardHandlers",
    () => gradientStopKeyboardHandlers,
    (value) => {
      gradientStopKeyboardHandlers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipWrapperJsx",
    () => TooltipWrapperJsx,
    (value) => {
      TooltipWrapperJsx = value;
    },
  );
  bindRuntimeValue(runtime, "TooltipWrapper", () => TooltipWrapper);
  return () => {
    jsxGradientStopKeyboardHandlers = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    gradientStopKeyboardHandlers = {
      onKeyDownCapture: (event) => {
        let value =
          event.target instanceof HTMLElement
            ? event.target.closest<HTMLElement>('[role="radio"]')
            : null;
        if (!value) {
          return;
        }
        if (
          event.key === "ArrowRight" ||
          event.key === "ArrowLeft" ||
          event.key === "ArrowDown" ||
          event.key === "ArrowUp"
        ) {
          event.preventDefault();
          event.stopPropagation();
          let items = [
              ...(value
                .closest('[role="radiogroup"]')
                ?.querySelectorAll<HTMLElement>('[role="radio"]') ?? []),
            ],
            value2 =
              event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
          items[
            (items.indexOf(value) + value2 + items.length) % items.length
          ]?.focus();
        } else if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          value.click();
        }
      },
    };
    TooltipWrapperJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
  };
}
