import type { OverlayPresentation } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsSheetsPresentation(
  runtime: RuntimeBindings,
): () => void {
  var reactSheetsPresentation: typeof React;
  var OverlayPresentationContext: React.Context<OverlayPresentation>;
  var drilledSheetAttribute: string;
  var coveredSheetAttribute: string;
  var CdsSheetPeelingAttribute: string;
  var CdsSheetTreeClosingAttribute: string;
  var sheetScrollAttribute: string;
  var CdsSheetPressedAttribute: string;
  var CdsSheetControlHeldAttribute: string;
  var SheetsPresentationDelayMs: number;
  var initializeSheetsPresentation: () => void;
  function useMobileSheets(): boolean {
    return (0, runtime.useWindowMediaQuery)(
      (0, runtime.useCdsWindow)(),
      runtime.mobileSheetMediaQuery,
    );
  }
  function useOverlayPresentation(): OverlayPresentation {
    return (0, reactSheetsPresentation.useContext)(OverlayPresentationContext);
  }
  function useTouchOverlay(): boolean {
    "use no memo";

    let value = useOverlayPresentation(),
      value2 = (0, runtime.useCdsWindow)(),
      value3 = (0, reactSheetsPresentation.useSyncExternalStore)(
        runtime.HooksMediaQueryHandler,
        () =>
          value2 !== undefined &&
          ((0, runtime.getMediaQueryStore)(
            value2,
            "(pointer: coarse)",
          )?.getSnapshot() ??
            false),
        runtime.HooksMediaQueryHandler_2,
      );
    return value === "sheet" || value3;
  }
  function sheetNeedsScrolling(input: Element): boolean {
    if (sheetContainsTextInput(input)) return true;
    for (let value of Array.from(
      input.querySelectorAll<HTMLElement>(`[${sheetScrollAttribute}]`),
    ))
      if (value.scrollHeight > value.clientHeight + 1) return true;
    return false;
  }
  function sheetContainsTextInput(element: Element): boolean {
    return element.querySelector(runtime.textInputSelector) !== null;
  }
  function shouldUseSheet(
    input: OverlayPresentation,
    options: boolean,
    context: boolean,
  ): boolean {
    return options ? false : input !== "auto" ? input === "sheet" : context;
  }
  function useFrozenSheetMode(
    input: boolean,
    options: boolean,
    context: boolean,
  ): boolean {
    let [value, value2] = (0, reactSheetsPresentation.useState)(input),
      [value3, value4] = (0, reactSheetsPresentation.useState)(options);
    return options !== value3 && (value4(options), options)
      ? (value2(input), input)
      : context
        ? value
        : input;
  }
  function useSheetPendingUnmount(input: boolean): {
    showing: boolean;
    onOpenChangeComplete: (open: boolean) => void;
  } {
    let [value, value2] = (0, reactSheetsPresentation.useState)(input);
    input && !value && value2(true);
    let value3 = (0, reactSheetsPresentation.useCallback)(
      (input2: boolean): void => {
        input2 || value2(false);
      },
      [],
    );
    (0, reactSheetsPresentation.useEffect)(() => {
      if (input || !value) return;
      let value4 = setTimeout(() => {
        value2(false);
      }, SheetsPresentationDelayMs);
      return () => {
        clearTimeout(value4);
      };
    }, [input, value]);
    return {
      showing: input || value,
      onOpenChangeComplete: value3,
    };
  }
  function useOpenSnapshot<Value>(
    input: boolean,
    options: () => Value,
    context: Value,
  ): Value {
    let [value, value2] = (0, reactSheetsPresentation.useState)(() => ({
        wasOpen: input,
        value: input ? options() : context,
      })),
      value3 = (0, reactSheetsPresentation.useRef)(options);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      value3.current = options;
    });
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      if (!input) return;
      let value4 = value3.current();
      value2((input2) =>
        input2.wasOpen && Object.is(input2.value, value4)
          ? input2
          : {
              wasOpen: true,
              value: value4,
            },
      );
    }, [input]);
    if (input !== value.wasOpen) {
      let value4 = input ? options() : value.value;
      value2({
        wasOpen: input,
        value: value4,
      });
      return value4;
    }
    return value.value;
  }
  bindRuntimeValue(runtime, "useMobileSheets", () => useMobileSheets);
  bindRuntimeValue(
    runtime,
    "useOverlayPresentation",
    () => useOverlayPresentation,
  );
  bindRuntimeValue(runtime, "useTouchOverlay", () => useTouchOverlay);
  bindRuntimeValue(runtime, "sheetNeedsScrolling", () => sheetNeedsScrolling);
  bindRuntimeValue(
    runtime,
    "sheetContainsTextInput",
    () => sheetContainsTextInput,
  );
  bindRuntimeValue(runtime, "shouldUseSheet", () => shouldUseSheet);
  bindRuntimeValue(runtime, "useFrozenSheetMode", () => useFrozenSheetMode);
  bindRuntimeValue(
    runtime,
    "useSheetPendingUnmount",
    () => useSheetPendingUnmount,
  );
  bindRuntimeValue(runtime, "useOpenSnapshot", () => useOpenSnapshot);
  bindRuntimeValue(
    runtime,
    "reactSheetsPresentation",
    () => reactSheetsPresentation,
    (value) => {
      reactSheetsPresentation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OverlayPresentationContext",
    () => OverlayPresentationContext,
    (value) => {
      OverlayPresentationContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "drilledSheetAttribute",
    () => drilledSheetAttribute,
    (value) => {
      drilledSheetAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "coveredSheetAttribute",
    () => coveredSheetAttribute,
    (value) => {
      coveredSheetAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsSheetPeelingAttribute",
    () => CdsSheetPeelingAttribute,
    (value) => {
      CdsSheetPeelingAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsSheetTreeClosingAttribute",
    () => CdsSheetTreeClosingAttribute,
    (value) => {
      CdsSheetTreeClosingAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetScrollAttribute",
    () => sheetScrollAttribute,
    (value) => {
      sheetScrollAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsSheetPressedAttribute",
    () => CdsSheetPressedAttribute,
    (value) => {
      CdsSheetPressedAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsSheetControlHeldAttribute",
    () => CdsSheetControlHeldAttribute,
    (value) => {
      CdsSheetControlHeldAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsPresentationDelayMs",
    () => SheetsPresentationDelayMs,
    (value) => {
      SheetsPresentationDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsPresentation",
    () => initializeSheetsPresentation,
    (value) => {
      initializeSheetsPresentation = value;
    },
  );
  return () => {
    initializeSheetsPresentation = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeHooksMediaQuery)();
      (0, runtime.initializeHooksLayoutEffect)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeSheetsKeyboardViewport)();
      reactSheetsPresentation = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      OverlayPresentationContext = (0,
      reactSheetsPresentation.createContext)<OverlayPresentation>("auto");
      drilledSheetAttribute = "data-cds-sheet-drilled";
      coveredSheetAttribute = "data-cds-sheet-covered";
      CdsSheetPeelingAttribute = "data-cds-sheet-peeling";
      CdsSheetTreeClosingAttribute = "data-cds-sheet-tree-closing";
      sheetScrollAttribute = "data-cds-sheet-scroll";
      CdsSheetPressedAttribute = "data-cds-sheet-pressed";
      CdsSheetControlHeldAttribute = "data-cds-sheet-control-held";
      SheetsPresentationDelayMs = 1e3;
    });
  };
}
