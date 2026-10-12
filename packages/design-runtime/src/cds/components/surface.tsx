import type {
  DesignStyle,
  ForwardComponent,
  SurfaceProps,
} from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsComponentsSurface(
  runtime: RuntimeBindings,
): () => void {
  var reactComponentsSurface: typeof React;
  var jsxComponentsSurface: typeof import("react/jsx-runtime");
  var Surface: ForwardComponent<HTMLDivElement, SurfaceProps>;
  var initializeComponentsSurface: () => void;
  function surfaceFocusStyle(input?: string): DesignStyle {
    let value = (0, runtime.useResolvedColorMode)();
    return {
      ...(0, runtime.pageBackgroundStyle)(input),
      "--cds-focus-shadow": runtime.focusShadowTokens[value],
      "--cds-focus-shadow-danger": runtime.dangerFocusShadowTokens[value],
    };
  }
  bindRuntimeValue(runtime, "surfaceFocusStyle", () => surfaceFocusStyle);
  bindRuntimeValue(
    runtime,
    "reactComponentsSurface",
    () => reactComponentsSurface,
    (value) => {
      reactComponentsSurface = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsSurface",
    () => jsxComponentsSurface,
    (value) => {
      jsxComponentsSurface = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Surface",
    () => Surface,
    (value) => {
      Surface = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsSurface",
    () => initializeComponentsSurface,
    (value) => {
      initializeComponentsSurface = value;
    },
  );
  return () => {
    initializeComponentsSurface = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeThemeSurfaces)();
      reactComponentsSurface = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxComponentsSurface = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      Surface = (0, reactComponentsSurface.forwardRef)<
        HTMLDivElement,
        SurfaceProps
      >(
        (
          {
            elevation: elevation,
            className: className,
            style: style,
            children: children,
            ...props
          }: SurfaceProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => {
          let value = surfaceFocusStyle(
            runtime.surfaceBackgroundTokens[elevation],
          );
          return (
            <div
              ref={options}
              data-cds={"Surface"}
              data-surface={elevation}
              {...props}
              className={(0, runtime.cn)(
                (0, runtime.popupSurfaceClassName)(elevation),
                className,
              )}
              style={{
                ...value,
                ...style,
              }}
            >
              <runtime.PageBackgroundContext.Provider
                value={runtime.surfaceBackgroundTokens[elevation]}
              >
                {children}
              </runtime.PageBackgroundContext.Provider>
            </div>
          );
        },
      );
      Surface.displayName = "Surface";
    });
  };
}
