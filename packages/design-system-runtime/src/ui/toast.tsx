import type * as React from "react";
import type {
  ToastVariant,
  ToastData,
  ToastObject,
  PinnedToast,
  ToastMovementState,
  PinnedToastContext,
  ToastNotification,
  ToastProviderProps,
  ToastNotifications,
} from "../contracts/overlays";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiToast(runtime: RuntimeBindings): () => void {
  var reactForUiToast: typeof React;
  var jsxForUiToast: typeof import("react/jsx-runtime");
  var DEFAULT_TOAST_TIMEOUT_MS: number;
  var TOAST_TRANSITION_TIMEOUT_MS: number;
  var toastSurfaceClasses: string;
  var toastVariantClasses: Record<ToastVariant, string>;
  var toastVariantTextClasses: Record<ToastVariant, string>;
  var toastDefaultIconNames: Record<ToastVariant, string>;
  var toastSecondaryTextClasses: Record<ToastVariant, string>;
  var toastStackTransformClasses: string;
  var toastContentClasses: string;
  var toastBodyClasses: string;
  var toastDismissButtonClasses: string;
  var emptyToastList: Array<"up" | "down" | "left" | "right">;
  var pinnedToastContext: React.Context<PinnedToastContext | null>;
  var noopToastPinSetter: (toast: PinnedToast | null) => void;
  function normalizeToastTimeout(timeout?: number): number | undefined {
    if (timeout === undefined || timeout <= 0) {
      return timeout;
    }
    if (!Number.isFinite(timeout)) {
      return 0;
    }
    if (timeout < 6000) {
      return DEFAULT_TOAST_TIMEOUT_MS;
    }
    return timeout;
  }
  function ToastView({
    toast: toast,
    front: front,
    frontHeight: frontHeight,
    zIndex: zIndex,
  }: {
    toast: ToastObject;
    front: boolean;
    frontHeight?: number;
    zIndex: number;
  }): React.ReactElement {
    let value =
        toast.data?.variant ??
        (toast.type as ToastVariant | undefined) ??
        "neutral",
      value2 = toast.data?.icon,
      value3 =
        value2 !== null && value2 !== undefined && typeof value2 !== "boolean",
      value4 = !front,
      value5 = value4 && frontHeight ? frontHeight : undefined,
      value6 = (0, runtime.useTranslation)("dismiss", "Dismiss"),
      { update: value7 } = runtime.baseToast.useToastManager<ToastData>(),
      value8 = reactForUiToast.useContext(pinnedToastContext),
      ref = reactForUiToast.useRef<HTMLElement | null>(null),
      ref2 = reactForUiToast.useRef(""),
      value9 = toast.data?.titleNode,
      value10 = toast.data?.count ?? 1,
      id = toast.id,
      callback = () => {
        let value16 = value8?.userDismissAt,
          value17 = Date.now();
        for (let [value18, value19] of value16 ?? []) {
          if (value17 - value19 > TOAST_TRANSITION_TIMEOUT_MS) {
            value16?.delete(value18);
          }
        }
        value16?.set(id, value17);
      };
    reactForUiToast.useLayoutEffect(() => {
      let current = ref.current;
      if (value9 === undefined || !current) {
        return;
      }
      let callback2 = () => {
        let value16 = current.textContent ?? "";
        if (value16 !== ref2.current) {
          ref2.current = value16;
          value7(id, {
            title: value16,
          });
        }
      };
      callback2();
      let observer = new MutationObserver(callback2);
      observer.observe(current, {
        characterData: true,
        childList: true,
        subtree: true,
      });
      return () => observer.disconnect();
    }, [value9, id, value7]);
    let value11 = toast.transitionStatus === "ending",
      [value12, value13] = reactForUiToast.useState({
        behind: value4,
        lockedHeight: value5,
      });
    if (
      !value11 &&
      (value12.behind !== value4 || value12.lockedHeight !== value5)
    ) {
      value13({
        behind: value4,
        lockedHeight: value5,
      });
    }
    let value14 = value11 ? value12.behind : value4,
      value15 = value11 ? value12.lockedHeight : value5;
    return (
      <runtime.baseToast.Root
        toast={toast}
        swipeDirection={emptyToastList}
        className={toastStackTransformClasses}
        style={{
          zIndex: zIndex,
        }}
        onKeyDown={(input: React.KeyboardEvent<HTMLDivElement>) => {
          if (
            input.key === "Escape" &&
            input.currentTarget.contains(
              input.currentTarget.ownerDocument.activeElement,
            )
          ) {
            callback();
          }
        }}
      >
        <div
          className={`${toastSurfaceClasses} ${toastVariantClasses[value]} ${toastVariantTextClasses[value]}`}
        >
          <div
            className={toastContentClasses}
            data-behind={value14 ? "" : undefined}
            style={
              value15 !== undefined
                ? {
                    height: value15,
                  }
                : undefined
            }
          >
            {[
              value2 !== null && (
                <span
                  className={`shrink-0 ${toastSecondaryTextClasses[value]}`}
                >
                  {value3 ? (
                    value2
                  ) : (
                    <runtime.Icon
                      name={toastDefaultIconNames[value]}
                      size={"md"}
                    />
                  )}
                </span>
              ),
              <div className={toastBodyClasses}>
                {[
                  <runtime.baseToast.Title
                    className={"font-medium"}
                    aria-atomic={"true"}
                  >
                    {[
                      <span ref={ref}>{value9 ?? toast.data?.baseTitle}</span>,
                      value10 > 1 && (
                        <span
                          aria-live={value10 > 2 ? "off" : undefined}
                          data-cds-toast-count={""}
                        >{` (×${value10})`}</span>
                      ),
                    ]}
                  </runtime.baseToast.Title>,
                  <runtime.baseToast.Description />,
                  toast.data?.action && (
                    <div className={"mt-pad-md empty:hidden"}>
                      {toast.data.action}
                    </div>
                  ),
                ]}
              </div>,
              <runtime.baseToast.Close
                aria-label={value6}
                className={toastDismissButtonClasses}
                onClick={callback}
              >
                <runtime.Icon name={"X"} size={"sm"} />
              </runtime.baseToast.Close>,
            ]}
          </div>
        </div>
      </runtime.baseToast.Root>
    );
  }
  function PinnedToastView({
    pinned: pinned,
    onDismiss: onDismiss,
  }: {
    pinned: PinnedToast;
    onDismiss(): void;
  }): React.ReactElement {
    let value = pinned.variant ?? "neutral",
      value2 = (0, runtime.useTranslation)("dismiss", "Dismiss");
    return (
      <div
        data-pinned={""}
        className={`pointer-events-auto relative w-full ${toastSurfaceClasses} ${toastVariantClasses[value]} ${toastVariantTextClasses[value]}`}
      >
        <div className={toastContentClasses}>
          {[
            <span className={`shrink-0 ${toastSecondaryTextClasses[value]}`}>
              <runtime.Icon name={toastDefaultIconNames[value]} size={"md"} />
            </span>,
            <div className={toastBodyClasses}>
              {[
                <div className={"font-medium"}>{pinned.title}</div>,
                pinned.description && <div>{pinned.description}</div>,
                pinned.action && (
                  <div className={"mt-pad-md empty:hidden"}>
                    {pinned.action}
                  </div>
                ),
              ]}
            </div>,
            pinned.dismissible && (
              <button
                type={"button"}
                aria-label={pinned.dismissLabel ?? value2}
                onClick={onDismiss}
                className={toastDismissButtonClasses}
              >
                <runtime.Icon name={"X"} size={"sm"} />
              </button>
            ),
          ]}
        </div>
      </div>
    );
  }
  function containsVisibleFocus(
    input: HTMLElement | null | undefined,
  ): boolean {
    let value = input?.ownerDocument.activeElement;
    if (!input || !value || !input.contains(value)) {
      return false;
    }
    try {
      return value.matches(":focus-visible");
    } catch {
      return true;
    }
  }
  function PinnedToastSlot({
    ctx: ctx,
  }: {
    ctx: PinnedToastContext;
  }): React.ReactElement {
    let {
        pinned: value,
        setPinned: value2,
        slotRef: value3,
        focusWasInsideRef: value4,
      } = ctx,
      ref = reactForUiToast.useRef<HTMLElement | null>(null);
    reactForUiToast.useEffect(() => {
      let current = value3.current;
      if (!current) {
        return;
      }
      let ownerDocument = current.ownerDocument,
        callback = (event: FocusEvent) => {
          let target = event.target as HTMLElement | null;
          if (
            target &&
            typeof target.focus === "function" &&
            !current.contains(target)
          ) {
            ref.current = target;
          }
        };
      ownerDocument.addEventListener("focusin", callback);
      return () => ownerDocument.removeEventListener("focusin", callback);
    }, [value3]);
    reactForUiToast.useLayoutEffect(() => {
      let current = value3.current;
      if (!current || !value4.current) {
        return;
      }
      value4.current = false;
      if (current.contains(current.ownerDocument.activeElement)) {
        return;
      }
      let current2 = ref.current;
      if (current2?.isConnected) {
        current2.focus({
          preventScroll: true,
        });
      }
    }, [value, value3, value4]);
    return (
      <div
        ref={(input: HTMLElement | null) => {
          value3.current = input;
        }}
        role={"status"}
        className={value ? "w-full" : "sr-only"}
        onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
          if (
            event.key === "Escape" &&
            !event.defaultPrevented &&
            !event.nativeEvent.isComposing &&
            value?.dismissible &&
            event.currentTarget.contains(
              event.currentTarget.ownerDocument.activeElement,
            )
          ) {
            value2(null);
          }
        }}
      >
        {value && (
          <PinnedToastView pinned={value} onDismiss={() => value2(null)} />
        )}
      </div>
    );
  }
  function ToastViewport({
    className: className,
  }: {
    className?: string;
  }): React.ReactElement {
    let { toasts: value } = runtime.baseToast.useToastManager<ToastData>(),
      value2 = reactForUiToast.useContext(pinnedToastContext);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      value2?.syncLiveToasts(value);
    }, [value, value2]);
    let value3 = value.find(
      (input: ToastObject) => input.transitionStatus !== "ending",
    );
    return (
      <runtime.baseToast.Portal>
        <runtime.PortalRoot surface={runtime.elevationSurfaceNames.popover}>
          <runtime.CdsLayer
            base={runtime.TOAST_LAYER_BASE}
            render={
              <div
                data-cds={"Toast"}
                className={(0, runtime.cn)(
                  "cds-reset pointer-events-none fixed right-4 bottom-4 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col-reverse gap-md",
                  className,
                )}
              />
            }
          >
            {[
              value2 && <PinnedToastSlot ctx={value2} />,
              <runtime.baseToast.Viewport
                className={
                  "pointer-events-auto relative outline-none focus-visible:outline-hidden"
                }
                style={{
                  height: value3?.height,
                }}
              >
                {value.map((input: ToastObject, options: number) =>
                  (() => {
                    const _Element = ToastView;
                    const _elementProps = {
                      toast: input,
                      front: input === value3,
                      frontHeight: value3?.height,
                      zIndex: value.length - options,
                    };
                    const _elementKey = input.id;
                    return <_Element key={_elementKey} {..._elementProps} />;
                  })(),
                )}
              </runtime.baseToast.Viewport>,
            ]}
          </runtime.CdsLayer>
        </runtime.PortalRoot>
      </runtime.baseToast.Portal>
    );
  }
  function createToastMovementState(): ToastMovementState {
    let nextId = 0;
    return {
      allocId: () => `cds-toast-${++nextId}`,
      movingIds: new Set(),
      userDismissAt: new Map(),
    };
  }
  function ToastProvider({
    children: children,
    timeout = DEFAULT_TOAST_TIMEOUT_MS,
    limit: limit,
    viewportClassName: viewportClassName,
  }: ToastProviderProps): React.ReactElement {
    let [value, value2] = reactForUiToast.useState<PinnedToast | null>(null),
      ref = reactForUiToast.useRef(value),
      ref2 = reactForUiToast.useRef<HTMLElement | null>(null),
      ref3 = reactForUiToast.useRef(false),
      callback = reactForUiToast.useCallback((input: PinnedToast | null) => {
        let current = ref.current;
        ref.current = input;
        if (current !== input && !ref3.current) {
          ref3.current = containsVisibleFocus(ref2.current);
        }
        value2(input);
        if (current && current !== input) {
          current.onClose?.();
        }
      }, []),
      ref4 = reactForUiToast.useRef<ToastObject[]>([]),
      callback2 = reactForUiToast.useCallback((input: ToastObject[]) => {
        ref4.current = input;
      }, []),
      [value3] = reactForUiToast.useState(createToastMovementState),
      memo = reactForUiToast.useMemo(
        () => normalizeToastTimeout(timeout),
        [timeout],
      ),
      memo2 = reactForUiToast.useMemo(
        () => ({
          pinned: value,
          setPinned: callback,
          slotRef: ref2,
          focusWasInsideRef: ref3,
          liveToasts: ref4,
          syncLiveToasts: callback2,
          defaultTimeout: memo,
          ...value3,
        }),
        [value, callback, callback2, memo, value3],
      );
    return (
      <runtime.baseToast.Provider timeout={memo} limit={limit}>
        <pinnedToastContext.Provider value={memo2}>
          {[children, <ToastViewport className={viewportClassName} />]}
        </pinnedToastContext.Provider>
      </runtime.baseToast.Provider>
    );
  }
  function useToastNotifications(): ToastNotifications {
    let value = runtime.baseToast.useToastManager<ToastData>(),
      value2 = reactForUiToast.useContext(pinnedToastContext);
    return {
      add: reactForUiToast.useCallback(
        ({
          title: title,
          description: description,
          variant: variant,
          icon: icon,
          action: action,
          timeout: timeout,
          onClose: onClose,
          dedupe = false,
          dedupeKey: dedupeKey,
        }: ToastNotification) => {
          let value3 = variant ?? "neutral",
            value4 = typeof title === "string",
            value5 = dedupeKey ?? (value4 ? (title as string) : undefined),
            state = {
              titleNode: value4 ? undefined : title,
              baseTitle: value4 ? (title as string) : undefined,
            },
            value6 = Date.now(),
            callback = (input: number | undefined) => {
              let value11 = input ?? value2?.defaultTimeout;
              if (value11 !== undefined && value11 > 0) {
                return value6 + value11;
              } else {
                return undefined;
              }
            };
          if (dedupe && value5 !== undefined) {
            let value11 = value2?.liveToasts.current ?? value.toasts,
              value12 = value11.find(
                (input: ToastObject) =>
                  input.data?.dedupeKey === value5 &&
                  input.transitionStatus !== "ending",
              );
            if (value12) {
              let value13 = (value12.data?.count ?? 1) + 1,
                value14 = action ?? value12.data?.action,
                value15 =
                  Boolean(value12.data?.action) ||
                  (value12.timeout ?? value2?.defaultTimeout) === 0,
                value16 =
                  timeout === undefined
                    ? undefined
                    : normalizeToastTimeout(timeout),
                value17 = value14 ? 0 : value15 ? undefined : value16,
                state4 = {
                  ...value12.data,
                  ...state,
                  variant: variant ?? value12.data?.variant,
                  ...(icon !== undefined && {
                    icon: icon,
                  }),
                  action: value14,
                  count: value13,
                  ...(value17 !== undefined && {
                    expiresAt: callback(value17),
                  }),
                },
                value18 = value4 ? title : value12.title,
                value19 =
                  value13 === 2 && typeof value18 === "string"
                    ? `${value18} (×2)`
                    : value4 && title !== value12.data?.baseTitle
                      ? title
                      : undefined,
                value20 = value11.find(
                  (input: ToastObject) => input.transitionStatus !== "ending",
                ),
                value21 =
                  typeof document !== "undefined" &&
                  Boolean(
                    document.activeElement?.closest('[data-cds="Toast"]'),
                  );
              if (
                !value2 ||
                value21 ||
                (value20?.id === value12.id && !value12.limited)
              ) {
                value.update(value12.id, {
                  ...(value19 !== undefined && {
                    title: value19,
                  }),
                  description: description,
                  ...(value17 !== undefined && {
                    timeout: value17,
                  }),
                  data: state4,
                });
                value2?.syncLiveToasts(
                  value11.map((input: ToastObject) =>
                    input.id === value12.id
                      ? {
                          ...input,
                          data: state4,
                          timeout: value17 ?? input.timeout,
                        }
                      : input,
                  ),
                );
                return value12.id;
              }
              let value22 =
                  state4.expiresAt === undefined
                    ? 0
                    : Math.max(state4.expiresAt - value6, 1),
                value23 = value17 ?? (value15 ? 0 : Math.max(value22, 6000)),
                state5 = {
                  ...value12,
                  title: value19 ?? value12.title,
                  description: description,
                  timeout: value23,
                  limited: false,
                  data: {
                    ...state4,
                    expiresAt: callback(value23),
                  },
                };
              value2.movingIds.add(value12.id);
              value.close(value12.id);
              value2.movingIds.delete(value12.id);
              value.add({
                id: state5.id,
                title: state5.title,
                description: description,
                type: state5.type,
                priority: state5.priority,
                timeout: value23,
                onClose: state5.onClose,
                data: state5.data,
              });
              value2.syncLiveToasts([
                state5,
                ...value2.liveToasts.current.filter(
                  (input: ToastObject) => input.id !== value12.id,
                ),
              ]);
              return value12.id;
            }
          }
          let value7 = Boolean(action),
            value8 = value2?.allocId(),
            value9 = value7 ? 0 : normalizeToastTimeout(timeout),
            state2 = {
              variant: value3,
              icon: icon,
              action: action,
              ...state,
              dedupeKey: value5,
              count: 1,
              expiresAt: callback(value9),
            },
            state3: import("@base-ui/react/toast").ToastManagerAddOptions<ToastData> =
              {
                id: value8,
                title: value4 ? title : undefined,
                description: description,
                type: value3,
                timeout: value9,
                onClose: () => {
                  if (value8 === undefined || !value2) {
                    onClose?.({
                      byUser: false,
                    });
                    return;
                  }
                  if (value2.movingIds.has(value8)) {
                    return;
                  }
                  value2.syncLiveToasts(
                    value2.liveToasts.current.map((input: ToastObject) =>
                      input.id === value8
                        ? {
                            ...input,
                            transitionStatus: "ending",
                          }
                        : input,
                    ),
                  );
                  let entry = value2.userDismissAt.get(value8);
                  value2.userDismissAt.delete(value8);
                  onClose?.({
                    byUser:
                      entry !== undefined &&
                      Date.now() - entry < TOAST_TRANSITION_TIMEOUT_MS,
                  });
                },
                priority: value3 === "danger" ? "high" : "low",
                data: state2,
              },
            value10 = value.add(state3);
          value2?.syncLiveToasts([
            {
              ...state3,
              id: value10,
            },
            ...value2.liveToasts.current,
          ]);
          return value10;
        },
        [value, value2],
      ),
      close: value.close,
      setPinned: value2?.setPinned ?? noopToastPinSetter,
    };
  }
  bindRuntimeValue(
    runtime,
    "reactForUiToast",
    () => reactForUiToast,
    (value) => {
      reactForUiToast = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiToast",
    () => jsxForUiToast,
    (value) => {
      jsxForUiToast = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_TOAST_TIMEOUT_MS",
    () => DEFAULT_TOAST_TIMEOUT_MS,
    (value) => {
      DEFAULT_TOAST_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOAST_TRANSITION_TIMEOUT_MS",
    () => TOAST_TRANSITION_TIMEOUT_MS,
    (value) => {
      TOAST_TRANSITION_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeToastTimeout",
    () => normalizeToastTimeout,
  );
  bindRuntimeValue(
    runtime,
    "toastSurfaceClasses",
    () => toastSurfaceClasses,
    (value) => {
      toastSurfaceClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastVariantClasses",
    () => toastVariantClasses,
    (value) => {
      toastVariantClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastVariantTextClasses",
    () => toastVariantTextClasses,
    (value) => {
      toastVariantTextClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastDefaultIconNames",
    () => toastDefaultIconNames,
    (value) => {
      toastDefaultIconNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastSecondaryTextClasses",
    () => toastSecondaryTextClasses,
    (value) => {
      toastSecondaryTextClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastStackTransformClasses",
    () => toastStackTransformClasses,
    (value) => {
      toastStackTransformClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastContentClasses",
    () => toastContentClasses,
    (value) => {
      toastContentClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastBodyClasses",
    () => toastBodyClasses,
    (value) => {
      toastBodyClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastDismissButtonClasses",
    () => toastDismissButtonClasses,
    (value) => {
      toastDismissButtonClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyToastList",
    () => emptyToastList,
    (value) => {
      emptyToastList = value;
    },
  );
  bindRuntimeValue(runtime, "ToastView", () => ToastView);
  bindRuntimeValue(
    runtime,
    "pinnedToastContext",
    () => pinnedToastContext,
    (value) => {
      pinnedToastContext = value;
    },
  );
  bindRuntimeValue(runtime, "PinnedToastView", () => PinnedToastView);
  bindRuntimeValue(runtime, "containsVisibleFocus", () => containsVisibleFocus);
  bindRuntimeValue(runtime, "PinnedToastSlot", () => PinnedToastSlot);
  bindRuntimeValue(runtime, "ToastViewport", () => ToastViewport);
  bindRuntimeValue(
    runtime,
    "createToastMovementState",
    () => createToastMovementState,
  );
  bindRuntimeValue(runtime, "ToastProvider", () => ToastProvider);
  bindRuntimeValue(
    runtime,
    "noopToastPinSetter",
    () => noopToastPinSetter,
    (value) => {
      noopToastPinSetter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useToastNotifications",
    () => useToastNotifications,
  );
  return () => {
    (0, runtime.initializeIsomorphicLayoutEffect)();
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeTranslations)();
    (0, runtime.initializeLayers)();
    (0, runtime.initializePortalRoot)();
    (0, runtime.initializeIcons)();
    (0, runtime.initializeSurfaces)();
    reactForUiToast = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxForUiToast = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    DEFAULT_TOAST_TIMEOUT_MS = 6000;
    TOAST_TRANSITION_TIMEOUT_MS = 1000;
    toastSurfaceClasses = (0, runtime.getSurfaceClasses)("popover");
    toastVariantClasses = {
      neutral: "shadow-panel-md",
      warning:
        "shadow-ring-warning [background-image:linear-gradient(0deg,var(--cds-bg-warning),var(--cds-bg-warning))]",
      danger:
        "shadow-ring-danger [background-image:linear-gradient(0deg,var(--cds-bg-danger),var(--cds-bg-danger))]",
    };
    toastVariantTextClasses = {
      neutral: "text-primary",
      warning: "text-warning",
      danger: "text-danger",
    };
    toastDefaultIconNames = {
      neutral: "Info",
      warning: "Warning",
      danger: "WarningCircle",
    };
    toastSecondaryTextClasses = {
      neutral: "text-secondary",
      warning: "",
      danger: "",
    };
    toastStackTransformClasses =
      "absolute w-full bottom-0 right-0 origin-bottom [--ty:calc(var(--toast-index)_*_-14px)] [--ts:calc(1_-_var(--toast-index)_*_0.04)] [transform:translateY(var(--ty))_scale(var(--ts))] transition-[transform,opacity] duration-base ease-out motion-reduce:transition-none data-[starting-style]:opacity-0 data-[starting-style]:[--ty:100%] data-[ending-style]:opacity-0 data-[ending-style]:[--ts:0.85] data-[limited]:opacity-0";
    toastContentClasses =
      "flex items-start gap-sm px-lg py-md overflow-hidden rounded-[inherit] text-body font-normal transition-[opacity,visibility] duration-base ease-out motion-reduce:transition-none data-[behind]:invisible data-[behind]:opacity-0";
    toastBodyClasses = "min-w-0 flex-1 text-pretty break-words";
    toastDismissButtonClasses =
      "cds-reset -mx-1 -mb-1 -mt-0.5 shrink-0 rounded p-1 outline-none focus-visible:outline-hidden transition duration-fast hover:bg-fill-ghost-hover focus-visible:shadow-focus";
    emptyToastList = [];
    pinnedToastContext =
      reactForUiToast.createContext<PinnedToastContext | null>(null);
    noopToastPinSetter = () => {
      return;
    };
  };
}
