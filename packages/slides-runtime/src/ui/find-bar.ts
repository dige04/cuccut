/** Restored application module; prepare first, initialize in original order. */
import type {
  ChangeEvent,
  CompositionEvent,
  CSSProperties,
  ReactElement,
  RefObject,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { SessionMouseEvent } from "./session-properties";

/** The modifier flags of a keyboard event. */
export type KeyModifiers = Pick<
  KeyboardEvent,
  "altKey" | "ctrlKey" | "metaKey" | "shiftKey"
>;
/** The parts of a keyboard event that identify a shortcut. */
export type ShortcutKeyEvent = KeyModifiers &
  Pick<KeyboardEvent, "key" | "code">;
/** Direction of a find step: next or previous match. */
export type FindStep = 1 | -1;
/** What the find bar shows about the running search. */
export interface FindStatus {
  query: string;
  searching: boolean;
  /** 1-based index of the current match. */
  current: number;
  total: number;
  /** The search stopped counting at a limit. */
  capped: boolean;
  /** Where the current match is, for screen readers. */
  place?: string;
}
/** Handles a key pressed inside the find bar; returns whether it was used. */
export type FindBarKeyHandler = (event: KeyboardEvent) => boolean;
/** What the find shortcuts act on. */
export interface FindKeyCommands {
  /** Opens or focuses the bar; returns whether the key was used. */
  findKey: () => boolean;
  isOpen: () => boolean;
  step: (direction: FindStep, event: KeyboardEvent) => void;
  /** Whether the editor owns this step chord for itself. */
  ownsStepChord?: (event: KeyboardEvent) => boolean;
}
export interface OpenFindBarProps {
  subscribe: (onChange: () => void) => () => void;
  getStatus: () => FindStatus;
  fieldRef: RefObject<HTMLInputElement | null>;
  onQuery: (query: string) => void;
  onStep: (direction: FindStep) => void;
  onClose: () => void;
}
export interface FindBarProps extends OpenFindBarProps {
  open: boolean;
  /** Called with `true` when the bar mounts and `false` when it unmounts. */
  onMounted: (mounted: boolean) => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactsq: ReactNamespace;
    jsxDY: JsxNamespace;
    FIND_BAR_ATTRIBUTE: string;
    matchesLatinShortcut: (event: ShortcutKeyEvent, letter: string) => boolean;
    FIND_BAR_EDIT_SHORTCUTS: string[];
    findBarKeyHandlers: WeakMap<Element, FindBarKeyHandler>;
    registerFindBarKeyHandler: (
      element: Element,
      handler: FindBarKeyHandler,
    ) => () => void;
    captureFindBarKey: (event: KeyboardEvent) => void;
    captureFindBarClipboard: (event: ClipboardEvent) => void;
    findBarListenerWindows: WeakSet<Window>;
    installFindBarEventGuards: (ownWindow: Window) => void;
    isPrimaryShortcutModifier: (event: KeyModifiers, isMac: boolean) => boolean;
    isFindShortcut: (event: ShortcutKeyEvent, isMac?: boolean) => boolean;
    addUnpatchedEventListener: <E extends Event>(
      target: EventTarget,
      eventType: string,
      listener: (event: E) => void,
      options?: boolean | AddEventListenerOptions,
    ) => () => void;
    createFindKeyHandler: (
      commands: FindKeyCommands,
      isOurs?: (event: KeyboardEvent) => boolean,
      enabled?: () => boolean,
    ) => (event: KeyboardEvent) => void;
    findStepShortcut: (
      event: ShortcutKeyEvent,
      isMac?: boolean,
    ) => FindStep | undefined;
    NON_TEXT_FIND_INPUT_PATTERN: RegExp;
    isTextEditingElement: (element: Element) => boolean;
    blurEditingTargetForFind: (
      page?: Document,
      keepSelector?: string,
      editSelector?: string,
    ) => void;
    FIND_BAR_LABEL: string;
    FIND_PREVIOUS_LABEL: string;
    FIND_NEXT_LABEL: string;
    FIND_CLOSE_LABEL: string;
    FIND_PLACEHOLDER: string;
    FIND_NO_MATCHES_LABEL: string;
    findCountAnnouncement: (
      current: number,
      total: number,
      capped: boolean,
      label?: string,
    ) => string;
    FIND_BAR_STYLE: CSSProperties;
    FIND_BAR_INPUT_STYLE: CSSProperties;
    FIND_BAR_COUNT_STYLE: CSSProperties;
    FIND_BAR_LIVE_REGION_STYLE: CSSProperties;
    findCountReadout: (status: FindStatus) => string;
    FindBar: (props: FindBarProps) => ReactElement | null;
    preserveFindStatusWhileSearching: (
      getStatus: () => FindStatus,
    ) => () => FindStatus;
    OpenFindBar: (props: OpenFindBarProps) => ReactElement;
  }
}

export function installUiFindBar(runtime: RuntimeBindings): () => void {
  var reactsq: ReactNamespace;
  var FIND_BAR_ATTRIBUTE: string;
  var FIND_BAR_EDIT_SHORTCUTS: string[];
  var findBarKeyHandlers: WeakMap<Element, FindBarKeyHandler>;
  var findBarListenerWindows: WeakSet<Window>;
  var NON_TEXT_FIND_INPUT_PATTERN: RegExp;
  var FIND_BAR_LABEL: string;
  var FIND_PREVIOUS_LABEL: string;
  var FIND_NEXT_LABEL: string;
  var FIND_CLOSE_LABEL: string;
  var FIND_PLACEHOLDER: string;
  var FIND_NO_MATCHES_LABEL: string;
  var jsxDY: JsxNamespace;
  var FIND_BAR_STYLE: CSSProperties;
  var FIND_BAR_INPUT_STYLE: CSSProperties;
  var FIND_BAR_COUNT_STYLE: CSSProperties;
  var FIND_BAR_LIVE_REGION_STYLE: CSSProperties;
  function matchesLatinShortcut(
    event: ShortcutKeyEvent,
    letter: string,
  ): boolean {
    if (event.key.toLowerCase() === letter) {
      return true;
    }
    return (
      event.code === "Key" + letter.toUpperCase() &&
      /^[\p{L}\p{M}]$/u.test(event.key) &&
      !/\p{Script=Latin}/u.test(event.key)
    );
  }
  function registerFindBarKeyHandler(
    element: Element,
    handler: FindBarKeyHandler,
  ): () => void {
    findBarKeyHandlers.set(element, handler);
    return () => void findBarKeyHandlers.delete(element);
  }
  function captureFindBarKey(event: KeyboardEvent): void {
    let target = event.target as Element | null,
      value =
        typeof target?.closest === "function"
          ? target.closest("[" + FIND_BAR_ATTRIBUTE + "]")
          : null;
    if (value === null || target === null || event.key === "F6") {
      return;
    }
    let flag = false;
    try {
      flag =
        event.type === "keydown" &&
        findBarKeyHandlers.get(value)?.(event) === true;
    } catch {
      flag = false;
    }
    if (
      flag === false &&
      (target.tagName === "INPUT" ||
        (matchesLatinShortcut(event, "s") &&
          isPrimaryShortcutModifier(event, (0, runtime.isApplePlatform)())))
    ) {
      return;
    }
    event.stopImmediatePropagation();
    let value2 =
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !/^F\d+$/.test(event.key) &&
        event.key !== "Tab" &&
        event.key !== "Enter" &&
        event.key !== " ",
      value3 =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        FIND_BAR_EDIT_SHORTCUTS.some((input: string): boolean =>
          matchesLatinShortcut(event, input),
        );
    if (!flag && event.type === "keydown" && (value2 || value3)) {
      event.preventDefault();
    }
  }
  function captureFindBarClipboard(event: ClipboardEvent): void {
    let target = event.target as Element | null;
    if (
      target === null ||
      typeof target.closest !== "function" ||
      target.tagName === "INPUT"
    ) {
      return;
    }
    if (target.closest("[" + FIND_BAR_ATTRIBUTE + "]") === null) {
      return;
    }
    event.stopImmediatePropagation();
    event.preventDefault();
  }
  function installFindBarEventGuards(ownWindow: Window): void {
    if (findBarListenerWindows.has(ownWindow)) {
      return;
    }
    findBarListenerWindows.add(ownWindow);
    for (let value of ["keydown", "keyup", "keypress"] as const)
      ownWindow.addEventListener(value, captureFindBarKey, true);
    for (let value of ["cut", "copy", "paste"] as const)
      ownWindow.addEventListener(value, captureFindBarClipboard, true);
  }
  function isPrimaryShortcutModifier(
    event: KeyModifiers,
    isMac: boolean,
  ): boolean {
    return (
      !event.altKey &&
      (isMac
        ? event.metaKey && !event.ctrlKey
        : event.ctrlKey && !event.metaKey)
    );
  }
  function isFindShortcut(
    event: ShortcutKeyEvent,
    isMac: boolean = (0, runtime.isApplePlatform)(),
  ): boolean {
    return (
      isPrimaryShortcutModifier(event, isMac) &&
      !event.shiftKey &&
      matchesLatinShortcut(event, "f")
    );
  }
  function addUnpatchedEventListener<E extends Event>(
    target: EventTarget,
    eventType: string,
    listener: (event: E) => void,
    options?: boolean | AddEventListenerOptions,
  ): () => void {
    let value = listener as EventListener;
    try {
      EventTarget.prototype.addEventListener.call(
        target,
        eventType,
        value,
        options,
      );
      return () =>
        EventTarget.prototype.removeEventListener.call(
          target,
          eventType,
          value,
          options,
        );
    } catch {
      target.addEventListener(eventType, value, options);
      return () =>
        target.removeEventListener(eventType, value, options);
    }
  }
  function createFindKeyHandler(
    commands: FindKeyCommands,
    isOurs: (event: KeyboardEvent) => boolean = (
      input: KeyboardEvent,
    ): boolean => input.isTrusted,
    enabled: () => boolean = () => true,
  ): (event: KeyboardEvent) => void {
    return (event: KeyboardEvent): void => {
      try {
        let value = !enabled();
        if ((event.eventPhase === 1) !== value) {
          return;
        }
        if (!isOurs(event) || event.defaultPrevented) {
          return;
        }
        if (event.isComposing) {
          if (isFindShortcut(event) || findStepShortcut(event) !== undefined) {
            event.preventDefault();
          }
          return;
        }
        let callback = (): void => {
          event.preventDefault();
          if (value) {
            event.stopImmediatePropagation();
          }
        };
        if (isFindShortcut(event)) {
          if (commands.findKey()) {
            callback();
          }
          return;
        }
        let value2 = findStepShortcut(event);
        if (
          value2 === undefined ||
          (event.key !== "F3" && commands.ownsStepChord?.(event) === true)
        ) {
          return;
        }
        if (!commands.isOpen()) {
          if (commands.findKey()) {
            callback();
          }
          return;
        }
        callback();
        commands.step(value2, event);
      } catch {
        return;
      }
    };
  }
  function findStepShortcut(
    event: ShortcutKeyEvent,
    isMac: boolean = (0, runtime.isApplePlatform)(),
  ): FindStep | undefined {
    if (
      !(event.key === "F3"
        ? !event.altKey && !event.metaKey && !event.ctrlKey
        : isPrimaryShortcutModifier(event, isMac) &&
          matchesLatinShortcut(event, "g"))
    ) {
      return;
    }
    if (event.shiftKey) {
      return -1;
    } else {
      return 1;
    }
  }
  function isTextEditingElement(element: Element): boolean {
    let tagName = element.tagName;
    return (
      tagName === "TEXTAREA" ||
      (element as HTMLElement).isContentEditable === true ||
      (tagName === "INPUT" &&
        !NON_TEXT_FIND_INPUT_PATTERN.test((element as HTMLInputElement).type))
    );
  }
  function blurEditingTargetForFind(
    page: Document = document,
    keepSelector?: string,
    editSelector?: string,
  ): void {
    let activeElement = page.activeElement as HTMLElement | null;
    if (
      activeElement === null ||
      activeElement.closest("[" + FIND_BAR_ATTRIBUTE + "]") !== null
    ) {
      return;
    }
    if (
      !isTextEditingElement(activeElement) &&
      (editSelector === undefined ||
        activeElement.closest(editSelector) === null)
    ) {
      return;
    }
    if (
      keepSelector === undefined ||
      activeElement.closest(keepSelector) === null
    ) {
      activeElement.blur();
    }
  }
  function findCountAnnouncement(
    current: number,
    total: number,
    capped: boolean,
    label?: string,
  ): string {
    if (total === 0) {
      return "No matches";
    }
    return (
      String(current) +
      " of " +
      String(total) +
      (capped ? " or more" : "") +
      (label === undefined ? "" : ", " + label)
    );
  }
  function findCountReadout(status: FindStatus): string {
    if (status.query === "" || status.searching) {
      return "";
    }
    return (
      String(status.current) +
      "/" +
      String(status.total) +
      (status.capped ? "+" : "")
    );
  }
  function FindBar(props: FindBarProps): ReactElement | null {
    let { onMounted: onMounted } = props;
    reactsq.useEffect(() => {
      onMounted(true);
      return () => onMounted(false);
    }, [onMounted]);
    if (props.open) {
      return jsxDY.jsx(OpenFindBar, {
        ...props,
      });
    } else {
      return null;
    }
  }
  function preserveFindStatusWhileSearching(
    getStatus: () => FindStatus,
  ): () => FindStatus {
    let value: FindStatus | null = null;
    return (): FindStatus => {
      let value2 = getStatus();
      if (value2.query === "") {
        value = null;
      } else if (!value2.searching) {
        value = value2;
      }
      if (value2.searching && value !== null) {
        return value;
      } else {
        return value2;
      }
    };
  }
  function OpenFindBar({
    subscribe: subscribe,
    getStatus: getStatus,
    fieldRef: fieldRef,
    onQuery: onQuery,
    onStep: onStep,
    onClose: onClose,
  }: OpenFindBarProps): ReactElement {
    let memo = reactsq.useMemo(
        () => preserveFindStatusWhileSearching(getStatus),
        [getStatus],
      ),
      value = reactsq.useSyncExternalStore(subscribe, memo),
      [value2, value3] = reactsq.useState(""),
      ref = reactsq.useRef<HTMLElement>(null),
      ref2 = reactsq.useRef<FindBarKeyHandler>(() => false);
    ref2.current = (event: KeyboardEvent): boolean => {
      if (event.isComposing || event.keyCode === 229) {
        return false;
      }
      let current = fieldRef.current,
        value6: FindStep | undefined =
          event.key === "Enter" && event.target === current
            ? event.shiftKey
              ? -1
              : 1
            : findStepShortcut(event);
      if (event.key === "Escape") {
        onClose();
      } else if (value6 !== undefined) {
        onStep(value6);
      } else if (isFindShortcut(event)) {
        current?.focus();
        current?.select();
      } else {
        return false;
      }
      event.preventDefault();
      return true;
    };
    reactsq.useEffect(
      (): (() => void) | undefined =>
        ref.current === null
          ? undefined
          : registerFindBarKeyHandler(
              ref.current,
              (input: KeyboardEvent): boolean => ref2.current(input),
            ),
      [],
    );
    let callback = (event: SessionMouseEvent): void => {
        if (event.target.closest(runtime.TEXT_EDITABLE_SELECTOR) === null) {
          event.preventDefault();
        }
      },
      value4 = value.total === 0,
      value5 =
        value.query === ""
          ? FIND_PLACEHOLDER
          : value.searching
            ? undefined
            : FIND_NO_MATCHES_LABEL;
    return jsxDY.jsx(runtime.CdsRoot, {
      density: "compact",
      render: jsxDY.jsx(runtime.Surface, {
        elevation: runtime.PANEL_ELEVATION,
        role: "search",
        "aria-label": FIND_BAR_LABEL,
        "data-mc-chrome": "",
        ...{
          [FIND_BAR_ATTRIBUTE]: "",
        },
        style: FIND_BAR_STYLE,
        ref: ref,
        onMouseDown: callback,
      }),
      children: jsxDY.jsxs(runtime.TooltipProvider, {
        children: [
          jsxDY.jsx(runtime.TextInput, {
            ref: fieldRef,
            value: value2,
            onChange: (
              event: ChangeEvent<HTMLInputElement> & { nativeEvent: InputEvent },
            ): void => {
              value3(event.target.value);
              if (!event.nativeEvent.isComposing) {
                onQuery(event.target.value);
              }
            },
            onCompositionEnd: (
              input: CompositionEvent<HTMLInputElement>,
            ): void => onQuery(input.currentTarget.value),
            placeholder: FIND_BAR_LABEL,
            "aria-label": FIND_BAR_LABEL,
            autoComplete: "off",
            spellCheck: false,
            maxLength: 200,
            className: "pointer-coarse:h-10",
            style: FIND_BAR_INPUT_STYLE,
          }),
          jsxDY.jsxs("span", {
            role: "status",
            "aria-atomic": "true",
            className: "text-muted text-caption",
            style: FIND_BAR_COUNT_STYLE,
            children: [
              jsxDY.jsx("span", {
                "aria-hidden": "true",
                children: findCountReadout(value),
              }),
              jsxDY.jsx("span", {
                style: FIND_BAR_LIVE_REGION_STYLE,
                children:
                  findCountReadout(value) === ""
                    ? ""
                    : findCountAnnouncement(
                        value.current,
                        value.total,
                        value.capped,
                        value.place,
                      ),
              }),
            ],
          }),
          jsxDY.jsx(runtime.ToolbarButton, {
            iconOnly: true,
            icon: "ArrowUp",
            label: FIND_PREVIOUS_LABEL,
            disabled: value4,
            disabledTip: value5,
            onClick: () => onStep(-1),
          }),
          jsxDY.jsx(runtime.ToolbarButton, {
            iconOnly: true,
            icon: "ArrowDown",
            label: FIND_NEXT_LABEL,
            disabled: value4,
            disabledTip: value5,
            onClick: () => onStep(1),
          }),
          jsxDY.jsx(runtime.ToolbarButton, {
            iconOnly: true,
            icon: "X",
            label: FIND_CLOSE_LABEL,
            onClick: onClose,
          }),
        ],
      }),
    });
  }
  bindRuntimeValue(
    runtime,
    "reactsq",
    () => reactsq,
    (value) => {
      reactsq = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FIND_BAR_ATTRIBUTE",
    () => FIND_BAR_ATTRIBUTE,
    (value) => {
      FIND_BAR_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(runtime, "matchesLatinShortcut", () => matchesLatinShortcut);
  bindRuntimeValue(
    runtime,
    "FIND_BAR_EDIT_SHORTCUTS",
    () => FIND_BAR_EDIT_SHORTCUTS,
    (value) => {
      FIND_BAR_EDIT_SHORTCUTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findBarKeyHandlers",
    () => findBarKeyHandlers,
    (value) => {
      findBarKeyHandlers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "registerFindBarKeyHandler",
    () => registerFindBarKeyHandler,
  );
  bindRuntimeValue(runtime, "captureFindBarKey", () => captureFindBarKey);
  bindRuntimeValue(
    runtime,
    "captureFindBarClipboard",
    () => captureFindBarClipboard,
  );
  bindRuntimeValue(
    runtime,
    "findBarListenerWindows",
    () => findBarListenerWindows,
    (value) => {
      findBarListenerWindows = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "installFindBarEventGuards",
    () => installFindBarEventGuards,
  );
  bindRuntimeValue(
    runtime,
    "isPrimaryShortcutModifier",
    () => isPrimaryShortcutModifier,
  );
  bindRuntimeValue(runtime, "isFindShortcut", () => isFindShortcut);
  bindRuntimeValue(
    runtime,
    "addUnpatchedEventListener",
    () => addUnpatchedEventListener,
  );
  bindRuntimeValue(runtime, "createFindKeyHandler", () => createFindKeyHandler);
  bindRuntimeValue(runtime, "findStepShortcut", () => findStepShortcut);
  bindRuntimeValue(
    runtime,
    "NON_TEXT_FIND_INPUT_PATTERN",
    () => NON_TEXT_FIND_INPUT_PATTERN,
    (value) => {
      NON_TEXT_FIND_INPUT_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "isTextEditingElement", () => isTextEditingElement);
  bindRuntimeValue(
    runtime,
    "blurEditingTargetForFind",
    () => blurEditingTargetForFind,
  );
  bindRuntimeValue(
    runtime,
    "FIND_BAR_LABEL",
    () => FIND_BAR_LABEL,
    (value) => {
      FIND_BAR_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FIND_PREVIOUS_LABEL",
    () => FIND_PREVIOUS_LABEL,
    (value) => {
      FIND_PREVIOUS_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FIND_NEXT_LABEL",
    () => FIND_NEXT_LABEL,
    (value) => {
      FIND_NEXT_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FIND_CLOSE_LABEL",
    () => FIND_CLOSE_LABEL,
    (value) => {
      FIND_CLOSE_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FIND_PLACEHOLDER",
    () => FIND_PLACEHOLDER,
    (value) => {
      FIND_PLACEHOLDER = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FIND_NO_MATCHES_LABEL",
    () => FIND_NO_MATCHES_LABEL,
    (value) => {
      FIND_NO_MATCHES_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findCountAnnouncement",
    () => findCountAnnouncement,
  );
  bindRuntimeValue(
    runtime,
    "jsxDY",
    () => jsxDY,
    (value) => {
      jsxDY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FIND_BAR_STYLE",
    () => FIND_BAR_STYLE,
    (value) => {
      FIND_BAR_STYLE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FIND_BAR_INPUT_STYLE",
    () => FIND_BAR_INPUT_STYLE,
    (value) => {
      FIND_BAR_INPUT_STYLE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FIND_BAR_COUNT_STYLE",
    () => FIND_BAR_COUNT_STYLE,
    (value) => {
      FIND_BAR_COUNT_STYLE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FIND_BAR_LIVE_REGION_STYLE",
    () => FIND_BAR_LIVE_REGION_STYLE,
    (value) => {
      FIND_BAR_LIVE_REGION_STYLE = value;
    },
  );
  bindRuntimeValue(runtime, "findCountReadout", () => findCountReadout);
  bindRuntimeValue(runtime, "FindBar", () => FindBar);
  bindRuntimeValue(
    runtime,
    "preserveFindStatusWhileSearching",
    () => preserveFindStatusWhileSearching,
  );
  bindRuntimeValue(runtime, "OpenFindBar", () => OpenFindBar);
  return () => {
    (0, runtime.initializeUiInputs210)();
    reactsq = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeUiPropertyFocus)();
    FIND_BAR_ATTRIBUTE = "data-mc-find";
    FIND_BAR_EDIT_SHORTCUTS = ["x", "c", "v", "z", "y", "a", "d"];
    findBarKeyHandlers = new WeakMap();
    findBarListenerWindows = new WeakSet();
    if (typeof window !== "undefined") {
      installFindBarEventGuards(window);
    }
    NON_TEXT_FIND_INPUT_PATTERN =
      /^(range|checkbox|radio|button|submit|reset|color|file|image)$/;
    FIND_BAR_LABEL = "Find in page";
    FIND_PREVIOUS_LABEL = "Previous match";
    FIND_NEXT_LABEL = "Next match";
    FIND_CLOSE_LABEL = "Close find bar";
    FIND_PLACEHOLDER = "Type to search";
    FIND_NO_MATCHES_LABEL = "No matches";
    jsxDY = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    FIND_BAR_STYLE = {
      position: "absolute",
      top: "max(var(--tb-overlay-h, 0px), 8px)",
      insetInlineEnd: 12,
      zIndex: 49,
      display: "flex",
      alignItems: "center",
      gap: 4,
      padding: 5,
      width: 320,
      maxWidth: "calc(100% - 24px)",
    };
    FIND_BAR_INPUT_STYLE = {
      flex: "1 1 0",
      minWidth: 0,
    };
    FIND_BAR_COUNT_STYLE = {
      minWidth: "3.5em",
      textAlign: "end",
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap",
    };
    FIND_BAR_LIVE_REGION_STYLE = {
      position: "absolute",
      width: 1,
      height: 1,
      overflow: "hidden",
      clipPath: "inset(50%)",
      whiteSpace: "nowrap",
    };
  };
}
