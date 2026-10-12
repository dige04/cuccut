import type {
  BrowserWindow,
  CompactableControlState,
} from "../contracts/overlays";
import type * as React from "react";
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
  CollapsiblePanelProps,
  CollapsibleRootProps,
  CollapsibleTriggerProps,
  ForwardComponent,
  DelayedSpinnerProps,
  SpinnerProps,
  SelectionMouseEvent,
} from "../contracts/overlays";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiDisclosure(runtime: RuntimeBindings): () => void {
  var reactDOMClientForUiDisclosure: typeof import("react-dom/client");
  var reactArtifactRoot: typeof React;
  var reactForUiDisclosure: typeof React;
  var repeatedClickSelectionProps: Readonly<{
    onMouseDown: typeof preventRepeatedClickSelection;
  }>;
  var react_k: typeof React;
  var reactXk: typeof React;
  var disclosurePanelClasses: string;
  var isHeightTransition: (input: Animation) => boolean;
  var observeDisclosureAnimation: (element: HTMLElement) => () => void;
  var useDisclosureAnimationRef: () => React.RefCallback<HTMLElement>;
  var useDisclosurePanelRef: (
    ref: React.Ref<HTMLElement> | undefined,
  ) => React.RefCallback<HTMLElement>;
  var reactForUiDisclosure2: typeof React;
  var reactDOMForUiDisclosure: typeof import("react/jsx-runtime");
  var CollapsibleRoot: ForwardComponent<HTMLDivElement, CollapsibleRootProps>;
  var collapsibleTriggerClasses: string;
  var collapsibleIconClasses: string;
  var CollapsibleTrigger: ForwardComponent<
    HTMLButtonElement,
    CollapsibleTriggerProps
  >;
  var collapsiblePanelClasses: string;
  var CollapsiblePanel: ForwardComponent<HTMLDivElement, CollapsiblePanelProps>;
  var Collapsible: {
    Root: typeof CollapsibleRoot;
    Trigger: typeof CollapsibleTrigger;
    Panel: typeof CollapsiblePanel;
  };
  var reactcK: typeof React;
  var jsxEq: typeof import("react/jsx-runtime");
  var spinnerSizeAliases: Partial<
    Record<NonNullable<SpinnerProps["size"]>, "sm" | "md" | "lg">
  >;
  var spinnerSizeMetrics: {
    sm: {
      box: number;
      stroke: number;
    };
    md: {
      box: number;
      stroke: number;
    };
    lg: {
      box: number;
      stroke: number;
    };
  };
  var reactfk: typeof React;
  var compactableControlContext: React.Context<CompactableControlState>;
  var COMPACTABLE_ATTRIBUTE: string;
  var reactForUiDisclosure3: typeof React;
  var reactForUiDisclosure4: typeof React;
  var jsxForUiDisclosure: typeof import("react/jsx-runtime");
  var loadedTooltipImplementation: TooltipImplementation | null;
  var tooltipImplementationPromise: Promise<TooltipImplementation> | null;
  var tooltipImplementationListeners: Set<() => void>;
  var tooltipBatchTimer: ReturnType<typeof setTimeout> | null;
  var tooltipBatchCallbacks: Set<() => void>;
  var tooltipPreloadEvents: string[];
  var tooltipPreloadStarted: boolean;
  var pendingTooltipProps: {
    "data-cds-tooltip-pending": string;
  };
  var TOUCH_TOOLTIP_HOLD_MS: number;
  var deferredTooltipImplementationContext: React.Context<DeferredTooltipScope | null>;
  function preventRepeatedClickSelection(event: SelectionMouseEvent): void {
    if (event.detail <= 1 || event.button !== 0) {
      return;
    }
    if (
      (event.target as Element).closest?.(
        "input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])",
      )
    ) {
      return;
    }
    event.preventDefault();
  }
  function withRepeatedClickSelectionPrevention<
    Event extends SelectionMouseEvent,
  >(onMouseDown?: (event: Event) => void): (event: Event) => void {
    if (!onMouseDown) {
      return preventRepeatedClickSelection;
    }
    return (input: Event) => {
      onMouseDown(input);
      preventRepeatedClickSelection(input);
    };
  }
  function useHiddenUntilFoundRef(): React.RefCallback<HTMLElement> {
    let ref = react_k.useRef<{
      node: HTMLElement;
      detach(): void;
    } | null>(null);
    return react_k.useCallback((input: HTMLElement | null) => {
      if (!input || input === ref.current?.node) {
        return;
      }
      ref.current?.detach();
      ref.current = {
        node: input,
        detach: attachBeforeMatchStyleRecovery(input),
      };
    }, []);
  }
  function attachBeforeMatchStyleRecovery(element: HTMLElement): () => void {
    let value: (() => void) | undefined,
      value2: MutationObserver | undefined,
      callback = () => {
        value2?.disconnect();
        value2 = undefined;
        value?.();
        value = undefined;
      },
      callback2 = (event: Event) => {
        if (event.target !== element || value) {
          return;
        }
        value = overrideInlineStyles(element, {
          height: "auto",
          "transition-property": "none",
        });
        value2 = new (element.ownerDocument.defaultView?.MutationObserver ??
          MutationObserver)(() => {
          if (element.hasAttribute("data-open")) {
            callback();
          }
        });
        value2.observe(element, {
          attributes: true,
          attributeFilter: ["data-open"],
        });
      };
    element.addEventListener("beforematch", callback2);
    return () => {
      element.removeEventListener("beforematch", callback2);
      callback();
    };
  }
  function overrideInlineStyles(
    element: HTMLElement,
    styles: Readonly<Record<string, string>>,
  ): () => void {
    let previousStyles = Object.keys(styles).map(
      (input: string): [string, string, string] => [
        input,
        element.style.getPropertyValue(input),
        element.style.getPropertyPriority(input),
      ],
    );
    for (let [value, value2] of Object.entries(styles)) {
      element.style.setProperty(value, value2);
    }
    return () => {
      for (let [value, value2, value3] of previousStyles) {
        if (value2) {
          element.style.setProperty(value, value2, value3);
        } else {
          element.style.removeProperty(value);
        }
      }
    };
  }
  function Spinner({
    size = "sm",
    delay = 0,
    inheritColor = false,
    label: label,
    className: className,
  }: SpinnerProps): React.ReactElement | null {
    let [value, value2] = reactcK.useState(delay <= 0),
      [value3, value4] = reactcK.useState(delay);
    if (delay !== value3) {
      value4(delay);
      if (delay > 0 && value) {
        value2(false);
      }
    }
    let value5 = delay <= 0 || value;
    reactcK.useEffect(() => {
      if (delay <= 0) {
        return;
      }
      let value14 = window.setTimeout(() => value2(true), delay);
      return () => window.clearTimeout(value14);
    }, [delay]);
    let value6 =
        spinnerSizeMetrics[
          (spinnerSizeAliases[size] ?? size) as "sm" | "md" | "lg"
        ],
      value7 = inheritColor ? "currentColor" : "var(--cds-text-muted)",
      value8 = inheritColor
        ? "color-mix(in srgb, currentColor 25%, transparent)"
        : "var(--cds-border)",
      value9 = (0, runtime.pixelsToScaledRem)(value6.box),
      value10 = (0, runtime.pixelsToScaledRem)(value6.stroke),
      value11 = `calc(100% - ${value10})`,
      value12 = `radial-gradient(farthest-side, transparent ${value11}, #000 calc(${value11} + 0.5px))`,
      value13 = !value5 ? null : (
        <span
          data-cds={"Spinner"}
          className={(0, runtime.cn)(
            "relative inline-block shrink-0 align-middle",
            className,
          )}
          style={{
            width: value9,
            height: value9,
          }}
          aria-hidden={true}
        >
          {[
            <span
              className={"absolute inset-0 rounded-full"}
              style={{
                border: `${value10} solid ${value8}`,
              }}
            />,
            <span
              className={
                "absolute inset-0 rounded-full animate-[spin_1s_linear_infinite] motion-reduce:animate-none"
              }
              style={{
                background: `conic-gradient(transparent 40%, ${value7})`,
                WebkitMask: value12,
                mask: value12,
              }}
            />,
          ]}
        </span>
      );
    if (!label) {
      return value13;
    }
    return (
      <span role={"status"} className={"leading-[0]"}>
        {[
          value13,
          <DelayedScreenReaderLabel show={value5}>
            {label}
          </DelayedScreenReaderLabel>,
        ]}
      </span>
    );
  }
  function DelayedScreenReaderLabel({
    show: show,
    children: children,
  }: DelayedSpinnerProps): React.ReactElement | null {
    let [value, value2] = reactcK.useState(false);
    reactcK.useEffect(() => {
      let value3 = window.setTimeout(() => value2(true), 100);
      return () => window.clearTimeout(value3);
    }, []);
    if (show && value) {
      return <span className={"sr-only"}>{children}</span>;
    } else {
      return null;
    }
  }
  function useCompactableControl(): CompactableControlState {
    return reactfk.useContext(compactableControlContext);
  }
  function useCompactableControlDebug(
    input: React.RefObject<Element | null>,
    options: string,
  ): void {
    reactForUiDisclosure3.useEffect(() => {
      return;
    }, [input, options]);
  }
  function scheduleTooltipUpdate(input: () => void): void {
    tooltipBatchCallbacks.add(input);
    tooltipBatchTimer ??= setTimeout(() => {
      tooltipBatchTimer = null;
      let items = [...tooltipBatchCallbacks];
      tooltipBatchCallbacks.clear();
      for (let value of items) {
        value();
      }
    }, 0);
  }
  function cancelTooltipUpdate(input: () => void): void {
    tooltipBatchCallbacks.delete(input);
  }
  function loadTooltipImplementation(): Promise<TooltipImplementation> {
    tooltipImplementationPromise ??= Promise.resolve()
      .then(() => {
        (0, runtime.initializeTooltip)();
        return runtime.tooltipExports;
      })
      .then(
        (input: TooltipImplementation) => {
          loadedTooltipImplementation = input;
          for (let value of tooltipImplementationListeners) {
            value();
          }
          return input;
        },
        (input: unknown) => {
          throw ((tooltipImplementationPromise = null), input);
        },
      );
    return tooltipImplementationPromise;
  }
  function preloadTooltipsOnInteraction(): void {
    if (tooltipPreloadStarted || loadedTooltipImplementation !== null) {
      return;
    }
    if (typeof document === "undefined") {
      return;
    }
    tooltipPreloadStarted = true;
    for (let value of tooltipPreloadEvents) {
      document.addEventListener(value, requestTooltipPreload, {
        capture: true,
        passive: true,
        once: true,
      });
    }
  }
  function requestTooltipPreload(): void {
    loadTooltipImplementation().catch(() => {
      return;
    });
  }
  function adoptTooltipTrigger(
    input: DeferredTooltipNode,
    options: HTMLElement | null,
  ): void {
    input.node = options;
    if (options === null) {
      return;
    }
    input.adopted = true;
    if (input.handBack) {
      input.handBack = false;
      queueMicrotask(() => restoreDeferredTooltipFocus(input, options));
    }
  }
  function restoreDeferredTooltipFocus(
    input: DeferredTooltipNode,
    element: HTMLElement,
  ): void {
    if (!element.isConnected || !input.focus) {
      return;
    }
    let activeElement = element.ownerDocument.activeElement;
    if (
      activeElement !== null &&
      activeElement !== element.ownerDocument.body
    ) {
      return;
    }
    element.focus({
      preventScroll: true,
    });
  }
  function cancelTooltipTouchHold(input: DeferredTooltipNode): void {
    if (input.tapHold !== null) {
      clearTimeout(input.tapHold);
      input.tapHold = null;
    }
  }
  function releaseTooltipTouchHold(
    input: DeferredTooltipNode,
    options: TooltipPointerEvent,
    context: () => void,
  ): void {
    cancelTooltipTouchHold(input);
    if (
      input.down &&
      options.type === "pointerup" &&
      (options.pointerType === "touch" || options.pointerType === "pen")
    ) {
      input.tapHold = setTimeout(() => {
        input.tapHold = null;
        input.down = false;
        context();
      }, TOUCH_TOOLTIP_HOLD_MS);
      return;
    }
    input.down = false;
    context();
  }
  function resolveTooltipImplementation(
    input: DeferredTooltipScope | null,
  ): TooltipImplementation | null {
    if (loadedTooltipImplementation !== null) {
      return loadedTooltipImplementation;
    }
    if (input === null) {
      return null;
    } else {
      return input.ambientImpl();
    }
  }
  function hasNonVisibleFocus(element: Element): boolean {
    if (element.ownerDocument.activeElement !== element) {
      return false;
    }
    try {
      return !element.matches(":focus-visible");
    } catch {
      return false;
    }
  }
  function useDeferredTooltipImplementation(
    input: boolean,
  ): DeferredTooltipState {
    let value = reactForUiDisclosure4.useContext<TooltipImplementation | null>(
        runtime.tooltipImplementationContext,
      ),
      value2 = reactForUiDisclosure4.useContext(
        deferredTooltipImplementationContext,
      ),
      [value3, value4] =
        reactForUiDisclosure4.useState<DeferredTooltipLoad | null>(() => {
          let value7 =
            value ??
            (value2 !== null && value2.isDeferred()
              ? null
              : resolveTooltipImplementation(value2));
          if (value7 === null) {
            return null;
          } else {
            return {
              impl: value7,
              track: undefined,
            };
          }
        }),
      value5 = value3 === null ? null : value3.impl,
      [value6] = reactForUiDisclosure4.useState(value5 === null),
      ref = reactForUiDisclosure4.useRef<DeferredTooltipNode>({
        hover: false,
        focus: false,
        down: false,
        node: null,
        adopted: false,
        handBack: false,
        tapHold: null,
      }),
      ref2 = reactForUiDisclosure4.useRef(false),
      callback = reactForUiDisclosure4.useCallback(() => {
        if (ref.current.adopted || (value2 !== null && value2.isDeferred())) {
          return;
        }
        let {
          hover: current,
          focus: current2,
          down: current3,
          node: current4,
        } = ref.current;
        if (current3) {
          return;
        }
        let current5 = ref2.current;
        ref2.current = false;
        let value7 =
          current2 &&
          input &&
          current4 !== null &&
          hasNonVisibleFocus(current4);
        if (current2 && !value7) {
          return;
        }
        let value8 = resolveTooltipImplementation(value2);
        if (value8 !== null && (!current || current5)) {
          let current6 = ref.current;
          current6.handBack = value7;
          value4(
            (input2: DeferredTooltipLoad | null) =>
              input2 ?? {
                impl: value8,
                track: input
                  ? (input3: HTMLElement | null) =>
                      adoptTooltipTrigger(current6, input3)
                  : undefined,
              },
          );
        }
      }, [value2, input]),
      callback2 = reactForUiDisclosure4.useCallback(() => {
        if (resolveTooltipImplementation(value2) === null) {
          return;
        }
        scheduleTooltipUpdate(callback);
      }, [value2, callback]),
      callback3 = reactForUiDisclosure4.useCallback(() => {
        ref2.current = resolveTooltipImplementation(value2) !== null;
        callback2();
      }, [callback2, value2]),
      ref3 = reactForUiDisclosure4.useRef<{
        doc: Document;
        release(event: PointerEvent): void;
      } | null>(null),
      callback4 = reactForUiDisclosure4.useCallback(() => {
        let current = ref3.current;
        if (current === null) {
          return;
        }
        ref3.current = null;
        current.doc.removeEventListener("pointerup", current.release, true);
        current.doc.removeEventListener("pointercancel", current.release, true);
      }, []),
      callback5 = reactForUiDisclosure4.useCallback(
        (input2: Document, options?: number) => {
          if (ref3.current !== null) {
            return;
          }
          let callback7 = (input3: PointerEvent): void => {
            let pointerId = input3.pointerId;
            if (
              options !== undefined &&
              pointerId !== undefined &&
              pointerId !== options
            ) {
              return;
            }
            callback4();
            releaseTooltipTouchHold(ref.current, input3, callback2);
          };
          ref3.current = {
            doc: input2,
            release: callback7,
          };
          input2.addEventListener("pointerup", callback7, {
            capture: true,
          });
          input2.addEventListener("pointercancel", callback7, {
            capture: true,
          });
        },
        [callback2, callback4],
      );
    reactForUiDisclosure4.useEffect(() => {
      if (!value6) {
        return;
      }
      preloadTooltipsOnInteraction();
      let current = ref.current,
        callback7 = (): void => {
          cancelTooltipUpdate(callback);
          if (current.tapHold !== null) {
            cancelTooltipTouchHold(current);
            current.down = false;
          }
          callback4();
        },
        items = [],
        value7 = value2 !== null && value2.isDeferred();
      if (value7) {
        items.push(value2!.subscribe(callback3));
      }
      if (loadedTooltipImplementation === null) {
        tooltipImplementationListeners.add(callback2);
        items.push(() => tooltipImplementationListeners.delete(callback2));
      }
      if (!value7 && resolveTooltipImplementation(value2) !== null) {
        if (value2 !== null) {
          ref2.current = true;
        }
        callback2();
      }
      return () => {
        for (let value8 of items) {
          value8();
        }
        callback7();
      };
    }, [callback2, callback3, value2, callback4, callback, value6]);
    let callback6 = reactForUiDisclosure4.useCallback(() => {
      loadTooltipImplementation().catch(() => {
        return;
      });
    }, []);
    return {
      impl: value5,
      wasCold: value6,
      interceptors: reactForUiDisclosure4.useCallback(
        (input2: TooltipTriggerProps) => {
          let callback7 =
            <Event extends React.SyntheticEvent<HTMLElement>>(
              input3: (event: Event) => void,
              options: ((event: Event) => void) | undefined,
            ): ((event: Event) => void) =>
            (input4: Event) => {
              input3(input4);
              options?.(input4);
            };
          return {
            onPointerEnter: callback7(() => {
              ref.current.hover = true;
              callback6();
            }, input2.onPointerEnter),
            onPointerLeave: callback7(() => {
              ref.current.hover = false;
              callback2();
            }, input2.onPointerLeave),
            onPointerDown: callback7(
              (input3: React.PointerEvent<HTMLElement>) => {
                if (input3.isPrimary !== false && input3.button === 0) {
                  cancelTooltipTouchHold(ref.current);
                  ref.current.down = true;
                  callback5(
                    input3.currentTarget.ownerDocument,
                    input3.pointerId,
                  );
                }
              },
              input2.onPointerDown,
            ),
            onPointerUp: callback7(
              (input3: React.PointerEvent<HTMLElement>) => {
                if (input3.isPrimary !== false) {
                  releaseTooltipTouchHold(ref.current, input3, callback2);
                }
              },
              input2.onPointerUp,
            ),
            onPointerCancel: callback7(
              (input3: React.PointerEvent<HTMLElement>) => {
                if (input3.isPrimary !== false) {
                  releaseTooltipTouchHold(ref.current, input3, callback2);
                }
              },
              input2.onPointerCancel,
            ),
            onClick: callback7((input3: React.MouseEvent<HTMLElement>) => {
              if (ref.current.tapHold !== null) {
                releaseTooltipTouchHold(ref.current, input3, callback2);
              }
            }, input2.onClick),
            onFocus: callback7((input3: React.FocusEvent<HTMLElement>) => {
              ref.current.focus = true;
              ref.current.node = (0, runtime.asElement)(
                input3.currentTarget,
              ) as HTMLElement | null;
              callback6();
            }, input2.onFocus),
            onBlur: callback7(() => {
              ref.current.focus = false;
              callback2();
            }, input2.onBlur),
          };
        },
        [callback2, callback5, callback6],
      ),
      trackTrigger: value3?.track,
    };
  }
  function disableElementAutofocus(input: React.ReactNode): React.ReactNode {
    if (reactForUiDisclosure4.isValidElement(input)) {
      return reactForUiDisclosure4.cloneElement(
        input as React.ReactElement<{
          autoFocus?: boolean;
        }>,
        {
          autoFocus: false,
        },
      );
    } else {
      return input;
    }
  }
  function DeferredTooltip(input: TooltipProps): React.ReactElement {
    let {
        impl: value,
        wasCold: value2,
        interceptors: value3,
        trackTrigger: value4,
      } = useDeferredTooltipImplementation(true),
      value5 = input.autoFocus === false;
    if (value !== null) {
      if (value2 || value5) {
        return (
          <value.Tooltip {...input} triggerRef={value4}>
            {disableElementAutofocus(input.children)}
          </value.Tooltip>
        );
      } else {
        return <value.Tooltip {...input} />;
      }
    }
    let { children: value6 } = input;
    if (!reactForUiDisclosure4.isValidElement(value6)) {
      return (
        <jsxForUiDisclosure.Fragment>{value6}</jsxForUiDisclosure.Fragment>
      );
    }
    let value7 = value6 as React.ReactElement<TooltipTriggerProps>;
    return reactForUiDisclosure4.cloneElement(value7, {
      ...value3(value7.props),
      ...pendingTooltipProps,
    });
  }
  function DeferredDisabledReasonTooltip(
    input: DisabledTooltipProps,
  ): React.ReactElement {
    let {
        impl: value,
        wasCold: value2,
        interceptors: value3,
      } = useDeferredTooltipImplementation(false),
      value4 = reactForUiDisclosure4.useId();
    if (value !== null) {
      if (value2) {
        return (
          <value.DisabledReasonTooltip {...input}>
            {disableElementAutofocus(input.children)}
          </value.DisabledReasonTooltip>
        );
      } else {
        return <value.DisabledReasonTooltip {...input} />;
      }
    }
    let { reason: value5, wrapperClassName: value6, children: value7 } = input;
    return (
      <span
        {...(0, runtime.getDisabledReasonWrapperProps)(value5, value4, value6)}
        title={typeof value5 === "string" ? value5 : undefined}
        {...value3({})}
        {...pendingTooltipProps}
      >
        {[
          value7,
          <runtime.DisabledReasonAnnouncement id={value4} reason={value5} />,
        ]}
      </span>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactDOMClientForUiDisclosure",
    () => reactDOMClientForUiDisclosure,
    (value) => {
      reactDOMClientForUiDisclosure = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactArtifactRoot",
    () => reactArtifactRoot,
    (value) => {
      reactArtifactRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiDisclosure",
    () => reactForUiDisclosure,
    (value) => {
      reactForUiDisclosure = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preventRepeatedClickSelection",
    () => preventRepeatedClickSelection,
  );
  bindRuntimeValue(
    runtime,
    "withRepeatedClickSelectionPrevention",
    () => withRepeatedClickSelectionPrevention,
  );
  bindRuntimeValue(
    runtime,
    "repeatedClickSelectionProps",
    () => repeatedClickSelectionProps,
    (value) => {
      repeatedClickSelectionProps = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "react_k",
    () => react_k,
    (value) => {
      react_k = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useHiddenUntilFoundRef",
    () => useHiddenUntilFoundRef,
  );
  bindRuntimeValue(
    runtime,
    "attachBeforeMatchStyleRecovery",
    () => attachBeforeMatchStyleRecovery,
  );
  bindRuntimeValue(runtime, "overrideInlineStyles", () => overrideInlineStyles);
  bindRuntimeValue(
    runtime,
    "reactXk",
    () => reactXk,
    (value) => {
      reactXk = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "disclosurePanelClasses",
    () => disclosurePanelClasses,
    (value) => {
      disclosurePanelClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isHeightTransition",
    () => isHeightTransition,
    (value) => {
      isHeightTransition = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "observeDisclosureAnimation",
    () => observeDisclosureAnimation,
    (value) => {
      observeDisclosureAnimation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useDisclosureAnimationRef",
    () => useDisclosureAnimationRef,
    (value) => {
      useDisclosureAnimationRef = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useDisclosurePanelRef",
    () => useDisclosurePanelRef,
    (value) => {
      useDisclosurePanelRef = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiDisclosure2",
    () => reactForUiDisclosure2,
    (value) => {
      reactForUiDisclosure2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDOMForUiDisclosure",
    () => reactDOMForUiDisclosure,
    (value) => {
      reactDOMForUiDisclosure = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollapsibleRoot",
    () => CollapsibleRoot,
    (value) => {
      CollapsibleRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collapsibleTriggerClasses",
    () => collapsibleTriggerClasses,
    (value) => {
      collapsibleTriggerClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collapsibleIconClasses",
    () => collapsibleIconClasses,
    (value) => {
      collapsibleIconClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollapsibleTrigger",
    () => CollapsibleTrigger,
    (value) => {
      CollapsibleTrigger = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collapsiblePanelClasses",
    () => collapsiblePanelClasses,
    (value) => {
      collapsiblePanelClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollapsiblePanel",
    () => CollapsiblePanel,
    (value) => {
      CollapsiblePanel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Collapsible",
    () => Collapsible,
    (value) => {
      Collapsible = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactcK",
    () => reactcK,
    (value) => {
      reactcK = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxEq",
    () => jsxEq,
    (value) => {
      jsxEq = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "spinnerSizeAliases",
    () => spinnerSizeAliases,
    (value) => {
      spinnerSizeAliases = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "spinnerSizeMetrics",
    () => spinnerSizeMetrics,
    (value) => {
      spinnerSizeMetrics = value;
    },
  );
  bindRuntimeValue(runtime, "Spinner", () => Spinner);
  bindRuntimeValue(
    runtime,
    "DelayedScreenReaderLabel",
    () => DelayedScreenReaderLabel,
  );
  bindRuntimeValue(
    runtime,
    "reactfk",
    () => reactfk,
    (value) => {
      reactfk = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "compactableControlContext",
    () => compactableControlContext,
    (value) => {
      compactableControlContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useCompactableControl",
    () => useCompactableControl,
  );
  bindRuntimeValue(
    runtime,
    "COMPACTABLE_ATTRIBUTE",
    () => COMPACTABLE_ATTRIBUTE,
    (value) => {
      COMPACTABLE_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiDisclosure3",
    () => reactForUiDisclosure3,
    (value) => {
      reactForUiDisclosure3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useCompactableControlDebug",
    () => useCompactableControlDebug,
  );
  bindRuntimeValue(
    runtime,
    "reactForUiDisclosure4",
    () => reactForUiDisclosure4,
    (value) => {
      reactForUiDisclosure4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiDisclosure",
    () => jsxForUiDisclosure,
    (value) => {
      jsxForUiDisclosure = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "loadedTooltipImplementation",
    () => loadedTooltipImplementation,
    (value) => {
      loadedTooltipImplementation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipImplementationPromise",
    () => tooltipImplementationPromise,
    (value) => {
      tooltipImplementationPromise = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipImplementationListeners",
    () => tooltipImplementationListeners,
    (value) => {
      tooltipImplementationListeners = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipBatchTimer",
    () => tooltipBatchTimer,
    (value) => {
      tooltipBatchTimer = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipBatchCallbacks",
    () => tooltipBatchCallbacks,
    (value) => {
      tooltipBatchCallbacks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "scheduleTooltipUpdate",
    () => scheduleTooltipUpdate,
  );
  bindRuntimeValue(runtime, "cancelTooltipUpdate", () => cancelTooltipUpdate);
  bindRuntimeValue(
    runtime,
    "loadTooltipImplementation",
    () => loadTooltipImplementation,
  );
  bindRuntimeValue(
    runtime,
    "tooltipPreloadEvents",
    () => tooltipPreloadEvents,
    (value) => {
      tooltipPreloadEvents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipPreloadStarted",
    () => tooltipPreloadStarted,
    (value) => {
      tooltipPreloadStarted = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preloadTooltipsOnInteraction",
    () => preloadTooltipsOnInteraction,
  );
  bindRuntimeValue(
    runtime,
    "requestTooltipPreload",
    () => requestTooltipPreload,
  );
  bindRuntimeValue(runtime, "adoptTooltipTrigger", () => adoptTooltipTrigger);
  bindRuntimeValue(
    runtime,
    "restoreDeferredTooltipFocus",
    () => restoreDeferredTooltipFocus,
  );
  bindRuntimeValue(
    runtime,
    "pendingTooltipProps",
    () => pendingTooltipProps,
    (value) => {
      pendingTooltipProps = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOUCH_TOOLTIP_HOLD_MS",
    () => TOUCH_TOOLTIP_HOLD_MS,
    (value) => {
      TOUCH_TOOLTIP_HOLD_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cancelTooltipTouchHold",
    () => cancelTooltipTouchHold,
  );
  bindRuntimeValue(
    runtime,
    "releaseTooltipTouchHold",
    () => releaseTooltipTouchHold,
  );
  bindRuntimeValue(
    runtime,
    "resolveTooltipImplementation",
    () => resolveTooltipImplementation,
  );
  bindRuntimeValue(
    runtime,
    "deferredTooltipImplementationContext",
    () => deferredTooltipImplementationContext,
    (value) => {
      deferredTooltipImplementationContext = value;
    },
  );
  bindRuntimeValue(runtime, "hasNonVisibleFocus", () => hasNonVisibleFocus);
  bindRuntimeValue(
    runtime,
    "useDeferredTooltipImplementation",
    () => useDeferredTooltipImplementation,
  );
  bindRuntimeValue(
    runtime,
    "disableElementAutofocus",
    () => disableElementAutofocus,
  );
  bindRuntimeValue(runtime, "DeferredTooltip", () => DeferredTooltip);
  bindRuntimeValue(
    runtime,
    "DeferredDisabledReasonTooltip",
    () => DeferredDisabledReasonTooltip,
  );
  return () => {
    reactDOMClientForUiDisclosure = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomClientNamespace)(),
      1,
    );
    reactArtifactRoot = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactForUiDisclosure = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeCdsRoot)();
    (0, runtime.initializeLayers)();
    (0, runtime.initializeIcons)();
    (0, runtime.initializeShortcuts)();
    (0, runtime.initializeTooltip)();
    (0, runtime.initializeClassNames)();
    repeatedClickSelectionProps = Object.freeze({
      onMouseDown: preventRepeatedClickSelection,
    });
    (0, runtime.initializeMergedRefs)();
    react_k = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactXk = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    disclosurePanelClasses =
      "break-words h-[var(--cds-disclosure-panel-height)] transition-[height] duration-base ease-out motion-reduce:transition-none data-[starting-style]:h-0 data-[ending-style]:h-0 data-[starting-style]:[clip-path:inset(-8px_-100vw_0_-100vw)] data-[ending-style]:[clip-path:inset(-8px_-100vw_0_-100vw)] data-[animating]:[clip-path:inset(-8px_-100vw_0_-100vw)] data-[starting-style]:contain-layout data-[ending-style]:contain-layout data-[animating]:contain-layout";
    isHeightTransition = (input: Animation) =>
      "transitionProperty" in input && input.transitionProperty === "height";
    observeDisclosureAnimation = (element: HTMLElement) => {
      let callback = () => {
          let value2 =
            element.hasAttribute("data-starting-style") ||
            element.hasAttribute("data-ending-style") ||
            (element.getAnimations?.().some(isHeightTransition) ?? false);
          element.toggleAttribute("data-animating", value2);
        },
        value = new (element.ownerDocument.defaultView?.MutationObserver ??
          MutationObserver)(callback);
      value.observe(element, {
        attributeFilter: ["data-starting-style", "data-ending-style"],
      });
      callback();
      let callback2 = (event: TransitionEvent) => {
          if (event.target === element && event.propertyName === "height") {
            element.setAttribute("data-animating", "");
          }
        },
        callback3 = (event: TransitionEvent) => {
          if (event.target === element && event.propertyName === "height") {
            callback();
          }
        };
      element.addEventListener("transitionrun", callback2);
      element.addEventListener("transitionend", callback3);
      element.addEventListener("transitioncancel", callback3);
      return () => {
        value.disconnect();
        element.removeEventListener("transitionrun", callback2);
        element.removeEventListener("transitionend", callback3);
        element.removeEventListener("transitioncancel", callback3);
        element.removeAttribute("data-animating");
      };
    };
    useDisclosureAnimationRef = () => {
      let ref = reactXk.useRef<(() => void) | null>(null);
      return reactXk.useCallback((input: HTMLElement | null) => {
        ref.current?.();
        ref.current = input ? observeDisclosureAnimation(input) : null;
      }, []);
    };
    useDisclosurePanelRef = (input: React.Ref<HTMLElement> | undefined) =>
      (0, runtime.useMergedRefs)(
        input,
        useDisclosureAnimationRef(),
        useHiddenUntilFoundRef(),
      );
    (0, runtime.initializeIcons)();
    reactForUiDisclosure2 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactDOMForUiDisclosure = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    CollapsibleRoot = reactForUiDisclosure2.forwardRef(
      (
        input: CollapsibleRootProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement => (
        <runtime.baseCollapsible.Root
          ref={options}
          data-cds={"Collapsible"}
          {...input}
        />
      ),
    );
    CollapsibleRoot.displayName = "Collapsible.Root";
    collapsibleTriggerClasses =
      "cds-reset group/clp inline-flex w-fit items-center gap-1.5 border-0 select-none outline-none focus-visible:outline-hidden font-sans text-body font-normal text-secondary hover:text-primary transition-shadow duration-fast focus-visible:shadow-focus rounded data-[disabled]:opacity-disabled data-[disabled]:pointer-events-none";
    collapsibleIconClasses =
      "shrink-0 transition-transform rtl:rotate-180 group-data-[panel-open]/clp:rotate-90";
    CollapsibleTrigger = reactForUiDisclosure2.forwardRef(
      (
        {
          className: className,
          children: children,
          caretPosition: caretPosition,
          hideCaret: hideCaret,
          render: render,
          ...props
        }: CollapsibleTriggerProps,
        options: React.ForwardedRef<HTMLButtonElement>,
      ): React.ReactElement => {
        let value = withRepeatedClickSelectionPrevention(props.onMouseDown),
          value2 = hideCaret ? null : (
            <runtime.Icon
              name={"CaretRight"}
              size={"sm"}
              className={(0, runtime.clsx)(
                collapsibleIconClasses,
                caretPosition === "end" && "ms-auto",
              )}
            />
          );
        if (render) {
          return (
            <runtime.baseCollapsible.Trigger
              ref={options}
              render={render}
              className={className}
              {...props}
              onMouseDown={value}
            />
          );
        } else {
          return (
            <runtime.baseCollapsible.Trigger
              ref={options}
              {...props}
              className={(0, runtime.cn)(collapsibleTriggerClasses, className)}
              onMouseDown={value}
            >
              {[
                caretPosition !== "end" && value2,
                children,
                caretPosition === "end" && value2,
              ]}
            </runtime.baseCollapsible.Trigger>
          );
        }
      },
    );
    CollapsibleTrigger.displayName = "Collapsible.Trigger";
    collapsiblePanelClasses = `${disclosurePanelClasses} [--cds-disclosure-panel-height:var(--collapsible-panel-height)]`;
    CollapsiblePanel = reactForUiDisclosure2.forwardRef(
      (
        { className: className, ...props }: CollapsiblePanelProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement => {
        let value = useDisclosurePanelRef(options);
        return (
          <runtime.baseCollapsible.Panel
            ref={value}
            {...props}
            className={(0, runtime.cn)(collapsiblePanelClasses, className)}
          />
        );
      },
    );
    CollapsiblePanel.displayName = "Collapsible.Panel";
    Collapsible = {
      Root: CollapsibleRoot,
      Trigger: CollapsibleTrigger,
      Panel: CollapsiblePanel,
    };
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeRemScale)();
    reactcK = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxEq = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    spinnerSizeAliases = {
      s: "sm",
      m: "md",
      l: "lg",
    };
    spinnerSizeMetrics = {
      sm: {
        box: 12,
        stroke: 1.5,
      },
      md: {
        box: 16,
        stroke: 1.75,
      },
      lg: {
        box: 20,
        stroke: 2,
      },
    };
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeCdsLink)();
    (0, runtime.initializeCdsRoot)();
    (0, runtime.initializeRemScale)();
    (0, runtime.initializeIcons)();
    (0, runtime.initializeShortcuts)();
    (0, runtime.initializeDisabledReasonDebug)();
    (0, runtime.initializeTooltipContext)();
    reactfk = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    compactableControlContext = reactfk.createContext<CompactableControlState>({
      compact: false,
    });
    COMPACTABLE_ATTRIBUTE = "data-cds-compactable";
    reactForUiDisclosure3 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeElementAccess)();
    (0, runtime.initializeDisabledReason)();
    (0, runtime.initializeTooltipContext)();
    reactForUiDisclosure4 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxForUiDisclosure = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    loadedTooltipImplementation = null;
    tooltipImplementationPromise = null;
    tooltipImplementationListeners = new Set();
    tooltipBatchTimer = null;
    tooltipBatchCallbacks = new Set();
    tooltipPreloadEvents = ["pointermove", "keydown", "touchstart"];
    tooltipPreloadStarted = false;
    pendingTooltipProps = {
      "data-cds-tooltip-pending": "",
    };
    TOUCH_TOOLTIP_HOLD_MS = 700;
    deferredTooltipImplementationContext =
      reactForUiDisclosure4.createContext<DeferredTooltipScope | null>(null);
  };
}
