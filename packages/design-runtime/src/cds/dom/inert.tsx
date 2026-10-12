import type { MutableCell, SheetFrame } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsDomInert(runtime: RuntimeBindings): () => void {
  var reactDomInert: typeof React;
  var DomInertParseIntValue: number;
  var DomInertResolvedValue: boolean;
  var initializeDomInert: () => void;
  function getInertProps(input: boolean | undefined): {
    inert?: true | "";
  } {
    return input
      ? {
          inert: DomInertResolvedValue ? true : "",
        }
      : {};
  }
  function createSheetMutableCell<Value = SheetFrame>(): MutableCell<Value> {
    let value: Value | null = null;
    return {
      get: () => value,
      set: (input) => {
        value = input;
      },
    };
  }
  function sheetFrameHeight(
    input: SheetFrame | null,
    options?: Pick<Window, "innerHeight">,
  ): number | undefined {
    if (input !== null)
      return input.detent === "tall" && options !== undefined
        ? Math.round(options.innerHeight * runtime.SheetsLayoutConstant)
        : input.height;
  }
  function sheetStackMaxHeight(
    input: readonly SheetFrame[],
  ): number | undefined {
    let value = input[0],
      value2 = input.at(-1);
    return value === undefined || value2 === undefined
      ? undefined
      : Math.max(value2.height, value.height);
  }
  bindRuntimeValue(runtime, "getInertProps", () => getInertProps);
  bindRuntimeValue(
    runtime,
    "reactDomInert",
    () => reactDomInert,
    (value) => {
      reactDomInert = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DomInertParseIntValue",
    () => DomInertParseIntValue,
    (value) => {
      DomInertParseIntValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DomInertResolvedValue",
    () => DomInertResolvedValue,
    (value) => {
      DomInertResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDomInert",
    () => initializeDomInert,
    (value) => {
      initializeDomInert = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createSheetMutableCell",
    () => createSheetMutableCell,
  );
  bindRuntimeValue(runtime, "sheetFrameHeight", () => sheetFrameHeight);
  bindRuntimeValue(runtime, "sheetStackMaxHeight", () => sheetStackMaxHeight);
  return () => {
    initializeDomInert = (0, runtime.initializeOnce)(() => {
      reactDomInert = (0, runtime.toModuleNamespace)((0, runtime.load_react)());
      DomInertParseIntValue = Number.parseInt(reactDomInert.version, 10);
      DomInertResolvedValue =
        !Number.isFinite(DomInertParseIntValue) ||
        DomInertParseIntValue === 0 ||
        DomInertParseIntValue >= 19;
    });
  };
}
