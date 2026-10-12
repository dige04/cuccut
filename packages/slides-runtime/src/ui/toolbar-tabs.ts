/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement, ReactNode } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";

/** One tab of the toolbar tab strip. */
export interface ToolbarTabItem {
  value: string;
  title?: string;
  label: ReactNode;
}

export interface ToolbarTabsProps {
  tabs: readonly ToolbarTabItem[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the tab list. */
  label: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactfS: ReactNamespace;
    jsxT_: JsxNamespace;
    ToolbarTabs: (props: ToolbarTabsProps) => ReactElement;
  }
}

export function installUiToolbarTabs(runtime: RuntimeBindings): () => void {
  var reactfS: ReactNamespace;
  var jsxT_: JsxNamespace;
  function ToolbarTabs({
    tabs: tabs,
    value: value,
    onChange: onChange,
    label: label,
  }: ToolbarTabsProps): ReactElement {
    return jsxT_.jsx("div", {
      className: "mc-tabbar",
      children: jsxT_.jsx(runtime.Tabs.Root, {
        value: value,
        onValueChange: (input: string) => onChange(input),
        children: jsxT_.jsx(runtime.Tabs.List, {
          "aria-label": label,
          activateOnFocus: true,
          className:
            "mx-auto w-fit max-w-full min-w-0 overflow-x-auto [scrollbar-width:none]",
          children: tabs.map(
            (input) =>
              jsxT_.jsx(
                runtime.Tabs.Tab,
                {
                  value: input.value,
                  title: input.title,
                  children: input.label,
                },
                input.value,
              ),
          ),
        }),
      }),
    });
  }
  bindRuntimeValue(
    runtime,
    "reactfS",
    () => reactfS,
    (value) => {
      reactfS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxT_",
    () => jsxT_,
    (value) => {
      jsxT_ = value;
    },
  );
  bindRuntimeValue(runtime, "ToolbarTabs", () => ToolbarTabs);
  return () => {
    reactfS = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeUiInputs210)();
    jsxT_ = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
  };
}
