/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsToastToast(runtime: RuntimeBindings): () => void {
  var reactToastToast: Dynamic;
  var jsxToastToast: Dynamic;
  var ToastToastConstant: Dynamic;
  var ToastToastLimit: Dynamic;
  var popupSurfaceClassNameValue: Dynamic;
  var ToastToastNeutralWarningDangerConfig: Dynamic;
  var ToastToastNeutralWarningDangerConfig_2: Dynamic;
  var ToastToastNeutralWarningDangerConfig_3: Dynamic;
  var ToastToastNeutralWarningDangerConfig_4: Dynamic;
  var toastViewportClasses: Dynamic;
  var ToastToastClassNames: Dynamic;
  var ToastToastClassNames_2: Dynamic;
  var ToastToastClassNames_3: Dynamic;
  var ToastToastItems: Dynamic;
  var ToastContext: Dynamic;
  var ToastToastHandler: Dynamic;
  var initializeToastToast: Dynamic;
  function normalizeToastTimeout(input?: Dynamic): Dynamic {
    return input === undefined || input <= 0
      ? input
      : Number.isFinite(input)
        ? input < 6e3
          ? ToastToastConstant
          : input
        : 0;
  }
  function ToastCard({
    toast: toast,
    front: front,
    frontHeight: frontHeight,
    zIndex: zIndex,
  }: Dynamic): Dynamic {
    let value: Dynamic = toast.data?.variant ?? toast.type ?? "neutral",
      value2: Dynamic = toast.data?.icon,
      value3: Dynamic = value2 != null && typeof value2 != "boolean",
      value4: Dynamic = !front,
      value5: Dynamic = value4 && frontHeight ? frontHeight : undefined,
      value6: Dynamic = (0, runtime.useLabel)("dismiss", "Dismiss"),
      { update: value7 }: Dynamic = runtime.npm_Toast_Ty.useToastManager(),
      value8: Dynamic = (0, reactToastToast.useContext)(ToastContext),
      value9: Dynamic = (0, reactToastToast.useRef)(null),
      value10: Dynamic = (0, reactToastToast.useRef)(""),
      value11: Dynamic = toast.data?.titleNode,
      value12: Dynamic = toast.data?.count ?? 1,
      id: Dynamic = toast.id,
      callback: Dynamic = (): Dynamic => {
        let value18: Dynamic = value8?.userDismissAt,
          value19: Dynamic = Date.now();
        for (let [value20, value21] of (value18 ?? []) as Dynamic)
          value19 - value21 > ToastToastLimit && value18?.delete(value20);
        value18?.set(id, value19);
      };
    (0, reactToastToast.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value9.current;
      if (value11 === undefined || !current) return;
      let callback2: Dynamic = (): Dynamic => {
        let value18: Dynamic = current.textContent ?? "";
        value18 !== value10.current &&
          ((value10.current = value18),
          value7(id, {
            title: value18,
          }));
      };
      callback2();
      let observer: Dynamic = new MutationObserver(callback2);
      observer.observe(current, {
        characterData: true,
        childList: true,
        subtree: true,
      });
      return (): Dynamic => observer.disconnect();
    }, [value11, id, value7]);
    let value13: Dynamic = toast.transitionStatus === "ending",
      [value14, value15]: Dynamic = (0, reactToastToast.useState)({
        behind: value4,
        lockedHeight: value5,
      });
    !value13 &&
      (value14.behind !== value4 || value14.lockedHeight !== value5) &&
      value15({
        behind: value4,
        lockedHeight: value5,
      });
    let value16: Dynamic = value13 ? value14.behind : value4,
      value17: Dynamic = value13 ? value14.lockedHeight : value5;
    return (
      <runtime.npm_Toast_Ty.Root
        toast={toast}
        swipeDirection={ToastToastItems}
        className={toastViewportClasses}
        style={{
          zIndex: zIndex,
        }}
        onKeyDown={(input?: Dynamic): Dynamic => {
          input.key === "Escape" &&
            input.currentTarget.contains(
              input.currentTarget.ownerDocument.activeElement,
            ) &&
            callback();
        }}
      >
        <div
          className={`${popupSurfaceClassNameValue} ${ToastToastNeutralWarningDangerConfig[value]} ${ToastToastNeutralWarningDangerConfig_2[value]}`}
        >
          <div
            className={ToastToastClassNames}
            data-behind={value16 ? "" : undefined}
            style={
              value17 !== undefined
                ? {
                    height: value17,
                  }
                : undefined
            }
          >
            {value2 !== null && (
              <span
                className={`shrink-0 ${ToastToastNeutralWarningDangerConfig_4[value]}`}
              >
                {value3 ? (
                  value2
                ) : (
                  <runtime.Icon
                    name={ToastToastNeutralWarningDangerConfig_3[value]}
                    size={"md"}
                  />
                )}
              </span>
            )}
            <div className={ToastToastClassNames_2}>
              <runtime.npm_Toast_Ty.Title
                className={"font-medium"}
                aria-atomic={"true"}
              >
                <span ref={value9}>{value11 ?? toast.data?.baseTitle}</span>
                {value12 > 1 && (
                  <span
                    aria-live={value12 > 2 ? "off" : undefined}
                    data-cds-toast-count={""}
                  >{` (\xD7${value12})`}</span>
                )}
              </runtime.npm_Toast_Ty.Title>
              <runtime.npm_Toast_Ty.Description />
              {toast.data?.action && (
                <div className={"mt-pad-md"}>{toast.data.action}</div>
              )}
            </div>
            <runtime.npm_Toast_Ty.Close
              aria-label={value6}
              className={ToastToastClassNames_3}
              onClick={callback}
            >
              <runtime.Icon name={"X"} size={"sm"} />
            </runtime.npm_Toast_Ty.Close>
          </div>
        </div>
      </runtime.npm_Toast_Ty.Root>
    );
  }
  function PinnedToastCard({
    pinned: pinned,
    onDismiss: onDismiss,
  }: Dynamic): Dynamic {
    let value: Dynamic = pinned.variant ?? "neutral",
      value2: Dynamic = (0, runtime.useLabel)("dismiss", "Dismiss");
    return (
      <div
        data-pinned={""}
        className={`pointer-events-auto relative w-full ${popupSurfaceClassNameValue} ${ToastToastNeutralWarningDangerConfig[value]} ${ToastToastNeutralWarningDangerConfig_2[value]}`}
      >
        <div className={ToastToastClassNames}>
          <span
            className={`shrink-0 ${ToastToastNeutralWarningDangerConfig_4[value]}`}
          >
            <runtime.Icon
              name={ToastToastNeutralWarningDangerConfig_3[value]}
              size={"md"}
            />
          </span>
          <div className={ToastToastClassNames_2}>
            <div className={"font-medium"}>{pinned.title}</div>
            {pinned.description && <div>{pinned.description}</div>}
            {pinned.action && (
              <div className={"mt-pad-md"}>{pinned.action}</div>
            )}
          </div>
          {pinned.dismissible && (
            <button
              type={"button"}
              aria-label={pinned.dismissLabel ?? value2}
              onClick={onDismiss}
              className={ToastToastClassNames_3}
            >
              <runtime.Icon name={"X"} size={"sm"} />
            </button>
          )}
        </div>
      </div>
    );
  }
  function isToastKeyboardFocused(input?: Dynamic): Dynamic {
    let value: Dynamic = input?.ownerDocument.activeElement;
    if (!input || !value || !input.contains(value)) return false;
    try {
      return value.matches(":focus-visible");
    } catch {
      return true;
    }
  }
  function PinnedToastFocusManager({ ctx: ctx }: Dynamic): Dynamic {
    let {
        pinned: value,
        setPinned: value2,
        slotRef: value3,
        focusWasInsideRef: value4,
      }: Dynamic = ctx,
      value5: Dynamic = (0, reactToastToast.useRef)(null);
    (0, reactToastToast.useEffect)((): Dynamic => {
      let current: Dynamic = value3.current;
      if (!current) return;
      let ownerDocument: Dynamic = current.ownerDocument,
        callback: Dynamic = (event?: Dynamic): Dynamic => {
          let target: Dynamic = event.target;
          target &&
            typeof target.focus == "function" &&
            !current.contains(target) &&
            (value5.current = target);
        };
      ownerDocument.addEventListener("focusin", callback);
      return (): Dynamic =>
        ownerDocument.removeEventListener("focusin", callback);
    }, [value3]);
    (0, reactToastToast.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value3.current;
      if (
        !current ||
        !value4.current ||
        ((value4.current = false),
        current.contains(current.ownerDocument.activeElement))
      )
        return;
      let current2: Dynamic = value5.current;
      current2?.isConnected &&
        current2.focus({
          preventScroll: true,
        });
    }, [value, value3, value4]);
    return (
      <div
        ref={(input?: Dynamic): Dynamic => {
          value3.current = input;
        }}
        role={"status"}
        className={value ? "w-full" : "sr-only"}
        onKeyDown={(event?: Dynamic): Dynamic => {
          event.key === "Escape" &&
            !event.defaultPrevented &&
            !event.nativeEvent.isComposing &&
            value?.dismissible &&
            event.currentTarget.contains(
              event.currentTarget.ownerDocument.activeElement,
            ) &&
            value2(null);
        }}
      >
        {value && (
          <PinnedToastCard
            pinned={value}
            onDismiss={(): Dynamic => value2(null)}
          />
        )}
      </div>
    );
  }
  function ToastViewport({ className: className }: Dynamic): Dynamic {
    let { toasts: value }: Dynamic = runtime.npm_Toast_Ty.useToastManager(),
      value2: Dynamic = (0, reactToastToast.useContext)(ToastContext);
    (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
      value2?.syncLiveToasts(value);
    }, [value, value2]);
    let value3: Dynamic = value.find(
      (input?: Dynamic): Dynamic => input.transitionStatus !== "ending",
    );
    return (
      <runtime.npm_Toast_Ty.Portal>
        <runtime.PopupSurface surface={runtime.surfaceBackgroundTokens.popover}>
          <runtime.CdsLayer
            base={runtime.GLOBAL_LAYER_BASE}
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
            {value2 && <PinnedToastFocusManager ctx={value2} />}
            <runtime.npm_Toast_Ty.Viewport
              className={
                "pointer-events-auto relative outline-none focus-visible:outline-hidden"
              }
              style={{
                height: value3?.height,
              }}
            >
              {value.map(
                (input?: Dynamic, options?: Dynamic): Dynamic =>
                  (() => {
                    const _Component = ToastCard;
                    const _props = {
                      toast: input,
                      front: input === value3,
                      frontHeight: value3?.height,
                      zIndex: value.length - options,
                    } as const;
                    const _key = input.id;
                    return <_Component key={_key} {..._props} />;
                  })(),
              )}
            </runtime.npm_Toast_Ty.Viewport>
          </runtime.CdsLayer>
        </runtime.PopupSurface>
      </runtime.npm_Toast_Ty.Portal>
    );
  }
  function createToastMoveState(): Dynamic {
    let index: Dynamic = 0;
    return {
      allocId: (): Dynamic => `cds-toast-${++index}`,
      movingIds: new Set(),
      userDismissAt: new Map(),
    };
  }
  function ToastProvider({
    children: children,
    timeout = ToastToastConstant,
    limit: limit,
    viewportClassName: viewportClassName,
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, reactToastToast.useState)(null),
      value3: Dynamic = (0, reactToastToast.useRef)(value),
      value4: Dynamic = (0, reactToastToast.useRef)(null),
      value5: Dynamic = (0, reactToastToast.useRef)(false),
      value6: Dynamic = (0, reactToastToast.useCallback)(
        (input?: Dynamic): Dynamic => {
          let current: Dynamic = value3.current;
          value3.current = input;
          current !== input &&
            !value5.current &&
            (value5.current = isToastKeyboardFocused(value4.current));
          value2(input);
          current && current !== input && current.onClose?.();
        },
        [],
      ),
      value7: Dynamic = (0, reactToastToast.useRef)([]),
      value8: Dynamic = (0, reactToastToast.useCallback)(
        (input?: Dynamic): Dynamic => {
          value7.current = input;
        },
        [],
      ),
      [value9]: Dynamic = (0, reactToastToast.useState)(createToastMoveState),
      value10: Dynamic = (0, reactToastToast.useMemo)(
        (): Dynamic => normalizeToastTimeout(timeout),
        [timeout],
      ),
      value11: Dynamic = (0, reactToastToast.useMemo)(
        (): Dynamic => ({
          pinned: value,
          setPinned: value6,
          slotRef: value4,
          focusWasInsideRef: value5,
          liveToasts: value7,
          syncLiveToasts: value8,
          defaultTimeout: value10,
          ...value9,
        }),
        [value, value6, value8, value10, value9],
      );
    return (
      <runtime.npm_Toast_Ty.Provider timeout={value10} limit={limit}>
        <ToastContext.Provider value={value11}>
          {children}
          <ToastViewport className={viewportClassName} />
        </ToastContext.Provider>
      </runtime.npm_Toast_Ty.Provider>
    );
  }
  function useToastManager(): Dynamic {
    let value: Dynamic = runtime.npm_Toast_Ty.useToastManager(),
      value2: Dynamic = (0, reactToastToast.useContext)(ToastContext);
    return {
      add: (0, reactToastToast.useCallback)(
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
        }: Dynamic): Dynamic => {
          let value3: Dynamic = variant ?? "neutral",
            value4: Dynamic = typeof title == "string",
            value5: Dynamic = dedupeKey ?? (value4 ? title : undefined),
            state: Dynamic = {
              titleNode: value4 ? undefined : title,
              baseTitle: value4 ? title : undefined,
            },
            value6: Dynamic = Date.now(),
            callback: Dynamic = (input?: Dynamic): Dynamic => {
              let value11: Dynamic = input ?? value2?.defaultTimeout;
              return value11 !== undefined && value11 > 0
                ? value6 + value11
                : undefined;
            };
          if (dedupe && value5 !== undefined) {
            let value11: Dynamic = value2?.liveToasts.current ?? value.toasts,
              value12: Dynamic = value11.find(
                (input?: Dynamic): Dynamic =>
                  input.data?.dedupeKey === value5 &&
                  input.transitionStatus !== "ending",
              );
            if (value12) {
              let value13: Dynamic = (value12.data?.count ?? 1) + 1,
                value14: Dynamic = action ?? value12.data?.action,
                value15: Dynamic =
                  !!value12.data?.action ||
                  (value12.timeout ?? value2?.defaultTimeout) === 0,
                value16: Dynamic =
                  timeout === undefined
                    ? undefined
                    : normalizeToastTimeout(timeout),
                value17: Dynamic = value14 ? 0 : value15 ? undefined : value16,
                state4: Dynamic = {
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
                value18: Dynamic = value4 ? title : value12.title,
                value19: Dynamic =
                  value13 === 2 && typeof value18 == "string"
                    ? `${value18} (\xD72)`
                    : value4 && title !== value12.data?.baseTitle
                      ? title
                      : undefined,
                value20: Dynamic = value11.find(
                  (input?: Dynamic): Dynamic =>
                    input.transitionStatus !== "ending",
                ),
                value21: Dynamic =
                  typeof document !== "undefined" &&
                  !!(document as Dynamic).activeElement?.closest(
                    '[data-cds="Toast"]',
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
                  value11.map(
                    (input?: Dynamic): Dynamic =>
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
              let value22: Dynamic =
                  state4.expiresAt === undefined
                    ? 0
                    : Math.max(state4.expiresAt - value6, 1),
                value23: Dynamic =
                  value17 ?? (value15 ? 0 : Math.max(value22, 6e3)),
                state5: Dynamic = {
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
                  (input?: Dynamic): Dynamic => input.id !== value12.id,
                ),
              ]);
              return value12.id;
            }
          }
          let value7: Dynamic = !!action,
            value8: Dynamic = value2?.allocId(),
            value9: Dynamic = value7 ? 0 : normalizeToastTimeout(timeout),
            state2: Dynamic = {
              variant: value3,
              icon: icon,
              action: action,
              ...state,
              dedupeKey: value5,
              count: 1,
              expiresAt: callback(value9),
            },
            state3: Dynamic = {
              id: value8,
              title: value4 ? title : undefined,
              description: description,
              type: value3,
              timeout: value9,
              onClose: (): Dynamic => {
                if (value8 === undefined || !value2) {
                  onClose?.({
                    byUser: false,
                  });
                  return;
                }
                if (value2.movingIds.has(value8)) return;
                value2.syncLiveToasts(
                  value2.liveToasts.current.map(
                    (input?: Dynamic): Dynamic =>
                      input.id === value8
                        ? {
                            ...input,
                            transitionStatus: "ending",
                          }
                        : input,
                  ),
                );
                let entry: Dynamic = value2.userDismissAt.get(value8);
                value2.userDismissAt.delete(value8);
                onClose?.({
                  byUser:
                    entry !== undefined && Date.now() - entry < ToastToastLimit,
                });
              },
              priority: value3 === "danger" ? "high" : "low",
              data: state2,
            },
            value10: Dynamic = value.add(state3);
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
      setPinned: value2?.setPinned ?? ToastToastHandler,
    };
  }
  bindRuntimeValue(
    runtime,
    "normalizeToastTimeout",
    () => normalizeToastTimeout,
  );
  bindRuntimeValue(runtime, "ToastCard", () => ToastCard);
  bindRuntimeValue(runtime, "PinnedToastCard", () => PinnedToastCard);
  bindRuntimeValue(
    runtime,
    "isToastKeyboardFocused",
    () => isToastKeyboardFocused,
  );
  bindRuntimeValue(
    runtime,
    "PinnedToastFocusManager",
    () => PinnedToastFocusManager,
  );
  bindRuntimeValue(runtime, "ToastViewport", () => ToastViewport);
  bindRuntimeValue(runtime, "createToastMoveState", () => createToastMoveState);
  bindRuntimeValue(runtime, "ToastProvider", () => ToastProvider);
  bindRuntimeValue(runtime, "useToastManager", () => useToastManager);
  bindRuntimeValue(
    runtime,
    "reactToastToast",
    () => reactToastToast,
    (value) => {
      reactToastToast = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxToastToast",
    () => jsxToastToast,
    (value) => {
      jsxToastToast = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToastToastConstant",
    () => ToastToastConstant,
    (value) => {
      ToastToastConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToastToastLimit",
    () => ToastToastLimit,
    (value) => {
      ToastToastLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "popupSurfaceClassNameValue",
    () => popupSurfaceClassNameValue,
    (value) => {
      popupSurfaceClassNameValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToastToastNeutralWarningDangerConfig",
    () => ToastToastNeutralWarningDangerConfig,
    (value) => {
      ToastToastNeutralWarningDangerConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToastToastNeutralWarningDangerConfig_2",
    () => ToastToastNeutralWarningDangerConfig_2,
    (value) => {
      ToastToastNeutralWarningDangerConfig_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToastToastNeutralWarningDangerConfig_3",
    () => ToastToastNeutralWarningDangerConfig_3,
    (value) => {
      ToastToastNeutralWarningDangerConfig_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToastToastNeutralWarningDangerConfig_4",
    () => ToastToastNeutralWarningDangerConfig_4,
    (value) => {
      ToastToastNeutralWarningDangerConfig_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastViewportClasses",
    () => toastViewportClasses,
    (value) => {
      toastViewportClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToastToastClassNames",
    () => ToastToastClassNames,
    (value) => {
      ToastToastClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToastToastClassNames_2",
    () => ToastToastClassNames_2,
    (value) => {
      ToastToastClassNames_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToastToastClassNames_3",
    () => ToastToastClassNames_3,
    (value) => {
      ToastToastClassNames_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToastToastItems",
    () => ToastToastItems,
    (value) => {
      ToastToastItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToastContext",
    () => ToastContext,
    (value) => {
      ToastContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToastToastHandler",
    () => ToastToastHandler,
    (value) => {
      ToastToastHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeToastToast",
    () => initializeToastToast,
    (value) => {
      initializeToastToast = value;
    },
  );
  return () => {
    initializeToastToast = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeHooksLayoutEffect)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeSheetsStyles_2)();
      (0, runtime.initializeOverlaysLayers)();
      (0, runtime.initializePlatformRootFontSize_2)();
      (0, runtime.initializeComponentsIcon_2)();
      (0, runtime.initializeThemeSurfaces)();
      reactToastToast = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxToastToast = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_oet)();
      ToastToastConstant = 6e3;
      ToastToastLimit = 1e3;
      popupSurfaceClassNameValue = (0, runtime.popupSurfaceClassName)(
        "popover",
      );
      ToastToastNeutralWarningDangerConfig = {
        neutral: "shadow-panel-md",
        warning:
          "shadow-ring-warning [background-image:linear-gradient(0deg,var(--cds-bg-warning),var(--cds-bg-warning))]",
        danger:
          "shadow-ring-danger [background-image:linear-gradient(0deg,var(--cds-bg-danger),var(--cds-bg-danger))]",
      };
      ToastToastNeutralWarningDangerConfig_2 = {
        neutral: "text-primary",
        warning: "text-warning",
        danger: "text-danger",
      };
      ToastToastNeutralWarningDangerConfig_3 = {
        neutral: "Info",
        warning: "Warning",
        danger: "WarningCircle",
      };
      ToastToastNeutralWarningDangerConfig_4 = {
        neutral: "text-secondary",
        warning: "",
        danger: "",
      };
      toastViewportClasses =
        "absolute w-full bottom-0 right-0 origin-bottom [--ty:calc(var(--toast-index)_*_-14px)] [--ts:calc(1_-_var(--toast-index)_*_0.04)] [transform:translateY(var(--ty))_scale(var(--ts))] transition-[transform,opacity] duration-base ease-out motion-reduce:transition-none data-[starting-style]:opacity-0 data-[starting-style]:[--ty:100%] data-[ending-style]:opacity-0 data-[ending-style]:[--ts:0.85] data-[limited]:opacity-0";
      ToastToastClassNames =
        "flex items-start gap-sm px-lg py-md overflow-hidden rounded-[inherit] text-body font-normal transition-[opacity,visibility] duration-base ease-out motion-reduce:transition-none data-[behind]:invisible data-[behind]:opacity-0";
      ToastToastClassNames_2 = "min-w-0 flex-1 text-pretty break-words";
      ToastToastClassNames_3 =
        "cds-reset -mx-1 -mb-1 -mt-0.5 shrink-0 rounded p-1 outline-none focus-visible:outline-hidden transition duration-fast hover:bg-fill-ghost-hover focus-visible:shadow-focus";
      ToastToastItems = [];
      ToastContext = (0, reactToastToast.createContext)(null);
      ToastToastHandler = (): Dynamic => {};
    });
  };
}
