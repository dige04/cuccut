import type {
  DeferredTooltipLoad,
  DeferredTooltipNode,
  DeferredTooltipScope,
  DeferredTooltipState,
  DisabledTooltipProps,
  TooltipImplementation,
  TooltipPointerEvent,
  TooltipProps,
  TooltipTriggerProps,
} from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsTooltipDeferredProvider(
  runtime: RuntimeBindings,
): () => void {
  var reactTooltipDeferredProvider: typeof React;
  var jsxTooltipDeferredProvider: typeof import("react/jsx-runtime");
  var TooltipDeferredProviderCurrentState: TooltipImplementation | null;
  var TooltipDeferredProviderCurrentState_2: Promise<TooltipImplementation> | null;
  var TooltipDeferredProviderSubscribers: Set<() => void>;
  var TooltipDeferredProviderCurrentState_3: ReturnType<
    typeof setTimeout
  > | null;
  var TooltipDeferredProviderSubscribers_2: Set<() => void>;
  var TooltipDeferredProviderPointermoveKeydownTouchstartValues: string[];
  var tooltipPreloadArmed: boolean;
  var TooltipDeferredProviderDataCdsTooltipPendingConfig: {
    "data-cds-tooltip-pending": string;
  };
  var TooltipDeferredProviderDelayMs: number;
  var TooltipDeferredProviderContext: React.Context<DeferredTooltipScope | null>;
  var initializeTooltipDeferredProvider: () => void;
  function scheduleTooltipHandoff(input: () => void): void {
    TooltipDeferredProviderSubscribers_2.add(input);
    TooltipDeferredProviderCurrentState_3 ??= setTimeout(() => {
      TooltipDeferredProviderCurrentState_3 = null;
      let items = [...TooltipDeferredProviderSubscribers_2];
      TooltipDeferredProviderSubscribers_2.clear();
      for (let value of items) value();
    }, 0);
  }
  function cancelTooltipHandoff(input: () => void): void {
    TooltipDeferredProviderSubscribers_2.delete(input);
  }
  function loadTooltipImplementation(): Promise<TooltipImplementation> {
    TooltipDeferredProviderCurrentState_2 ??= Promise.resolve()
      .then(
        () => (
          (0, runtime.initializeTooltipTooltip)(),
          runtime.tooltipImplementationExports as TooltipImplementation
        ),
      )
      .then(
        (input) => {
          TooltipDeferredProviderCurrentState = input;
          for (let value of TooltipDeferredProviderSubscribers) value();
          return input;
        },
        (input: unknown) => {
          throw ((TooltipDeferredProviderCurrentState_2 = null), input);
        },
      );
    return TooltipDeferredProviderCurrentState_2;
  }
  function preloadTooltipsAfterInteraction(): void {
    if (
      !(tooltipPreloadArmed || TooltipDeferredProviderCurrentState !== null) &&
      !(typeof document === "undefined")
    ) {
      tooltipPreloadArmed = true;
      for (let value of TooltipDeferredProviderPointermoveKeydownTouchstartValues)
        document.addEventListener(value, preloadTooltips, {
          capture: true,
          passive: true,
          once: true,
        });
    }
  }
  function preloadTooltips(): void {
    loadTooltipImplementation().catch(() => {});
  }
  function trackDeferredTooltipNode(
    input: DeferredTooltipNode,
    options: HTMLElement | null,
  ): void {
    input.node = options;
    options !== null &&
      ((input.adopted = true),
      input.handBack &&
        ((input.handBack = false),
        queueMicrotask(() => restoreTooltipFocus(input, options))));
  }
  function restoreTooltipFocus(
    input: DeferredTooltipNode,
    element: HTMLElement,
  ): void {
    if (!element.isConnected || !input.focus) return;
    let activeElement = element.ownerDocument.activeElement;
    (activeElement !== null && activeElement !== element.ownerDocument.body) ||
      element.focus({
        preventScroll: true,
      });
  }
  function cancelTooltipTapHold(input: DeferredTooltipNode): void {
    input.tapHold !== null &&
      (clearTimeout(input.tapHold), (input.tapHold = null));
  }
  function interceptTooltipPointer(
    input: DeferredTooltipNode,
    options: TooltipPointerEvent,
    context: () => void,
  ): void {
    cancelTooltipTapHold(input);
    if (
      input.down &&
      options.type === "pointerup" &&
      (options.pointerType === "touch" || options.pointerType === "pen")
    ) {
      input.tapHold = setTimeout(() => {
        input.tapHold = null;
        input.down = false;
        context();
      }, TooltipDeferredProviderDelayMs);
      return;
    }
    input.down = false;
    context();
  }
  function getTooltipImplementation(
    input: DeferredTooltipScope | null,
  ): TooltipImplementation | null {
    return TooltipDeferredProviderCurrentState !== null
      ? TooltipDeferredProviderCurrentState
      : input === null
        ? null
        : input.ambientImpl();
  }
  function DeferredTooltipProvider({
    children: children,
  }: React.PropsWithChildren): React.ReactElement {
    let value = (0, reactTooltipDeferredProvider.useContext)(
        runtime.TooltipImplementationContext,
      ),
      value2 = (0, reactTooltipDeferredProvider.useRef)(value);
    (0, reactTooltipDeferredProvider.useEffect)(() => {
      value2.current = value;
    }, [value]);
    let [value3] = (0,
    reactTooltipDeferredProvider.useState)<DeferredTooltipScope>(() => {
      let flag = true,
        values: Set<() => void> | null = new Set();
      return {
        ambientImpl: () => value2.current,
        isDeferred: () => flag,
        subscribe: (input) => {
          let value5 = values;
          return value5 === null
            ? () => {}
            : (value5.add(input), () => value5.delete(input));
        },
        engage: () => {
          if (!flag) return;
          flag = false;
          let value5 = values;
          values = null;
          if (value5 !== null) for (let value6 of value5) value6();
        },
      };
    });
    if (!(0, reactTooltipDeferredProvider.isValidElement)(children))
      return (
        <jsxTooltipDeferredProvider.Fragment>
          {children}
        </jsxTooltipDeferredProvider.Fragment>
      );
    let value4: React.ReactElement<TooltipTriggerProps> =
        children as React.ReactElement<TooltipTriggerProps>,
      callback =
        <Event extends React.SyntheticEvent>(
          input: () => void,
          options: ((event: Event) => void) | undefined,
        ): ((event: Event) => void) =>
        (input2) => {
          input();
          options?.(input2);
        };
    return (
      <TooltipDeferredProviderContext.Provider value={value3}>
        <runtime.TooltipImplementationContext.Provider value={null}>
          {(0, reactTooltipDeferredProvider.cloneElement)(
            value4 as React.ReactElement<TooltipTriggerProps>,
            {
              onPointerEnter: callback(
                value3.engage,
                value4.props.onPointerEnter,
              ),
              onFocus: callback(value3.engage, value4.props.onFocus),
            },
          )}
        </runtime.TooltipImplementationContext.Provider>
      </TooltipDeferredProviderContext.Provider>
    );
  }
  function isPointerFocused(element: Element): boolean {
    if (element.ownerDocument.activeElement !== element) return false;
    try {
      return !element.matches(":focus-visible");
    } catch {
      return false;
    }
  }
  function useDeferredTooltipImplementation(
    input: boolean,
  ): DeferredTooltipState {
    let value = (0, reactTooltipDeferredProvider.useContext)(
        runtime.TooltipImplementationContext,
      ),
      value2 = (0, reactTooltipDeferredProvider.useContext)(
        TooltipDeferredProviderContext,
      ),
      [value3, value4] = (0,
      reactTooltipDeferredProvider.useState)<DeferredTooltipLoad | null>(() => {
        let value16 =
          value ??
          (value2 !== null && value2.isDeferred()
            ? null
            : getTooltipImplementation(value2));
        return value16 === null
          ? null
          : {
              impl: value16,
              track: undefined,
            };
      }),
      value5 = value3 === null ? null : value3.impl,
      [value6] = (0, reactTooltipDeferredProvider.useState)(value5 === null),
      value7: React.RefObject<DeferredTooltipNode> = (0,
      reactTooltipDeferredProvider.useRef)({
        hover: false,
        focus: false,
        down: false,
        node: null,
        adopted: false,
        handBack: false,
        tapHold: null,
      }),
      value8 = (0, reactTooltipDeferredProvider.useRef)(false),
      value9 = (0, reactTooltipDeferredProvider.useCallback)(() => {
        if (value7.current.adopted || (value2 !== null && value2.isDeferred()))
          return;
        let {
          hover: current,
          focus: current2,
          down: current3,
          node: current4,
        } = value7.current;
        if (current3) return;
        let current5 = value8.current;
        value8.current = false;
        let value16 =
          current2 && input && current4 !== null && isPointerFocused(current4);
        if (current2 && !value16) return;
        let value17 = getTooltipImplementation(value2);
        if (value17 !== null && (!current || current5)) {
          let current6 = value7.current;
          current6.handBack = value16;
          value4(
            (input2) =>
              input2 ?? {
                impl: value17,
                track: input
                  ? (input3) => trackDeferredTooltipNode(current6, input3)
                  : undefined,
              },
          );
        }
      }, [value2, input]),
      value10 = (0, reactTooltipDeferredProvider.useCallback)(() => {
        getTooltipImplementation(value2) !== null &&
          scheduleTooltipHandoff(value9);
      }, [value2, value9]),
      value11 = (0, reactTooltipDeferredProvider.useCallback)(() => {
        value8.current = getTooltipImplementation(value2) !== null;
        value10();
      }, [value10, value2]),
      value12: React.RefObject<((event: PointerEvent) => void) | null> = (0,
      reactTooltipDeferredProvider.useRef)(null),
      value13 = (0, reactTooltipDeferredProvider.useCallback)(() => {
        let current = value12.current;
        current !== null &&
          ((value12.current = null),
          document.removeEventListener("pointerup", current, true),
          document.removeEventListener("pointercancel", current, true));
      }, []),
      value14 = (0, reactTooltipDeferredProvider.useCallback)(
        (input2?: number): void => {
          if (value12.current !== null || typeof document === "undefined")
            return;
          let callback = (input3: PointerEvent): void => {
            let pointerId = input3.pointerId;
            (input2 !== undefined &&
              pointerId !== undefined &&
              pointerId !== input2) ||
              (value13(),
              interceptTooltipPointer(value7.current, input3, value10));
          };
          value12.current = callback;
          document.addEventListener("pointerup", callback, {
            capture: true,
          });
          document.addEventListener("pointercancel", callback, {
            capture: true,
          });
        },
        [value10, value13],
      );
    (0, reactTooltipDeferredProvider.useEffect)(() => {
      if (!value6) return;
      preloadTooltipsAfterInteraction();
      let current = value7.current,
        callback = (): void => {
          cancelTooltipHandoff(value9);
          current.tapHold !== null &&
            (cancelTooltipTapHold(current), (current.down = false));
          value13();
        },
        items: (() => void)[] = [],
        value16 = value2 !== null && value2.isDeferred();
      value16 &&
        items.push((value2 as DeferredTooltipScope).subscribe(value11));
      TooltipDeferredProviderCurrentState === null &&
        (TooltipDeferredProviderSubscribers.add(value10),
        items.push(() => TooltipDeferredProviderSubscribers.delete(value10)));
      !value16 &&
        getTooltipImplementation(value2) !== null &&
        (value2 !== null && (value8.current = true), value10());
      return () => {
        for (let value17 of items) value17();
        callback();
      };
    }, [value10, value11, value2, value13, value9, value6]);
    let value15 = (0, reactTooltipDeferredProvider.useCallback)(() => {
      loadTooltipImplementation().catch(() => {});
    }, []);
    return {
      impl: value5,
      wasCold: value6,
      interceptors: (0, reactTooltipDeferredProvider.useCallback)(
        (input2) => {
          let callback =
            <Event extends React.SyntheticEvent>(
              input3: (event: Event) => void,
              options: ((event: Event) => void) | undefined,
            ): ((event: Event) => void) =>
            (input4) => {
              input3(input4);
              options?.(input4);
            };
          return {
            onPointerEnter: callback(() => {
              value7.current.hover = true;
              value15();
            }, input2.onPointerEnter),
            onPointerLeave: callback(() => {
              value7.current.hover = false;
              value10();
            }, input2.onPointerLeave),
            onPointerDown: callback((input3) => {
              input3.isPrimary !== false &&
                input3.button === 0 &&
                (cancelTooltipTapHold(value7.current),
                (value7.current.down = true),
                value14(input3.pointerId));
            }, input2.onPointerDown),
            onPointerUp: callback((input3) => {
              input3.isPrimary !== false &&
                interceptTooltipPointer(value7.current, input3, value10);
            }, input2.onPointerUp),
            onPointerCancel: callback((input3) => {
              input3.isPrimary !== false &&
                interceptTooltipPointer(value7.current, input3, value10);
            }, input2.onPointerCancel),
            onClick: callback((input3) => {
              value7.current.tapHold !== null &&
                interceptTooltipPointer(value7.current, input3, value10);
            }, input2.onClick),
            onFocus: callback((input3) => {
              value7.current.focus = true;
              value7.current.node = (0, runtime.asElement)(
                input3.currentTarget,
              ) as HTMLElement | null;
              value15();
            }, input2.onFocus),
            onBlur: callback(() => {
              value7.current.focus = false;
              value10();
            }, input2.onBlur),
          };
        },
        [value10, value14, value15],
      ),
      trackTrigger: value3?.track,
    };
  }
  function disableAutoFocus(input: React.ReactNode): React.ReactNode {
    return (0, reactTooltipDeferredProvider.isValidElement)(input)
      ? (0, reactTooltipDeferredProvider.cloneElement)(
          input as React.ReactElement<TooltipTriggerProps>,
          {
            autoFocus: false,
          },
        )
      : input;
  }
  function DeferredTooltip(input: TooltipProps): React.ReactElement {
    let {
        impl: value,
        wasCold: value2,
        interceptors: value3,
        trackTrigger: value4,
      } = useDeferredTooltipImplementation(true),
      value5 = input.autoFocus === false;
    if (value !== null)
      return value2 || value5 ? (
        <value.Tooltip {...input} triggerRef={value4}>
          {disableAutoFocus(input.children)}
        </value.Tooltip>
      ) : (
        <value.Tooltip {...input} />
      );
    let { children: value6 } = input;
    if (!(0, reactTooltipDeferredProvider.isValidElement)(value6))
      return (
        <jsxTooltipDeferredProvider.Fragment>
          {value6}
        </jsxTooltipDeferredProvider.Fragment>
      );
    let value7: React.ReactElement<TooltipTriggerProps> =
      value6 as React.ReactElement<TooltipTriggerProps>;
    return (0, reactTooltipDeferredProvider.cloneElement)(
      value7 as React.ReactElement<TooltipTriggerProps>,
      {
        ...value3(value7.props),
        ...TooltipDeferredProviderDataCdsTooltipPendingConfig,
      },
    );
  }
  function DeferredDisabledReasonTooltip(
    input: DisabledTooltipProps,
  ): React.ReactElement {
    let {
        impl: value,
        wasCold: value2,
        interceptors: value3,
      } = useDeferredTooltipImplementation(false),
      value4 = (0, reactTooltipDeferredProvider.useId)();
    if (value !== null)
      return value2 ? (
        <value.DisabledReasonTooltip {...input}>
          {disableAutoFocus(input.children)}
        </value.DisabledReasonTooltip>
      ) : (
        <value.DisabledReasonTooltip {...input} />
      );
    let { reason: value5, wrapperClassName: value6, children: value7 } = input;
    return (
      <span
        {...(0, runtime.disabledReasonWrapperProps)(value5, value4, value6)}
        title={typeof value5 == "string" ? value5 : undefined}
        {...value3({})}
        {...TooltipDeferredProviderDataCdsTooltipPendingConfig}
      >
        {value7}
        <runtime.DisabledReasonDescription id={value4} reason={value5} />
      </span>
    );
  }
  bindRuntimeValue(
    runtime,
    "scheduleTooltipHandoff",
    () => scheduleTooltipHandoff,
  );
  bindRuntimeValue(runtime, "cancelTooltipHandoff", () => cancelTooltipHandoff);
  bindRuntimeValue(
    runtime,
    "loadTooltipImplementation",
    () => loadTooltipImplementation,
  );
  bindRuntimeValue(
    runtime,
    "preloadTooltipsAfterInteraction",
    () => preloadTooltipsAfterInteraction,
  );
  bindRuntimeValue(runtime, "preloadTooltips", () => preloadTooltips);
  bindRuntimeValue(
    runtime,
    "trackDeferredTooltipNode",
    () => trackDeferredTooltipNode,
  );
  bindRuntimeValue(runtime, "restoreTooltipFocus", () => restoreTooltipFocus);
  bindRuntimeValue(runtime, "cancelTooltipTapHold", () => cancelTooltipTapHold);
  bindRuntimeValue(
    runtime,
    "interceptTooltipPointer",
    () => interceptTooltipPointer,
  );
  bindRuntimeValue(
    runtime,
    "getTooltipImplementation",
    () => getTooltipImplementation,
  );
  bindRuntimeValue(
    runtime,
    "DeferredTooltipProvider",
    () => DeferredTooltipProvider,
  );
  bindRuntimeValue(runtime, "isPointerFocused", () => isPointerFocused);
  bindRuntimeValue(
    runtime,
    "useDeferredTooltipImplementation",
    () => useDeferredTooltipImplementation,
  );
  bindRuntimeValue(runtime, "disableAutoFocus", () => disableAutoFocus);
  bindRuntimeValue(runtime, "DeferredTooltip", () => DeferredTooltip);
  bindRuntimeValue(
    runtime,
    "DeferredDisabledReasonTooltip",
    () => DeferredDisabledReasonTooltip,
  );
  bindRuntimeValue(
    runtime,
    "reactTooltipDeferredProvider",
    () => reactTooltipDeferredProvider,
    (value) => {
      reactTooltipDeferredProvider = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxTooltipDeferredProvider",
    () => jsxTooltipDeferredProvider,
    (value) => {
      jsxTooltipDeferredProvider = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipDeferredProviderCurrentState",
    () => TooltipDeferredProviderCurrentState,
    (value) => {
      TooltipDeferredProviderCurrentState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipDeferredProviderCurrentState_2",
    () => TooltipDeferredProviderCurrentState_2,
    (value) => {
      TooltipDeferredProviderCurrentState_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipDeferredProviderSubscribers",
    () => TooltipDeferredProviderSubscribers,
    (value) => {
      TooltipDeferredProviderSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipDeferredProviderCurrentState_3",
    () => TooltipDeferredProviderCurrentState_3,
    (value) => {
      TooltipDeferredProviderCurrentState_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipDeferredProviderSubscribers_2",
    () => TooltipDeferredProviderSubscribers_2,
    (value) => {
      TooltipDeferredProviderSubscribers_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipDeferredProviderPointermoveKeydownTouchstartValues",
    () => TooltipDeferredProviderPointermoveKeydownTouchstartValues,
    (value) => {
      TooltipDeferredProviderPointermoveKeydownTouchstartValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipPreloadArmed",
    () => tooltipPreloadArmed,
    (value) => {
      tooltipPreloadArmed = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipDeferredProviderDataCdsTooltipPendingConfig",
    () => TooltipDeferredProviderDataCdsTooltipPendingConfig,
    (value) => {
      TooltipDeferredProviderDataCdsTooltipPendingConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipDeferredProviderDelayMs",
    () => TooltipDeferredProviderDelayMs,
    (value) => {
      TooltipDeferredProviderDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipDeferredProviderContext",
    () => TooltipDeferredProviderContext,
    (value) => {
      TooltipDeferredProviderContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeTooltipDeferredProvider",
    () => initializeTooltipDeferredProvider,
    (value) => {
      initializeTooltipDeferredProvider = value;
    },
  );
  return () => {
    initializeTooltipDeferredProvider = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeHooksStableCallback)();
      (0, runtime.initializeTooltipDisabledReason)();
      (0, runtime.initializeTooltipTrigger)();
      reactTooltipDeferredProvider = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxTooltipDeferredProvider = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      TooltipDeferredProviderCurrentState = null;
      TooltipDeferredProviderCurrentState_2 = null;
      TooltipDeferredProviderSubscribers = new Set();
      TooltipDeferredProviderCurrentState_3 = null;
      TooltipDeferredProviderSubscribers_2 = new Set();
      TooltipDeferredProviderPointermoveKeydownTouchstartValues = [
        "pointermove",
        "keydown",
        "touchstart",
      ];
      tooltipPreloadArmed = false;
      TooltipDeferredProviderDataCdsTooltipPendingConfig = {
        "data-cds-tooltip-pending": "",
      };
      TooltipDeferredProviderDelayMs = 700;
      TooltipDeferredProviderContext = (0,
      reactTooltipDeferredProvider.createContext)<DeferredTooltipScope | null>(
        null,
      );
    });
  };
}
