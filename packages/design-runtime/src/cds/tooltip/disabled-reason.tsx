import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsTooltipDisabledReason(
  runtime: RuntimeBindings,
): () => void {
  var reactTooltipDisabledReason: typeof React;
  var jsxTooltipDisabledReason: typeof import("react/jsx-runtime");
  var CdsDisabledReasonAttribute: string;
  var initializeTooltipDisabledReason: () => void;
  function disabledReasonWrapperProps(
    input: React.ReactNode,
    options?: string,
    context?: string,
  ): {
    tabIndex: number;
    "aria-describedby": string | undefined;
    className: string;
  } {
    let value = hasDisabledReason(input);
    return {
      tabIndex: value ? 0 : -1,
      "aria-describedby": value ? options : undefined,
      className: (0, runtime.cn)("inline-flex", context),
    };
  }
  function hasDisabledReason(input: React.ReactNode): boolean {
    return !!input;
  }
  function DisabledReasonDescription({
    id: id,
    reason: reason,
  }: {
    id?: string;
    reason?: React.ReactNode;
  }): React.ReactElement {
    let value = (0, reactTooltipDisabledReason.useRef)<HTMLSpanElement | null>(
      null,
    );
    (0, reactTooltipDisabledReason.useEffect)(() => {}, [reason]);
    return (
      <span
        ref={value}
        id={id}
        hidden={true}
        {...{
          [CdsDisabledReasonAttribute]: "",
        }}
      >
        {hasDisabledReason(reason) ? reason : null}
      </span>
    );
  }
  bindRuntimeValue(
    runtime,
    "disabledReasonWrapperProps",
    () => disabledReasonWrapperProps,
  );
  bindRuntimeValue(runtime, "hasDisabledReason", () => hasDisabledReason);
  bindRuntimeValue(
    runtime,
    "DisabledReasonDescription",
    () => DisabledReasonDescription,
  );
  bindRuntimeValue(
    runtime,
    "reactTooltipDisabledReason",
    () => reactTooltipDisabledReason,
    (value) => {
      reactTooltipDisabledReason = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxTooltipDisabledReason",
    () => jsxTooltipDisabledReason,
    (value) => {
      jsxTooltipDisabledReason = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsDisabledReasonAttribute",
    () => CdsDisabledReasonAttribute,
    (value) => {
      CdsDisabledReasonAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeTooltipDisabledReason",
    () => initializeTooltipDisabledReason,
    (value) => {
      initializeTooltipDisabledReason = value;
    },
  );
  return () => {
    initializeTooltipDisabledReason = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeClassNames)();
      reactTooltipDisabledReason = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxTooltipDisabledReason = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      CdsDisabledReasonAttribute = "data-cds-disabled-reason";
    });
  };
}
