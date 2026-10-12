import type { KeyboardInset } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsSheetsKeyboardViewport(
  runtime: RuntimeBindings,
): () => void {
  var reactSheetsKeyboardViewport: typeof React;
  var textInputSelector: string;
  var SheetsKeyboardViewportConstant: number;
  var SheetsKeyboardViewportLimit: number;
  var initializeSheetsKeyboardViewport: () => void;
  function isTextInputElement(input: Element | null | undefined): boolean {
    return input == null
      ? false
      : input.matches(
            'input:not([type=button],[type=checkbox],[type=radio],[type=range],[type=submit],[type=reset],[type=color],[type=file],[type=image],[type=hidden],[readonly]), textarea:not([readonly]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
          )
        ? true
        : ((0, runtime.asElement)(input) as HTMLElement | null)
            ?.isContentEditable === true;
  }
  function measureKeyboardInset(input: Window): KeyboardInset | null {
    let visualViewport = input.visualViewport;
    if (
      visualViewport == null ||
      Math.abs((visualViewport.scale ?? 1) - 1) > SheetsKeyboardViewportLimit
    )
      return null;
    let clientHeight = input.document.documentElement.clientHeight;
    return {
      inset: Math.max(
        0,
        Math.round(
          clientHeight - (visualViewport.offsetTop + visualViewport.height),
        ),
      ),
      visible: Math.round(visualViewport.height),
      offset: Math.max(0, Math.round(visualViewport.offsetTop)),
    };
  }
  function useKeyboardViewport(
    input: boolean,
    options: (inset: KeyboardInset | null) => void,
    {
      unpan: context = false,
    }: {
      unpan?: boolean;
    } = {},
  ): void {
    let value = (0, runtime.useCdsWindow)(),
      value2 = (0, runtime.useStableCallback)(options);
    (0, reactSheetsKeyboardViewport.useEffect)(() => {
      if (!input || value === undefined) return;
      let visualViewport = value.visualViewport;
      if (visualViewport == null) return;
      let value3: KeyboardInset | null = null,
        flag = false,
        index = 0,
        callback = () => {
          index = 0;
          let value4 = measureKeyboardInset(value),
            clientHeight = value.document.documentElement.clientHeight,
            value5 =
              value4 !== null &&
              value4.visible < clientHeight - SheetsKeyboardViewportConstant,
            value6 = value5 ? value4 : null;
          (value6?.inset !== value3?.inset ||
            value6?.visible !== value3?.visible ||
            value6?.offset !== value3?.offset) &&
            ((value3 = value6), value2(value6));
          context &&
            value5 &&
            !flag &&
            visualViewport.offsetTop > 0 &&
            ((flag = true),
            value.document.documentElement.scrollIntoView({
              block: "start",
              inline: "start",
              behavior: "instant",
            }),
            value.scrollTo({
              top: 0,
              left: 0,
              behavior: "instant",
            }));
          value5 || (flag = false);
        },
        callback2 = () => {
          index === 0 && (index = value.requestAnimationFrame(callback));
        };
      callback();
      visualViewport.addEventListener("resize", callback2);
      visualViewport.addEventListener("scroll", callback2);
      return () => {
        visualViewport.removeEventListener("resize", callback2);
        visualViewport.removeEventListener("scroll", callback2);
        index !== 0 && value.cancelAnimationFrame(index);
        value2(null);
      };
    }, [input, value, value2, context]);
  }
  bindRuntimeValue(runtime, "isTextInputElement", () => isTextInputElement);
  bindRuntimeValue(runtime, "measureKeyboardInset", () => measureKeyboardInset);
  bindRuntimeValue(runtime, "useKeyboardViewport", () => useKeyboardViewport);
  bindRuntimeValue(
    runtime,
    "reactSheetsKeyboardViewport",
    () => reactSheetsKeyboardViewport,
    (value) => {
      reactSheetsKeyboardViewport = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textInputSelector",
    () => textInputSelector,
    (value) => {
      textInputSelector = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsKeyboardViewportConstant",
    () => SheetsKeyboardViewportConstant,
    (value) => {
      SheetsKeyboardViewportConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsKeyboardViewportLimit",
    () => SheetsKeyboardViewportLimit,
    (value) => {
      SheetsKeyboardViewportLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsKeyboardViewport",
    () => initializeSheetsKeyboardViewport,
    (value) => {
      initializeSheetsKeyboardViewport = value;
    },
  );
  return () => {
    initializeSheetsKeyboardViewport = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeHooksStableCallback)();
      (0, runtime.initializeHooksStableCallback_2)();
      reactSheetsKeyboardViewport = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      textInputSelector =
        'input:not([type=button],[type=checkbox],[type=radio],[type=range],[type=submit],[type=reset],[type=color],[type=file],[type=image],[type=hidden],[readonly]), textarea:not([readonly]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';
      SheetsKeyboardViewportConstant = 120;
      SheetsKeyboardViewportLimit = 0.01;
    });
  };
}
