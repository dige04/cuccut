import type * as React from "react";
import type {
  AdaptiveSheetPopupHostProps,
  SheetRenderState,
  MobileSheetParts,
} from "../contracts/overlays";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiAdaptiveSheets(runtime: RuntimeBindings): () => void {
  var jsxtK: typeof import("react/jsx-runtime");
  function AdaptiveSheetPopupHost({
    kind: kind,
    children: children,
  }: AdaptiveSheetPopupHostProps): React.ReactElement {
    let value: MobileSheetParts | null = (0, runtime.useSheetImplementation)(),
      { pending: value2 } = (0, runtime.useSheetState)();
    if (value !== null) {
      return (
        <value.SheetPopupHost>
          {(input: SheetRenderState): React.ReactNode => children(input, value)}
        </value.SheetPopupHost>
      );
    }
    return (
      <jsxtK.Fragment>
        {[
          children(
            value2 ? runtime.concealedSheetHost : runtime.defaultSheetHost,
            null,
          ),
          value2 ? <runtime.PendingSheetBackdrop kind={kind} /> : null,
        ]}
      </jsxtK.Fragment>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxtK",
    () => jsxtK,
    (value) => {
      jsxtK = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AdaptiveSheetPopupHost",
    () => AdaptiveSheetPopupHost,
  );
  return () => {
    (0, runtime.initializeSheetStyles)();
    (0, runtime.initializePresentationMode)();
    (0, runtime.initializeAdaptiveSheets)();
    (0, runtime.initializeSheetClassNames)();
    (0, runtime.initializeAdaptiveSheets)();
    jsxtK = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    (0, runtime.initializeOverlayFocus)();
    (0, runtime.initializeOverlayStack)();
    (0, runtime.initializePopupPointerFocus)();
  };
}
