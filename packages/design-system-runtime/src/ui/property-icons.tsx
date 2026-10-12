import type * as React from "react";
import type * as Color from "../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiPropertyIcons(runtime: RuntimeBindings): () => void {
  var jsxForUiPropertyIcons: typeof import("react/jsx-runtime");
  function joinClassNames(...input: (string | false | null | undefined)[]) {
    return input.filter(Boolean).join(" ");
  }
  function KitIcon({
    name: name,
    size = 14,
    className: className,
    style: style,
  }: Color.KitIconProps): React.ReactElement {
    return (
      <runtime.Icon
        name={name}
        customSize={size}
        className={joinClassNames("shrink-0", className)}
        style={{
          display: "inline-flex",
          ...style,
        }}
      />
    );
  }
  bindRuntimeValue(runtime, "joinClassNames", () => joinClassNames);
  bindRuntimeValue(
    runtime,
    "jsxForUiPropertyIcons",
    () => jsxForUiPropertyIcons,
    (value) => {
      jsxForUiPropertyIcons = value;
    },
  );
  bindRuntimeValue(runtime, "KitIcon", () => KitIcon);
  return () => {
    jsxForUiPropertyIcons = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
  };
}
