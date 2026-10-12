import type * as React from "react";
import type * as Color from "../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiSidePanels(runtime: RuntimeBindings): () => void {
  var reactForUiSidePanels: typeof import("react");
  var reactDomSidePanels: typeof import("react-dom");
  var reactForUiSidePanels2: typeof import("react");
  var jsxForUiSidePanels: typeof import("react/jsx-runtime");
  var PANEL_HEADER_CLASS: string;
  var jsxForUiSidePanels2: typeof import("react/jsx-runtime");
  var PanelIconButton: React.ForwardRefExoticComponent<
    import("../contracts/controls").ButtonProps &
      React.RefAttributes<HTMLButtonElement>
  >;
  var SidePanelContext: React.Context<Color.SidePanelState | null>;
  var SidePanelHostContext: React.Context<Color.SidePanelHostState | null>;
  var PANEL_STORAGE_PREFIX: string;
  var isFinitePanelNumber: (value: unknown) => value is number;
  var isPanelDockMode: (value: unknown) => value is Color.PanelDockMode;
  var isPanelPosition: (value: unknown) => value is Color.PanelPosition;
  var MIN_PANEL_WIDTH: number;
  var NON_TEXT_INPUT_TYPES: RegExp;
  var approximatelyEqualPanelSize: (left: number, right: number) => boolean;
  var MIN_PANEL_HEIGHT: number;
  var PANEL_SHEET_MAX_HEIGHT: string;
  var IFRAME_POINTER_LOCK_CLASS: string;
  var activeIframePointerLocks: number;
  var COARSE_PANEL_WIDTH: number;
  var jsxaZ: typeof import("react/jsx-runtime");
  function PanelHeaderContent({
    tabs: tabs,
    activateOnFocus: activateOnFocus,
    tabsLabel: tabsLabel,
    title: title,
    onClose: onClose,
    closeLabel = runtime.DEFAULT_CLOSE_LABEL,
    trailing: trailing,
  }: Color.PanelHeaderProps): React.ReactElement {
    let value = tabs !== undefined && tabs.length > 0;
    return (
      <jsxForUiSidePanels.Fragment>
        {[
          value ? (
            <runtime.Tabs.List
              aria-label={tabsLabel}
              activateOnFocus={activateOnFocus}
              className={"min-w-0 flex-1"}
            >
              {tabs!.map((input) =>
                (() => {
                  const _Element = runtime.Tabs.Tab;
                  const _elementProps = {
                    value: input.value,
                    onClick: input.onClick,
                    "data-testid": input["data-testid"],
                    children: input.label,
                  };
                  const _elementKey = input.value;
                  return <_Element key={_elementKey} {..._elementProps} />;
                })(),
              )}
            </runtime.Tabs.List>
          ) : title !== undefined && title !== null && title !== false ? (
            <span
              className={
                "min-w-0 flex-1 truncate pl-[calc(var(--pp-gutter-l,var(--cds-pad-lg))-var(--cds-pad-sm))] text-body-semibold text-primary"
              }
            >
              {title}
            </span>
          ) : (
            <span aria-hidden={"true"} className={"flex-1"} />
          ),
          trailing,
          onClose !== undefined ? (
            <runtime.Button
              variant={"ghost"}
              iconOnly={true}
              icon={
                <runtime.Icon
                  name={"X"}
                  size={"sm"}
                  className={"text-secondary"}
                />
              }
              aria-label={closeLabel}
              onClick={onClose}
              className={"relative shrink-0"}
            />
          ) : null,
        ]}
      </jsxForUiSidePanels.Fragment>
    );
  }
  function usePanelHeaderTab(
    props: Color.PanelHeaderProps,
  ): [string, (tab: string) => void] {
    let [value, value2] = reactForUiSidePanels2.useState(
      props.tabs?.[0]?.value ?? "",
    );
    return [
      props.tab ?? value,
      (input) => {
        value2(input);
        props.onTabChange?.(input);
      },
    ];
  }
  function PanelHeader(props: Color.PanelHeaderProps): React.ReactElement {
    let { tabs: tabs, className: className, "data-testid": value } = props,
      [value2, value3] = usePanelHeaderTab(props);
    if (tabs !== undefined && tabs.length > 0) {
      return (
        <runtime.Tabs.Root
          value={value2}
          onValueChange={(input: unknown) => value3(input as string)}
          data-kit={"panel-header"}
          data-testid={value}
          className={(0, runtime.joinClassNames)(PANEL_HEADER_CLASS, className)}
        >
          <PanelHeaderContent {...props} />
        </runtime.Tabs.Root>
      );
    }
    return (
      <div
        data-kit={"panel-header"}
        data-testid={value}
        className={(0, runtime.joinClassNames)(PANEL_HEADER_CLASS, className)}
      >
        <PanelHeaderContent {...props} />
      </div>
    );
  }
  function SidePanelProvider({
    children: children,
  }: React.PropsWithChildren): React.ReactElement {
    let [value, value2] =
        reactForUiSidePanels.useState<Color.SidePanelMeta | null>(null),
      [value3, value4] = reactForUiSidePanels.useState<HTMLDivElement | null>(
        null,
      ),
      [value5, value6] = reactForUiSidePanels.useState<HTMLSpanElement | null>(
        null,
      ),
      [value7, value8] = reactForUiSidePanels.useState<HTMLSpanElement | null>(
        null,
      ),
      [value9, value10] = reactForUiSidePanels.useState(false),
      ref = reactForUiSidePanels.useRef<Color.SidePanelMeta | null>(null),
      callback = reactForUiSidePanels.useCallback(
        (input: Color.SidePanelMeta) => {
          let current = ref.current;
          if (current && current.id !== input.id) {
            current.onClose();
          }
          ref.current = input;
          value2(input);
        },
        [],
      ),
      callback2 = reactForUiSidePanels.useCallback((input: string) => {
        if (ref.current?.id === input) {
          ref.current = null;
          value2(null);
        }
      }, []),
      callback3 = reactForUiSidePanels.useCallback(
        (input: boolean) => value10(input),
        [],
      );
    return (
      <SidePanelContext.Provider
        value={{
          activeId: value?.id ?? null,
          hostEl: value3,
          leadingEl: value5,
          trailingEl: value7,
          openPanel: callback,
          closePanel: callback2,
          setPanelHidden: callback3,
        }}
      >
        <SidePanelHostContext.Provider
          value={{
            meta: value,
            hidden: value9,
            setHostEl: value4,
            setLeadingEl: value6,
            setTrailingEl: value8,
          }}
        >
          {children}
        </SidePanelHostContext.Provider>
      </SidePanelContext.Provider>
    );
  }
  function readPanelPreference<T>(
    key: string,
    validate: (value: unknown) => value is T,
  ): T | undefined {
    try {
      let value = localStorage.getItem(PANEL_STORAGE_PREFIX + key);
      if (value === null) {
        return;
      }
      let value2: unknown = JSON.parse(value);
      if (validate(value2)) {
        return value2;
      }
    } catch {}
    return;
  }
  function writePanelPreference(key: string, value: unknown): void {
    try {
      localStorage.setItem(PANEL_STORAGE_PREFIX + key, JSON.stringify(value));
    } catch {}
  }
  function maximumPanelWidth(): number {
    return Math.max(MIN_PANEL_WIDTH, Math.min(560, window.innerWidth - 120));
  }
  function clampPanelWidth(width: number): number {
    return Math.max(
      MIN_PANEL_WIDTH,
      Math.min(maximumPanelWidth(), Math.round(width)),
    );
  }
  function maximumPanelHeight(height: number = window.innerHeight): number {
    return Math.round(height * 0.85);
  }
  function minimumPanelHeight(
    inset: number,
    height: number = window.innerHeight,
  ): number {
    return Math.max(
      MIN_PANEL_HEIGHT,
      Math.min(MIN_PANEL_HEIGHT + inset, Math.round(height / 2)),
    );
  }
  function clampPanelHeight(height: number, inset: number = 0): number {
    return Math.max(
      minimumPanelHeight(inset),
      Math.min(maximumPanelHeight(), Math.round(height)),
    );
  }
  function panelBottomPadding(element: HTMLElement | null): number {
    let value = element?.ownerDocument.defaultView?.getComputedStyle?.(element);
    return Math.round(parseFloat(value?.paddingBottom ?? "") || 0);
  }
  function defaultFloatingPanelTop(element: HTMLElement | null): number {
    let value = element
        ?.closest("[data-mc-paned]")
        ?.querySelector<HTMLElement>("header.tb-root"),
      value2 =
        value && value.offsetParent !== null
          ? value.getBoundingClientRect().bottom
          : 40;
    return Math.round(value2 + 12);
  }
  function clampFloatingPanelPosition(
    position: Color.PanelPosition,
    element: HTMLElement | null,
    width?: number,
  ): Color.PanelPosition {
    let value = width ?? element?.offsetWidth ?? 0,
      value2 = element?.offsetHeight ?? 0;
    return {
      x: Math.max(
        0,
        Math.min(position.x, window.innerWidth - Math.max(value, 48)),
      ),
      y: Math.max(
        0,
        Math.min(position.y, window.innerHeight - Math.max(value2, 40)),
      ),
    };
  }
  function beginPanelPointerGesture(
    event: React.PointerEvent<HTMLElement>,
    onMove: "x" | "y",
    onDone: Color.PanelResizeGesture,
    pointerMode: "touch" | "all" = "touch",
  ): Color.PanelGestureEnd {
    let callback = () => {};
    if (pointerMode === "touch" && event.pointerType === "mouse") {
      return callback;
    }
    if (!event.isPrimary || event.button !== 0) {
      return callback;
    }
    event.preventDefault();
    let { currentTarget: currentTarget, pointerId: pointerId } = event;
    currentTarget.setPointerCapture?.(pointerId);
    let callback2 = (input: Pick<PointerEvent, "clientX" | "clientY">) =>
        onMove === "x" ? input.clientX : input.clientY,
      value = callback2(event),
      value2 = "pointer:" + pointerId,
      flag = false,
      flag2 = false;
    onDone.onResizeStart(value2);
    let callback3 = (input: PointerEvent) => {
        if (input.pointerId !== pointerId) {
          return;
        }
        let value3 = callback2(input) - value;
        if (Math.abs(value3) > 3) {
          flag = true;
        }
        onDone.onResize(value3, value2);
      },
      callback4 = (input?: boolean) => {
        if (flag2) {
          return;
        }
        flag2 = true;
        window.removeEventListener("pointermove", callback3);
        window.removeEventListener("pointerup", callback5);
        window.removeEventListener("pointercancel", callback5);
        currentTarget.removeEventListener("lostpointercapture", callback5);
        onDone.onResizeEnd(flag, value2, input);
      },
      callback5 = (input: PointerEvent) => {
        if (input.pointerId === pointerId) {
          callback4();
        }
      };
    window.addEventListener("pointermove", callback3);
    window.addEventListener("pointerup", callback5);
    window.addEventListener("pointercancel", callback5);
    currentTarget.addEventListener("lostpointercapture", callback5);
    return callback4;
  }
  function holdIframePointerLock(): () => void {
    if (activeIframePointerLocks++ === 0) {
      document.documentElement.classList.add(IFRAME_POINTER_LOCK_CLASS);
    }
    let flag = false;
    return () => {
      if (flag) {
        return;
      }
      flag = true;
      if (--activeIframePointerLocks === 0) {
        document.documentElement.classList.remove(IFRAME_POINTER_LOCK_CLASS);
      }
    };
  }
  function wrapPanelResizeGestures(
    gesture: Color.PanelResizeGesture,
  ): Color.PanelResizeGesture {
    let entries = new Map<string, () => void>(),
      callback = (input: string | undefined) =>
        typeof input === "string" ? input : "cds";
    return {
      onResizeStart: (input?: string) => {
        let value = callback(input);
        entries.get(value)?.();
        entries.set(value, holdIframePointerLock());
        gesture.onResizeStart(value);
      },
      onResize: gesture.onResize,
      onResizeEnd: (input?: boolean, options?: string, context?: boolean) => {
        let value = callback(options);
        entries.get(value)?.();
        entries.delete(value);
        gesture.onResizeEnd(input, value, context);
      },
    };
  }
  function usePanelWidth(
    initialWidth: number = 304,
    onResize?: (width: number, previous: number) => void,
  ): Color.PanelWidthState {
    let [value] = reactForUiSidePanels.useState(() =>
        typeof matchMedia === "function" &&
        matchMedia(runtime.COARSE_POINTER_QUERY).matches
          ? Math.max(initialWidth, COARSE_PANEL_WIDTH)
          : initialWidth,
      ),
      [value2, value3] = reactForUiSidePanels.useState(
        () => readPanelPreference("width", isFinitePanelNumber) ?? value,
      ),
      [value4, value5] = reactForUiSidePanels.useState(maximumPanelWidth);
    reactForUiSidePanels.useLayoutEffect(() => {
      let callback = () => {
        value5(maximumPanelWidth());
        value3((input) => clampPanelWidth(input));
      };
      callback();
      window.addEventListener("resize", callback);
      return () => window.removeEventListener("resize", callback);
    }, []);
    let ref = reactForUiSidePanels.useRef(value2),
      ref2 = reactForUiSidePanels.useRef(onResize);
    reactForUiSidePanels.useLayoutEffect(() => {
      ref.current = value2;
      ref2.current = onResize;
    });
    let ref3 = reactForUiSidePanels.useRef(value2),
      memo = reactForUiSidePanels.useMemo(
        () => ({
          onResizeStart: () => {
            ref3.current = ref.current;
          },
          onResize: (input: number) => {
            let value6 = clampPanelWidth(ref3.current - input);
            value3(value6);
            ref2.current?.(value6, ref3.current);
          },
          onResizeEnd: () => {
            value3((input) => {
              writePanelPreference("width", input);
              return input;
            });
          },
        }),
        [],
      );
    return {
      width: value2,
      min: MIN_PANEL_WIDTH,
      max: value4,
      defaultWidth: value,
      gesture: memo,
    };
  }
  function PanelWidthResizeHandle({
    width: width,
    min: min,
    max: max,
    defaultWidth: defaultWidth,
    gesture: gesture,
    label = "Resize panel",
    className: className,
  }: Color.PanelWidthHandleProps): React.ReactElement {
    let callback = (input: number) => () => {
      gesture.onResizeStart("keys");
      gesture.onResize(width - input, "keys");
      gesture.onResizeEnd(true, "keys");
    };
    return (
      <PanelResizeHandle
        side={"inline-start"}
        name={"panel"}
        label={label}
        now={width}
        min={min}
        max={max}
        valueText={String(width) + " pixels wide"}
        gesture={gesture}
        onHome={callback(min)}
        onEnd={callback(max)}
        onReset={callback(defaultWidth)}
        className={(0, runtime.joinClassNames)(
          "[&:not(:focus-visible)>[data-cds-part=resize-pill]]:opacity-0",
          className,
        )}
      />
    );
  }
  function PanelResizeHandle({
    name: name,
    label: label,
    now: now,
    min: min,
    max: onEnd,
    valueText: valueText,
    side = "top",
    gesture: gesture,
    disabled = false,
    unavailableTip: unavailableTip,
    onHome: onHome,
    onEnd: onReset,
    onReset: onHome2,
    className: className,
    grabClassName: grabTargetClassName2 = "justify-center pointer-coarse:flex",
    grabTargetClassName: grabTargetClassName,
  }: Color.PanelResizeHandleProps): React.ReactElement {
    let value = side === "inline-start",
      grabClassName = reactForUiSidePanels.useRef(gesture);
    grabClassName.current = gesture;
    let ref = reactForUiSidePanels.useRef(disabled);
    ref.current = disabled;
    let [value2, value3] = reactForUiSidePanels.useState(false),
      [value4, value5] = reactForUiSidePanels.useState(false),
      [value6, value7] = reactForUiSidePanels.useState(false),
      value8 = reactForUiSidePanels.useId(),
      ref2 = reactForUiSidePanels.useRef<string | null>(null),
      ref3 = reactForUiSidePanels.useRef<Color.PanelGestureEnd | null>(null);
    reactForUiSidePanels.useEffect(() => () => ref3.current?.(true), []);
    let ref4 = reactForUiSidePanels.useRef([false, false]),
      memo = reactForUiSidePanels.useMemo(
        () => ({
          onResizeStart: (input: string = "keys") => {
            if (ref.current) {
              return;
            }
            if (ref2.current === input) {
              if (ref3.current) {
                ref3.current();
              } else {
                ref2.current = null;
                grabClassName.current.onResizeEnd(true, input);
              }
            }
            if (ref2.current !== null) {
              return;
            }
            ref2.current = input;
            value3(true);
            grabClassName.current.onResizeStart(input);
          },
          onResize: (input: number, options: string = "keys") => {
            if (ref2.current === options) {
              grabClassName.current.onResize(input, options);
            }
          },
          onResizeEnd: (
            input?: boolean,
            options: string = "keys",
            context?: boolean,
          ) => {
            if (ref2.current !== options) {
              return;
            }
            ref2.current = null;
            ref3.current = null;
            value3(false);
            if (options !== "keys") {
              ref4.current = [ref4.current[1], input as boolean];
            }
            grabClassName.current.onResizeEnd(input, options, context);
          },
        }),
        [],
      ),
      callback = (
        event: React.PointerEvent<HTMLElement>,
        options: "all" | "touch",
      ) => {
        let value12 = "pointer:" + event.pointerId;
        if (
          ref.current ||
          (ref2.current !== null && ref2.current !== value12)
        ) {
          if (
            event.isPrimary &&
            event.button === 0 &&
            !(options === "touch" && event.pointerType === "mouse")
          ) {
            event.preventDefault();
          }
          return;
        }
        let value13 = beginPanelPointerGesture(
          event,
          value ? "x" : "y",
          memo,
          options,
        );
        if (ref2.current === value12) {
          ref3.current = value13;
        }
      },
      callback2 = (input: (() => void) | undefined) => {
        if (!disabled && ref2.current === null) {
          input?.();
        }
      },
      value9 = disabled ? unavailableTip : undefined;
    reactForUiSidePanels.useEffect(() => {
      if (!disabled) {
        value7(false);
      }
    }, [disabled]);
    let value10 = value9 !== undefined && value4 && !value6,
      value11 = (
        <runtime.ResizeHandle
          side={side}
          aria-label={label}
          aria-valuenow={now}
          aria-valuemin={min}
          aria-valuemax={onEnd}
          aria-valuetext={valueText}
          aria-disabled={disabled || undefined}
          aria-describedby={value9 !== undefined ? value8 : undefined}
          data-kit={name + "-resize"}
          onResizeStart={memo.onResizeStart}
          onResize={memo.onResize}
          onResizeEnd={memo.onResizeEnd}
          onPointerDown={(input: React.PointerEvent<HTMLElement>) =>
            callback(input, "all")
          }
          onFocus={() => {
            value5(true);
            value7(false);
          }}
          onBlur={() => value5(false)}
          onDoubleClick={() => {
            if (!ref4.current[0] && !ref4.current[1]) {
              callback2(onHome2);
            }
          }}
          onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.altKey ||
              event.shiftKey ||
              (event.key !== "Home" && event.key !== "End")
            ) {
              return;
            }
            let value12 = disabled
              ? undefined
              : event.key === "Home"
                ? onHome
                : onReset;
            if (!value12) {
              return;
            }
            event.preventDefault();
            callback2(value12);
          }}
          className={(0, runtime.joinClassNames)(
            "z-10 touch-none [--cds-ring-outer:1px] [--cds-ring-inner:0px]",
            value2 && "[--cds-resize-pill-force:1]",
            disabled
              ? "pointer-events-none pointer-coarse:[--cds-resize-pill-force:0.2]"
              : !value &&
                  !value2 &&
                  "pointer-coarse:[--cds-resize-pill-force:0.5] [&:hover:not(:focus-visible)>[data-cds-part=resize-pill]]:opacity-50",
            !value &&
              "[&:not(:focus-visible)>[data-cds-part=resize-pill]]:top-[calc(50%+6px)]",
            className,
          )}
        />
      );
    return (
      <jsxForUiSidePanels2.Fragment>
        {[
          disabled ? null : (
            <div
              data-kit={name + "-grab"}
              onPointerDown={(input: React.PointerEvent<HTMLElement>) =>
                callback(input, value ? "all" : "touch")
              }
              aria-hidden={"true"}
              className={(0, runtime.joinClassNames)(
                "absolute z-10 hidden touch-none",
                value
                  ? "inset-y-0 left-0 w-0 flex-col items-center"
                  : "inset-x-0 top-0 h-0 items-start",
                grabTargetClassName2,
              )}
            >
              <span
                className={(0, runtime.joinClassNames)(
                  value ? "h-full w-10 cursor-col-resize" : "h-10 w-24",
                  grabTargetClassName,
                )}
              />
            </div>
          ),
          <runtime.Tooltip
            content={value9 ?? ""}
            side={value ? "left" : "top"}
            open={value10}
            onOpenChange={(input: boolean) => {
              if (!input && value10) {
                value7(true);
              }
            }}
          >
            {value11}
          </runtime.Tooltip>,
          value9 !== undefined ? (
            <jsxForUiSidePanels2.Fragment>
              {[
                <span id={value8} hidden={true}>
                  {value9}
                </span>,
                <runtime.TooltipWrapper
                  tip={value9}
                  side={value ? "left" : "top"}
                  className={
                    value
                      ? "absolute! inset-y-0 -left-1.5 z-10 w-3 cursor-default"
                      : "absolute! inset-x-0 -top-1.5 z-10 h-3 cursor-default"
                  }
                >
                  <span className={"size-full"} />
                </runtime.TooltipWrapper>,
              ]}
            </jsxForUiSidePanels2.Fragment>
          ) : null,
        ]}
      </jsxForUiSidePanels2.Fragment>
    );
  }
  function SidePanelHost(): React.ReactElement | null {
    let value = reactForUiSidePanels.useContext(SidePanelHostContext);
    if (!value) {
      throw Error("SidePanelHost requires a SidePanelProvider");
    }
    let {
        meta: meta,
        hidden: hidden,
        setHostEl: setHostEl,
        setLeadingEl: setLeadingEl,
        setTrailingEl: setTrailingEl,
      } = value,
      [value2, value3] = reactForUiSidePanels.useState(() => {
        let value28 = readPanelPreference("sheetH", isFinitePanelNumber) ?? 0;
        if (value28 > 0) {
          return clampPanelHeight(value28);
        } else {
          return 0;
        }
      }),
      [value4, value5] = reactForUiSidePanels.useState(
        () => window.innerHeight,
      ),
      [value6, value7] = reactForUiSidePanels.useState(0),
      value8 =
        value2 > 0 ? Math.max(value2, minimumPanelHeight(value6, value4)) : 0,
      [value9, value10] = reactForUiSidePanels.useState(
        () => readPanelPreference("mode", isPanelDockMode) ?? "docked",
      ),
      value11 = meta?.detachable === true,
      value12 = value11 ? value9 : "docked",
      [value13, value14] = reactForUiSidePanels.useState(() =>
        readPanelPreference("pos", isPanelPosition),
      ),
      ref = reactForUiSidePanels.useRef<HTMLDivElement | null>(null),
      [value15, value16] = reactForUiSidePanels.useState(false),
      ref2 = reactForUiSidePanels.useRef<Color.PanelPosition | undefined>(
        undefined,
      ),
      value17 = usePanelWidth(304, (input: number, options: number) => {
        let current = ref2.current;
        if (value12 === "floating" && current) {
          value14(
            clampFloatingPanelPosition(
              {
                x: current.x + (options - input),
                y: current.y,
              },
              ref.current,
              input,
            ),
          );
        }
      }),
      { width: width, gesture: gesture } = value17,
      memo = reactForUiSidePanels.useMemo(
        () => ({
          ...gesture,
          onResizeStart: (input?: string) => {
            ref2.current = value13;
            gesture.onResizeStart(input);
          },
          onResizeEnd: (
            input?: boolean,
            options?: string,
            context?: boolean,
          ) => {
            gesture.onResizeEnd(input, options, context);
            if (value12 === "floating") {
              value14((input2) => {
                if (input2) {
                  writePanelPreference("pos", input2);
                }
                return input2;
              });
            }
          },
        }),
        [gesture, value13, value12],
      ),
      ref3 = reactForUiSidePanels.useRef(0),
      ref4 = reactForUiSidePanels.useRef(0),
      memo2 = reactForUiSidePanels.useMemo(
        () =>
          wrapPanelResizeGestures({
            onResizeStart: () => {
              ref3.current =
                ref.current?.offsetHeight ?? Math.round(window.innerHeight / 2);
              ref4.current = panelBottomPadding(ref.current);
              value7(ref4.current);
            },
            onResize: (input: number) =>
              value3(clampPanelHeight(ref3.current - input, ref4.current)),
            onResizeEnd: () => {
              value3((input) => {
                let value28 =
                  input > 0 && input === minimumPanelHeight(ref4.current)
                    ? MIN_PANEL_HEIGHT
                    : input;
                if (value28 > 0) {
                  writePanelPreference("sheetH", value28);
                }
                return value28;
              });
            },
          }),
        [],
      ),
      [value18, value19] = reactForUiSidePanels.useState(
        () => !window.matchMedia("(min-width: 48rem)").matches,
      );
    reactForUiSidePanels.useEffect(() => {
      let value28 = window.matchMedia("(min-width: 48rem)"),
        callback5 = () => value19(!value28.matches);
      value28.addEventListener("change", callback5);
      return () => value28.removeEventListener("change", callback5);
    }, []);
    reactForUiSidePanels.useLayoutEffect(() => {
      let documentElement = document.documentElement;
      if (!meta || hidden) {
        documentElement.removeAttribute("data-mc-presentation");
        documentElement.style.removeProperty("--mc-sheet-h");
        return;
      }
      let value28 =
        value12 === "floating"
          ? "floating"
          : value18
            ? meta.narrow === "sheet"
              ? "sheet"
              : "overlay"
            : meta.wide === "overlay"
              ? "overlay"
              : "docked";
      if (documentElement.getAttribute("data-mc-presentation") !== value28) {
        documentElement.setAttribute("data-mc-presentation", value28);
      }
      if (value28 === "sheet" && meta.sheetFitsContent !== true) {
        documentElement.style.setProperty(
          "--mc-sheet-h",
          value8 > 0 ? `${value8}px` : PANEL_SHEET_MAX_HEIGHT,
        );
      } else {
        documentElement.style.removeProperty("--mc-sheet-h");
      }
    }, [meta, hidden, value12, value18, value8]);
    reactForUiSidePanels.useLayoutEffect(() => {
      return () => {
        let documentElement = document.documentElement;
        documentElement.removeAttribute("data-mc-presentation");
        documentElement.style.removeProperty("--mc-sheet-h");
      };
    }, []);
    let [value20, value21] = reactForUiSidePanels.useState(false),
      ref5 = reactForUiSidePanels.useRef<HTMLDivElement | null>(null),
      ref6 = reactForUiSidePanels.useRef(0),
      ref7 = reactForUiSidePanels.useRef<MutationObserver | null>(null),
      callback = reactForUiSidePanels.useCallback(() => {
        if (ref6.current) {
          return;
        }
        let value28 = ref5.current?.ownerDocument.defaultView;
        if (!value28) {
          return;
        }
        ref6.current = value28.requestAnimationFrame(() => {
          ref6.current = 0;
          let current = ref5.current,
            value29 = current ? current.scrollTop > 0 : false;
          if (current && !value29) {
            for (let value30 of current.querySelectorAll("*")) {
              let tagName = value30.tagName;
              if (
                tagName === "TEXTAREA" ||
                tagName === "INPUT" ||
                tagName === "SELECT"
              ) {
                continue;
              }
              if (
                value30.scrollTop > 0 &&
                value30.closest(runtime.OPEN_OVERLAY_SELECTOR) === null
              ) {
                value29 = approximatelyEqualPanelSize(
                  value30.getBoundingClientRect().top,
                  current.getBoundingClientRect().top,
                );
                break;
              }
            }
          }
          value21(value29);
        });
      }, []),
      callback2 = reactForUiSidePanels.useCallback(
        (input: HTMLDivElement | null) => {
          let current = ref5.current;
          if (current) {
            current.removeEventListener("scroll", callback, true);
            if (ref6.current) {
              current.ownerDocument.defaultView?.cancelAnimationFrame(
                ref6.current,
              );
              ref6.current = 0;
            }
          }
          ref7.current?.disconnect();
          ref7.current = null;
          ref5.current = input;
          let value28 = input?.ownerDocument.defaultView;
          if (input && value28) {
            input.addEventListener("scroll", callback, true);
            let value29 = new (
              value28 as Window & typeof globalThis
            ).MutationObserver(callback);
            value29.observe(input, {
              childList: true,
              subtree: true,
            });
            ref7.current = value29;
          }
          value21(false);
          setHostEl(input);
        },
        [setHostEl, callback],
      );
    reactForUiSidePanels.useLayoutEffect(() => {
      let callback5 = () => {
        value5(window.innerHeight);
        value14((input) =>
          input ? clampFloatingPanelPosition(input, ref.current) : input,
        );
        value3((input) => (input > 0 ? clampPanelHeight(input) : input));
      };
      callback5();
      window.addEventListener("resize", callback5);
      return () => window.removeEventListener("resize", callback5);
    }, []);
    reactForUiSidePanels.useLayoutEffect(
      () => value7(panelBottomPadding(ref.current)),
      [meta, hidden, value12, value18, value4],
    );
    let callback3 = reactForUiSidePanels.useCallback(
        (
          event: React.PointerEvent<HTMLDivElement> & {
            target: HTMLElement;
          },
        ) => {
          let target = event.target as
            | (HTMLElement & {
                value?: string;
              })
            | null;
          if (
            target &&
            typeof target.closest === "function" &&
            target.closest("button, a, input, select, textarea")
          ) {
            return;
          }
          if (
            meta?.narrow === "sheet" &&
            !window.matchMedia("(min-width: 48rem)").matches
          ) {
            return;
          }
          if (!value11) {
            return;
          }
          event.preventDefault();
          let value28 = ref.current?.getBoundingClientRect(),
            value29 = value28 ? event.clientX - value28.left : 24,
            value30 = value28 ? event.clientY - value28.top : 16,
            clientX = event.clientX,
            clientY = event.clientY,
            value31 = value12 === "floating";
          value16(true);
          let callback5 = (input: PointerEvent) => {
              if (!value31) {
                if (
                  Math.abs(input.clientX - clientX) +
                    Math.abs(input.clientY - clientY) <
                  8
                ) {
                  return;
                }
                value31 = true;
                value10("floating");
                writePanelPreference("mode", "floating");
              }
              let value32 = clampFloatingPanelPosition(
                {
                  x: input.clientX - value29,
                  y: input.clientY - value30,
                },
                ref.current,
              );
              value14(value32);
            },
            callback6 = (input: PointerEvent) => {
              window.removeEventListener("pointermove", callback5);
              window.removeEventListener("pointerup", callback6);
              window.removeEventListener("pointercancel", callback6);
              value16(false);
              if (value31) {
                let value32 = clampFloatingPanelPosition(
                  {
                    x: input.clientX - value29,
                    y: input.clientY - value30,
                  },
                  ref.current,
                );
                value14(value32);
                writePanelPreference("pos", value32);
              }
            };
          window.addEventListener("pointermove", callback5);
          window.addEventListener("pointerup", callback6);
          window.addEventListener("pointercancel", callback6);
        },
        [value12, meta?.narrow, value11],
      ),
      callback4 = reactForUiSidePanels.useCallback(() => {
        value10("docked");
        writePanelPreference("mode", "docked");
      }, []);
    reactForUiSidePanels.useEffect(() => {
      if (!meta) {
        return;
      }
      let callback5 = (event: KeyboardEvent) => {
        if (
          event.key !== "Escape" ||
          event.defaultPrevented ||
          event.isComposing
        ) {
          return;
        }
        if ((0, runtime.hasOpenOverlay)()) {
          return;
        }
        let target = event.target as
          | (HTMLElement & {
              value?: string;
            })
          | null;
        if (
          target &&
          ref.current?.contains(target) === true &&
          (((target.tagName === "TEXTAREA" ||
            (target.tagName === "INPUT" &&
              !NON_TEXT_INPUT_TYPES.test(target.getAttribute("type") ?? ""))) &&
            typeof target.value === "string" &&
            target.value.length > 0) ||
            (target.isContentEditable === true &&
              (target.textContent ?? "") !== ""))
        ) {
          target.blur?.();
          return;
        }
        event.preventDefault();
        meta.onClose();
      };
      window.addEventListener("keydown", callback5);
      return () => window.removeEventListener("keydown", callback5);
    }, [meta]);
    if (!meta) {
      return null;
    }
    let value22 = value12 === "floating",
      value23 = meta.sheetFitsContent === true,
      value24 =
        value8 > 0 ? value8 : Math.min(Math.round(value4 / 2), 384 + value6),
      state = {
        "--mc-side-w": `${width}px`,
        ...(value8 > 0 && !value23
          ? {
              "--mc-sheet-h": `${value8}px`,
            }
          : {}),
      },
      value25 =
        meta.tabs !== undefined && meta.tabs.length > 0 ? meta.tabs : undefined,
      value26 = value25 !== undefined,
      value27 =
        value25 !== undefined ? (
          <div
            onPointerDown={callback3}
            className={(0, runtime.joinClassNames)(
              "shrink-0 touch-none select-none border-b border-border-line",
              value11 && (value15 ? "cursor-grabbing" : "cursor-grab"),
            )}
          >
            <runtime.CdsRoot density={"compact"} className={"contents"}>
              {(() => {
                const _Element2 = PanelHeader;
                const _elementProps2 = {
                  tabs: value25,
                  tab: meta.tab ?? value25[0]?.value,
                  onTabChange: meta.onTabChange,
                  tabsLabel: meta.tabsLabel ?? "Panel view",
                  trailing: value22 ? (
                    <runtime.Button
                      iconOnly={true}
                      variant={"ghost"}
                      icon={"SidebarRight"}
                      aria-label={"Dock panel"}
                      tooltip={"Dock back to the side"}
                      className={"relative shrink-0"}
                      onClick={callback4}
                    />
                  ) : undefined,
                  onClose: () => meta.onClose(),
                  closeLabel: "Close panel",
                };
                const _elementKey2 = meta.id;
                return <_Element2 key={_elementKey2} {..._elementProps2} />;
              })()}
            </runtime.CdsRoot>
          </div>
        ) : (
          <div
            data-kit={"panel-header"}
            onPointerDown={callback3}
            className={(0, runtime.joinClassNames)(
              "flex h-[38px] shrink-0 touch-none items-center gap-1.5 px-3",
              "pointer-coarse:gap-4",
              "select-none border-b transition-colors",
              value20 ? "border-border-line" : "border-transparent",
              meta.wideHeader === false && !value11 && "md:hidden",
              value11 && (value15 ? "cursor-grabbing" : "cursor-grab"),
            )}
          >
            {[
              <span
                ref={setLeadingEl}
                className={"-ml-[5px] flex shrink-0 items-center empty:hidden"}
              />,
              <span className={"min-w-0 flex-1 truncate text-body-semibold"}>
                {meta.hideTitle === true ? null : meta.title}
              </span>,
              <span
                ref={setTrailingEl}
                className={
                  "relative z-20 flex shrink-0 items-center gap-1.5 pointer-coarse:gap-4 empty:hidden"
                }
              />,
              value22 ? (
                <PanelIconButton
                  icon={"SidebarRight"}
                  aria-label={"Dock panel"}
                  tooltip={"Dock back to the side"}
                  onClick={callback4}
                />
              ) : null,
              <PanelIconButton
                icon={"X"}
                aria-label={"Close panel"}
                className={
                  meta.closeInset === "shell" ? undefined : "-mr-[5px]"
                }
                onClick={() => meta.onClose()}
              />,
            ]}
          </div>
        );
    return (
      <div
        ref={ref}
        role={value22 ? "dialog" : "complementary"}
        aria-label={meta.title}
        style={{
          ...(value22
            ? {
                position: "fixed",
                width: width,
                ...(value13
                  ? {
                      left: value13.x,
                      top: value13.y,
                    }
                  : {
                      right: 12,
                      top: defaultFloatingPanelTop(ref.current),
                    }),
              }
            : state),
          ...(hidden
            ? {
                display: "none",
              }
            : {}),
        }}
        className={(0, runtime.joinClassNames)(
          "z-panel flex min-h-0 flex-col",
          value22
            ? "max-h-[min(75dvh,42rem)] rounded-lg border border-border-line bg-panel shadow-xl"
            : (0, runtime.joinClassNames)(
                "bg-surface-panel",
                "relative w-[var(--mc-side-w)] shrink-0 border-l border-border-line",
                meta.wide === "overlay" &&
                  "md:absolute md:top-[var(--tb-row-h,0px)] md:right-0 md:bottom-0 md:shadow-xl",
                meta.narrow === "sheet"
                  ? (0, runtime.joinClassNames)(
                      "max-md:relative max-md:z-sheet",
                      value23
                        ? "max-md:max-h-[85dvh]"
                        : "max-md:h-[var(--mc-sheet-h,min(50dvh,calc(24rem_+_var(--mc-foot-inset,0px))))]",
                      "max-md:w-full max-md:shrink-0 max-md:pb-[var(--mc-foot-inset,0px)]",
                      "max-md:border-t max-md:border-l-0 max-md:border-border-line",
                    )
                  : "max-md:absolute max-md:top-[var(--tb-row-h,0px)] max-md:right-0 max-md:bottom-0 max-md:shadow-xl",
              ),
        )}
      >
        {[
          !value22 && meta.narrow === "sheet" && !value23 ? (
            <PanelResizeHandle
              name={"sheet"}
              label={"Resize sheet"}
              now={value24}
              valueText={String(value24) + " pixels tall"}
              min={minimumPanelHeight(value6, value4)}
              max={maximumPanelHeight(value4)}
              gesture={memo2}
              className={"hidden max-md:block"}
              grabClassName={(0, runtime.joinClassNames)(
                "max-md:pointer-coarse:flex pointer-coarse:right-14",
                value26 ? "justify-end" : "justify-center",
              )}
              grabTargetClassName={value26 ? undefined : "ml-14"}
            />
          ) : null,
          value27,
          <div className={"relative flex min-h-0 flex-1 flex-col"}>
            {[
              <div
                ref={callback2}
                className={"flex min-h-0 flex-1 flex-col overflow-hidden"}
              />,
              value18 && meta.narrow === "sheet" ? null : (
                <PanelWidthResizeHandle
                  {...value17}
                  gesture={memo}
                  label={meta.resizeLabel}
                />
              ),
            ]}
          </div>,
        ]}
      </div>
    );
  }
  function PanedLayout({
    toolbar: toolbar,
    leading: leading,
    toolbarVariant = "docked",
    children: children,
  }: Color.PanedLayoutProps): React.ReactElement {
    let value =
        leading == null ? null : (
          <div data-mc-chrome={""} className={"contents"}>
            {leading}
          </div>
        ),
      value2 = (
        <main
          data-appifact-main={""}
          className={"flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"}
        >
          {children}
        </main>
      );
    return (
      <SidePanelProvider>
        {toolbarVariant === "floating" ? (
          <div
            data-mc-paned={""}
            className={"relative flex h-dvh overflow-hidden max-md:flex-col"}
          >
            {[
              <div className={"flex min-h-0 min-w-0 flex-1"}>
                {[
                  value,
                  <div
                    className={"relative flex min-h-0 min-w-0 flex-1 flex-col"}
                  >
                    {[toolbar, value2]}
                  </div>,
                ]}
              </div>,
              <SidePanelHost />,
            ]}
          </div>
        ) : (
          <div data-mc-paned={""} className={"flex h-dvh overflow-hidden"}>
            {[
              value,
              <div className={"flex min-h-0 min-w-0 flex-1 flex-col"}>
                {[
                  toolbar,
                  <div
                    className={"relative flex min-h-0 flex-1 max-md:flex-col"}
                  >
                    {[value2, <SidePanelHost />]}
                  </div>,
                ]}
              </div>,
            ]}
          </div>
        )}
      </SidePanelProvider>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactForUiSidePanels",
    () => reactForUiSidePanels,
    (value) => {
      reactForUiSidePanels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDomSidePanels",
    () => reactDomSidePanels,
    (value) => {
      reactDomSidePanels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiSidePanels2",
    () => reactForUiSidePanels2,
    (value) => {
      reactForUiSidePanels2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiSidePanels",
    () => jsxForUiSidePanels,
    (value) => {
      jsxForUiSidePanels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PANEL_HEADER_CLASS",
    () => PANEL_HEADER_CLASS,
    (value) => {
      PANEL_HEADER_CLASS = value;
    },
  );
  bindRuntimeValue(runtime, "PanelHeaderContent", () => PanelHeaderContent);
  bindRuntimeValue(runtime, "usePanelHeaderTab", () => usePanelHeaderTab);
  bindRuntimeValue(runtime, "PanelHeader", () => PanelHeader);
  bindRuntimeValue(
    runtime,
    "jsxForUiSidePanels2",
    () => jsxForUiSidePanels2,
    (value) => {
      jsxForUiSidePanels2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PanelIconButton",
    () => PanelIconButton,
    (value) => {
      PanelIconButton = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SidePanelContext",
    () => SidePanelContext,
    (value) => {
      SidePanelContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SidePanelHostContext",
    () => SidePanelHostContext,
    (value) => {
      SidePanelHostContext = value;
    },
  );
  bindRuntimeValue(runtime, "SidePanelProvider", () => SidePanelProvider);
  bindRuntimeValue(
    runtime,
    "PANEL_STORAGE_PREFIX",
    () => PANEL_STORAGE_PREFIX,
    (value) => {
      PANEL_STORAGE_PREFIX = value;
    },
  );
  bindRuntimeValue(runtime, "readPanelPreference", () => readPanelPreference);
  bindRuntimeValue(runtime, "writePanelPreference", () => writePanelPreference);
  bindRuntimeValue(
    runtime,
    "isFinitePanelNumber",
    () => isFinitePanelNumber,
    (value) => {
      isFinitePanelNumber = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isPanelDockMode",
    () => isPanelDockMode,
    (value) => {
      isPanelDockMode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isPanelPosition",
    () => isPanelPosition,
    (value) => {
      isPanelPosition = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIN_PANEL_WIDTH",
    () => MIN_PANEL_WIDTH,
    (value) => {
      MIN_PANEL_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NON_TEXT_INPUT_TYPES",
    () => NON_TEXT_INPUT_TYPES,
    (value) => {
      NON_TEXT_INPUT_TYPES = value;
    },
  );
  bindRuntimeValue(runtime, "maximumPanelWidth", () => maximumPanelWidth);
  bindRuntimeValue(runtime, "clampPanelWidth", () => clampPanelWidth);
  bindRuntimeValue(
    runtime,
    "approximatelyEqualPanelSize",
    () => approximatelyEqualPanelSize,
    (value) => {
      approximatelyEqualPanelSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIN_PANEL_HEIGHT",
    () => MIN_PANEL_HEIGHT,
    (value) => {
      MIN_PANEL_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PANEL_SHEET_MAX_HEIGHT",
    () => PANEL_SHEET_MAX_HEIGHT,
    (value) => {
      PANEL_SHEET_MAX_HEIGHT = value;
    },
  );
  bindRuntimeValue(runtime, "maximumPanelHeight", () => maximumPanelHeight);
  bindRuntimeValue(runtime, "minimumPanelHeight", () => minimumPanelHeight);
  bindRuntimeValue(runtime, "clampPanelHeight", () => clampPanelHeight);
  bindRuntimeValue(runtime, "panelBottomPadding", () => panelBottomPadding);
  bindRuntimeValue(
    runtime,
    "defaultFloatingPanelTop",
    () => defaultFloatingPanelTop,
  );
  bindRuntimeValue(
    runtime,
    "clampFloatingPanelPosition",
    () => clampFloatingPanelPosition,
  );
  bindRuntimeValue(
    runtime,
    "beginPanelPointerGesture",
    () => beginPanelPointerGesture,
  );
  bindRuntimeValue(
    runtime,
    "IFRAME_POINTER_LOCK_CLASS",
    () => IFRAME_POINTER_LOCK_CLASS,
    (value) => {
      IFRAME_POINTER_LOCK_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "activeIframePointerLocks",
    () => activeIframePointerLocks,
    (value) => {
      activeIframePointerLocks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "holdIframePointerLock",
    () => holdIframePointerLock,
  );
  bindRuntimeValue(
    runtime,
    "wrapPanelResizeGestures",
    () => wrapPanelResizeGestures,
  );
  bindRuntimeValue(
    runtime,
    "COARSE_PANEL_WIDTH",
    () => COARSE_PANEL_WIDTH,
    (value) => {
      COARSE_PANEL_WIDTH = value;
    },
  );
  bindRuntimeValue(runtime, "usePanelWidth", () => usePanelWidth);
  bindRuntimeValue(
    runtime,
    "PanelWidthResizeHandle",
    () => PanelWidthResizeHandle,
  );
  bindRuntimeValue(runtime, "PanelResizeHandle", () => PanelResizeHandle);
  bindRuntimeValue(runtime, "SidePanelHost", () => SidePanelHost);
  bindRuntimeValue(
    runtime,
    "jsxaZ",
    () => jsxaZ,
    (value) => {
      jsxaZ = value;
    },
  );
  bindRuntimeValue(runtime, "PanedLayout", () => PanedLayout);
  return () => {
    reactForUiSidePanels = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactDomSidePanels = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomNamespace)(),
      1,
    );
    reactForUiSidePanels2 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxForUiSidePanels = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    PANEL_HEADER_CLASS =
      "flex min-w-0 shrink-0 items-center gap-xs py-md pr-sm pl-sm";
    jsxForUiSidePanels2 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    PanelIconButton = reactForUiSidePanels.forwardRef(function (
      input: import("../contracts/controls").ButtonProps,
      options: React.ForwardedRef<HTMLButtonElement>,
    ) {
      return (
        <runtime.Button
          ref={options}
          iconOnly={true}
          size={"xs"}
          variant={"ghost"}
          {...input}
        />
      );
    });
    SidePanelContext =
      reactForUiSidePanels.createContext<Color.SidePanelState | null>(null);
    SidePanelHostContext =
      reactForUiSidePanels.createContext<Color.SidePanelHostState | null>(null);
    PANEL_STORAGE_PREFIX = "mc-side/";
    isFinitePanelNumber = (value: unknown): value is number =>
      typeof value === "number" && Number.isFinite(value);
    isPanelDockMode = (value: unknown): value is Color.PanelDockMode =>
      value === "docked" || value === "floating";
    isPanelPosition = (value: unknown): value is Color.PanelPosition =>
      typeof value === "object" &&
      value !== null &&
      Number.isFinite((value as Color.PanelPosition).x) &&
      Number.isFinite((value as Color.PanelPosition).y);
    MIN_PANEL_WIDTH = 285;
    NON_TEXT_INPUT_TYPES =
      /^(checkbox|radio|range|button|submit|reset|image|color)$/i;
    approximatelyEqualPanelSize = (left: number, right: number) =>
      Math.abs(left - right) < 1;
    MIN_PANEL_HEIGHT = 160;
    PANEL_SHEET_MAX_HEIGHT =
      "min(50dvh, calc(24rem + var(--mc-foot-inset, 0px)))";
    IFRAME_POINTER_LOCK_CLASS = "[&_iframe]:pointer-events-none!";
    activeIframePointerLocks = 0;
    COARSE_PANEL_WIDTH = 376;
    jsxaZ = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
  };
}
