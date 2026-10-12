/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactDomNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  Context,
  ForwardRefExoticComponent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
  RefAttributes,
} from "react";

/** A tab shown in a panel header. */
export interface PanelHeaderTab {
  value: string;
  label: ReactNode;
  onClick?: () => void;
  "data-testid"?: string;
}

export interface PanelHeaderContentProps {
  tabs?: PanelHeaderTab[];
  activateOnFocus?: boolean;
  tabsLabel?: string;
  title?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  trailing?: ReactNode;
}

export interface PanelHeaderProps extends PanelHeaderContentProps {
  /** Controlled active tab; falls back to local state seeded from the first tab. */
  tab?: string;
  onTabChange?: (value: string) => void;
  className?: string;
  "data-testid"?: string;
}

export interface PanelIconButtonProps {
  icon: string;
  "aria-label": string;
  tooltip?: string;
  className?: string;
  onClick?: () => void;
}

/** How a panel is presented below the `md` breakpoint. */
export type SidePanelNarrowMode = "sheet" | "overlay";
/** How a panel is presented at `md` and wider. */
export type SidePanelWideMode = "push" | "overlay";

/** Props of `SidePanel`: content portaled into the shared side-panel host while `open`. */
export interface SidePanelProps {
  id: string;
  title: string;
  open: boolean;
  onClose: () => void;
  narrow?: SidePanelNarrowMode;
  wide?: SidePanelWideMode;
  detachable?: boolean;
  tabs?: PanelHeaderTab[];
  tab?: string;
  onTabChange?: (value: string) => void;
  tabsLabel?: string;
  hideTitle?: boolean;
  wideHeader?: boolean;
  sheetFitsContent?: boolean;
  /** `"shell"` aligns the close button with the app shell instead of the default inset. */
  closeInset?: string;
  resizeLabel?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
}

/** What an open `SidePanel` registers with the provider so the host can render its chrome. */
export interface SidePanelMeta {
  id: string;
  title: string;
  narrow: SidePanelNarrowMode;
  wide: SidePanelWideMode;
  detachable: boolean;
  hideTitle?: boolean;
  wideHeader?: boolean;
  sheetFitsContent?: boolean;
  closeInset?: string;
  resizeLabel?: string;
  onClose: () => void;
  tabs?: PanelHeaderTab[];
  tab?: string;
  tabsLabel?: string;
  onTabChange?: (value: string) => void;
}

export interface SidePanelProviderProps {
  children?: ReactNode;
}

/** Value of the context `SidePanel` reads. */
export interface SidePanelContextValue {
  activeId: string | null;
  hostEl: HTMLElement | null;
  leadingEl: HTMLElement | null;
  trailingEl: HTMLElement | null;
  openPanel: (meta: SidePanelMeta) => void;
  closePanel: (id: string) => void;
  setPanelHidden: (hidden: boolean) => void;
}

/** Value of the context `SidePanelHost` reads. */
export interface SidePanelHostContextValue {
  meta: SidePanelMeta | null;
  hidden: boolean;
  setHostEl: (element: HTMLElement | null) => void;
  setLeadingEl: (element: HTMLElement | null) => void;
  setTrailingEl: (element: HTMLElement | null) => void;
}

export interface PanedLayoutProps {
  toolbar?: ReactNode;
  leading?: ReactNode;
  toolbarVariant?: "docked" | "floating";
  children?: ReactNode;
}

export type PanelDockMode = "docked" | "floating";
/** Top-left corner of a floating panel in viewport pixels. */
export type PanelPosition = { x: number; y: number };
/** A JSON value read back from localStorage, before validation. */
export type PanelStoredValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: unknown };

/** `"touch"` ignores mouse pointers; `"all"` accepts every pointer type. */
export type PanelPointerMode = "touch" | "all";

/** An event target that may be an input, a textarea or a contenteditable element. */
type PanelEventTarget = HTMLElement & { value?: unknown };

/** Callbacks a resize handle drives while a drag or keyboard resize is in progress. */
export interface PanelResizeGesture {
  onResizeStart: (source: string) => void;
  /** `delta` is the pointer travel in pixels since the gesture started. */
  onResize: (delta: number, source: string) => void;
  /** `moved` is whether the pointer travelled past the drag threshold. */
  onResizeEnd: (moved: boolean, source: string, context?: boolean) => void;
}

/** State returned by `usePanelWidth`. */
export interface PanelWidthState {
  width: number;
  min: number;
  max: number;
  defaultWidth: number;
  gesture: PanelResizeGesture;
}

export interface PanelWidthResizeHandleProps extends PanelWidthState {
  label?: string;
  className?: string;
}

export interface PanelResizeHandleProps {
  name: string;
  label: string;
  now: number;
  min: number;
  max: number;
  valueText: string;
  side?: "top" | "inline-start";
  gesture: PanelResizeGesture;
  disabled?: boolean;
  /** Tooltip explaining why the handle is disabled. */
  unavailableTip?: string;
  onHome?: () => void;
  onEnd?: () => void;
  onReset?: () => void;
  className?: string;
  grabClassName?: string;
  grabTargetClassName?: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactl0: ReactNamespace;
    reactDOMip: ReactDomNamespace;
    reactb20: ReactNamespace;
    jsxf1: JsxNamespace;
    jsxe5: JsxNamespace;
    jsxaZ: JsxNamespace;
    PANEL_HEADER_CLASS: string;
    PanelIconButton: ForwardRefExoticComponent<PanelIconButtonProps & RefAttributes<HTMLButtonElement>>;
    SidePanelContext: Context<SidePanelContextValue | null>;
    SidePanelHostContext: Context<SidePanelHostContextValue | null>;
    PANEL_STORAGE_PREFIX: string;
    isFinitePanelNumber: (value: PanelStoredValue) => value is number;
    isPanelDockMode: (value: PanelStoredValue) => value is PanelDockMode;
    isPanelPosition: (value: PanelStoredValue) => value is PanelPosition;
    MIN_PANEL_WIDTH: number;
    NON_TEXT_INPUT_TYPES: RegExp;
    approximatelyEqualPanelSize: (left: number, right: number) => boolean;
    MIN_PANEL_HEIGHT: number;
    PANEL_SHEET_MAX_HEIGHT: string;
    IFRAME_POINTER_LOCK_CLASS: string;
    activeIframePointerLocks: number;
    COARSE_PANEL_WIDTH: number;
    PanelHeaderContent: (props: PanelHeaderContentProps) => ReactElement;
    usePanelHeaderTab: (
      props: PanelHeaderProps,
    ) => [string, (value: string) => void];
    PanelHeader: (props: PanelHeaderProps) => ReactElement;
    SidePanelProvider: (props: SidePanelProviderProps) => ReactElement;
    useSidePanel: () => SidePanelContextValue;
    SidePanel: (props: SidePanelProps) => ReactElement | null;
    readPanelPreference: <T extends PanelStoredValue>(
      key: string,
      validate: (value: PanelStoredValue) => value is T,
    ) => T | undefined;
    writePanelPreference: (key: string, value: unknown) => void;
    maximumPanelWidth: () => number;
    clampPanelWidth: (width: number) => number;
    maximumPanelHeight: (height?: number) => number;
    minimumPanelHeight: (inset: number, height?: number) => number;
    clampPanelHeight: (height: number, inset?: number) => number;
    panelBottomPadding: (element: Element | null) => number;
    defaultFloatingPanelTop: (element: Element | null) => number;
    clampFloatingPanelPosition: (
      position: PanelPosition,
      element?: HTMLElement | null,
      width?: number,
    ) => PanelPosition;
    beginPanelPointerGesture: (
      event: ReactPointerEvent<HTMLElement>,
      onMove: "x" | "y",
      onDone: PanelResizeGesture,
      pointerMode?: PanelPointerMode,
    ) => (context?: boolean) => void;
    holdIframePointerLock: () => () => void;
    wrapPanelResizeGestures: (gesture: PanelResizeGesture) => PanelResizeGesture;
    usePanelWidth: (
      initialWidth?: number,
      onResize?: (width: number, startWidth: number) => void,
    ) => PanelWidthState;
    PanelWidthResizeHandle: (props: PanelWidthResizeHandleProps) => ReactElement;
    PanelResizeHandle: (props: PanelResizeHandleProps) => ReactElement;
    SidePanelHost: () => ReactElement | null;
    PanedLayout: (props: PanedLayoutProps) => ReactElement;
  }
}

export function installUiSidePanels(runtime: RuntimeBindings): () => void {
  var reactl0: ReactNamespace;
  var reactDOMip: ReactDomNamespace;
  var reactb20: ReactNamespace;
  var jsxf1: JsxNamespace;
  var PANEL_HEADER_CLASS: string;
  var jsxe5: JsxNamespace;
  var PanelIconButton: RuntimeBindings["PanelIconButton"];
  var SidePanelContext: Context<SidePanelContextValue | null>;
  var SidePanelHostContext: Context<SidePanelHostContextValue | null>;
  var PANEL_STORAGE_PREFIX: string;
  var isFinitePanelNumber: (value: PanelStoredValue) => value is number;
  var isPanelDockMode: (value: PanelStoredValue) => value is PanelDockMode;
  var isPanelPosition: (value: PanelStoredValue) => value is PanelPosition;
  var MIN_PANEL_WIDTH: number;
  var NON_TEXT_INPUT_TYPES: RegExp;
  var approximatelyEqualPanelSize: (left: number, right: number) => boolean;
  var MIN_PANEL_HEIGHT: number;
  var PANEL_SHEET_MAX_HEIGHT: string;
  var IFRAME_POINTER_LOCK_CLASS: string;
  var activeIframePointerLocks: number;
  var COARSE_PANEL_WIDTH: number;
  var jsxaZ: JsxNamespace;
  function PanelHeaderContent({
    tabs: tabs,
    activateOnFocus: activateOnFocus,
    tabsLabel: tabsLabel,
    title: title,
    onClose: onClose,
    closeLabel = runtime.DEFAULT_CLOSE_LABEL,
    trailing: trailing,
  }: PanelHeaderContentProps): ReactElement {
    let value = tabs !== undefined && tabs.length > 0;
    return jsxf1.jsxs(jsxf1.Fragment, {
      children: [
        value
          ? jsxf1.jsx(runtime.Tabs.List, {
              "aria-label": tabsLabel,
              activateOnFocus: activateOnFocus,
              className: "min-w-0 flex-1",
              children: tabs!.map(
                (input: PanelHeaderTab) =>
                  jsxf1.jsx(
                    runtime.Tabs.Tab,
                    {
                      value: input.value,
                      onClick: input.onClick,
                      "data-testid": input["data-testid"],
                      children: input.label,
                    },
                    input.value,
                  ),
              ),
            })
          : title !== undefined && title !== null && title !== false
            ? jsxf1.jsx("span", {
                className:
                  "min-w-0 flex-1 truncate pl-[calc(var(--pp-gutter-l,var(--cds-pad-lg))-var(--cds-pad-sm))] text-body-semibold text-primary",
                children: title,
              })
            : jsxf1.jsx("span", {
                "aria-hidden": "true",
                className: "flex-1",
              }),
        trailing,
        onClose !== undefined
          ? jsxf1.jsx(runtime.Button, {
              variant: "ghost",
              iconOnly: true,
              icon: jsxf1.jsx(runtime.Icon, {
                name: "X",
                size: "sm",
                className: "text-secondary",
              }),
              "aria-label": closeLabel,
              onClick: onClose,
              className: "relative shrink-0",
            })
          : null,
      ],
    });
  }
  function usePanelHeaderTab(
    props: PanelHeaderProps,
  ): [string, (value: string) => void] {
    let [value, value2] = reactb20.useState(
      props.tabs?.[0]?.value ?? "",
    );
    return [
      props.tab ?? value,
      (input: string) => {
        value2(input);
        props.onTabChange?.(input);
      },
    ];
  }
  function PanelHeader(props: PanelHeaderProps): ReactElement {
    let {
        tabs: tabs,
        className: className,
        "data-testid": value,
      } = props,
      [value2, value3] = usePanelHeaderTab(props);
    if (tabs !== undefined && tabs.length > 0) {
      return jsxf1.jsx(runtime.Tabs.Root, {
        value: value2,
        onValueChange: (input: string) => value3(input),
        "data-kit": "panel-header",
        "data-testid": value,
        className: (0, runtime.joinClassNames)(PANEL_HEADER_CLASS, className),
        children: jsxf1.jsx(PanelHeaderContent, {
          ...props,
        }),
      });
    }
    return jsxf1.jsx("div", {
      "data-kit": "panel-header",
      "data-testid": value,
      className: (0, runtime.joinClassNames)(PANEL_HEADER_CLASS, className),
      children: jsxf1.jsx(PanelHeaderContent, {
        ...props,
      }),
    });
  }
  function SidePanelProvider({
    children: children,
  }: SidePanelProviderProps): ReactElement {
    let [value, value2] = reactl0.useState<SidePanelMeta | null>(null),
      [value3, value4] = reactl0.useState<HTMLElement | null>(null),
      [value5, value6] = reactl0.useState<HTMLElement | null>(null),
      [value7, value8] = reactl0.useState<HTMLElement | null>(null),
      [value9, value10] = reactl0.useState(false),
      ref = reactl0.useRef<SidePanelMeta | null>(null),
      callback = reactl0.useCallback((input: SidePanelMeta) => {
        let current = ref.current;
        if (current && current.id !== input.id) {
          current.onClose();
        }
        ref.current = input;
        value2(input);
      }, []),
      callback2 = reactl0.useCallback((input: string) => {
        if (ref.current?.id === input) {
          ref.current = null;
          value2(null);
        }
      }, []),
      callback3 = reactl0.useCallback(
        (input: boolean) => value10(input),
        [],
      );
    return jsxe5.jsx(SidePanelContext.Provider, {
      value: {
        activeId: value?.id ?? null,
        hostEl: value3,
        leadingEl: value5,
        trailingEl: value7,
        openPanel: callback,
        closePanel: callback2,
        setPanelHidden: callback3,
      },
      children: jsxe5.jsx(SidePanelHostContext.Provider, {
        value: {
          meta: value,
          hidden: value9,
          setHostEl: value4,
          setLeadingEl: value6,
          setTrailingEl: value8,
        },
        children: children,
      }),
    });
  }
  function useSidePanel(): SidePanelContextValue {
    let value = reactl0.useContext(SidePanelContext);
    if (!value) {
      throw Error("useSidePanel requires a SidePanelProvider (PanedLayout)");
    }
    return value;
  }
  function SidePanel({
    id: id,
    title: title,
    open: open,
    onClose: onClose,
    narrow = "sheet",
    wide = "push",
    detachable = false,
    tabs: tabs,
    tab: tab,
    onTabChange: onTabChange,
    tabsLabel: tabsLabel,
    hideTitle: hideTitle,
    wideHeader: wideHeader,
    sheetFitsContent: sheetFitsContent,
    closeInset: closeInset,
    resizeLabel: resizeLabel,
    leading: leading,
    trailing: trailing,
    children: children,
  }: SidePanelProps): ReactElement | null {
    let {
        activeId: activeId,
        hostEl: hostEl,
        leadingEl: leadingEl,
        trailingEl: trailingEl,
        openPanel: openPanel,
        closePanel: closePanel,
      } = useSidePanel(),
      ref = reactl0.useRef(onClose);
    ref.current = onClose;
    let ref2 = reactl0.useRef(tabs);
    ref2.current = tabs;
    let ref3 = reactl0.useRef(onTabChange);
    ref3.current = onTabChange;
    let value = tabs
      ?.map((input: PanelHeaderTab) => input.value + "\x00" + input.label)
      .join("\x01");
    reactl0.useEffect(() => {
      if (open) {
        let current = ref2.current;
        openPanel({
          id: id,
          title: title,
          narrow: narrow,
          wide: wide,
          detachable: detachable,
          hideTitle: hideTitle,
          wideHeader: wideHeader,
          sheetFitsContent: sheetFitsContent,
          closeInset: closeInset,
          resizeLabel: resizeLabel,
          onClose: () => ref.current(),
          ...(current !== undefined && current.length > 0
            ? {
                tabs: current.map(
                  (input: PanelHeaderTab, options: number) => ({
                    ...input,
                    onClick: () =>
                      ref2.current?.[options]?.onClick?.(),
                  }),
                ),
                tab: tab,
                tabsLabel: tabsLabel,
                onTabChange: (input: string) =>
                  ref3.current?.(input),
              }
            : {}),
        });
        return () => closePanel(id);
      }
      closePanel(id);
      return;
    }, [
      open,
      id,
      title,
      narrow,
      wide,
      detachable,
      hideTitle,
      wideHeader,
      sheetFitsContent,
      closeInset,
      resizeLabel,
      value,
      tab,
      tabsLabel,
      openPanel,
      closePanel,
    ]);
    if (!open || activeId !== id || !hostEl) {
      return null;
    }
    let callback = (input: ReactNode, options: HTMLElement | null) =>
      options && input !== undefined && input !== null && input !== false
        ? reactDOMip.createPortal(
            jsxe5.jsx(runtime.CdsRoot, {
              density: runtime.defaultDensity,
              className: "contents",
              children: input,
            }),
            options,
          )
        : null;
    return jsxe5.jsxs(jsxe5.Fragment, {
      children: [
        callback(leading, leadingEl),
        callback(trailing, trailingEl),
        reactDOMip.createPortal(
          jsxe5.jsx(runtime.CdsRoot, {
            density: "compact",
            className: "contents",
            children: children,
          }),
          hostEl,
        ),
      ],
    });
  }
  function readPanelPreference<T extends PanelStoredValue>(
    key: string,
    validate: (value: PanelStoredValue) => value is T,
  ): T | undefined {
    try {
      let value = localStorage.getItem(PANEL_STORAGE_PREFIX + key);
      if (value === null) {
        return;
      }
      let value2: PanelStoredValue = JSON.parse(value);
      if (validate(value2)) {
        return value2;
      }
    } catch {}
    return;
  }
  function writePanelPreference(key: string, value: unknown) {
    try {
      localStorage.setItem(PANEL_STORAGE_PREFIX + key, JSON.stringify(value));
    } catch {}
  }
  function maximumPanelWidth() {
    return Math.max(
      MIN_PANEL_WIDTH,
      Math.min(560, window.innerWidth - 120),
    );
  }
  function clampPanelWidth(width: number) {
    return Math.max(
      MIN_PANEL_WIDTH,
      Math.min(maximumPanelWidth(), Math.round(width)),
    );
  }
  function maximumPanelHeight(
    height: number = window.innerHeight,
  ) {
    return Math.round(height * 0.85);
  }
  function minimumPanelHeight(
    inset: number,
    height: number = window.innerHeight,
  ) {
    return Math.max(
      MIN_PANEL_HEIGHT,
      Math.min(MIN_PANEL_HEIGHT + inset, Math.round(height / 2)),
    );
  }
  function clampPanelHeight(height: number, inset: number = 0) {
    return Math.max(
      minimumPanelHeight(inset),
      Math.min(maximumPanelHeight(), Math.round(height)),
    );
  }
  function panelBottomPadding(element: Element | null) {
    let value =
      element?.ownerDocument.defaultView?.getComputedStyle?.(element);
    return Math.round(parseFloat(value?.paddingBottom ?? "") || 0);
  }
  function defaultFloatingPanelTop(element: Element | null) {
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
    position: PanelPosition,
    element?: HTMLElement | null,
    width?: number,
  ) {
    let value = width ?? element?.offsetWidth ?? 0,
      value2 = element?.offsetHeight ?? 0;
    return {
      x: Math.max(
        0,
        Math.min(
          position.x,
          window.innerWidth - Math.max(value, 48),
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          position.y,
          window.innerHeight - Math.max(value2, 40),
        ),
      ),
    };
  }
  function beginPanelPointerGesture(
    event: ReactPointerEvent<HTMLElement>,
    onMove: "x" | "y",
    onDone: PanelResizeGesture,
    pointerMode: PanelPointerMode = "touch",
  ) {
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
    let callback2 = (input: { clientX: number; clientY: number }) =>
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
  function holdIframePointerLock() {
    if (activeIframePointerLocks++ === 0) {
      document.documentElement.classList.add(
        IFRAME_POINTER_LOCK_CLASS,
      );
    }
    let flag = false;
    return () => {
      if (flag) {
        return;
      }
      flag = true;
      if (--activeIframePointerLocks === 0) {
        document.documentElement.classList.remove(
          IFRAME_POINTER_LOCK_CLASS,
        );
      }
    };
  }
  function wrapPanelResizeGestures(
    gesture: PanelResizeGesture,
  ): PanelResizeGesture {
    let entries = new Map<string, () => void>(),
      callback = (input: unknown) =>
        typeof input === "string" ? input : "cds";
    return {
      onResizeStart: (input: unknown) => {
        let value = callback(input);
        entries.get(value)?.();
        entries.set(value, holdIframePointerLock());
        gesture.onResizeStart(value);
      },
      onResize: gesture.onResize,
      onResizeEnd: (
        input: boolean,
        options: unknown,
        context?: boolean,
      ) => {
        let value = callback(options);
        entries.get(value)?.();
        entries.delete(value);
        gesture.onResizeEnd(input, value, context);
      },
    };
  }
  function usePanelWidth(
    initialWidth: number = 304,
    onResize?: (width: number, startWidth: number) => void,
  ): PanelWidthState {
    let [value] = reactl0.useState(
        () =>
          typeof matchMedia === "function" &&
          matchMedia(runtime.COARSE_POINTER_QUERY).matches
            ? Math.max(initialWidth, COARSE_PANEL_WIDTH)
            : initialWidth,
      ),
      [value2, value3] = reactl0.useState(
        () =>
          readPanelPreference("width", isFinitePanelNumber) ?? value,
      ),
      [value4, value5] = reactl0.useState(maximumPanelWidth);
    reactl0.useLayoutEffect(() => {
      let callback = () => {
        value5(maximumPanelWidth());
        value3((input) => clampPanelWidth(input));
      };
      callback();
      window.addEventListener("resize", callback);
      return () =>
        window.removeEventListener("resize", callback);
    }, []);
    let ref = reactl0.useRef(value2),
      ref2 = reactl0.useRef(onResize);
    reactl0.useLayoutEffect(() => {
      ref.current = value2;
      ref2.current = onResize;
    });
    let ref3 = reactl0.useRef(value2),
      memo = reactl0.useMemo(
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
  }: PanelWidthResizeHandleProps): ReactElement {
    let callback =
      (input: number) =>
      () => {
        gesture.onResizeStart("keys");
        gesture.onResize(width - input, "keys");
        gesture.onResizeEnd(true, "keys");
      };
    return jsxe5.jsx(PanelResizeHandle, {
      side: "inline-start",
      name: "panel",
      label: label,
      now: width,
      min: min,
      max: max,
      valueText: String(width) + " pixels wide",
      gesture: gesture,
      onHome: callback(min),
      onEnd: callback(max),
      onReset: callback(defaultWidth),
      className: (0, runtime.joinClassNames)(
        "[&:not(:focus-visible)>[data-cds-part=resize-pill]]:opacity-0",
        className,
      ),
    });
  }
  function PanelResizeHandle({
    name: name,
    label: label,
    now: now,
    min: min,
    max: max,
    valueText: valueText,
    side = "top",
    gesture: gesture,
    disabled = false,
    unavailableTip: unavailableTip,
    onHome: onHome,
    onEnd: onEnd,
    onReset: onReset,
    className: className,
    grabClassName = "justify-center pointer-coarse:flex",
    grabTargetClassName: grabTargetClassName,
  }: PanelResizeHandleProps): ReactElement {
    let value = side === "inline-start",
      ref = reactl0.useRef(gesture);
    ref.current = gesture;
    let ref2 = reactl0.useRef(disabled);
    ref2.current = disabled;
    let [value2, value3] = reactl0.useState(false),
      [value4, value5] = reactl0.useState(false),
      [value6, value7] = reactl0.useState(false),
      value8 = reactl0.useId(),
      ref3 = reactl0.useRef<string | null>(null),
      ref4 = reactl0.useRef<((context?: boolean) => void) | null>(null);
    reactl0.useEffect(() => () => ref4.current?.(true), []);
    let ref5 = reactl0.useRef<[boolean, boolean]>([false, false]),
      memo = reactl0.useMemo(
        () => ({
          onResizeStart: (input: string = "keys") => {
            if (ref2.current) {
              return;
            }
            if (ref3.current === input) {
              if (ref4.current) {
                ref4.current();
              } else {
                ref3.current = null;
                ref.current.onResizeEnd(true, input);
              }
            }
            if (ref3.current !== null) {
              return;
            }
            ref3.current = input;
            value3(true);
            ref.current.onResizeStart(input);
          },
          onResize: (input: number, options = "keys") => {
            if (ref3.current === options) {
              ref.current.onResize(input, options);
            }
          },
          onResizeEnd: (
            input: boolean,
            options = "keys",
            context?: boolean,
          ) => {
            if (ref3.current !== options) {
              return;
            }
            ref3.current = null;
            ref4.current = null;
            value3(false);
            if (options !== "keys") {
              ref5.current = [ref5.current[1], input];
            }
            ref.current.onResizeEnd(input, options, context);
          },
        }),
        [],
      ),
      callback = (event: ReactPointerEvent<HTMLElement>, options: PanelPointerMode) => {
        let value12 = "pointer:" + event.pointerId;
        if (
          ref2.current ||
          (ref3.current !== null && ref3.current !== value12)
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
        if (ref3.current === value12) {
          ref4.current = value13;
        }
      },
      callback2 = (input?: () => void) => {
        if (!disabled && ref3.current === null) {
          input?.();
        }
      },
      value9 = disabled ? unavailableTip : undefined;
    reactl0.useEffect(() => {
      if (!disabled) {
        value7(false);
      }
    }, [disabled]);
    let value10 = value9 !== undefined && value4 && !value6,
      value11 = jsxe5.jsx(runtime.ResizeHandle, {
        side: side,
        "aria-label": label,
        "aria-valuenow": now,
        "aria-valuemin": min,
        "aria-valuemax": max,
        "aria-valuetext": valueText,
        "aria-disabled": disabled || undefined,
        "aria-describedby": value9 !== undefined ? value8 : undefined,
        "data-kit": name + "-resize",
        onResizeStart: memo.onResizeStart,
        onResize: memo.onResize,
        onResizeEnd: memo.onResizeEnd,
        onPointerDown: (input: ReactPointerEvent<HTMLElement>) => callback(input, "all"),
        onFocus: () => {
          value5(true);
          value7(false);
        },
        onBlur: () => value5(false),
        onDoubleClick: () => {
          if (!ref5.current[0] && !ref5.current[1]) {
            callback2(onReset);
          }
        },
        onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
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
              : onEnd;
          if (!value12) {
            return;
          }
          event.preventDefault();
          callback2(value12);
        },
        className: (0, runtime.joinClassNames)(
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
        ),
      });
    return jsxe5.jsxs(jsxe5.Fragment, {
      children: [
        disabled
          ? null
          : jsxe5.jsx("div", {
              "data-kit": name + "-grab",
              onPointerDown: (input: ReactPointerEvent<HTMLElement>) =>
                callback(input, value ? "all" : "touch"),
              "aria-hidden": "true",
              className: (0, runtime.joinClassNames)(
                "absolute z-10 hidden touch-none",
                value
                  ? "inset-y-0 left-0 w-0 flex-col items-center"
                  : "inset-x-0 top-0 h-0 items-start",
                grabClassName,
              ),
              children: jsxe5.jsx("span", {
                className: (0, runtime.joinClassNames)(
                  value ? "h-full w-10 cursor-col-resize" : "h-10 w-24",
                  grabTargetClassName,
                ),
              }),
            }),
        jsxe5.jsx(runtime.Tooltip, {
          content: value9 ?? "",
          side: value ? "left" : "top",
          open: value10,
          onOpenChange: (input: boolean) => {
            if (!input && value10) {
              value7(true);
            }
          },
          children: value11,
        }),
        value9 !== undefined
          ? jsxe5.jsxs(jsxe5.Fragment, {
              children: [
                jsxe5.jsx("span", {
                  id: value8,
                  hidden: true,
                  children: value9,
                }),
                jsxe5.jsx(runtime.TooltipWrapper, {
                  tip: value9,
                  side: value ? "left" : "top",
                  className: value
                    ? "absolute! inset-y-0 -left-1.5 z-10 w-3 cursor-default"
                    : "absolute! inset-x-0 -top-1.5 z-10 h-3 cursor-default",
                  children: jsxe5.jsx("span", {
                    className: "size-full",
                  }),
                }),
              ],
            })
          : null,
      ],
    });
  }
  function SidePanelHost(): ReactElement | null {
    let value = reactl0.useContext(SidePanelHostContext);
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
      [value2, value3] = reactl0.useState(() => {
        let value28 =
          readPanelPreference("sheetH", isFinitePanelNumber) ?? 0;
        if (value28 > 0) {
          return clampPanelHeight(value28);
        } else {
          return 0;
        }
      }),
      [value4, value5] = reactl0.useState(
        () => window.innerHeight,
      ),
      [value6, value7] = reactl0.useState(0),
      value8 =
        value2 > 0 ? Math.max(value2, minimumPanelHeight(value6, value4)) : 0,
      [value9, value10] = reactl0.useState(
        () => readPanelPreference("mode", isPanelDockMode) ?? "docked",
      ),
      value11 = meta?.detachable === true,
      value12 = value11 ? value9 : "docked",
      [value13, value14] = reactl0.useState(
        () => readPanelPreference("pos", isPanelPosition),
      ),
      ref = reactl0.useRef<HTMLDivElement | null>(null),
      [value15, value16] = reactl0.useState(false),
      ref2 = reactl0.useRef<PanelPosition | undefined>(undefined),
      value17 = usePanelWidth(
        304,
        (input: number, options: number) => {
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
        },
      ),
      { width: width, gesture: gesture } = value17,
      memo = reactl0.useMemo(
        () => ({
          ...gesture,
          onResizeStart: (input: string) => {
            ref2.current = value13;
            gesture.onResizeStart(input);
          },
          onResizeEnd: (
            input: boolean,
            options: string,
            context?: boolean,
          ) => {
            gesture.onResizeEnd(input, options, context);
            if (value12 === "floating") {
              value14((input2: PanelPosition | undefined) => {
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
      ref3 = reactl0.useRef(0),
      ref4 = reactl0.useRef(0),
      memo2 = reactl0.useMemo(
        () =>
          wrapPanelResizeGestures({
            onResizeStart: () => {
              ref3.current =
                ref.current?.offsetHeight ??
                Math.round(window.innerHeight / 2);
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
      [value18, value19] = reactl0.useState(
        () =>
          !window.matchMedia("(min-width: 48rem)").matches,
      );
    reactl0.useEffect(() => {
      let value28 = window.matchMedia(
          "(min-width: 48rem)",
        ),
        callback5 = () => value19(!value28.matches);
      value28.addEventListener("change", callback5);
      return () => value28.removeEventListener("change", callback5);
    }, []);
    reactl0.useLayoutEffect(() => {
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
    reactl0.useLayoutEffect(() => {
      return () => {
        let documentElement = document.documentElement;
        documentElement.removeAttribute("data-mc-presentation");
        documentElement.style.removeProperty("--mc-sheet-h");
      };
    }, []);
    let [value20, value21] = reactl0.useState(false),
      ref5 = reactl0.useRef<HTMLElement | null>(null),
      ref6 = reactl0.useRef(0),
      ref7 = reactl0.useRef<MutationObserver | null>(null),
      callback = reactl0.useCallback(() => {
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
      callback2 = reactl0.useCallback(
        (input: HTMLElement | null) => {
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
            let value29 = new value28.MutationObserver(callback);
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
    reactl0.useLayoutEffect(() => {
      let callback5 = () => {
        value5(window.innerHeight);
        value14(
          (input) =>
            input ? clampFloatingPanelPosition(input, ref.current) : input,
        );
        value3(
          (input) =>
            input > 0 ? clampPanelHeight(input) : input,
        );
      };
      callback5();
      window.addEventListener("resize", callback5);
      return () =>
        window.removeEventListener("resize", callback5);
    }, []);
    reactl0.useLayoutEffect(
      () => value7(panelBottomPadding(ref.current)),
      [meta, hidden, value12, value18, value4],
    );
    let callback3 = reactl0.useCallback(
        (event: ReactPointerEvent<HTMLElement>) => {
          let target = event.target as HTMLElement | null;
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
              window.removeEventListener(
                "pointercancel",
                callback6,
              );
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
      callback4 = reactl0.useCallback(() => {
        value10("docked");
        writePanelPreference("mode", "docked");
      }, []);
    reactl0.useEffect(() => {
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
        let target = event.target as PanelEventTarget | null;
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
      return () =>
        window.removeEventListener("keydown", callback5);
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
        value25 !== undefined
          ? jsxe5.jsx("div", {
              onPointerDown: callback3,
              className: (0, runtime.joinClassNames)(
                "shrink-0 touch-none select-none border-b border-border-line",
                value11 && (value15 ? "cursor-grabbing" : "cursor-grab"),
              ),
              children: jsxe5.jsx(runtime.CdsRoot, {
                density: "compact",
                className: "contents",
                children: jsxe5.jsx(
                  PanelHeader,
                  {
                    tabs: value25,
                    tab: meta.tab ?? value25[0]?.value,
                    onTabChange: meta.onTabChange,
                    tabsLabel: meta.tabsLabel ?? "Panel view",
                    trailing: value22
                      ? jsxe5.jsx(runtime.Button, {
                          iconOnly: true,
                          variant: "ghost",
                          icon: "SidebarRight",
                          "aria-label": "Dock panel",
                          tooltip: "Dock back to the side",
                          className: "relative shrink-0",
                          onClick: callback4,
                        })
                      : undefined,
                    onClose: () => meta.onClose(),
                    closeLabel: "Close panel",
                  },
                  meta.id,
                ),
              }),
            })
          : jsxe5.jsxs("div", {
              "data-kit": "panel-header",
              onPointerDown: callback3,
              className: (0, runtime.joinClassNames)(
                "flex h-[38px] shrink-0 touch-none items-center gap-1.5 px-3",
                "pointer-coarse:gap-4",
                "select-none border-b transition-colors",
                value20 ? "border-border-line" : "border-transparent",
                meta.wideHeader === false && !value11 && "md:hidden",
                value11 && (value15 ? "cursor-grabbing" : "cursor-grab"),
              ),
              children: [
                jsxe5.jsx("span", {
                  ref: setLeadingEl,
                  className:
                    "-ml-[5px] flex shrink-0 items-center empty:hidden",
                }),
                jsxe5.jsx("span", {
                  className: "min-w-0 flex-1 truncate text-body-semibold",
                  children: meta.hideTitle === true ? null : meta.title,
                }),
                jsxe5.jsx("span", {
                  ref: setTrailingEl,
                  className:
                    "relative z-20 flex shrink-0 items-center gap-1.5 pointer-coarse:gap-4 empty:hidden",
                }),
                value22
                  ? jsxe5.jsx(PanelIconButton, {
                      icon: "SidebarRight",
                      "aria-label": "Dock panel",
                      tooltip: "Dock back to the side",
                      onClick: callback4,
                    })
                  : null,
                jsxe5.jsx(PanelIconButton, {
                  icon: "X",
                  "aria-label": "Close panel",
                  className:
                    meta.closeInset === "shell" ? undefined : "-mr-[5px]",
                  onClick: () => meta.onClose(),
                }),
              ],
            });
    return jsxe5.jsxs("div", {
      ref: ref,
      role: value22 ? "dialog" : "complementary",
      "aria-label": meta.title,
      style: {
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
      },
      className: (0, runtime.joinClassNames)(
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
      ),
      children: [
        !value22 && meta.narrow === "sheet" && !value23
          ? jsxe5.jsx(PanelResizeHandle, {
              name: "sheet",
              label: "Resize sheet",
              now: value24,
              valueText: String(value24) + " pixels tall",
              min: minimumPanelHeight(value6, value4),
              max: maximumPanelHeight(value4),
              gesture: memo2,
              className: "hidden max-md:block",
              grabClassName: (0, runtime.joinClassNames)(
                "max-md:pointer-coarse:flex pointer-coarse:right-14",
                value26 ? "justify-end" : "justify-center",
              ),
              grabTargetClassName: value26 ? undefined : "ml-14",
            })
          : null,
        value27,
        jsxe5.jsxs("div", {
          className: "relative flex min-h-0 flex-1 flex-col",
          children: [
            jsxe5.jsx("div", {
              ref: callback2,
              className: "flex min-h-0 flex-1 flex-col overflow-hidden",
            }),
            value18 && meta.narrow === "sheet"
              ? null
              : jsxe5.jsx(PanelWidthResizeHandle, {
                  ...value17,
                  gesture: memo,
                  label: meta.resizeLabel,
                }),
          ],
        }),
      ],
    });
  }
  function PanedLayout({
    toolbar: toolbar,
    leading: leading,
    toolbarVariant = "docked",
    children: children,
  }: PanedLayoutProps): ReactElement {
    let value =
        leading == null
          ? null
          : jsxaZ.jsx("div", {
              "data-mc-chrome": "",
              className: "contents",
              children: leading,
            }),
      value2 = jsxaZ.jsx("main", {
        "data-appifact-main": "",
        className: "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        children: children,
      });
    return jsxaZ.jsx(SidePanelProvider, {
      children:
        toolbarVariant === "floating"
          ? jsxaZ.jsxs("div", {
              "data-mc-paned": "",
              className: "relative flex h-dvh overflow-hidden max-md:flex-col",
              children: [
                jsxaZ.jsxs("div", {
                  className: "flex min-h-0 min-w-0 flex-1",
                  children: [
                    value,
                    jsxaZ.jsxs("div", {
                      className:
                        "relative flex min-h-0 min-w-0 flex-1 flex-col",
                      children: [toolbar, value2],
                    }),
                  ],
                }),
                jsxaZ.jsx(SidePanelHost, {}),
              ],
            })
          : jsxaZ.jsxs("div", {
              "data-mc-paned": "",
              className: "flex h-dvh overflow-hidden",
              children: [
                value,
                jsxaZ.jsxs("div", {
                  className: "flex min-h-0 min-w-0 flex-1 flex-col",
                  children: [
                    toolbar,
                    jsxaZ.jsxs("div", {
                      className: "relative flex min-h-0 flex-1 max-md:flex-col",
                      children: [value2, jsxaZ.jsx(SidePanelHost, {})],
                    }),
                  ],
                }),
              ],
            }),
    });
  }
  bindRuntimeValue(
    runtime,
    "reactl0",
    () => reactl0,
    (value) => {
      reactl0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDOMip",
    () => reactDOMip,
    (value) => {
      reactDOMip = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactb20",
    () => reactb20,
    (value) => {
      reactb20 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxf1",
    () => jsxf1,
    (value) => {
      jsxf1 = value;
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
    "jsxe5",
    () => jsxe5,
    (value) => {
      jsxe5 = value;
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
  bindRuntimeValue(runtime, "useSidePanel", () => useSidePanel);
  bindRuntimeValue(runtime, "SidePanel", () => SidePanel);
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
    (0, runtime.initializeUiInputs210)();
    (0, runtime.initializeUiPointerMedia)();
    (0, runtime.initializeUiPropertyFocus)();
    reactl0 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactDOMip = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomNamespace)(),
      1,
    );
    (0, runtime.initializeUiInputs210)();
    (0, runtime.initializeUiPropertyLabels)();
    reactb20 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxf1 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    PANEL_HEADER_CLASS =
      "flex min-w-0 shrink-0 items-center gap-xs py-md pr-sm pl-sm";
    (0, runtime.initializeTooltipWrapper)();
    jsxe5 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    PanelIconButton = reactl0.forwardRef<
      HTMLButtonElement,
      PanelIconButtonProps
    >(function (input, options) {
      return jsxe5.jsx(runtime.Button, {
        ref: options,
        iconOnly: true,
        size: "xs",
        variant: "ghost",
        ...input,
      });
    });
    SidePanelContext = reactl0.createContext<SidePanelContextValue | null>(null);
    SidePanelHostContext = reactl0.createContext<SidePanelHostContextValue | null>(
      null,
    );
    PANEL_STORAGE_PREFIX = "mc-side/";
    isFinitePanelNumber = (value: PanelStoredValue): value is number =>
      typeof value === "number" && Number.isFinite(value);
    isPanelDockMode = (value: PanelStoredValue): value is PanelDockMode =>
      value === "docked" || value === "floating";
    isPanelPosition = (value: PanelStoredValue): value is PanelPosition =>
      typeof value === "object" &&
      value !== null &&
      Number.isFinite(value.x) &&
      Number.isFinite(value.y);
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
