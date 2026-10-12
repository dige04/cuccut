/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  AriaAttributes,
  Context,
  ForwardRefExoticComponent,
  ForwardedRef,
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
  RefAttributes,
  RefObject,
  UIEvent as ReactUIEvent,
} from "react";
import type { ButtonProps, SurfaceProps } from "./disclosure";
import type { ElevationName } from "./interactions";
import type { PopoverSide } from "./property-focus";

export interface ToolbarWhenVisibleProps {
  children?: ReactNode;
}

export interface ToolbarCaretProps {
  /** Takes the colour of the button instead of the muted foreground. */
  inherit?: boolean;
}

/** What a toolbar button shows in its tooltip. */
export interface ToolbarTooltipInput {
  label: string;
  tip?: string;
  disabledTip?: string;
  shortcut?: string;
  disabled?: boolean;
}

export interface ToolbarTooltipContent {
  content: string;
  shortcut: string | undefined;
}

export interface DisabledButtonDescriptionOptions {
  disabled: boolean;
  name: string;
  reason?: string;
  pressed?: AriaAttributes["aria-pressed"];
  expanded?: AriaAttributes["aria-expanded"];
  hasPopup?: AriaAttributes["aria-haspopup"];
}

/** Props that keep a disabled button focusable, plus the hidden node that carries its reason. */
export interface DisabledButtonDescription {
  props: HTMLAttributes<HTMLSpanElement>;
  inner: { "aria-hidden"?: boolean };
  mirror: ReactElement | null;
}

export interface ButtonAccessibilityOptions {
  disabled: boolean;
  name: string;
  tip: string;
  shortcut?: string;
  describedBy?: string;
  descriptionSuffix?: string;
}

export interface ButtonAccessibility {
  describedBy: string | undefined;
  keyShortcuts: string | undefined;
  mirror: ReactElement | null;
}

/** Display names of a shortcut part on Apple platforms and elsewhere. */
export type ShortcutNamePair = [apple: string, other: string];

/** A modifier symbol followed by the lowercase names that map to it. */
export type ShortcutSymbolModifier = [symbol: string, ...names: string[]];

/** Where and when a pointer went down or up, in event and performance time. */
export interface ToolbarPointerStamp {
  x: number;
  y: number;
  at: number;
  perf: number | null;
}

/** The latest primary pointer gesture, used to swallow clicks that touch release re-targets. */
export interface ToolbarPointerSession {
  onStrip: boolean;
  inPopup: boolean;
  mouse: boolean;
  began: ToolbarPointerStamp;
  ended: ToolbarPointerStamp | null;
  early?: boolean;
  runAt?: number;
  stray?: boolean;
  end?: number;
}

export interface CompletedToolbarPointerSession extends ToolbarPointerSession {
  ended: ToolbarPointerStamp;
}

/** The parts of a mouse or pointer event the click-through checks read. */
export interface ToolbarPointerEventLike {
  timeStamp: number;
  clientX: number;
  clientY: number;
}

export interface ToolbarClickEventLike extends ToolbarPointerEventLike {
  detail: number;
}

export interface ToolbarTouchDeadline {
  left: number;
  top: number;
  end: number;
  since: number;
  movedAt: number;
}

export interface ToolbarStripProps extends Omit<SurfaceProps, "elevation"> {
  surface?: "panel" | "popover";
  placed?: "above" | "below";
  coversSelection?: boolean;
  wrap?: boolean;
}

export interface ToolbarGroupProps extends HTMLAttributes<HTMLSpanElement> {
  wrap?: boolean;
  fields?: boolean;
}

export interface ToolbarButtonProps extends ButtonProps {
  glyph?: ReactNode;
  label: string;
  tip?: string;
  disabledTip?: string;
  descriptionSuffix?: string;
  expanded?: boolean;
  count?: number;
  caret?: boolean;
  tipSide?: PopoverSide;
}

export interface ToolbarStripButtonProps extends ButtonProps {
  chevron?: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reacty8: ReactNamespace;
    reactq8: ReactNamespace;
    jsxv1: JsxNamespace;
    jsxR8: JsxNamespace;
    PANEL_ELEVATION: ElevationName;
    POPOVER_ELEVATION: ElevationName;
    ToolbarFloatingContext: Context<boolean>;
    ToolbarQuietContext: Context<boolean>;
    ToolbarGroupWrapContext: Context<boolean>;
    SHORTCUT_MODIFIER_NAMES: Record<string, ShortcutNamePair>;
    SHORTCUT_MODIFIER_LABELS: string[];
    SHORTCUT_KEY_NAMES: Record<string, string | ShortcutNamePair>;
    ownShortcutMapping: <T>(mapping: Record<string, T>, key: string) => T | undefined;
    SHORTCUT_SYMBOL_MODIFIERS: ShortcutSymbolModifier[];
    SHORTCUT_SPOKEN_REPLACEMENTS: [RegExp, string, string][];
    ToolbarButton: ForwardRefExoticComponent<ToolbarButtonProps & RefAttributes<HTMLElement>>;
    ToolbarStripButton: ForwardRefExoticComponent<ToolbarStripButtonProps & RefAttributes<HTMLElement>>;
    toolbarPointerSession: ToolbarPointerSession | null;
    installedToolbarPointerDocuments: WeakSet<Document>;
    monotonicNow: () => number | null;
    TOOLBAR_POINTER_TIME_TOLERANCE: number;
    TOOLBAR_POINTER_COORDINATE_TOLERANCE: number;
    TOOLBAR_TOUCH_HOLD_MS: number;
    TOOLBAR_TOUCH_RECENCY_MS: number;
    TOOLBAR_STRAY_HOLD_MS: number;
    TOOLBAR_EARLY_HOLD_MS: number;
    pointInsideElement: (element: Element, x: number, y: number) => boolean;
    matchesToolbarPointerEvent: (event: ToolbarPointerEventLike, timestamp: number, x: number, y: number) => boolean;
    toolbarStrips: Set<HTMLElement>;
    toolbarClickThroughTimer: ReturnType<typeof setTimeout> | null;
    lastToolbarTouchRelease: number | null;
    afterTwoAnimationFrames: (callback: () => void) => void;
    TOOLBAR_POSITION_TOLERANCE: number;
    toolbarTouchDeadlines: WeakMap<Element, ToolbarTouchDeadline>;
    TOOLBAR_SCROLL_FOCUS_MARGIN: number;
    ToolbarWhenVisible: (props: ToolbarWhenVisibleProps) => ReactElement | null;
    ToolbarCaret: (props?: ToolbarCaretProps) => ReactElement;
    toolbarTooltipContent: (props: ToolbarTooltipInput) => ToolbarTooltipContent;
    useDisabledButtonDescription: (options: DisabledButtonDescriptionOptions) => DisabledButtonDescription;
    useDeferredTooltipFocus: (enabled: RefObject<HTMLElement | null>, onChange?: boolean) => void;
    accessibleKeyShortcut: (shortcut: string, isMac?: boolean) => string | undefined;
    shortcutSymbols: (shortcut: string) => string;
    spokenShortcut: (shortcut: string, isMac?: boolean) => string;
    useButtonAccessibility: (props: ButtonAccessibilityOptions) => ButtonAccessibility;
    completedToolbarPointerSession: (session: ToolbarPointerSession | null, allowStray?: boolean) => CompletedToolbarPointerSession | null;
    installToolbarPointerTracking: (document2: Document) => void;
    isToolbarClickThrough: (event: ToolbarClickEventLike) => boolean;
    coarseToolbarPointer: () => boolean;
    updateToolbarTouchDeadline: (element: Element, active: boolean) => void;
    toolbarElementClickThroughDeadline: (element: Element) => number;
    toolbarStripClickThroughDeadline: (element: Element, now: number) => number;
    toolbarRecentTouchDeadline: (element: Element, now: number) => number;
    updateToolbarOverflowAttributes: (strip: Element, row: HTMLElement) => void;
    updateToolbarClickThroughAttributes: () => void;
    ToolbarStrip: (props: ToolbarStripProps) => ReactElement;
    ToolbarGroup: (props: ToolbarGroupProps) => ReactElement;
    ToolbarDivider: () => ReactElement;
    toolbarScrollableRow: (strip: HTMLElement) => HTMLElement;
    scrollToolbarButtonIntoView: (strip: HTMLElement, button: Element) => void;
  }
}

export function installUiToolbarControls(runtime: RuntimeBindings): () => void {
  var reacty8: ReactNamespace;
  var PANEL_ELEVATION: ElevationName;
  var POPOVER_ELEVATION: ElevationName;
  var reactq8: ReactNamespace;
  var jsxv1: JsxNamespace;
  var ToolbarFloatingContext: Context<boolean>;
  var ToolbarQuietContext: Context<boolean>;
  var SHORTCUT_MODIFIER_NAMES: Record<string, ShortcutNamePair>;
  var SHORTCUT_MODIFIER_LABELS: string[];
  var SHORTCUT_KEY_NAMES: Record<string, string | ShortcutNamePair>;
  var ownShortcutMapping: <T>(mapping: Record<string, T>, key: string) => T | undefined;
  var SHORTCUT_SYMBOL_MODIFIERS: ShortcutSymbolModifier[];
  var SHORTCUT_SPOKEN_REPLACEMENTS: [RegExp, string, string][];
  var ToolbarButton: ForwardRefExoticComponent<ToolbarButtonProps & RefAttributes<HTMLElement>>;
  var jsxR8: JsxNamespace;
  var toolbarPointerSession: ToolbarPointerSession | null;
  var installedToolbarPointerDocuments: WeakSet<Document>;
  var monotonicNow: () => number | null;
  var TOOLBAR_POINTER_TIME_TOLERANCE: number;
  var TOOLBAR_POINTER_COORDINATE_TOLERANCE: number;
  var TOOLBAR_TOUCH_HOLD_MS: number;
  var TOOLBAR_TOUCH_RECENCY_MS: number;
  var TOOLBAR_STRAY_HOLD_MS: number;
  var TOOLBAR_EARLY_HOLD_MS: number;
  var pointInsideElement: (element: Element, x: number, y: number) => boolean;
  var matchesToolbarPointerEvent: (event: ToolbarPointerEventLike, timestamp: number, x: number, y: number) => boolean;
  var toolbarStrips: Set<HTMLElement>;
  var toolbarClickThroughTimer: ReturnType<typeof setTimeout> | null;
  var lastToolbarTouchRelease: number | null;
  var afterTwoAnimationFrames: (callback: () => void) => void;
  var TOOLBAR_POSITION_TOLERANCE: number;
  var toolbarTouchDeadlines: WeakMap<Element, ToolbarTouchDeadline>;
  var ToolbarGroupWrapContext: Context<boolean>;
  var ToolbarStripButton: ForwardRefExoticComponent<ToolbarStripButtonProps & RefAttributes<HTMLElement>>;
  var TOOLBAR_SCROLL_FOCUS_MARGIN: number;
  function ToolbarWhenVisible({ children: children }: ToolbarWhenVisibleProps): ReactElement | null {
    if (reactq8.useContext(ToolbarQuietContext)) {
      return null;
    } else {
      return jsxv1.jsx(jsxv1.Fragment, {
        children: children,
      });
    }
  }
  function ToolbarCaret({ inherit = false }: ToolbarCaretProps = {}): ReactElement {
    return jsxv1.jsx(runtime.Icon, {
      name: "CaretDown",
      size: "xs",
      className: (0, runtime.joinClassNames)(
        "-mx-0.5 shrink-0",
        !inherit && "text-fg-muted",
      ),
    });
  }
  function toolbarTooltipContent(props: ToolbarTooltipInput): ToolbarTooltipContent {
    if (props.disabled) {
      return {
        content: props.disabledTip ?? props.tip ?? props.label,
        shortcut: undefined,
      };
    } else {
      return {
        content: props.tip ?? props.label,
        shortcut: props.shortcut,
      };
    }
  }
  function useDisabledButtonDescription(options: DisabledButtonDescriptionOptions): DisabledButtonDescription {
    let value = reactq8.useId();
    if (!options.disabled) {
      return {
        props: {},
        inner: {},
        mirror: null,
      };
    }
    let value2 = !!options.reason && options.reason !== options.name;
    return {
      props: {
        role: "button",
        "aria-disabled": true,
        "aria-label": options.name,
        "aria-describedby": value2 ? value : undefined,
        "aria-pressed": options.pressed,
        "aria-expanded": options.expanded,
        "aria-haspopup": options.hasPopup,
      },
      inner: {
        "aria-hidden": true,
      },
      mirror: value2
        ? jsxv1.jsx("span", {
            hidden: true,
            id: value,
            children: options.reason,
          })
        : null,
    };
  }
  function useDeferredTooltipFocus(
    enabled: RefObject<HTMLElement | null>,
    onChange?: boolean,
  ): void {
    let ref = reactq8.useRef(onChange);
    ref.current = onChange;
    let ref2 = reactq8.useRef<boolean | undefined>(undefined),
      ref3 = reactq8.useRef(false),
      current = reactq8.useRef((event: Event): void => {
        let currentTarget = event.currentTarget as HTMLElement;
        if (event.type === "pointerdown") {
          ref2.current = false;
        } else if (event.type === "focusout") {
          let relatedTarget = (event as FocusEvent).relatedTarget;
          if (
            event.target === currentTarget &&
            relatedTarget instanceof Node &&
            relatedTarget.isConnected &&
            !currentTarget.contains(relatedTarget)
          ) {
            ref3.current = false;
          }
        } else if (
          ((ref2.current =
            event.target instanceof Element &&
            event.target.matches(":focus-visible")),
          event.type === "focusin" &&
            event.target === currentTarget &&
            ref.current)
        ) {
          ref3.current = ref2.current;
        }
      }).current,
      current2 = reactq8.useRef(() => {
        ref3.current = false;
      }).current,
      ref4 = reactq8.useRef<HTMLElement | null>(null),
      callback = (element: HTMLElement | null): void => {
        let current3 = ref4.current;
        if (element === current3) {
          return;
        }
        let items = ["focusin", "focusout", "keydown", "pointerdown"];
        if (current3 !== null) {
          for (let value of items)
            current3.removeEventListener(value, current);
          current3.ownerDocument.removeEventListener(
            "pointerdown",
            current2,
            true,
          );
        }
        ref4.current = element;
        if (element !== null) {
          for (let value of items)
            element.addEventListener(value, current);
          element.ownerDocument.addEventListener("pointerdown", current2, true);
        }
      };
    reactq8.useLayoutEffect(() => callback(enabled.current));
    reactq8.useLayoutEffect(() => () => callback(null), []);
    reactq8.useLayoutEffect(() => {
      let current3 = enabled.current;
      if (current3 === null) {
        return;
      }
      let ownerDocument = current3.ownerDocument,
        value =
          ownerDocument.activeElement instanceof HTMLElement ||
          ownerDocument.activeElement instanceof SVGElement
            ? ownerDocument.activeElement
            : null,
        value2 =
          value === null ||
          value === ownerDocument.body ||
          value === ownerDocument.documentElement;
      if (onChange) {
        if (
          ownerDocument.hasFocus() &&
          !value2 &&
          value !== current3 &&
          current3.contains(value) &&
          (ref2.current ?? value!.matches(":focus-visible"))
        ) {
          current3.focus({
            preventScroll: true,
          });
        }
      } else {
        let current4 = ref3.current;
        ref3.current = false;
        if (
          current4 &&
          (value === current3 || (value2 && ownerDocument.hasFocus()))
        ) {
          current3.querySelector("button")?.focus({
            preventScroll: true,
          });
        }
      }
    }, [onChange]);
  }
  function accessibleKeyShortcut(shortcut: string, isMac?: boolean): string | undefined {
    let value = shortcut.trim().replace(/\s*\+\s*/g, "+");
    if (value === "" || /\s/.test(value)) {
      return;
    }
    let items: string[] = [],
      items2: string[] = [];
    for (let value2 of value.split("+")) {
      let value3 = value2.toLowerCase();
      if (value3 === "") {
        continue;
      }
      let value4 = ownShortcutMapping(SHORTCUT_MODIFIER_NAMES, value3);
      if (value4 !== undefined) {
        let value6 = value4[isMac ? 0 : 1];
        if (!items.includes(value6)) {
          items.push(value6);
        }
        continue;
      }
      let value5 = ownShortcutMapping(SHORTCUT_KEY_NAMES, value3);
      items2.push(
        value5 !== undefined
          ? typeof value5 === "string"
            ? value5
            : value5[isMac ? 0 : 1]
          : value3.length === 1
            ? value3.toUpperCase()
            : value3.charAt(0).toUpperCase() + value3.slice(1),
      );
    }
    if (items2.length === 0) {
      return;
    }
    items.sort(
      (input: string, options: string): number =>
        SHORTCUT_MODIFIER_LABELS.indexOf(input) -
        SHORTCUT_MODIFIER_LABELS.indexOf(options),
    );
    return [...items, ...items2].join("+");
  }
  function shortcutSymbols(shortcut: string): string {
    let value = shortcut
        .trim()
        .replace(/\s*\+\s*/g, "+")
        .split("+")
        .filter((input: string): boolean => input !== ""),
      callback = (input: string): boolean =>
        SHORTCUT_SYMBOL_MODIFIERS.some(
          ([, ...input2]: ShortcutSymbolModifier): boolean =>
            input2.includes(input.toLowerCase()),
        ),
      value2 = SHORTCUT_SYMBOL_MODIFIERS.filter(
        ([, ...input]: ShortcutSymbolModifier): boolean =>
          value.some(
            (input2: string): boolean => input.includes(input2.toLowerCase()),
          ),
      ).map(([input]: ShortcutSymbolModifier): string => input),
      value3 = value
        .filter((input: string): boolean => !callback(input))
        .map(
          (input: string): string =>
            input.charAt(0).toUpperCase() + input.slice(1),
        );
    return [...value2, ...value3].join("");
  }
  function spokenShortcut(shortcut: string, isMac?: boolean): string {
    let value = shortcut;
    for (let [
      value2,
      value3,
      value4,
    ] of SHORTCUT_SPOKEN_REPLACEMENTS)
      value = value.replace(value2, isMac ? value3 : value4);
    return value.replace(/ {2,}/g, " ").trim();
  }
  function useButtonAccessibility(props: ButtonAccessibilityOptions): ButtonAccessibility {
    let value = reactq8.useId(),
      value2 = (0, runtime.useAppleKeyboard)(),
      value3 = !props.disabled,
      value4 = props.tip !== "" && !props.name.includes(props.tip),
      value5 =
        value3 && props.shortcut !== undefined
          ? accessibleKeyShortcut(props.shortcut, value2)
          : undefined,
      value6 =
        value3 && props.shortcut !== undefined
          ? (0, runtime.shortcutToAriaKeyShortcuts)(props.shortcut, value2)
          : undefined,
      value7 =
        value3 && props.descriptionSuffix ? props.descriptionSuffix : undefined,
      value8 =
        value3 && (value4 || value5 !== undefined || value7 !== undefined),
      value9 =
        [props.describedBy, value8 ? value : undefined]
          .filter(Boolean)
          .join(" ") || undefined;
    if (!value8) {
      return {
        describedBy: value9,
        keyShortcuts: value6,
        mirror: null,
      };
    }
    let value10 = [
        value4 ? spokenShortcut(props.tip, value2) : undefined,
        value5 !== undefined ? "Shortcut: " + value5 : undefined,
      ]
        .filter(Boolean)
        .join(". "),
      value11 =
        value7 === undefined
          ? value10
          : value10 === ""
            ? value7
            : value10 + (/[.!?]$/.test(value10) ? " " : ". ") + value7;
    return {
      describedBy: value9,
      keyShortcuts: value6,
      mirror: jsxv1.jsx("span", {
        hidden: true,
        id: value,
        children: value11,
      }),
    };
  }
  function completedToolbarPointerSession(
    session: ToolbarPointerSession | null,
    allowStray: boolean = false,
  ): CompletedToolbarPointerSession | null {
    if (
      session === null ||
      session.ended === null ||
      (session.onStrip && !(allowStray && session.stray === true)) ||
      session.inPopup ||
      session.mouse
    ) {
      return null;
    }
    if (!(session.ended.at - session.began.at >= 0)) {
      return null;
    }
    return session as CompletedToolbarPointerSession;
  }
  function installToolbarPointerTracking(document2: Document): void {
    if (installedToolbarPointerDocuments.has(document2)) {
      return;
    }
    installedToolbarPointerDocuments.add(document2);
    document2.addEventListener(
      "pointerdown",
      (event: PointerEvent): void => {
        if (event.isPrimary === false) {
          return;
        }
        let value = monotonicNow();
        for (let value7 of Array.from(
          document2.querySelectorAll("[data-mc-through]"),
        )) {
          let value8 = Number(
            value7.getAttribute("data-mc-through") || Number.NaN,
          );
          if (
            !(
              value !== null &&
              value < value8 &&
              value8 - value <= TOOLBAR_EARLY_HOLD_MS
            )
          ) {
            value7.removeAttribute("data-mc-through");
          }
        }
        let target = event.target as Element | null,
          value2 = target?.closest?.("[data-mc-strip]") ?? null,
          state: ToolbarPointerSession = {
            onStrip: value2 !== null,
            inPopup: target?.closest?.(runtime.OPEN_OVERLAY_SELECTOR) != null,
            mouse: event.pointerType === "mouse",
            began: {
              x: event.clientX,
              y: event.clientY,
              at: event.timeStamp,
              perf: value,
            },
            ended: null,
          },
          value3 = value === null ? -1 : value - event.timeStamp;
        if (
          value2 !== null &&
          event.pointerType !== "mouse" &&
          value3 >= 0 &&
          value3 <= TOOLBAR_TOUCH_RECENCY_MS
        ) {
          state.early =
            event.timeStamp < toolbarElementClickThroughDeadline(value2);
        }
        let value4 = completedToolbarPointerSession(
            toolbarPointerSession,
            true,
          ),
          value5 =
            value4 === null ? -1 : event.timeStamp - value4.ended.at,
          value6 =
            value4 === null ? 0 : (value4.runAt ?? value4.ended.at);
        if (
          value4 !== null &&
          value5 >= 0 &&
          value5 <= TOOLBAR_POINTER_TIME_TOLERANCE &&
          event.timeStamp - value6 < TOOLBAR_TOUCH_HOLD_MS
        ) {
          state.runAt = value6;
          state.stray =
            event.pointerType !== "mouse" &&
            value2 !== null &&
            pointInsideElement(value2, value4.ended.x, value4.ended.y);
        }
        toolbarPointerSession = state;
      },
      true,
    );
    document2.addEventListener(
      "pointerup",
      (input: PointerEvent): void => {
        if (input.isPrimary !== false && toolbarPointerSession !== null) {
          toolbarPointerSession.ended = {
            at: input.timeStamp,
            x: input.clientX,
            y: input.clientY,
            perf: monotonicNow(),
          };
        }
        updateToolbarClickThroughAttributes();
      },
      true,
    );
  }
  function isToolbarClickThrough(event: ToolbarClickEventLike): boolean {
    let value = toolbarPointerSession;
    if (event.detail === 0 || value === null) {
      return false;
    }
    if (value.stray === true || value.early === true) {
      return (
        matchesToolbarPointerEvent(
          event,
          value.began.at,
          value.began.x,
          value.began.y,
        ) ||
        (value.ended !== null &&
          matchesToolbarPointerEvent(
            event,
            value.ended.at,
            value.ended.x,
            value.ended.y,
          ))
      );
    }
    return (
      !value.onStrip &&
      value.ended !== null &&
      matchesToolbarPointerEvent(
        event,
        value.ended.at,
        value.ended.x,
        value.ended.y,
      )
    );
  }
  function coarseToolbarPointer(): boolean {
    try {
      return (
        typeof matchMedia === "function" &&
        matchMedia(runtime.COARSE_POINTER_QUERY)?.matches === true
      );
    } catch {
      return false;
    }
  }
  function updateToolbarTouchDeadline(
    element: Element,
    active: boolean,
  ): void {
    let entry = toolbarTouchDeadlines.get(element);
    if (!active) {
      if (entry !== undefined) {
        toolbarTouchDeadlines.delete(element);
      }
      return;
    }
    let value = monotonicNow(),
      bounds = element.getBoundingClientRect(),
      value2 =
        entry === undefined ||
        Math.abs(bounds.left - entry.left) > TOOLBAR_POSITION_TOLERANCE ||
        Math.abs(bounds.top - entry.top) > TOOLBAR_POSITION_TOLERANCE,
      value3 = toolbarPointerSession,
      value4 =
        value3 === null
          ? null
          : value3.ended === null
            ? value3.began.perf
            : value3.ended.perf,
      value5 = value === null || value4 === null ? -1 : value - value4,
      value6 =
        value3 !== null &&
        ((value3.onStrip && value3.stray !== true && value3.early !== true) ||
          value3.inPopup) &&
        value5 >= 0 &&
        value5 <=
          (value3.ended === null
            ? TOOLBAR_TOUCH_HOLD_MS
            : TOOLBAR_POINTER_TIME_TOLERANCE);
    if (value6 && entry !== undefined) {
      [entry.left, entry.top] = [bounds.left, bounds.top];
    }
    if (
      !value2 ||
      value === null ||
      !(bounds.width > 0 && bounds.height > 0) ||
      !coarseToolbarPointer()
    ) {
      return;
    }
    if (value6) {
      if (entry === undefined) {
        toolbarTouchDeadlines.set(element, {
          left: bounds.left,
          top: bounds.top,
          end: 0,
          since: value,
          movedAt: 0,
        });
      }
      return;
    }
    let value7 =
        entry !== undefined &&
        (value < entry.end || value - entry.movedAt <= TOOLBAR_TOUCH_HOLD_MS)
          ? entry.since
          : value,
      state = {
        left: bounds.left,
        top: bounds.top,
        end: Math.min(
          value + TOOLBAR_STRAY_HOLD_MS + TOOLBAR_POINTER_TIME_TOLERANCE,
          value7 + TOOLBAR_EARLY_HOLD_MS,
        ),
        since: value7,
        movedAt: value,
      };
    toolbarTouchDeadlines.set(element, state);
    afterTwoAnimationFrames(() => {
      let value8 = monotonicNow();
      if (value8 !== null && toolbarTouchDeadlines.get(element) === state) {
        state.end = Math.min(
          state.end,
          value8 + TOOLBAR_POINTER_TIME_TOLERANCE,
        );
      }
      updateToolbarClickThroughAttributes();
    });
  }
  function toolbarElementClickThroughDeadline(element: Element): number {
    let value = completedToolbarPointerSession(toolbarPointerSession),
      value2 =
        value !== null &&
        value.end !== undefined &&
        pointInsideElement(element, value.ended.x, value.ended.y)
          ? value.end
          : 0;
    return Math.max(toolbarTouchDeadlines.get(element)?.end ?? 0, value2);
  }
  function toolbarStripClickThroughDeadline(
    element: Element,
    now: number,
  ): number {
    return Math.max(
      toolbarTouchDeadlines.get(element)?.end ?? 0,
      toolbarRecentTouchDeadline(element, now),
    );
  }
  function toolbarRecentTouchDeadline(
    element: Element,
    now: number,
  ): number {
    let value = completedToolbarPointerSession(toolbarPointerSession);
    if (value === null || value.ended.perf === null) {
      return 0;
    }
    if (value.end === undefined) {
      let value2 = now - value.ended.perf;
      if (
        !(value2 >= 0 && value2 <= TOOLBAR_TOUCH_RECENCY_MS) ||
        !pointInsideElement(element, value.ended.x, value.ended.y)
      ) {
        return 0;
      }
      let value3 =
        lastToolbarTouchRelease !== null &&
        value.began.perf !== null &&
        value.began.perf < lastToolbarTouchRelease;
      if (!value3) {
        lastToolbarTouchRelease =
          now + TOOLBAR_STRAY_HOLD_MS + TOOLBAR_TOUCH_HOLD_MS;
      }
      let value4 = lastToolbarTouchRelease ?? 0;
      value.end = Math.min(
        now + TOOLBAR_STRAY_HOLD_MS + TOOLBAR_POINTER_TIME_TOLERANCE,
        value4,
      );
      afterTwoAnimationFrames(() => {
        let value5 = monotonicNow();
        if (value5 !== null && !value3 && lastToolbarTouchRelease === value4) {
          lastToolbarTouchRelease = Math.min(
            value4,
            value5 + TOOLBAR_TOUCH_HOLD_MS,
          );
        }
        if (value5 !== null && value.end !== undefined) {
          value.end = Math.min(
            value.end,
            value5 + TOOLBAR_POINTER_TIME_TOLERANCE,
            lastToolbarTouchRelease ?? 0,
          );
        }
        updateToolbarClickThroughAttributes();
      });
    }
    if (
      now < value.end &&
      pointInsideElement(element, value.ended.x, value.ended.y)
    ) {
      return value.end;
    } else {
      return 0;
    }
  }
  function updateToolbarOverflowAttributes(
    strip: Element,
    row: HTMLElement,
  ): void {
    strip.toggleAttribute("data-mc-more-start", row.scrollLeft > 1);
    strip.toggleAttribute(
      "data-mc-more-end",
      row.scrollLeft < row.scrollWidth - row.clientWidth - 1,
    );
  }
  function updateToolbarClickThroughAttributes(): void {
    if (toolbarClickThroughTimer !== null) {
      clearTimeout(toolbarClickThroughTimer);
    }
    toolbarClickThroughTimer = null;
    let value = monotonicNow(),
      index = 0;
    for (let value2 of toolbarStrips) {
      let value3 =
        value === null ? 0 : toolbarStripClickThroughDeadline(value2, value);
      if (value !== null && value < value3) {
        value2.setAttribute("data-mc-through", String(Math.ceil(value3)));
        index = Math.max(index, value3);
      } else {
        value2.removeAttribute("data-mc-through");
      }
    }
    if (value !== null && index > 0) {
      toolbarClickThroughTimer = setTimeout(
        updateToolbarClickThroughAttributes,
        Math.min(TOOLBAR_POINTER_TIME_TOLERANCE, Math.max(0, index - value)) +
          1,
      );
    }
  }
  function ToolbarStrip({
    className: className,
    onPointerDown: onPointerDown,
    onMouseDown: onMouseDown,
    onMouseDownCapture: onMouseDownCapture,
    onClickCapture: onClickCapture,
    onScroll: onScroll,
    children: children,
    surface = "panel",
    placed = "above",
    coversSelection: coversSelection,
    wrap = false,
    ...remainingProps
  }: ToolbarStripProps): ReactElement {
    reacty8.useEffect(
      () => installToolbarPointerTracking(document),
      [],
    );
    let ref = reacty8.useRef<HTMLDivElement | null>(null),
      ref2 = reacty8.useRef<HTMLDivElement | null>(null),
      value = (0, runtime.useCoarsePointer)();
    reacty8.useLayoutEffect(() => {
      let current = ref.current;
      if (current === null) {
        return;
      }
      toolbarStrips.add(current);
      return () => {
        toolbarStrips.delete(current);
        if (toolbarStrips.size === 0 && toolbarClickThroughTimer !== null) {
          clearTimeout(toolbarClickThroughTimer);
          toolbarClickThroughTimer = null;
        }
      };
    }, []);
    reacty8.useLayoutEffect(() => {
      if (ref.current !== null) {
        updateToolbarTouchDeadline(ref.current, coversSelection === true);
      }
      updateToolbarClickThroughAttributes();
      if (ref.current !== null && ref2.current !== null) {
        updateToolbarOverflowAttributes(ref.current, ref2.current);
      }
    });
    reacty8.useLayoutEffect(() => {
      let current = ref.current,
        current2 = ref2.current;
      if (
        current === null ||
        current2 === null ||
        typeof ResizeObserver === "undefined"
      ) {
        return;
      }
      let observer = new ResizeObserver(
        () => updateToolbarOverflowAttributes(current, current2),
      );
      observer.observe(current2);
      return () => observer.disconnect();
    }, []);
    reacty8.useLayoutEffect(() => {
      let current = ref.current,
        current2 = ref2.current;
      if (
        surface !== "popover" ||
        current === null ||
        current2 === null ||
        typeof ResizeObserver === "undefined"
      ) {
        return;
      }
      let callback = () => {
          let element = current2.querySelector<HTMLElement>('[data-cds="Button"]'),
            value2 = getComputedStyle(current2),
            value3 =
              (element?.offsetHeight ?? 0) +
              (parseFloat(value2.paddingTop) || 0) +
              (parseFloat(value2.paddingBottom) || 0);
          current.toggleAttribute(
            "data-mc-wrapped",
            element !== null && current2.clientHeight > value3 + 1,
          );
        },
        observer = new ResizeObserver(callback);
      observer.observe(current2);
      callback();
      return () => observer.disconnect();
    }, [surface]);
    return jsxR8.jsx(runtime.CdsRoot, {
      density: surface === "popover" && value ? "comfortable" : "compact",
      render: jsxR8.jsx(runtime.Surface, {
        elevation: POPOVER_ELEVATION,
        role: "toolbar",
        "data-mc-strip": "",
        "data-mc-surface": surface,
        onPointerDown: (input: ReactPointerEvent<HTMLDivElement>): void => {
          input.stopPropagation();
          onPointerDown?.(input);
        },
        onMouseDownCapture: (event: ReactMouseEvent<HTMLDivElement>): void => {
          if (
            event.currentTarget.contains(event.target as Node) &&
            isToolbarClickThrough(event)
          ) {
            event.preventDefault();
            event.stopPropagation();
          }
          onMouseDownCapture?.(event);
        },
        onClickCapture: (event: ReactMouseEvent<HTMLDivElement>): void => {
          if (
            event.currentTarget.contains(event.target as Node) &&
            isToolbarClickThrough(event)
          ) {
            event.preventDefault();
            event.stopPropagation();
          }
          onClickCapture?.(event);
        },
        onMouseDown: (event: ReactMouseEvent<HTMLDivElement>): void => {
          if (!(event.target as Element).closest(runtime.TEXT_EDITABLE_SELECTOR)) {
            event.preventDefault();
          }
          onMouseDown?.(event);
        },
        className: (0, runtime.joinClassNames)(
          "z-selection flex items-center",
          surface === "popover"
            ? "[--mc-group-gap:2px] [--mc-strip-gap:4px] [--mc-strip-pad:5px] pointer-coarse:rounded-xl pointer-coarse:[--mc-group-gap:8px] pointer-coarse:[--mc-strip-gap:8px] pointer-coarse:[--mc-strip-pad:6px] [&_[data-mc-divider]]:mx-0"
            : "[--mc-strip-gap:2px] [--mc-strip-pad:4px] [--mc-group-gap:4px]",
          "max-w-[calc(100vw-16px)] overflow-clip",
          className,
        ),
        ...remainingProps,
        ref: ref,
      }),
      children: jsxR8.jsxs("div", {
        className: "relative min-w-0 flex-auto rounded-[inherit]",
        children: [
          jsxR8.jsx("div", {
            ref: ref2,
            "data-mc-row": "",
            onScroll: (input: ReactUIEvent<HTMLDivElement>): void => {
              if (ref.current !== null) {
                updateToolbarOverflowAttributes(
                  ref.current,
                  input.currentTarget,
                );
              }
              onScroll?.(input);
            },
            className: (0, runtime.joinClassNames)(
              "flex min-w-0 items-center gap-[var(--mc-strip-gap)] rounded-[inherit] p-[var(--mc-strip-pad)]",
              wrap
                ? "flex-wrap"
                : "overflow-x-auto [clip-path:inset(0_1px)] [scrollbar-width:none] [&>*]:shrink-0",
            ),
            children: jsxR8.jsx(runtime.ToolbarTooltipSideContext.Provider, {
              value: placed === "below" ? "bottom" : "top",
              children: jsxR8.jsx(ToolbarGroupWrapContext.Provider, {
                value: wrap,
                children: jsxR8.jsx(runtime.TooltipProvider, {
                  children: children,
                }),
              }),
            }),
          }),
          jsxR8.jsx("span", {
            "aria-hidden": "true",
            "data-tb-fade": "start",
            className:
              "pointer-events-none absolute inset-y-px left-px z-10 w-12",
            children: jsxR8.jsx("span", {
              className:
                "pointer-events-auto absolute inset-y-0 left-0 w-[30%]",
            }),
          }),
          jsxR8.jsx("span", {
            "aria-hidden": "true",
            "data-tb-fade": "end",
            className:
              "pointer-events-none absolute inset-y-px right-px z-10 w-12",
            children: jsxR8.jsx("span", {
              className:
                "pointer-events-auto absolute inset-y-0 right-0 w-[30%]",
            }),
          }),
        ],
      }),
    });
  }
  function ToolbarGroup({
    wrap = false,
    fields = false,
    className: className,
    ...remainingProps
  }: ToolbarGroupProps): ReactElement {
    let value = reacty8.useContext(ToolbarGroupWrapContext);
    return jsxR8.jsx("span", {
      "data-mc-group": "",
      className: (0, runtime.joinClassNames)(
        "flex items-center gap-y-1",
        fields ? "gap-x-1" : "gap-x-[var(--mc-group-gap,4px)]",
        wrap && value && "max-w-full shrink-0 flex-wrap",
        className,
      ),
      ...remainingProps,
    });
  }
  function ToolbarDivider(): ReactElement {
    return jsxR8.jsx("span", {
      "aria-hidden": "true",
      "data-mc-divider": "",
      className: "mx-0.5 h-[18px] w-px bg-border-line",
    });
  }
  function toolbarScrollableRow(strip: HTMLElement): HTMLElement {
    return strip.querySelector<HTMLElement>("[data-mc-row]") ?? strip;
  }
  function scrollToolbarButtonIntoView(
    strip: HTMLElement,
    button: Element,
  ): void {
    let value = toolbarScrollableRow(strip),
      bounds = button.getBoundingClientRect(),
      bounds2 = value.getBoundingClientRect();
    if (bounds.left < bounds2.left + TOOLBAR_SCROLL_FOCUS_MARGIN) {
      value.scrollLeft -=
        bounds2.left + TOOLBAR_SCROLL_FOCUS_MARGIN - bounds.left;
    } else if (bounds.right > bounds2.right - TOOLBAR_SCROLL_FOCUS_MARGIN) {
      value.scrollLeft +=
        bounds.right - (bounds2.right - TOOLBAR_SCROLL_FOCUS_MARGIN);
    }
  }
  bindRuntimeValue(
    runtime,
    "reacty8",
    () => reacty8,
    (value) => {
      reacty8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PANEL_ELEVATION",
    () => PANEL_ELEVATION,
    (value) => {
      PANEL_ELEVATION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "POPOVER_ELEVATION",
    () => POPOVER_ELEVATION,
    (value) => {
      POPOVER_ELEVATION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactq8",
    () => reactq8,
    (value) => {
      reactq8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxv1",
    () => jsxv1,
    (value) => {
      jsxv1 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarFloatingContext",
    () => ToolbarFloatingContext,
    (value) => {
      ToolbarFloatingContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarQuietContext",
    () => ToolbarQuietContext,
    (value) => {
      ToolbarQuietContext = value;
    },
  );
  bindRuntimeValue(runtime, "ToolbarWhenVisible", () => ToolbarWhenVisible);
  bindRuntimeValue(runtime, "ToolbarCaret", () => ToolbarCaret);
  bindRuntimeValue(
    runtime,
    "toolbarTooltipContent",
    () => toolbarTooltipContent,
  );
  bindRuntimeValue(
    runtime,
    "useDisabledButtonDescription",
    () => useDisabledButtonDescription,
  );
  bindRuntimeValue(
    runtime,
    "useDeferredTooltipFocus",
    () => useDeferredTooltipFocus,
  );
  bindRuntimeValue(
    runtime,
    "SHORTCUT_MODIFIER_NAMES",
    () => SHORTCUT_MODIFIER_NAMES,
    (value) => {
      SHORTCUT_MODIFIER_NAMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHORTCUT_MODIFIER_LABELS",
    () => SHORTCUT_MODIFIER_LABELS,
    (value) => {
      SHORTCUT_MODIFIER_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHORTCUT_KEY_NAMES",
    () => SHORTCUT_KEY_NAMES,
    (value) => {
      SHORTCUT_KEY_NAMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ownShortcutMapping",
    () => ownShortcutMapping,
    (value) => {
      ownShortcutMapping = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "accessibleKeyShortcut",
    () => accessibleKeyShortcut,
  );
  bindRuntimeValue(
    runtime,
    "SHORTCUT_SYMBOL_MODIFIERS",
    () => SHORTCUT_SYMBOL_MODIFIERS,
    (value) => {
      SHORTCUT_SYMBOL_MODIFIERS = value;
    },
  );
  bindRuntimeValue(runtime, "shortcutSymbols", () => shortcutSymbols);
  bindRuntimeValue(
    runtime,
    "SHORTCUT_SPOKEN_REPLACEMENTS",
    () => SHORTCUT_SPOKEN_REPLACEMENTS,
    (value) => {
      SHORTCUT_SPOKEN_REPLACEMENTS = value;
    },
  );
  bindRuntimeValue(runtime, "spokenShortcut", () => spokenShortcut);
  bindRuntimeValue(
    runtime,
    "useButtonAccessibility",
    () => useButtonAccessibility,
  );
  bindRuntimeValue(
    runtime,
    "ToolbarButton",
    () => ToolbarButton,
    (value) => {
      ToolbarButton = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxR8",
    () => jsxR8,
    (value) => {
      jsxR8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toolbarPointerSession",
    () => toolbarPointerSession,
    (value) => {
      toolbarPointerSession = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "installedToolbarPointerDocuments",
    () => installedToolbarPointerDocuments,
    (value) => {
      installedToolbarPointerDocuments = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "monotonicNow",
    () => monotonicNow,
    (value) => {
      monotonicNow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOOLBAR_POINTER_TIME_TOLERANCE",
    () => TOOLBAR_POINTER_TIME_TOLERANCE,
    (value) => {
      TOOLBAR_POINTER_TIME_TOLERANCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOOLBAR_POINTER_COORDINATE_TOLERANCE",
    () => TOOLBAR_POINTER_COORDINATE_TOLERANCE,
    (value) => {
      TOOLBAR_POINTER_COORDINATE_TOLERANCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOOLBAR_TOUCH_HOLD_MS",
    () => TOOLBAR_TOUCH_HOLD_MS,
    (value) => {
      TOOLBAR_TOUCH_HOLD_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOOLBAR_TOUCH_RECENCY_MS",
    () => TOOLBAR_TOUCH_RECENCY_MS,
    (value) => {
      TOOLBAR_TOUCH_RECENCY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOOLBAR_STRAY_HOLD_MS",
    () => TOOLBAR_STRAY_HOLD_MS,
    (value) => {
      TOOLBAR_STRAY_HOLD_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOOLBAR_EARLY_HOLD_MS",
    () => TOOLBAR_EARLY_HOLD_MS,
    (value) => {
      TOOLBAR_EARLY_HOLD_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "completedToolbarPointerSession",
    () => completedToolbarPointerSession,
  );
  bindRuntimeValue(
    runtime,
    "pointInsideElement",
    () => pointInsideElement,
    (value) => {
      pointInsideElement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "installToolbarPointerTracking",
    () => installToolbarPointerTracking,
  );
  bindRuntimeValue(
    runtime,
    "matchesToolbarPointerEvent",
    () => matchesToolbarPointerEvent,
    (value) => {
      matchesToolbarPointerEvent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isToolbarClickThrough",
    () => isToolbarClickThrough,
  );
  bindRuntimeValue(
    runtime,
    "toolbarStrips",
    () => toolbarStrips,
    (value) => {
      toolbarStrips = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toolbarClickThroughTimer",
    () => toolbarClickThroughTimer,
    (value) => {
      toolbarClickThroughTimer = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "lastToolbarTouchRelease",
    () => lastToolbarTouchRelease,
    (value) => {
      lastToolbarTouchRelease = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "afterTwoAnimationFrames",
    () => afterTwoAnimationFrames,
    (value) => {
      afterTwoAnimationFrames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOOLBAR_POSITION_TOLERANCE",
    () => TOOLBAR_POSITION_TOLERANCE,
    (value) => {
      TOOLBAR_POSITION_TOLERANCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toolbarTouchDeadlines",
    () => toolbarTouchDeadlines,
    (value) => {
      toolbarTouchDeadlines = value;
    },
  );
  bindRuntimeValue(runtime, "coarseToolbarPointer", () => coarseToolbarPointer);
  bindRuntimeValue(
    runtime,
    "updateToolbarTouchDeadline",
    () => updateToolbarTouchDeadline,
  );
  bindRuntimeValue(
    runtime,
    "toolbarElementClickThroughDeadline",
    () => toolbarElementClickThroughDeadline,
  );
  bindRuntimeValue(
    runtime,
    "toolbarStripClickThroughDeadline",
    () => toolbarStripClickThroughDeadline,
  );
  bindRuntimeValue(
    runtime,
    "toolbarRecentTouchDeadline",
    () => toolbarRecentTouchDeadline,
  );
  bindRuntimeValue(
    runtime,
    "ToolbarGroupWrapContext",
    () => ToolbarGroupWrapContext,
    (value) => {
      ToolbarGroupWrapContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "updateToolbarOverflowAttributes",
    () => updateToolbarOverflowAttributes,
  );
  bindRuntimeValue(
    runtime,
    "updateToolbarClickThroughAttributes",
    () => updateToolbarClickThroughAttributes,
  );
  bindRuntimeValue(runtime, "ToolbarStrip", () => ToolbarStrip);
  bindRuntimeValue(
    runtime,
    "ToolbarStripButton",
    () => ToolbarStripButton,
    (value) => {
      ToolbarStripButton = value;
    },
  );
  bindRuntimeValue(runtime, "ToolbarGroup", () => ToolbarGroup);
  bindRuntimeValue(runtime, "ToolbarDivider", () => ToolbarDivider);
  bindRuntimeValue(runtime, "toolbarScrollableRow", () => toolbarScrollableRow);
  bindRuntimeValue(
    runtime,
    "TOOLBAR_SCROLL_FOCUS_MARGIN",
    () => TOOLBAR_SCROLL_FOCUS_MARGIN,
    (value) => {
      TOOLBAR_SCROLL_FOCUS_MARGIN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "scrollToolbarButtonIntoView",
    () => scrollToolbarButtonIntoView,
  );
  return () => {
    (0, runtime.initializeUiInputs210)();
    reacty8 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    PANEL_ELEVATION = "panel";
    POPOVER_ELEVATION = "popover";
    (0, runtime.initializeUiPropertyFocus)();
    (0, runtime.initializeUiColorPicker)();
    (0, runtime.initializeColorSelect)();
    (0, runtime.initializeUiPointerMedia)();
    (0, runtime.initializeUiPropertyPopover2)();
    (0, runtime.initializeUiInputs210)();
    reactq8 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxv1 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    ToolbarFloatingContext = reactq8.createContext(false);
    ToolbarQuietContext = reactq8.createContext(false);
    SHORTCUT_MODIFIER_NAMES = {
      ctrl: ["Control", "Ctrl"],
      control: ["Control", "Ctrl"],
      alt: ["Option", "Alt"],
      option: ["Option", "Alt"],
      shift: ["Shift", "Shift"],
      cmd: ["Command", "Ctrl"],
      command: ["Command", "Ctrl"],
      meta: ["Command", "Ctrl"],
    };
    SHORTCUT_MODIFIER_LABELS = [
      "Control",
      "Ctrl",
      "Option",
      "Alt",
      "Shift",
      "Command",
    ];
    SHORTCUT_KEY_NAMES = {
      esc: "Escape",
      escape: "Escape",
      enter: ["Return", "Enter"],
      return: ["Return", "Enter"],
      delete: ["Delete", "Backspace"],
      backspace: ["Delete", "Backspace"],
      space: "Space",
      tab: "Tab",
      up: "Up Arrow",
      down: "Down Arrow",
      left: "Left Arrow",
      right: "Right Arrow",
      pageup: "Page Up",
      pagedown: "Page Down",
      "\\": "Backslash",
      "/": "Slash",
      "-": "Minus",
      "=": "Equals",
      ",": "Comma",
      ".": "Period",
      ";": "Semicolon",
      "'": "Apostrophe",
      "`": "Backtick",
      "[": "Left Bracket",
      "]": "Right Bracket",
    };
    ownShortcutMapping = <T>(mapping: Record<string, T>, key: string): T | undefined =>
      Object.hasOwn(mapping, key) ? mapping[key] : undefined;
    SHORTCUT_SYMBOL_MODIFIERS = [
      ["⌃", "ctrl", "control"],
      ["⌥", "alt", "option"],
      ["⇧", "shift"],
      ["⌘", "cmd", "command", "meta"],
    ];
    SHORTCUT_SPOKEN_REPLACEMENTS = [
      [/⌘/g, "Command ", "Ctrl "],
      [/⇧/g, "Shift ", "Shift "],
      [/⌥/g, "Option ", "Alt "],
      [/⌃/g, "Control ", "Ctrl "],
      [/⏎/g, "Return", "Enter"],
      [/⌫/g, "Delete", "Backspace"],
    ];
    ToolbarButton = reactq8.forwardRef<HTMLElement, ToolbarButtonProps>(function (
      {
        icon: icon,
        glyph: glyph,
        label: label,
        tip: tip,
        disabledTip: disabledTip,
        shortcut: shortcut,
        descriptionSuffix: descriptionSuffix,
        children: children,
        pressed: pressed,
        expanded: expanded,
        count: count,
        iconOnly: iconOnly,
        caret: caret,
        tipSide = "bottom",
        className: className,
        variant = "ghost",
        "aria-expanded": ariaExpanded,
        "aria-describedby": ariaDescribedby,
        ...props
      },
      options: ForwardedRef<HTMLElement>,
    ): ReactElement {
      let value = reactq8.useContext(ToolbarFloatingContext),
        value2 = props.disabled === true,
        value3 = count ? label + " (" + String(count) + ")" : label,
        value4 = icon ?? glyph,
        value5 = toolbarTooltipContent({
          label: label,
          tip: tip,
          disabledTip: disabledTip,
          shortcut: shortcut,
          disabled: value2,
        }),
        value6 = useButtonAccessibility({
          disabled: value2,
          name: value3,
          tip: value5.content,
          shortcut: value5.shortcut,
          describedBy: ariaDescribedby,
          descriptionSuffix: descriptionSuffix,
        }),
        value7 = useDisabledButtonDescription({
          disabled: value2,
          name: value3,
          reason: disabledTip ?? tip,
          pressed: pressed,
          expanded: expanded ?? ariaExpanded,
          hasPopup: props["aria-haspopup"],
        }),
        ref = reactq8.useRef<HTMLSpanElement | null>(null);
      useDeferredTooltipFocus(ref, value2);
      let state = {
          ...props,
          ref: options,
          variant: variant,
          pressed: pressed,
          "aria-expanded": expanded ?? ariaExpanded,
          "aria-label": value3,
          "aria-describedby": value6.describedBy,
          "aria-keyshortcuts":
            props["aria-keyshortcuts"] ?? value6.keyShortcuts,
          ...value7.inner,
        },
        value8 = iconOnly === true || (value && variant !== "primary"),
        value9 = value8 && caret !== true;
      return jsxv1.jsx(runtime.Tooltip, {
        content: value5.content,
        shortcut: value5.shortcut,
        side: tipSide,
        hoverable: false,
        children: jsxv1.jsxs("span", {
          ref: ref,
          tabIndex: value2 ? 0 : -1,
          ...value7.props,
          "data-tb-icon": value9 ? "" : undefined,
          className: (0, runtime.joinClassNames)(
            "relative inline-flex shrink-0 rounded align-top outline-none focus-visible:outline-hidden focus-visible:shadow-focus",
            className,
          ),
          children: [
            value8
              ? caret === true
                ? jsxv1.jsx(runtime.Button, {
                    ...state,
                    icon: value4,
                    children: jsxv1.jsx(ToolbarCaret, {}),
                  })
                : jsxv1.jsx(runtime.Button, {
                    ...state,
                    iconOnly: true,
                    icon: value4,
                    tooltip: false,
                  })
              : jsxv1.jsxs(runtime.Button, {
                  ...state,
                  icon: value4,
                  children: [
                    label,
                    children,
                    caret === true
                      ? jsxv1.jsx(ToolbarCaret, {
                          inherit: variant === "primary",
                        })
                      : null,
                  ],
                }),
            count
              ? jsxv1.jsx("span", {
                  "aria-hidden": "true",
                  className:
                    "pointer-events-none absolute -top-0.5 -right-0.5 flex",
                  children: jsxv1.jsx(runtime.Counter, {
                    value: count,
                    variant: "accent",
                    size: "xs",
                  }),
                })
              : null,
            value6.mirror,
            value7.mirror,
          ],
        }),
      });
    });
    jsxR8 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    toolbarPointerSession = null;
    installedToolbarPointerDocuments = new WeakSet();
    monotonicNow = (): number | null =>
      typeof performance === "undefined" ? null : performance.now();
    TOOLBAR_POINTER_TIME_TOLERANCE = 500;
    TOOLBAR_POINTER_COORDINATE_TOLERANCE = 8;
    TOOLBAR_TOUCH_HOLD_MS = 1000;
    TOOLBAR_TOUCH_RECENCY_MS = 5000;
    TOOLBAR_STRAY_HOLD_MS = 3000;
    TOOLBAR_EARLY_HOLD_MS = 8000;
    pointInsideElement = (
      element: Element,
      x: number,
      y: number,
    ): boolean => {
      let bounds = element.getBoundingClientRect();
      return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        x >= bounds.left &&
        x <= bounds.right &&
        y >= bounds.top &&
        y <= bounds.bottom
      );
    };
    if (typeof document !== "undefined") {
      installToolbarPointerTracking(document);
    }
    matchesToolbarPointerEvent = (
      event: ToolbarPointerEventLike,
      timestamp: number,
      x: number,
      y: number,
    ): boolean =>
      Math.abs(event.timeStamp - timestamp) <= TOOLBAR_POINTER_TIME_TOLERANCE &&
      Math.abs(event.clientX - x) <= TOOLBAR_POINTER_COORDINATE_TOLERANCE &&
      Math.abs(event.clientY - y) <= TOOLBAR_POINTER_COORDINATE_TOLERANCE;
    toolbarStrips = new Set();
    toolbarClickThroughTimer = null;
    lastToolbarTouchRelease = null;
    afterTwoAnimationFrames = (callback: () => void): void => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame((): number => requestAnimationFrame(callback));
      }
    };
    TOOLBAR_POSITION_TOLERANCE = 4;
    toolbarTouchDeadlines = new WeakMap();
    ToolbarGroupWrapContext = reacty8.createContext(true);
    ToolbarStripButton = reacty8.forwardRef<HTMLElement, ToolbarStripButtonProps>(function (
      {
        className: className,
        type: type,
        onMouseDown: onMouseDown,
        chevron: chevron,
        icon: icon,
        children: children,
        title: title,
        disabled: disabled,
        "aria-pressed": ariaPressed,
        "aria-label": ariaLabel,
        "aria-expanded": ariaExpanded,
        "aria-describedby": ariaDescribedby,
        ...props
      },
      options: ForwardedRef<HTMLElement>,
    ): ReactElement {
      let value =
          ariaPressed === undefined
            ? undefined
            : ariaPressed === true || ariaPressed === "true",
        callback = (event: ReactMouseEvent<HTMLElement>): void => {
          event.preventDefault();
          onMouseDown?.(event);
        },
        value2 = disabled === true,
        value3 =
          reacty8.useContext(runtime.ToolbarTooltipSideContext) ?? "top",
        value4 =
          ariaLabel ?? (typeof children === "string" ? children : undefined),
        value5 = useDisabledButtonDescription({
          disabled: value2 && title !== undefined,
          name: value4 ?? title ?? "",
          reason: title,
          pressed: ariaPressed,
          expanded: ariaExpanded,
          hasPopup: props["aria-haspopup"],
        }),
        ref = reacty8.useRef<HTMLSpanElement | null>(null);
      useDeferredTooltipFocus(ref, value2 && title !== undefined);
      let value6 = reacty8.useId(),
        value7 =
          !value2 && !!title && value4?.startsWith(title) !== true,
        value8 =
          [ariaDescribedby, value7 ? value6 : undefined]
            .filter(Boolean)
            .join(" ") || undefined,
        state = {
          ref: options,
          variant: "ghost",
          type: type ?? "button",
          pressed: value,
          disabled: disabled,
          "aria-expanded": ariaExpanded,
          "aria-describedby": value8,
          onMouseDown: callback,
          className: (0, runtime.joinClassNames)("shrink-0", className),
          ...props,
          "data-mc-item": "",
          ...value5.inner,
        },
        value9 =
          icon !== undefined && (children === undefined || children === null)
            ? jsxR8.jsx(runtime.Button, {
                ...state,
                iconOnly: true,
                icon: icon,
                "aria-label": ariaLabel ?? "",
                tooltip: false,
              })
            : jsxR8.jsxs(runtime.Button, {
                ...state,
                icon: icon,
                "aria-label": ariaLabel,
                children: [
                  children,
                  chevron === true
                    ? jsxR8.jsx(runtime.Icon, {
                        name: "CaretDown",
                        size: "sm",
                        className: "shrink-0 opacity-60",
                      })
                    : null,
                ],
              });
      if (title === undefined) {
        return value9;
      }
      return jsxR8.jsx(runtime.Tooltip, {
        content: title,
        side: value3,
        hoverable: false,
        open:
          (ariaExpanded === true || ariaExpanded === "true") && !value2
            ? false
            : undefined,
        children: jsxR8.jsxs("span", {
          ref: ref,
          tabIndex: value2 ? 0 : -1,
          ...value5.props,
          "data-tip": title,
          className:
            "relative inline-flex shrink-0 rounded align-top outline-none focus-visible:outline-hidden focus-visible:shadow-focus",
          children: [
            value9,
            value7
              ? jsxR8.jsx("span", {
                  hidden: true,
                  id: value6,
                  children: title,
                })
              : null,
            value5.mirror,
          ],
        }),
      });
    });
    TOOLBAR_SCROLL_FOCUS_MARGIN = 48;
  };
}
