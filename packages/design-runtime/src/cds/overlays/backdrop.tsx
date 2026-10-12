import type { OverlayKind } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsOverlaysBackdrop(
  runtime: RuntimeBindings,
): () => void {
  var reactOverlaysBackdrop: typeof React;
  var jsxOverlaysBackdrop: typeof import("react/jsx-runtime");
  var reactDomOverlaysBackdrop: typeof import("react-dom");
  var CdsSheetPendingAttribute: string;
  var OverlaysBackdropVisibilityOpacityConfig: React.CSSProperties;
  var OverlaysBackdropPreventDefault: (
    event: Pick<React.SyntheticEvent, "preventDefault">,
  ) => void;
  var initializeOverlaysBackdrop: typeof import("react-dom");
  function useRestoreFocusOnClose(
    input: boolean,
  ): React.RefCallback<HTMLElement> {
    let value = (0, reactOverlaysBackdrop.useRef)<HTMLElement | null>(null),
      value2 = (0, reactOverlaysBackdrop.useRef)(input);
    (0, reactOverlaysBackdrop.useEffect)(() => {
      value2.current &&
        !input &&
        value.current?.focus({
          preventScroll: true,
        });
      value2.current = input;
    }, [input]);
    return (0, reactOverlaysBackdrop.useCallback)(
      (input2: HTMLElement | null) => {
        value.current = input2;
      },
      [],
    );
  }
  function OverlayBackdrop({
    kind: kind,
  }: {
    kind: OverlayKind;
  }): React.ReactPortal | null {
    let value = (0, reactOverlaysBackdrop.useContext)(
        runtime.SheetPopupContext,
      ),
      value2 = (0, runtime.useOverlayRoot)(),
      value3 = (0, runtime.useDefaultLayer)(kind);
    (0, runtime.useAndroidCloseWatcher)(value?.open ?? false, value?.dismiss);
    let [value4, value5] = (0, reactOverlaysBackdrop.useState)(false),
      value6 = (0, reactOverlaysBackdrop.useRef)(false),
      value7 = (0, runtime.useCdsWindow)();
    (0, reactOverlaysBackdrop.useEffect)(() => {
      if (value7 === undefined) return;
      let value9 = value7.requestAnimationFrame(() => {
        value5(true);
      });
      return () => {
        value7.cancelAnimationFrame(value9);
      };
    }, [value7]);
    let value8 =
      value2 ?? (typeof document === "undefined" ? null : document.body);
    return value8 === null || value === null || !value.open
      ? null
      : (0, reactDomOverlaysBackdrop.createPortal)(
          <runtime.PopupSurface {...value3.portalProps}>
            <div
              role={"presentation"}
              {...{
                [CdsSheetPendingAttribute]: "",
              }}
              className={(0, runtime.npm_clsx_Ea)(
                runtime.PlatformReducedMotionCss_4,
                !value4 && "opacity-0",
              )}
              style={value3.style}
              onPointerDown={(input: React.PointerEvent<HTMLElement>) => {
                value6.current = true;
                OverlaysBackdropPreventDefault(input);
              }}
              onPointerCancel={() => {
                value6.current = false;
              }}
              onMouseDown={OverlaysBackdropPreventDefault}
              onClick={() => {
                value6.current && ((value6.current = false), value.dismiss());
              }}
            />
          </runtime.PopupSurface>,
          value8,
        );
  }
  bindRuntimeValue(
    runtime,
    "useRestoreFocusOnClose",
    () => useRestoreFocusOnClose,
  );
  bindRuntimeValue(runtime, "OverlayBackdrop", () => OverlayBackdrop);
  bindRuntimeValue(
    runtime,
    "reactOverlaysBackdrop",
    () => reactOverlaysBackdrop,
    (value) => {
      reactOverlaysBackdrop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxOverlaysBackdrop",
    () => jsxOverlaysBackdrop,
    (value) => {
      jsxOverlaysBackdrop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDomOverlaysBackdrop",
    () => reactDomOverlaysBackdrop,
    (value) => {
      reactDomOverlaysBackdrop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsSheetPendingAttribute",
    () => CdsSheetPendingAttribute,
    (value) => {
      CdsSheetPendingAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OverlaysBackdropVisibilityOpacityConfig",
    () => OverlaysBackdropVisibilityOpacityConfig,
    (value) => {
      OverlaysBackdropVisibilityOpacityConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OverlaysBackdropPreventDefault",
    () => OverlaysBackdropPreventDefault,
    (value) => {
      OverlaysBackdropPreventDefault = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeOverlaysBackdrop",
    () => initializeOverlaysBackdrop,
    (value) => {
      initializeOverlaysBackdrop = value;
    },
  );
  return () => {
    initializeOverlaysBackdrop = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeOverlaysLayers)();
      (0, runtime.initializeOverlaysAndroidCloseWatcher)();
      (0, runtime.initializePlatformRootFontSize_2)();
      (0, runtime.initializeSheetsPopupStack)();
      (0, runtime.initializePlatformReducedMotion_2)();
      reactOverlaysBackdrop = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      (0, runtime.initializeNpm_clsx_xh)();
      jsxOverlaysBackdrop = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      reactDomOverlaysBackdrop = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_dom)(),
      );
      CdsSheetPendingAttribute = "data-cds-sheet-pending";
      OverlaysBackdropVisibilityOpacityConfig = {
        visibility: "hidden",
        opacity: 0,
      };
      OverlaysBackdropPreventDefault = (
        event: Pick<React.SyntheticEvent, "preventDefault">,
      ): void => {
        event.preventDefault();
      };
    });
  };
}
