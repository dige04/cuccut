/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  JsxNamespace,
  ToolbarTabsProps,
  ToolbarTab,
} from "../contracts/composition";
export function installUiToolbarTabs(runtime: RuntimeBindings): () => void {
  var jsxT_: JsxNamespace;
  function ToolbarTabs({
    tabs: tabs,
    value: value,
    onChange: onChange,
    label: label,
  }: ToolbarTabsProps) {
    return (
      <div className={"mc-tabbar"}>
        <runtime.Tabs.Root
          value={value}
          onValueChange={(input: unknown) => onChange(input as string)}
        >
          <runtime.Tabs.List
            aria-label={label}
            activateOnFocus={true}
            className={
              "mx-auto w-fit max-w-full min-w-0 overflow-x-auto [scrollbar-width:none]"
            }
          >
            {tabs.map((input: ToolbarTab) =>
              (() => {
                const _Element = runtime.Tabs.Tab;
                const _elementProps = {
                  value: input.value,
                  title: input.title,
                  children: input.label,
                };
                const _elementKey = input.value;
                return <_Element key={_elementKey} {..._elementProps} />;
              })(),
            )}
          </runtime.Tabs.List>
        </runtime.Tabs.Root>
      </div>
    );
  }
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
    jsxT_ = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
  };
}
