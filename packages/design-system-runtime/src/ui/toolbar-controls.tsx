import type * as React from "react";
import type * as Color from "../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiToolbarControls(runtime: RuntimeBindings): () => void {
  var jsxToolbarLabels: typeof import("react/jsx-runtime");
  var jsxToolbarSeparators: typeof import("react/jsx-runtime");
  var reactToolbarLayout: typeof import("react");
  var jsxToolbarLayout: typeof import("react/jsx-runtime");
  var reactToolbarButtons: typeof import("react");
  var jsxToolbarButtons: typeof import("react/jsx-runtime");
  var jsxToolbarIndicators: typeof import("react/jsx-runtime");
  var reactToolbarControls: typeof import("react");
  var reactForUiToolbarControls: typeof import("react");
  var PANEL_ELEVATION: "panel";
  var POPOVER_ELEVATION: "popover";
  var reactForUiToolbarControls2: typeof import("react");
  var jsxForUiToolbarControls: typeof import("react/jsx-runtime");
  var ToolbarFloatingContext: React.Context<boolean>;
  var ToolbarQuietContext: React.Context<boolean>;
  var SHORTCUT_MODIFIER_NAMES: Record<string, [string, string]>;
  var SHORTCUT_MODIFIER_LABELS: string[];
  var SHORTCUT_KEY_NAMES: Record<string, string | [string, string]>;
  var ownShortcutMapping: <T>(
    mapping: Record<string, T>,
    key: string,
  ) => T | undefined;
  var SHORTCUT_SPOKEN_REPLACEMENTS: [RegExp, string, string][];
  var ToolbarButton: React.ForwardRefExoticComponent<
    Color.ToolbarButtonProps & React.RefAttributes<HTMLButtonElement>
  >;
  var jsxForUiToolbarControls2: typeof import("react/jsx-runtime");
  var toolbarPointerSession: Color.ToolbarPointerSession | null;
  var installedToolbarPointerDocuments: WeakSet<Document>;
  var monotonicNow: () => number | null;
  var TOOLBAR_POINTER_TIME_TOLERANCE: number;
  var TOOLBAR_POINTER_COORDINATE_TOLERANCE: number;
  var TOOLBAR_TOUCH_HOLD_MS: number;
  var TOOLBAR_TOUCH_RECENCY_MS: number;
  var TOOLBAR_STRAY_HOLD_MS: number;
  var TOOLBAR_EARLY_HOLD_MS: number;
  var pointInsideElement: (element: Element, x: number, y: number) => boolean;
  var matchesToolbarPointerEvent: (
    event: Pick<MouseEvent, "timeStamp" | "clientX" | "clientY">,
    timestamp: number,
    x: number,
    y: number,
  ) => boolean;
  var toolbarStrips: Set<HTMLElement>;
  var toolbarClickThroughTimer: ReturnType<typeof setTimeout> | null;
  var lastToolbarTouchRelease: number | null;
  var afterTwoAnimationFramesUiToolbarControls: (
    callback: FrameRequestCallback,
  ) => void;
  var TOOLBAR_POSITION_TOLERANCE: number;
  var toolbarTouchDeadlines: WeakMap<Element, Color.ToolbarTouchDeadline>;
  var ToolbarGroupWrapContext: React.Context<boolean>;
  var ToolbarStripButton: React.ForwardRefExoticComponent<
    Color.ToolbarStripButtonProps & React.RefAttributes<HTMLButtonElement>
  >;
  function ToolbarCaret({
    inherit = false,
  }: {
    inherit?: boolean;
  } = {}): React.ReactElement {
    return (
      <runtime.Icon
        name={"CaretDown"}
        size={"xs"}
        className={(0, runtime.joinClassNames)(
          "-mx-0.5 shrink-0",
          !inherit && "text-fg-muted",
        )}
      />
    );
  }
  function toolbarTooltipContent(props: Color.ToolbarTip): {
    content: string;
    shortcut?: string;
  } {
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
  function useDisabledButtonDescription(
    options: Color.ToolbarDisabledDescription,
  ): Color.ToolbarDisabledAccessibility {
    let value = reactForUiToolbarControls2.useId();
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
      mirror: value2 ? (
        <span hidden={true} id={value}>
          {options.reason}
        </span>
      ) : null,
    };
  }
  function useDeferredTooltipFocus(
    enabled: React.RefObject<HTMLElement | null>,
    onChange: boolean,
  ): void {
    let ref = reactForUiToolbarControls2.useRef(onChange);
    ref.current = onChange;
    let ref2 = reactForUiToolbarControls2.useRef<boolean | undefined>(
        undefined,
      ),
      ref3 = reactForUiToolbarControls2.useRef(false),
      current = reactForUiToolbarControls2.useRef(
        (event: Color.ToolbarFocusEvent) => {
          let currentTarget = event.currentTarget;
          if (event.type === "pointerdown") {
            ref2.current = false;
          } else if (event.type === "focusout") {
            let relatedTarget = event.relatedTarget;
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
        },
      ).current,
      current2 = reactForUiToolbarControls2.useRef(() => {
        ref3.current = false;
      }).current,
      ref4 = reactForUiToolbarControls2.useRef<HTMLElement | null>(null),
      callback = (element: HTMLElement | null) => {
        let current3 = ref4.current;
        if (element === current3) {
          return;
        }
        let items = ["focusin", "focusout", "keydown", "pointerdown"] as const;
        if (current3 !== null) {
          for (let value of items) {
            current3.removeEventListener(value, current as EventListener);
          }
          current3.ownerDocument.removeEventListener(
            "pointerdown",
            current2,
            true,
          );
        }
        ref4.current = element;
        if (element !== null) {
          for (let value of items) {
            element.addEventListener(value, current as EventListener);
          }
          element.ownerDocument.addEventListener("pointerdown", current2, true);
        }
      };
    reactForUiToolbarControls2.useLayoutEffect(() => callback(enabled.current));
    reactForUiToolbarControls2.useLayoutEffect(() => () => callback(null), []);
    reactForUiToolbarControls2.useLayoutEffect(() => {
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
  function accessibleKeyShortcut(
    shortcut: string,
    isMac: boolean,
  ): string | undefined {
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
      (input, options) =>
        SHORTCUT_MODIFIER_LABELS.indexOf(input) -
        SHORTCUT_MODIFIER_LABELS.indexOf(options),
    );
    return [...items, ...items2].join("+");
  }
  function spokenShortcut(shortcut: string, isMac: boolean): string {
    let value = shortcut;
    for (let [value2, value3, value4] of SHORTCUT_SPOKEN_REPLACEMENTS) {
      value = value.replace(value2, isMac ? value3 : value4);
    }
    return value.replace(/ {2,}/g, " ").trim();
  }
  function useButtonAccessibility(
    props: Color.ToolbarAccessibleDescription,
  ): Color.ToolbarAccessibility {
    let value = reactForUiToolbarControls2.useId(),
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
      mirror: (
        <span hidden={true} id={value}>
          {value11}
        </span>
      ),
    };
  }
  function completedToolbarPointerSession(
    session: Color.ToolbarPointerSession | null,
    allowStray: boolean = false,
  ): Color.CompletedToolbarPointerSession | null {
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
    return session as Color.CompletedToolbarPointerSession;
  }
  function installToolbarPointerTracking(document2: Document): void {
    if (installedToolbarPointerDocuments.has(document2)) {
      return;
    }
    installedToolbarPointerDocuments.add(document2);
    document2.addEventListener(
      "pointerdown",
      (event: PointerEvent) => {
        if (event.isPrimary === false) {
          return;
        }
        let value = monotonicNow();
        for (let value7 of Array.from<Element>(
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
          state: Color.ToolbarPointerSession = {
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
          value5 = value4 === null ? -1 : event.timeStamp - value4.ended.at,
          value6 = value4 === null ? 0 : (value4.runAt ?? value4.ended.at);
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
      (input: PointerEvent) => {
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
  function isToolbarClickThrough(event: Color.ToolbarClickEvent): boolean {
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
    element: HTMLElement,
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
    afterTwoAnimationFramesUiToolbarControls(() => {
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
    element: HTMLElement,
    now: number,
  ): number {
    return Math.max(
      toolbarTouchDeadlines.get(element)?.end ?? 0,
      toolbarRecentTouchDeadline(element, now),
    );
  }
  function toolbarRecentTouchDeadline(
    element: HTMLElement,
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
      afterTwoAnimationFramesUiToolbarControls(() => {
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
    strip: HTMLElement,
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
  }: Color.ToolbarStripProps): React.ReactElement {
    reactForUiToolbarControls.useEffect(
      () => installToolbarPointerTracking(document),
      [],
    );
    let ref = reactForUiToolbarControls.useRef<HTMLDivElement | null>(null),
      ref2 = reactForUiToolbarControls.useRef<HTMLDivElement | null>(null),
      value = (0, runtime.useCoarsePointer)();
    reactForUiToolbarControls.useLayoutEffect(() => {
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
    reactForUiToolbarControls.useLayoutEffect(() => {
      if (ref.current !== null) {
        updateToolbarTouchDeadline(ref.current, coversSelection === true);
      }
      updateToolbarClickThroughAttributes();
      if (ref.current !== null && ref2.current !== null) {
        updateToolbarOverflowAttributes(ref.current, ref2.current);
      }
    });
    reactForUiToolbarControls.useLayoutEffect(() => {
      let current = ref.current,
        current2 = ref2.current;
      if (
        current === null ||
        current2 === null ||
        typeof ResizeObserver === "undefined"
      ) {
        return;
      }
      let observer = new ResizeObserver(() =>
        updateToolbarOverflowAttributes(current, current2),
      );
      observer.observe(current2);
      return () => observer.disconnect();
    }, []);
    reactForUiToolbarControls.useLayoutEffect(() => {
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
          let element = current2.querySelector<HTMLElement>(
              '[data-cds="Button"]',
            ),
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
    return (
      <runtime.CdsRoot
        density={surface === "popover" && value ? "comfortable" : "compact"}
        render={
          <runtime.Surface
            elevation={POPOVER_ELEVATION}
            role={"toolbar"}
            data-mc-strip={""}
            data-mc-surface={surface}
            onPointerDown={(input: React.PointerEvent<HTMLDivElement>) => {
              input.stopPropagation();
              onPointerDown?.(input);
            }}
            onMouseDownCapture={(
              event: React.MouseEvent<HTMLDivElement> & {
                target: HTMLElement;
              },
            ) => {
              if (
                event.currentTarget.contains(event.target) &&
                isToolbarClickThrough(event)
              ) {
                event.preventDefault();
                event.stopPropagation();
              }
              onMouseDownCapture?.(event);
            }}
            onClickCapture={(
              event: React.MouseEvent<HTMLDivElement> & {
                target: HTMLElement;
              },
            ) => {
              if (
                event.currentTarget.contains(event.target) &&
                isToolbarClickThrough(event)
              ) {
                event.preventDefault();
                event.stopPropagation();
              }
              onClickCapture?.(event);
            }}
            onMouseDown={(
              event: React.MouseEvent<HTMLDivElement> & {
                target: HTMLElement;
              },
            ) => {
              if (!event.target.closest(runtime.TEXT_EDITABLE_SELECTOR)) {
                event.preventDefault();
              }
              onMouseDown?.(event);
            }}
            className={(0, runtime.joinClassNames)(
              "z-selection flex items-center",
              surface === "popover"
                ? "[--mc-group-gap:2px] [--mc-strip-gap:4px] [--mc-strip-pad:5px] pointer-coarse:rounded-xl pointer-coarse:[--mc-group-gap:8px] pointer-coarse:[--mc-strip-gap:8px] pointer-coarse:[--mc-strip-pad:6px] [&_[data-mc-divider]]:mx-0"
                : "[--mc-strip-gap:2px] [--mc-strip-pad:4px] [--mc-group-gap:4px]",
              "max-w-[calc(100vw-16px)] overflow-clip",
              className,
            )}
            {...remainingProps}
            ref={ref}
          />
        }
      >
        <div className={"relative min-w-0 flex-auto rounded-[inherit]"}>
          {[
            <div
              ref={ref2}
              data-mc-row={""}
              onScroll={(input: React.UIEvent<HTMLDivElement>) => {
                if (ref.current !== null) {
                  updateToolbarOverflowAttributes(
                    ref.current,
                    input.currentTarget,
                  );
                }
                onScroll?.(input);
              }}
              className={(0, runtime.joinClassNames)(
                "flex min-w-0 items-center gap-[var(--mc-strip-gap)] rounded-[inherit] p-[var(--mc-strip-pad)]",
                wrap
                  ? "flex-wrap"
                  : "overflow-x-auto [clip-path:inset(0_1px)] [scrollbar-width:none] [&>*]:shrink-0",
              )}
            >
              <runtime.ToolbarTooltipSideContext.Provider
                value={placed === "below" ? "bottom" : "top"}
              >
                <ToolbarGroupWrapContext.Provider value={wrap}>
                  <runtime.TooltipProvider>{children}</runtime.TooltipProvider>
                </ToolbarGroupWrapContext.Provider>
              </runtime.ToolbarTooltipSideContext.Provider>
            </div>,
            <span
              aria-hidden={"true"}
              data-tb-fade={"start"}
              className={
                "pointer-events-none absolute inset-y-px left-px z-10 w-12"
              }
            >
              <span
                className={
                  "pointer-events-auto absolute inset-y-0 left-0 w-[30%]"
                }
              />
            </span>,
            <span
              aria-hidden={"true"}
              data-tb-fade={"end"}
              className={
                "pointer-events-none absolute inset-y-px right-px z-10 w-12"
              }
            >
              <span
                className={
                  "pointer-events-auto absolute inset-y-0 right-0 w-[30%]"
                }
              />
            </span>,
          ]}
        </div>
      </runtime.CdsRoot>
    );
  }
  function ToolbarDivider(): React.ReactElement {
    return (
      <span
        aria-hidden={"true"}
        data-mc-divider={""}
        className={"mx-0.5 h-[18px] w-px bg-border-line"}
      />
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxToolbarLabels",
    () => jsxToolbarLabels,
    (value) => {
      jsxToolbarLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxToolbarSeparators",
    () => jsxToolbarSeparators,
    (value) => {
      jsxToolbarSeparators = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactToolbarLayout",
    () => reactToolbarLayout,
    (value) => {
      reactToolbarLayout = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxToolbarLayout",
    () => jsxToolbarLayout,
    (value) => {
      jsxToolbarLayout = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactToolbarButtons",
    () => reactToolbarButtons,
    (value) => {
      reactToolbarButtons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxToolbarButtons",
    () => jsxToolbarButtons,
    (value) => {
      jsxToolbarButtons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxToolbarIndicators",
    () => jsxToolbarIndicators,
    (value) => {
      jsxToolbarIndicators = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactToolbarControls",
    () => reactToolbarControls,
    (value) => {
      reactToolbarControls = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiToolbarControls",
    () => reactForUiToolbarControls,
    (value) => {
      reactForUiToolbarControls = value;
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
    "reactForUiToolbarControls2",
    () => reactForUiToolbarControls2,
    (value) => {
      reactForUiToolbarControls2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiToolbarControls",
    () => jsxForUiToolbarControls,
    (value) => {
      jsxForUiToolbarControls = value;
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
    "jsxForUiToolbarControls2",
    () => jsxForUiToolbarControls2,
    (value) => {
      jsxForUiToolbarControls2 = value;
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
    "afterTwoAnimationFramesUiToolbarControls",
    () => afterTwoAnimationFramesUiToolbarControls,
    (value) => {
      afterTwoAnimationFramesUiToolbarControls = value;
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
  bindRuntimeValue(runtime, "ToolbarDivider", () => ToolbarDivider);
  return () => {
    jsxToolbarLabels = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    jsxToolbarSeparators = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    reactToolbarLayout = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxToolbarLayout = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    reactToolbarButtons = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxToolbarButtons = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    jsxToolbarIndicators = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    reactToolbarControls = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactForUiToolbarControls = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    PANEL_ELEVATION = "panel";
    POPOVER_ELEVATION = "popover";
    reactForUiToolbarControls2 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxForUiToolbarControls = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    ToolbarFloatingContext = reactForUiToolbarControls2.createContext(false);
    ToolbarQuietContext = reactForUiToolbarControls2.createContext(false);
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
    ownShortcutMapping = <T,>(mapping: Record<string, T>, key: string) =>
      Object.hasOwn(mapping, key) ? mapping[key] : undefined;
    SHORTCUT_SPOKEN_REPLACEMENTS = [
      [/⌘/g, "Command ", "Ctrl "],
      [/⇧/g, "Shift ", "Shift "],
      [/⌥/g, "Option ", "Alt "],
      [/⌃/g, "Control ", "Ctrl "],
      [/⏎/g, "Return", "Enter"],
      [/⌫/g, "Delete", "Backspace"],
    ];
    ToolbarButton = reactForUiToolbarControls2.forwardRef(function (
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
      }: Color.ToolbarButtonProps,
      options: React.ForwardedRef<HTMLButtonElement>,
    ) {
      let value = reactForUiToolbarControls2.useContext(ToolbarFloatingContext),
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
        ref = reactForUiToolbarControls2.useRef<HTMLElement | null>(null);
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
      return (
        <runtime.Tooltip
          content={value5.content}
          shortcut={value5.shortcut}
          side={tipSide}
          hoverable={false}
        >
          <span
            ref={ref}
            tabIndex={value2 ? 0 : -1}
            {...value7.props}
            data-tb-icon={value9 ? "" : undefined}
            className={(0, runtime.joinClassNames)(
              "relative inline-flex shrink-0 rounded align-top outline-none focus-visible:outline-hidden focus-visible:shadow-focus",
              className,
            )}
          >
            {[
              value8 ? (
                caret === true ? (
                  <runtime.Button {...state} icon={value4}>
                    <ToolbarCaret />
                  </runtime.Button>
                ) : (
                  <runtime.Button
                    {...state}
                    iconOnly={true}
                    icon={value4}
                    tooltip={false}
                  />
                )
              ) : (
                <runtime.Button {...state} icon={value4}>
                  {[
                    label,
                    children,
                    caret === true ? (
                      <ToolbarCaret inherit={variant === "primary"} />
                    ) : null,
                  ]}
                </runtime.Button>
              ),
              count ? (
                <span
                  aria-hidden={"true"}
                  className={
                    "pointer-events-none absolute -top-0.5 -right-0.5 flex"
                  }
                >
                  <runtime.Counter
                    value={count}
                    variant={"accent"}
                    size={"xs"}
                  />
                </span>
              ) : null,
              value6.mirror,
              value7.mirror,
            ]}
          </span>
        </runtime.Tooltip>
      );
    });
    jsxForUiToolbarControls2 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    toolbarPointerSession = null;
    installedToolbarPointerDocuments = new WeakSet();
    monotonicNow = () =>
      typeof performance === "undefined" ? null : performance.now();
    TOOLBAR_POINTER_TIME_TOLERANCE = 500;
    TOOLBAR_POINTER_COORDINATE_TOLERANCE = 8;
    TOOLBAR_TOUCH_HOLD_MS = 1000;
    TOOLBAR_TOUCH_RECENCY_MS = 5000;
    TOOLBAR_STRAY_HOLD_MS = 3000;
    TOOLBAR_EARLY_HOLD_MS = 8000;
    pointInsideElement = (element: Element, x: number, y: number) => {
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
      event: Pick<MouseEvent, "timeStamp" | "clientX" | "clientY">,
      timestamp: number,
      x: number,
      y: number,
    ) =>
      Math.abs(event.timeStamp - timestamp) <= TOOLBAR_POINTER_TIME_TOLERANCE &&
      Math.abs(event.clientX - x) <= TOOLBAR_POINTER_COORDINATE_TOLERANCE &&
      Math.abs(event.clientY - y) <= TOOLBAR_POINTER_COORDINATE_TOLERANCE;
    toolbarStrips = new Set();
    toolbarClickThroughTimer = null;
    lastToolbarTouchRelease = null;
    afterTwoAnimationFramesUiToolbarControls = (
      callback: FrameRequestCallback,
    ) => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => requestAnimationFrame(callback));
      }
    };
    TOOLBAR_POSITION_TOLERANCE = 4;
    toolbarTouchDeadlines = new WeakMap();
    ToolbarGroupWrapContext = reactForUiToolbarControls.createContext(true);
    ToolbarStripButton = reactForUiToolbarControls.forwardRef(function (
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
      }: Color.ToolbarStripButtonProps,
      options: React.ForwardedRef<HTMLButtonElement>,
    ) {
      let value =
          ariaPressed === undefined
            ? undefined
            : ariaPressed === true || ariaPressed === "true",
        callback = (event: React.MouseEvent<HTMLButtonElement>) => {
          event.preventDefault();
          onMouseDown?.(event);
        },
        value2 = disabled === true,
        value3 =
          reactForUiToolbarControls.useContext(
            runtime.ToolbarTooltipSideContext,
          ) ?? "top",
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
        ref = reactForUiToolbarControls.useRef<HTMLElement | null>(null);
      useDeferredTooltipFocus(ref, value2 && title !== undefined);
      let value6 = reactForUiToolbarControls.useId(),
        value7 = !value2 && !!title && value4?.startsWith(title) !== true,
        value8 =
          [ariaDescribedby, value7 ? value6 : undefined]
            .filter(Boolean)
            .join(" ") || undefined,
        state = {
          ref: options,
          variant: "ghost" as const,
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
          icon !== undefined &&
          (children === undefined || children === null) ? (
            <runtime.Button
              {...state}
              iconOnly={true}
              icon={icon}
              aria-label={ariaLabel ?? ""}
              tooltip={false}
            />
          ) : (
            <runtime.Button {...state} icon={icon} aria-label={ariaLabel}>
              {[
                children,
                chevron === true ? (
                  <runtime.Icon
                    name={"CaretDown"}
                    size={"sm"}
                    className={"shrink-0 opacity-60"}
                  />
                ) : null,
              ]}
            </runtime.Button>
          );
      if (title === undefined) {
        return value9;
      }
      return (
        <runtime.Tooltip
          content={title}
          side={value3}
          hoverable={false}
          open={
            (ariaExpanded === true || ariaExpanded === "true") && !value2
              ? false
              : undefined
          }
        >
          <span
            ref={ref}
            tabIndex={value2 ? 0 : -1}
            {...value5.props}
            data-tip={title}
            className={
              "relative inline-flex shrink-0 rounded align-top outline-none focus-visible:outline-hidden focus-visible:shadow-focus"
            }
          >
            {[
              value9,
              value7 ? (
                <span hidden={true} id={value6}>
                  {title}
                </span>
              ) : null,
              value5.mirror,
            ]}
          </span>
        </runtime.Tooltip>
      );
    });
  };
}
