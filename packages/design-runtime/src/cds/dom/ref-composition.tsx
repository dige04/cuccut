import type { ActivityBoundaryProps } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsDomRefComposition(
  runtime: RuntimeBindings,
): () => void {
  var reactDomRefComposition: typeof React;
  var initializeDomRefComposition: () => void;
  var HttpWwwW3Org1999XhtmlValue: string;
  var HttpWwwW3Org2000SvgValue: string;
  var initializeDomRefComposition_2: () => void;
  var reactDomRefComposition_2: typeof React;
  var jsxDomRefComposition: typeof import("react/jsx-runtime");
  var ActivityVisibilityContext: React.Context<Set<Element> | null>;
  var initializeDomRefComposition_3: () => void;
  var DomRefCompositionEventRestoreAllState: {
    event: Event;
    restoreAll: () => void;
  } | null;
  var DomRefCompositionDragendDropPointerdownValues: string[];
  var initializeDomRefComposition_4: () => void;
  var reactDomRefComposition_3: typeof React;
  var jsxDomRefComposition_2: typeof import("react/jsx-runtime");
  var DisabledContext: React.Context<boolean>;
  var initializeDomRefComposition_5: () => void;
  function assignRef<Element>(
    ref: React.Ref<Element> | undefined,
    value: Element | null,
  ): void | (() => void) {
    if (typeof ref == "function") return ref(value);
    ref && (ref.current = value);
  }
  function mergeRefs<Element>(
    ...refs: (React.Ref<Element> | undefined)[]
  ): React.RefCallback<Element> {
    return (input) => {
      let value = refs.map((input2) => assignRef(input2, input));
      if (value.some((input2) => typeof input2 == "function"))
        return () => {
          refs.forEach((input2, options) => {
            let value2 = value[options];
            typeof value2 == "function" ? value2() : assignRef(input2, null);
          });
        };
    };
  }
  function useMergedRefs<Element>(
    input?: React.Ref<Element>,
    options?: React.Ref<Element>,
    context?: React.Ref<Element>,
  ): React.RefCallback<Element> {
    return (0, reactDomRefComposition.useMemo)(
      () => mergeRefs(input, options, context),
      [input, options, context],
    );
  }
  function useEventRef<Element>(
    input: React.RefCallback<Element>,
    options?: React.Ref<Element>,
  ): React.RefCallback<Element> {
    let value = (0, runtime.useStableCallback)(input);
    return (0, runtime.useStableCallback)((input2) =>
      mergeRefs(value, options)(input2),
    );
  }
  function elementNamespace(
    input: Node | null | undefined,
  ): string | null | undefined {
    let value = input;
    return value?.nodeType === 1 ? (value as Element).namespaceURI : undefined;
  }
  function isHtmlElement(input: Node | null | undefined): input is HTMLElement {
    return elementNamespace(input) === HttpWwwW3Org1999XhtmlValue;
  }
  function isSvgElement(input: Node | null | undefined): input is SVGElement {
    return elementNamespace(input) === HttpWwwW3Org2000SvgValue;
  }
  function hasDisplayNoneAncestor(input: Element): boolean {
    if (!input.isConnected) return false;
    for (
      let value: Element | null = input;
      value !== null;
      value = value.parentElement
    )
      if (
        isHtmlElement(value) &&
        (value as HTMLElement).style.display === "none"
      )
        return true;
    return false;
  }
  function hasOpenChildOverlay(input: Element): boolean {
    for (let value of input.children)
      if (value.hasAttribute("data-open")) return true;
    return false;
  }
  function ActivityBoundary({
    actionsRef: actionsRef,
    children: children,
  }: ActivityBoundaryProps): React.ReactElement {
    let [value] = (0, reactDomRefComposition_2.useState)(
        () => new Set<Element>(),
      ),
      value2 = (0, reactDomRefComposition_2.useRef)(false);
    (0, reactDomRefComposition_2.useEffect)(
      () => (
        value2.current &&
          ((value2.current = false), actionsRef.current?.close?.()),
        () => {
          value2.current = false;
          for (let value3 of value)
            hasDisplayNoneAncestor(value3) &&
              hasOpenChildOverlay(value3) &&
              (value2.current = true);
        }
      ),
      [actionsRef, value],
    );
    return (
      <ActivityVisibilityContext.Provider value={value}>
        {children}
      </ActivityVisibilityContext.Provider>
    );
  }
  function useCloseOnHiddenActivity(
    input: boolean | undefined,
  ): React.RefObject<HTMLElement | null> {
    let value = (0, reactDomRefComposition_2.useContext)(
        ActivityVisibilityContext,
      ),
      value2 = (0, reactDomRefComposition_2.useRef)<HTMLElement | null>(null);
    (0, reactDomRefComposition_2.useEffect)(() => {
      let current = value2.current;
      if (!(!input || value === null || current === null)) {
        value.add(current);
        return () => {
          value.delete(current);
        };
      }
    }, [value, input]);
    return value2;
  }
  function companionModalCatcher(
    input: Element,
    options: EventTarget | null,
  ): HTMLElement | null {
    let value = (0, runtime.asElement)(options);
    return (
      value === null || value.parentElement !== input
        ? null
        : value.childElementCount === 0 &&
            (value as HTMLElement).style.position === "fixed"
          ? value
          : null
    ) as HTMLElement | null;
  }
  function shouldPreventModalCatcherFocus(
    input: Element,
    options: EventTarget | null,
  ): boolean {
    let value = companionModalCatcher(input, options);
    if (value === null) return false;
    let value2 = (0, runtime.asElement)(value.ownerDocument.activeElement),
      value3 = input.parentElement ?? input;
    return value2 === null || !value3.contains(value2);
  }
  function preventModalCatcherPointerFocus(
    event: React.PointerEvent<HTMLElement>,
  ): void {
    event.pointerType !== "touch" &&
      shouldPreventModalCatcherFocus(event.currentTarget, event.target) &&
      event.preventDefault();
  }
  function preventModalCatcherMouseFocus(
    event: React.MouseEvent<HTMLElement>,
  ): void {
    shouldPreventModalCatcherFocus(event.currentTarget, event.target) &&
      event.preventDefault();
  }
  function handleModalCatcherDismissal(
    event: React.SyntheticEvent<HTMLElement>,
  ): void {
    let currentTarget = event.currentTarget,
      value: HTMLElement | null = null;
    for (let value3 of currentTarget.children)
      if (
        ((value = companionModalCatcher(currentTarget, value3)), value !== null)
      )
        break;
    if (value === null) return;
    let value2 = value;
    if (
      DomRefCompositionEventRestoreAllState !== null &&
      DomRefCompositionEventRestoreAllState.event === event.nativeEvent
    ) {
      value2.style.pointerEvents = "none";
      let restoreAll = DomRefCompositionEventRestoreAllState.restoreAll;
      DomRefCompositionEventRestoreAllState.restoreAll = () => {
        value2.style.pointerEvents = "";
        restoreAll();
      };
      return;
    }
    DomRefCompositionEventRestoreAllState?.restoreAll();
    value2.style.pointerEvents = "none";
    let ownerDocument = value2.ownerDocument,
      state = {
        event: event.nativeEvent,
        restoreAll: () => {
          value2.style.pointerEvents = "";
          for (let value3 of DomRefCompositionDragendDropPointerdownValues)
            ownerDocument.removeEventListener(value3, callback, true);
          DomRefCompositionEventRestoreAllState === state &&
            (DomRefCompositionEventRestoreAllState = null);
        },
      },
      callback = () => state.restoreAll();
    DomRefCompositionEventRestoreAllState = state;
    for (let value3 of DomRefCompositionDragendDropPointerdownValues)
      ownerDocument.addEventListener(value3, callback, true);
  }
  bindRuntimeValue(runtime, "assignRef", () => assignRef);
  bindRuntimeValue(runtime, "mergeRefs", () => mergeRefs);
  bindRuntimeValue(runtime, "useMergedRefs", () => useMergedRefs);
  bindRuntimeValue(runtime, "useEventRef", () => useEventRef);
  bindRuntimeValue(
    runtime,
    "reactDomRefComposition",
    () => reactDomRefComposition,
    (value) => {
      reactDomRefComposition = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDomRefComposition",
    () => initializeDomRefComposition,
    (value) => {
      initializeDomRefComposition = value;
    },
  );
  bindRuntimeValue(runtime, "elementNamespace", () => elementNamespace);
  bindRuntimeValue(runtime, "isHtmlElement", () => isHtmlElement);
  bindRuntimeValue(runtime, "isSvgElement", () => isSvgElement);
  bindRuntimeValue(
    runtime,
    "HttpWwwW3Org1999XhtmlValue",
    () => HttpWwwW3Org1999XhtmlValue,
    (value) => {
      HttpWwwW3Org1999XhtmlValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HttpWwwW3Org2000SvgValue",
    () => HttpWwwW3Org2000SvgValue,
    (value) => {
      HttpWwwW3Org2000SvgValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDomRefComposition_2",
    () => initializeDomRefComposition_2,
    (value) => {
      initializeDomRefComposition_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasDisplayNoneAncestor",
    () => hasDisplayNoneAncestor,
  );
  bindRuntimeValue(runtime, "hasOpenChildOverlay", () => hasOpenChildOverlay);
  bindRuntimeValue(runtime, "ActivityBoundary", () => ActivityBoundary);
  bindRuntimeValue(
    runtime,
    "useCloseOnHiddenActivity",
    () => useCloseOnHiddenActivity,
  );
  bindRuntimeValue(
    runtime,
    "reactDomRefComposition_2",
    () => reactDomRefComposition_2,
    (value) => {
      reactDomRefComposition_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxDomRefComposition",
    () => jsxDomRefComposition,
    (value) => {
      jsxDomRefComposition = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ActivityVisibilityContext",
    () => ActivityVisibilityContext,
    (value) => {
      ActivityVisibilityContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDomRefComposition_3",
    () => initializeDomRefComposition_3,
    (value) => {
      initializeDomRefComposition_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "companionModalCatcher",
    () => companionModalCatcher,
  );
  bindRuntimeValue(
    runtime,
    "shouldPreventModalCatcherFocus",
    () => shouldPreventModalCatcherFocus,
  );
  bindRuntimeValue(
    runtime,
    "preventModalCatcherPointerFocus",
    () => preventModalCatcherPointerFocus,
  );
  bindRuntimeValue(
    runtime,
    "preventModalCatcherMouseFocus",
    () => preventModalCatcherMouseFocus,
  );
  bindRuntimeValue(
    runtime,
    "handleModalCatcherDismissal",
    () => handleModalCatcherDismissal,
  );
  bindRuntimeValue(
    runtime,
    "DomRefCompositionEventRestoreAllState",
    () => DomRefCompositionEventRestoreAllState,
    (value) => {
      DomRefCompositionEventRestoreAllState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DomRefCompositionDragendDropPointerdownValues",
    () => DomRefCompositionDragendDropPointerdownValues,
    (value) => {
      DomRefCompositionDragendDropPointerdownValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDomRefComposition_4",
    () => initializeDomRefComposition_4,
    (value) => {
      initializeDomRefComposition_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDomRefComposition_3",
    () => reactDomRefComposition_3,
    (value) => {
      reactDomRefComposition_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxDomRefComposition_2",
    () => jsxDomRefComposition_2,
    (value) => {
      jsxDomRefComposition_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DisabledContext",
    () => DisabledContext,
    (value) => {
      DisabledContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDomRefComposition_5",
    () => initializeDomRefComposition_5,
    (value) => {
      initializeDomRefComposition_5 = value;
    },
  );
  return () => {
    initializeDomRefComposition = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeHooksStableCallback_2)();
      reactDomRefComposition = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
    });
    initializeDomRefComposition_2 = (0, runtime.initializeOnce)(() => {
      HttpWwwW3Org1999XhtmlValue = "http://www.w3.org/1999/xhtml";
      HttpWwwW3Org2000SvgValue = "http://www.w3.org/2000/svg";
    });
    initializeDomRefComposition_3 = (0, runtime.initializeOnce)(() => {
      "use client";

      initializeDomRefComposition_2();
      reactDomRefComposition_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxDomRefComposition = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      ActivityVisibilityContext = (0,
      reactDomRefComposition_2.createContext)<Set<Element> | null>(null);
    });
    initializeDomRefComposition_4 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeHooksStableCallback)();
      DomRefCompositionEventRestoreAllState = null;
      DomRefCompositionDragendDropPointerdownValues = [
        "dragend",
        "drop",
        "pointerdown",
      ];
    });
    initializeDomRefComposition_5 = (0, runtime.initializeOnce)(() => {
      "use client";

      reactDomRefComposition_3 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxDomRefComposition_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      DisabledContext = (0, reactDomRefComposition_3.createContext)(false);
    });
  };
}
