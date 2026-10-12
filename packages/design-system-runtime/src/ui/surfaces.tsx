/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as C from "../contracts/controls";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiSurfaces(runtime: RuntimeBindings): () => void {
  var reactForUiSurfaces: typeof React;
  var jsxrm: typeof import("react/jsx-runtime");
  var Surface: C.ForwardComponent<HTMLDivElement, C.SurfaceProps>;
  function useSurfaceStyle(input: C.SurfaceBackground): C.DesignStyle {
    let value: "light" | "dark" = (0, runtime.useResolvedColorMode)();
    return {
      ...(0, runtime.getSurfaceBackgroundStyle)(input),
      "--cds-focus-shadow": runtime.focusShadowByMode[value],
      "--cds-focus-shadow-danger": runtime.dangerFocusShadowByMode[value],
    };
  }
  bindRuntimeValue(
    runtime,
    "reactForUiSurfaces",
    () => reactForUiSurfaces,
    (value) => {
      reactForUiSurfaces = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxrm",
    () => jsxrm,
    (value) => {
      jsxrm = value;
    },
  );
  bindRuntimeValue(runtime, "useSurfaceStyle", () => useSurfaceStyle);
  bindRuntimeValue(
    runtime,
    "Surface",
    () => Surface,
    (value) => {
      Surface = value;
    },
  );
  return () => {
    (0, runtime.initializeCdsRoot)();
    (0, runtime.initializeSurfaces)();
    reactForUiSurfaces = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxrm = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    Surface = reactForUiSurfaces.forwardRef(
      (
        {
          elevation: elevation,
          className: className,
          style: style,
          children: children,
          ...props
        }: C.SurfaceProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ) => {
        let value = useSurfaceStyle(runtime.elevationSurfaceNames[elevation]);
        return (
          <div
            ref={options}
            data-cds={"Surface"}
            data-surface={elevation}
            {...props}
            className={(0, runtime.cn)(
              (0, runtime.getSurfaceClasses)(elevation),
              className,
            )}
            style={{
              ...value,
              ...style,
            }}
          >
            <runtime.surfaceBackgroundContext.Provider
              value={runtime.elevationSurfaceNames[elevation]}
            >
              {children}
            </runtime.surfaceBackgroundContext.Provider>
          </div>
        );
      },
    );
    Surface.displayName = "Surface";
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeTranslations)();
    (0, runtime.initializeCdsRoot)();
  };
}
