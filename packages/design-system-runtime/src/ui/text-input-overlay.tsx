/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as C from "../contracts/controls";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiTextInputOverlay(
  runtime: RuntimeBindings,
): () => void {
  var reactiZ: typeof React;
  var jsxZu: typeof import("react/jsx-runtime");
  var reactDOMForUiTextInputOverlay: typeof import("react-dom");
  var SHEET_PENDING_ATTRIBUTE: string;
  var concealedPopupStyle: React.CSSProperties;
  var preventPendingSheetFocus: (event: Pick<Event, "preventDefault">) => void;
  var COMPOSITION_TIME_SENTINEL: number;
  var lastCompositionEndTime: number;
  var suppressedCompositionEvents: WeakSet<Event>;
  var compositionLineBreakInputTypes: Set<string>;
  var compositionSuppressionResetEvents: string[];
  function useRefocusAfterPendingSheet(input: boolean) {
    let ref = reactiZ.useRef<HTMLElement>(null),
      ref2 = reactiZ.useRef(input);
    reactiZ.useEffect(() => {
      if (ref2.current && !input) {
        ref.current?.focus({
          preventScroll: true,
        });
      }
      ref2.current = input;
    }, [input]);
    return reactiZ.useCallback((input2: HTMLElement | null) => {
      ref.current = input2;
    }, []);
  }
  function PendingSheetBackdrop({ kind: kind }: { kind: C.OverlayKind }) {
    let value = reactiZ.useContext<
        import("../contracts/overlays").SheetFrameContext | null
      >(runtime.sheetFrameContext),
      value2: Element | ShadowRoot | null | undefined = (0,
      runtime.usePortalContainer)(),
      value3: {
        portalProps: React.HTMLAttributes<HTMLElement>;
        style: C.DesignStyle;
      } = (0, runtime.useDefaultOverlayLayer)(kind);
    (0, runtime.useAndroidCloseWatcher)(value?.open ?? false, value?.dismiss);
    let [value4, value5] = reactiZ.useState(false),
      ref = reactiZ.useRef(false),
      value6: Window | undefined = (0, runtime.useRootWindow)();
    reactiZ.useEffect(() => {
      if (value6 === undefined) {
        return;
      }
      let value8 = value6.requestAnimationFrame(() => {
        value5(true);
      });
      return () => {
        value6.cancelAnimationFrame(value8);
      };
    }, [value6]);
    let value7 =
      value2 ?? (typeof document === "undefined" ? null : document.body);
    if (value7 === null || value === null || !value.open) {
      return null;
    }
    return reactDOMForUiTextInputOverlay.createPortal(
      <runtime.PortalRoot {...value3.portalProps}>
        <div
          role={"presentation"}
          {...{
            [SHEET_PENDING_ATTRIBUTE]: "",
          }}
          className={(0, runtime.clsx)(
            runtime.sheetBackdropClasses,
            !value4 && "opacity-0",
          )}
          style={value3.style}
          onPointerDown={(input: React.PointerEvent<HTMLDivElement>) => {
            ref.current = true;
            preventPendingSheetFocus(input);
          }}
          onPointerCancel={() => {
            ref.current = false;
          }}
          onMouseDown={preventPendingSheetFocus}
          onClick={() => {
            if (!ref.current) {
              return;
            }
            ref.current = false;
            value.dismiss();
          }}
        />
      </runtime.PortalRoot>,
      value7,
    );
  }
  function isAppleBrowser() {
    if (typeof window === "undefined") {
      return false;
    }
    return /Apple Computer/.test(window.navigator.vendor);
  }
  function recordCompositionEnd(input: number): void {
    lastCompositionEndTime = input;
  }
  function resetCompositionSuppression(
    event: C.CompositionKeyboardEvent,
  ): void {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.altKey ||
      event.keyCode === 229 ||
      event.isComposing === true ||
      event.nativeEvent?.isComposing === true
    ) {
      lastCompositionEndTime = COMPOSITION_TIME_SENTINEL;
    }
  }
  function shouldSuppressCompositionEnter(
    input: C.CompositionEnterEvent,
  ): boolean {
    if (input.isComposing || input.keyCode === 229) {
      lastCompositionEndTime = COMPOSITION_TIME_SENTINEL;
      return true;
    }
    if (suppressedCompositionEvents.has(input)) {
      return true;
    }
    if (
      isAppleBrowser() &&
      Math.abs(input.timeStamp - lastCompositionEndTime) < 500
    ) {
      lastCompositionEndTime = COMPOSITION_TIME_SENTINEL;
      if (input.metaKey || input.ctrlKey) {
        return false;
      }
      suppressedCompositionEvents.add(input);
      return true;
    }
    return false;
  }
  function suppressFollowupCompositionLineBreak(
    input: Event,
    options: EventTarget,
    context: () => void,
  ) {
    if (!suppressedCompositionEvents.has(input)) {
      return;
    }
    let value = input,
      callback = (event: Event) => {
        if (event === value) {
          return;
        }
        for (let value2 of compositionSuppressionResetEvents) {
          options.removeEventListener(value2, callback, {
            capture: true,
          });
        }
        if (
          event.type === "beforeinput" &&
          "inputType" in event &&
          typeof event.inputType === "string" &&
          compositionLineBreakInputTypes.has(event.inputType)
        ) {
          event.preventDefault();
          context();
        }
      };
    for (let value2 of compositionSuppressionResetEvents) {
      options.addEventListener(value2, callback, {
        capture: true,
      });
    }
  }
  bindRuntimeValue(
    runtime,
    "reactiZ",
    () => reactiZ,
    (value) => {
      reactiZ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxZu",
    () => jsxZu,
    (value) => {
      jsxZu = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDOMForUiTextInputOverlay",
    () => reactDOMForUiTextInputOverlay,
    (value) => {
      reactDOMForUiTextInputOverlay = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHEET_PENDING_ATTRIBUTE",
    () => SHEET_PENDING_ATTRIBUTE,
    (value) => {
      SHEET_PENDING_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "concealedPopupStyle",
    () => concealedPopupStyle,
    (value) => {
      concealedPopupStyle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useRefocusAfterPendingSheet",
    () => useRefocusAfterPendingSheet,
  );
  bindRuntimeValue(
    runtime,
    "preventPendingSheetFocus",
    () => preventPendingSheetFocus,
    (value) => {
      preventPendingSheetFocus = value;
    },
  );
  bindRuntimeValue(runtime, "PendingSheetBackdrop", () => PendingSheetBackdrop);
  bindRuntimeValue(
    runtime,
    "COMPOSITION_TIME_SENTINEL",
    () => COMPOSITION_TIME_SENTINEL,
    (value) => {
      COMPOSITION_TIME_SENTINEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "lastCompositionEndTime",
    () => lastCompositionEndTime,
    (value) => {
      lastCompositionEndTime = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "suppressedCompositionEvents",
    () => suppressedCompositionEvents,
    (value) => {
      suppressedCompositionEvents = value;
    },
  );
  bindRuntimeValue(runtime, "isAppleBrowser", () => isAppleBrowser);
  bindRuntimeValue(runtime, "recordCompositionEnd", () => recordCompositionEnd);
  bindRuntimeValue(
    runtime,
    "resetCompositionSuppression",
    () => resetCompositionSuppression,
  );
  bindRuntimeValue(
    runtime,
    "shouldSuppressCompositionEnter",
    () => shouldSuppressCompositionEnter,
  );
  bindRuntimeValue(
    runtime,
    "compositionLineBreakInputTypes",
    () => compositionLineBreakInputTypes,
    (value) => {
      compositionLineBreakInputTypes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "compositionSuppressionResetEvents",
    () => compositionSuppressionResetEvents,
    (value) => {
      compositionSuppressionResetEvents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "suppressFollowupCompositionLineBreak",
    () => suppressFollowupCompositionLineBreak,
  );
  return () => {
    reactiZ = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxZu = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    reactDOMForUiTextInputOverlay = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomNamespace)(),
      1,
    );
    SHEET_PENDING_ATTRIBUTE = "data-cds-sheet-pending";
    concealedPopupStyle = {
      visibility: "hidden",
      opacity: 0,
    };
    preventPendingSheetFocus = (event: Pick<Event, "preventDefault">) => {
      event.preventDefault();
    };
    COMPOSITION_TIME_SENTINEL = -1e8;
    lastCompositionEndTime = COMPOSITION_TIME_SENTINEL;
    suppressedCompositionEvents = new WeakSet();
    compositionLineBreakInputTypes = new Set([
      "insertParagraph",
      "insertLineBreak",
    ]);
    compositionSuppressionResetEvents = [
      "beforeinput",
      "keydown",
      "keyup",
      "compositionstart",
      "focusout",
    ];
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeIcons)();
  };
}
