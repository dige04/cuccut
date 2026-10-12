/** Restored application module; prepare first, initialize in original order. */
import type { CSSProperties, ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";

/** One class-name fragment; falsy values are skipped when joining. */
export type ClassNameInput = string | false | null | undefined;

export interface KitIconProps {
  name: string;
  /** Icon box edge in px (default 14). */
  size?: number;
  className?: ClassNameInput;
  style?: CSSProperties;
}

declare module "../bindings" {
  interface RuntimeBindings {
    jsxq20: JsxNamespace;
    joinClassNames: (...input: ClassNameInput[]) => string;
    KitIcon: (props: KitIconProps) => ReactElement;
    ZoomInIcon: () => ReactElement;
    initializeUiPropertyIcons: () => void;
  }
}

export function installUiPropertyIcons(runtime: RuntimeBindings): () => void {
  var jsxq20: JsxNamespace;
  var initializeUiPropertyIcons: () => void;
  function joinClassNames(...input: ClassNameInput[]): string {
    return input.filter(Boolean).join(" ");
  }
  function KitIcon({
    name: name,
    size = 14,
    className: className,
    style: style,
  }: KitIconProps): ReactElement {
    return jsxq20.jsx(runtime.Icon, {
      name: name,
      customSize: size,
      className: joinClassNames("shrink-0", className),
      style: {
        display: "inline-flex",
        ...style,
      },
    });
  }
  function ZoomInIcon(): ReactElement {
    return jsxq20.jsx(runtime.Icon, {
      name: "ZoomIn",
      size: "auto",
      className: "shrink-0",
    });
  }
  bindRuntimeValue(runtime, "joinClassNames", () => joinClassNames);
  bindRuntimeValue(runtime, "KitIcon", () => KitIcon);
  bindRuntimeValue(runtime, "ZoomInIcon", () => ZoomInIcon);
  bindRuntimeValue(
    runtime,
    "jsxq20",
    () => jsxq20,
    (value) => {
      jsxq20 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiPropertyIcons",
    () => initializeUiPropertyIcons,
    (value) => {
      initializeUiPropertyIcons = value;
    },
  );
  return () => {
    initializeUiPropertyIcons = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeUiInputs210)();
      jsxq20 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
  };
}
