/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** A camera over a surface: the top-left point it shows and its zoom. */
export interface ViewportView {
  x: number;
  y: number;
  scale: number;
}
export interface ViewportZoomLimits {
  /** Defaults to 0.05. */
  minScale?: number;
  /** Defaults to 40. */
  maxScale?: number;
}
/** What a wheel event does to the viewport. */
export type WheelGestureDecision = "zoom" | "consume" | "native" | "pan";
export interface WheelGestureDecider {
  /**
   * Classifies a wheel event. `zoom` is true for ctrl/meta wheels, `hasDelta`
   * for events that move; `canScrollNatively` is asked when a gesture starts.
   */
  decide(
    timeStamp: number,
    zoom: boolean,
    hasDelta: boolean,
    canScrollNatively: () => boolean,
  ): WheelGestureDecision;
}
/** Safari's non-standard pinch gesture event. */
export interface SafariGestureEvent extends UIEvent {
  scale: number;
  clientX?: number;
  clientY?: number;
}
export type SafariGestureEventName =
  | "gesturestart"
  | "gesturechange"
  | "gestureend";
export type TouchCountEventName = "touchstart" | "touchend" | "touchcancel";
export type ViewportGestureHandlers = Record<
  SafariGestureEventName,
  (event: SafariGestureEvent) => void
>;
export interface ViewportGestureOptions {
  /** The surface that receives pointer, wheel and gesture input. */
  element: HTMLElement;
  getView: () => ViewportView;
  setView: (view: ViewportView) => void;
  limits?: ViewportZoomLimits;
  onGestureEnd?: () => void;
  /** Decides whether a pointer press starts panning; defaults to "not on a control". */
  shouldPan?: (event: PointerEvent) => boolean;
  /** Lets a wheel event scroll natively instead of panning. */
  allowNativeScroll?: (event: WheelEvent) => boolean;
  /** Pans with the secondary button as well. */
  panSecondaryButton?: boolean;
}
export interface ViewportGestures {
  /** Stops tracking a pointer; false if it can't be released. */
  release: (pointerId: number) => boolean;
  destroy: () => void;
}
/** A pointer a viewport is tracking. */
interface TrackedPointer {
  x: number;
  y: number;
  type: string;
  lastSeen: number;
}
/** Distance between two pointers and the scale when the pinch began. */
interface PinchStart {
  dist: number;
  scale: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    zoomViewportAt: (
      viewport: ViewportView,
      localX: number,
      localY: number,
      zoomFactor: number,
      limits?: ViewportZoomLimits,
    ) => ViewportView;
    panViewport: (
      viewport: ViewportView,
      deltaX: number,
      deltaY: number,
    ) => ViewportView;
    wheelZoomFactor: (deltaY: number) => number;
    createWheelGestureDecision: (idleMs?: number) => WheelGestureDecider;
    POINTER_STALE_TIMEOUT_MS: number;
    SAFARI_GESTURE_WHEEL_SUPPRESSION_MS: number;
    SAFARI_GESTURE_EVENTS: SafariGestureEventName[];
    TOUCH_COUNT_EVENTS: TouchCountEventName[];
    activeViewportGestures: Map<HTMLElement, ViewportGestureHandlers>;
    activeTouchCount: number;
    isReroutingViewportEvent: boolean;
    updateTouchCount: (event: TouchEvent) => void;
    viewportGestureElementAtPoint: (
      clientX?: number,
      clientY?: number,
    ) => HTMLElement | undefined;
    rerouteViewportWheelEvent: (event: WheelEvent) => void;
    rerouteSafariGestureEvent: (event: Event) => void;
    registerViewportGestureHandlers: (
      element: HTMLElement,
      handlers: ViewportGestureHandlers,
    ) => () => void;
    attachViewportGestures: (
      options: ViewportGestureOptions,
    ) => ViewportGestures;
  }
}

export function installUiViewportGestures(
  runtime: RuntimeBindings,
): () => void {
  var POINTER_STALE_TIMEOUT_MS: number;
  var SAFARI_GESTURE_WHEEL_SUPPRESSION_MS: number;
  var SAFARI_GESTURE_EVENTS: SafariGestureEventName[];
  var TOUCH_COUNT_EVENTS: TouchCountEventName[];
  var activeViewportGestures: Map<HTMLElement, ViewportGestureHandlers>;
  var activeTouchCount: number;
  var isReroutingViewportEvent: boolean;
  var updateTouchCount: (event: TouchEvent) => void;
  var viewportGestureElementAtPoint: (
    clientX?: number,
    clientY?: number,
  ) => HTMLElement | undefined;
  var rerouteViewportWheelEvent: (event: WheelEvent) => void;
  var rerouteSafariGestureEvent: (event: Event) => void;
  var registerViewportGestureHandlers: (
    element: HTMLElement,
    handlers: ViewportGestureHandlers,
  ) => () => void;
  function zoomViewportAt(
    viewport: ViewportView,
    localX: number,
    localY: number,
    zoomFactor: number,
    limits?: ViewportZoomLimits,
  ): ViewportView {
    let value = Math.min(
      limits?.maxScale ?? 40,
      Math.max(limits?.minScale ?? 0.05, viewport.scale * zoomFactor),
    );
    if (value === viewport.scale) {
      return viewport;
    }
    let value2 = viewport.x + localX / viewport.scale,
      value3 = viewport.y + localY / viewport.scale;
    return {
      x: value2 - localX / value,
      y: value3 - localY / value,
      scale: value,
    };
  }
  function panViewport(
    viewport: ViewportView,
    deltaX: number,
    deltaY: number,
  ): ViewportView {
    if (deltaX === 0 && deltaY === 0) {
      return viewport;
    }
    return {
      x: viewport.x - deltaX / viewport.scale,
      y: viewport.y - deltaY / viewport.scale,
      scale: viewport.scale,
    };
  }
  function wheelZoomFactor(deltaY: number): number {
    return Math.min(1.25, Math.max(0.8, Math.exp(-deltaY * 0.01)));
  }
  function createWheelGestureDecision(idleMs: number = 200): WheelGestureDecider {
    let value: "native" | "pan" | undefined,
      value2 = -1 / 0;
    return {
      decide(
        input: number,
        options: boolean,
        context: boolean,
        value3: () => boolean,
      ): WheelGestureDecision {
        if (options) {
          value = undefined;
          value2 = input;
          return "zoom";
        }
        if (input - value2 > idleMs) {
          value = undefined;
        }
        value2 = input;
        if (value === undefined) {
          if (!context) {
            return "consume";
          }
          value = value3() ? "native" : "pan";
        }
        return value;
      },
    };
  }
  function attachViewportGestures(
    options: ViewportGestureOptions,
  ): ViewportGestures {
    let element = options.element,
      touchAction = element.style.touchAction;
    element.style.touchAction = "none";
    let callback = (): void => {
      if (element.scrollLeft !== 0) {
        element.scrollLeft = 0;
      }
      if (element.scrollTop !== 0) {
        element.scrollTop = 0;
      }
    };
    callback();
    element.addEventListener("scroll", callback, {
      passive: true,
    });
    let entries = new Map<number, boolean>(),
      callback2 = (input: EventTarget | null | undefined): boolean => {
        let value7 = (input ?? null) as HTMLElement | null,
          value8 = element;
        while (value7 && value7 !== value8) {
          let tagName = value7.tagName;
          if (
            tagName === "INPUT" ||
            tagName === "SELECT" ||
            tagName === "TEXTAREA" ||
            value7.isContentEditable === true
          ) {
            return true;
          }
          if (tagName !== undefined) {
            let value9: CSSStyleDeclaration | undefined;
            try {
              value9 = window.getComputedStyle(value7);
            } catch {
              value9 = undefined;
            }
            if (value9) {
              let value10 =
                  (value9.overflowY === "auto" ||
                    value9.overflowY === "scroll") &&
                  (value7.scrollHeight ?? 0) > (value7.clientHeight ?? 0),
                value11 =
                  (value9.overflowX === "auto" ||
                    value9.overflowX === "scroll") &&
                  (value7.scrollWidth ?? 0) > (value7.clientWidth ?? 0);
              if (value10 || value11) {
                return true;
              }
            }
          }
          value7 = value7.parentElement ?? null;
        }
        return false;
      },
      callback3 = (input: TouchEvent): void => {
        let changedTouches = input.changedTouches;
        for (
          let index2 = 0;
          index2 < (changedTouches?.length ?? 0);
          index2++
        ) {
          let value7 = changedTouches[index2];
          if (value7) {
            entries.set(value7.identifier, !callback2(value7.target));
          }
        }
      },
      callback4 = (event: TouchEvent): void => {
        if (!event.cancelable) {
          return;
        }
        let changedTouches = event.changedTouches,
          value7 = changedTouches?.length ?? 0;
        if (value7 === 0) {
          return;
        }
        for (let index2 = 0; index2 < value7; index2++) {
          let value8 = changedTouches[index2];
          if (!value8 || entries.get(value8.identifier) !== true) {
            return;
          }
        }
        event.preventDefault();
      },
      callback5 = (input: TouchEvent): void => {
        let changedTouches = input.changedTouches;
        for (
          let index2 = 0;
          index2 < (changedTouches?.length ?? 0);
          index2++
        ) {
          let value7 = changedTouches[index2];
          if (value7) {
            entries.delete(value7.identifier);
          }
        }
      },
      value = createWheelGestureDecision(),
      entries2 = new Map<number, TrackedPointer>(),
      value2: PinchStart | undefined,
      entries3 = new Map<number, TrackedPointer>(),
      value3: string | undefined,
      value4: string | undefined,
      callback6 = (): void => {
        if (value3 !== undefined) {
          return;
        }
        let style = element.style;
        if (!style) {
          return;
        }
        value3 = style.userSelect ?? "";
        value4 = style.webkitUserSelect ?? "";
        style.webkitUserSelect = "none";
        style.userSelect = "none";
      },
      callback7 = (): void => {
        if (value3 === undefined) {
          return;
        }
        let style = element.style;
        if (style) {
          style.userSelect = value3;
          style.webkitUserSelect = value4 ?? "";
        }
        value3 = undefined;
        value4 = undefined;
      },
      flag = false,
      index = 0,
      count = 1,
      entries4 = new Map<number, number>(),
      callback8 = (input: number): void => {
        for (let [value7, value8] of entries4)
          if (input - value8 > POINTER_STALE_TIMEOUT_MS) {
            entries4.delete(value7);
          }
      },
      callback9 = (): boolean => {
        let index2 = 0;
        for (let value7 of entries2.values())
          if (value7.type === "touch") {
            index2 += 1;
          }
        return index2 >= 2;
      },
      callback10 = (input: number): boolean => {
        let index2 = 0,
          index3 = 0;
        for (let value7 of entries2.values()) {
          if (value7.type !== "touch") {
            continue;
          }
          index2 += 1;
          if (input - value7.lastSeen <= POINTER_STALE_TIMEOUT_MS) {
            index3 += 1;
          }
        }
        return index2 >= 2 && index3 >= 1;
      },
      value5: number | undefined,
      count2 = 1,
      flag2 = false,
      callback11 = (
        input: number,
        options2: number,
      ): { sx: number; sy: number } => {
        let bounds = element.getBoundingClientRect();
        return {
          sx: input - bounds.left,
          sy: options2 - bounds.top,
        };
      },
      callback12 = (event: WheelEvent): void => {
        let value7 = event.ctrlKey || event.metaKey;
        if (
          flag &&
          event.timeStamp - index <= SAFARI_GESTURE_WHEEL_SUPPRESSION_MS
        ) {
          event.preventDefault();
          return;
        }
        let value8 = value.decide(
          event.timeStamp,
          value7,
          event.deltaX !== 0 || event.deltaY !== 0,
          () => options.allowNativeScroll?.(event) ?? false,
        );
        if (value8 === "native") {
          return;
        }
        event.preventDefault();
        if (value8 === "consume") {
          return;
        }
        let value9 =
            event.deltaMode === 1
              ? 16
              : event.deltaMode === 2
                ? window.innerHeight
                : 1,
          value10 =
            event.deltaMode === 1
              ? 16
              : event.deltaMode === 2
                ? window.innerWidth
                : 1;
        if (value8 === "zoom") {
          let { sx: value11, sy: value12 } = callback11(
            event.clientX,
            event.clientY,
          );
          options.setView(
            zoomViewportAt(
              options.getView(),
              value11,
              value12,
              wheelZoomFactor(event.deltaY * value9),
              options.limits,
            ),
          );
        } else {
          options.setView(
            panViewport(
              options.getView(),
              -event.deltaX * value10,
              -event.deltaY * value9,
            ),
          );
        }
      },
      callback13 = (): void => {
        if (flag2 && entries2.size === 0) {
          flag2 = false;
          callback7();
          options.onGestureEnd?.();
        }
      },
      callback14 = (event: PointerEvent): boolean => {
        if (options.shouldPan) {
          return options.shouldPan(event);
        }
        let target = event.target as Element | null;
        while (target) {
          let tagName = target.tagName;
          if (
            tagName === "BUTTON" ||
            tagName === "A" ||
            tagName === "INPUT" ||
            tagName === "SELECT" ||
            tagName === "TEXTAREA" ||
            target.getAttribute?.("role") === "slider" ||
            target.hasAttribute?.("data-no-pan")
          ) {
            return false;
          }
          target = target.parentElement;
        }
        return true;
      },
      callback15 = (input: number): void => {
        value2 = undefined;
        if (entries2.size === 1) {
          let value7 = entries2.values().next().value?.type,
            flag3 = false;
          for (let [value8, value9] of entries3) {
            if (value9.type !== value7) {
              continue;
            }
            entries3.delete(value8);
            if (input - value9.lastSeen > POINTER_STALE_TIMEOUT_MS) {
              continue;
            }
            entries2.set(value8, value9);
            value5 = undefined;
            flag3 = true;
            break;
          }
          if (!flag3) {
            value5 = [...entries2.keys()][0];
          }
        }
        callback13();
      },
      callback16 = (input: PointerEvent): void => {
        entries3.delete(input.pointerId);
        entries4.delete(input.pointerId);
        let value7 = entries2.delete(input.pointerId);
        if (value7 && value5 === input.pointerId) {
          value5 = undefined;
        }
        let flag3 = false;
        if (input.isPrimary && input.button === 0) {
          for (let [value8, value9] of entries2)
            if (value9.type === input.pointerType) {
              entries2.delete(value8);
              flag3 = true;
            }
          for (let [value8, value9] of entries3)
            if (value9.type === input.pointerType) {
              entries3.delete(value8);
            }
          if (input.pointerType === "touch") {
            entries4.clear();
          }
          if (value5 !== undefined && !entries2.has(value5)) {
            value5 = undefined;
          }
        }
        if (value7 || flag3) {
          callback15(input.timeStamp);
        }
      },
      callback17 = (input: EventTarget | null): boolean => {
        for (
          let value7 = input as HTMLElement | null;
          value7 && value7 !== element;
          value7 = value7.parentElement ?? null
        )
          if (
            value7.tagName === "INPUT" ||
            value7.tagName === "TEXTAREA" ||
            value7.tagName === "SELECT" ||
            value7.isContentEditable === true
          ) {
            return true;
          }
        return false;
      },
      callback18 = (event: PointerEvent): void => {
        if (
          event.button !== 0 &&
          event.button !== 1 &&
          !(event.button === 2 && options.panSecondaryButton)
        ) {
          return;
        }
        if (event.button === 1 && callback17(event.target)) {
          return;
        }
        if (entries2.size > 0) {
          let values = new Set<string>();
          for (let value8 of entries2.values())
            values.add(value8.type);
          for (let value8 of values) {
            let flag3 = true;
            for (let value9 of entries2.values())
              if (
                value9.type === value8 &&
                event.timeStamp - value9.lastSeen <= POINTER_STALE_TIMEOUT_MS
              ) {
                flag3 = false;
                break;
              }
            if (flag3) {
              for (let value9 of entries3.values())
                if (
                  value9.type === value8 &&
                  event.timeStamp - value9.lastSeen <= POINTER_STALE_TIMEOUT_MS
                ) {
                  flag3 = false;
                  break;
                }
            }
            if (flag3 && value8 !== event.pointerType) {
              for (let [value9, value10] of entries2)
                if (value10.type === value8) {
                  entries2.delete(value9);
                  if (value5 === value9) {
                    value5 = undefined;
                  }
                }
              for (let [value9, value10] of entries3)
                if (value10.type === value8) {
                  entries3.delete(value9);
                }
            }
          }
          if (!callback9()) {
            value2 = undefined;
          }
          callback13();
          let value7 = entries2.values().next().value?.type;
          if (value7 !== undefined && value7 !== event.pointerType) {
            return;
          }
        }
        if (entries2.size === 0) {
          if (!callback14(event)) {
            if (event.pointerType === "touch" && options.shouldPan) {
              entries4.set(event.pointerId, event.timeStamp);
            }
            return;
          }
          value5 = event.pointerId;
          count2 = event.button === 1 ? 4 : event.button === 2 ? 2 : 1;
          if (event.button === 1) {
            event.preventDefault();
          }
          callback6();
        } else {
          if (event.pointerType !== "touch") {
            return;
          }
          if (!callback14(event)) {
            if (options.shouldPan) {
              entries4.set(event.pointerId, event.timeStamp);
            }
            return;
          }
          if (entries2.size >= 2) {
            entries3.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
              type: event.pointerType,
              lastSeen: event.timeStamp,
            });
            return;
          }
          value5 = undefined;
        }
        entries2.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
          type: event.pointerType,
          lastSeen: event.timeStamp,
        });
        flag2 = true;
        try {
          element.setPointerCapture(event.pointerId);
        } catch {}
      },
      callback19 = (input: PointerEvent): void => {
        if (entries4.has(input.pointerId)) {
          entries4.set(input.pointerId, input.timeStamp);
        }
        let entry = entries3.get(input.pointerId);
        if (entry) {
          entries3.set(input.pointerId, {
            x: input.clientX,
            y: input.clientY,
            type: entry.type,
            lastSeen: input.timeStamp,
          });
          return;
        }
        let entry2 = entries2.get(input.pointerId);
        if (!entry2) {
          return;
        }
        if (input.pointerType !== "touch" && (input.buttons & count2) === 0) {
          callback20(input);
          return;
        }
        if (entries2.size === 2) {
          let value7 = [...entries2.entries()].find(
            ([input2]) => input2 !== input.pointerId,
          );
          if (value7) {
            let [, value8] = value7,
              value9 = Math.hypot(
                input.clientX - value8.x,
                input.clientY - value8.y,
              ),
              state = {
                x: (entry2.x + value8.x) / 2,
                y: (entry2.y + value8.y) / 2,
              },
              state2 = {
                x: (input.clientX + value8.x) / 2,
                y: (input.clientY + value8.y) / 2,
              };
            if (!value2 || value2.dist <= 0) {
              value2 = {
                dist: Math.hypot(entry2.x - value8.x, entry2.y - value8.y),
                scale: options.getView().scale,
              };
            }
            let value10 = panViewport(
              options.getView(),
              state2.x - state.x,
              state2.y - state.y,
            );
            if (value2.dist > 0 && value9 > 0) {
              let value11 = value2.scale * (value9 / value2.dist);
              if (value11 !== value10.scale) {
                let { sx: value12, sy: value13 } = callback11(
                  state2.x,
                  state2.y,
                );
                value10 = zoomViewportAt(
                  value10,
                  value12,
                  value13,
                  value11 / value10.scale,
                  options.limits,
                );
              }
            }
            options.setView(value10);
          }
        } else if (input.pointerId === value5) {
          options.setView(
            panViewport(
              options.getView(),
              input.clientX - entry2.x,
              input.clientY - entry2.y,
            ),
          );
        }
        entries2.set(input.pointerId, {
          x: input.clientX,
          y: input.clientY,
          type: entry2.type,
          lastSeen: input.timeStamp,
        });
      },
      callback20 = (input: PointerEvent): void => {
        entries4.delete(input.pointerId);
        entries3.delete(input.pointerId);
        if (!entries2.has(input.pointerId)) {
          return;
        }
        entries2.delete(input.pointerId);
        if (input.pointerId === value5) {
          value5 = undefined;
        }
        callback15(input.timeStamp);
      },
      callback21 = (event: SafariGestureEvent): void => {
        event.preventDefault();
        flag = true;
        index = typeof event.timeStamp === "number" ? event.timeStamp : 0;
        count = options.getView().scale;
        value.decide(
          typeof event.timeStamp === "number" ? event.timeStamp : 0,
          true,
          true,
          () => false,
        );
      },
      callback22 = (event: SafariGestureEvent): void => {
        event.preventDefault();
        if (!flag || !event.scale) {
          return;
        }
        index = typeof event.timeStamp === "number" ? event.timeStamp : 0;
        callback8(index);
        if (callback10(index) || entries4.size > 0) {
          count = options.getView().scale / event.scale;
          return;
        }
        let value7 = options.getView(),
          value8 = count * event.scale;
        if (value8 === value7.scale) {
          return;
        }
        let { sx: value9, sy: value10 } = callback11(
          event.clientX ?? 0,
          event.clientY ?? 0,
        );
        options.setView(
          zoomViewportAt(
            value7,
            value9,
            value10,
            value8 / value7.scale,
            options.limits,
          ),
        );
      },
      callback23 = (event: SafariGestureEvent): void => {
        event.preventDefault();
        flag = false;
      },
      callback24 = (event: DragEvent): void => {
        if (value5 !== undefined || entries2.size > 0) {
          event.preventDefault();
        }
      },
      callback25 = (event: MouseEvent): void => {
        if (event.button === 1 && value5 !== undefined && count2 === 4) {
          event.preventDefault();
        }
      };
    element.addEventListener("dragstart", callback24);
    element.addEventListener("mousedown", callback25);
    element.addEventListener("touchstart", callback3, {
      passive: true,
    });
    element.addEventListener("touchmove", callback4, {
      passive: false,
    });
    element.addEventListener("touchend", callback5, {
      passive: true,
    });
    element.addEventListener("touchcancel", callback5, {
      passive: true,
    });
    element.addEventListener("wheel", callback12, {
      passive: false,
    });
    window.addEventListener("pointerdown", callback16, true);
    element.addEventListener("pointerdown", callback18);
    element.addEventListener("gesturestart", callback21 as EventListener, {
      passive: false,
    });
    element.addEventListener("gesturechange", callback22 as EventListener, {
      passive: false,
    });
    element.addEventListener("gestureend", callback23 as EventListener, {
      passive: false,
    });
    window.addEventListener("pointermove", callback19);
    window.addEventListener("pointerup", callback20);
    window.addEventListener("pointercancel", callback20);
    let value6 = registerViewportGestureHandlers(element, {
      gesturestart: callback21,
      gesturechange: callback22,
      gestureend: callback23,
    });
    return {
      release(input: number): boolean {
        let entry = entries2.get(input);
        if (entry === undefined || entries2.size !== 1 || entries3.size > 0) {
          return false;
        }
        entries2.delete(input);
        if (input === value5) {
          value5 = undefined;
        }
        try {
          element.releasePointerCapture(input);
        } catch {}
        callback15(entry.lastSeen);
        return true;
      },
      destroy(): void {
        value6();
        element.removeEventListener("scroll", callback);
        element.removeEventListener("dragstart", callback24);
        element.removeEventListener("mousedown", callback25);
        element.removeEventListener("touchstart", callback3);
        element.removeEventListener("touchmove", callback4);
        element.removeEventListener("touchend", callback5);
        element.removeEventListener("touchcancel", callback5);
        element.removeEventListener("wheel", callback12);
        window.removeEventListener(
          "pointerdown",
          callback16,
          true,
        );
        element.removeEventListener("pointerdown", callback18);
        element.removeEventListener("gesturestart", callback21 as EventListener);
        element.removeEventListener("gesturechange", callback22 as EventListener);
        element.removeEventListener("gestureend", callback23 as EventListener);
        window.removeEventListener("pointermove", callback19);
        window.removeEventListener("pointerup", callback20);
        window.removeEventListener("pointercancel", callback20);
        entries4.clear();
        entries3.clear();
        entries.clear();
        callback7();
        element.style.touchAction = touchAction;
      },
    };
  }
  bindRuntimeValue(runtime, "zoomViewportAt", () => zoomViewportAt);
  bindRuntimeValue(runtime, "panViewport", () => panViewport);
  bindRuntimeValue(runtime, "wheelZoomFactor", () => wheelZoomFactor);
  bindRuntimeValue(
    runtime,
    "createWheelGestureDecision",
    () => createWheelGestureDecision,
  );
  bindRuntimeValue(
    runtime,
    "POINTER_STALE_TIMEOUT_MS",
    () => POINTER_STALE_TIMEOUT_MS,
    (value) => {
      POINTER_STALE_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SAFARI_GESTURE_WHEEL_SUPPRESSION_MS",
    () => SAFARI_GESTURE_WHEEL_SUPPRESSION_MS,
    (value) => {
      SAFARI_GESTURE_WHEEL_SUPPRESSION_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SAFARI_GESTURE_EVENTS",
    () => SAFARI_GESTURE_EVENTS,
    (value) => {
      SAFARI_GESTURE_EVENTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOUCH_COUNT_EVENTS",
    () => TOUCH_COUNT_EVENTS,
    (value) => {
      TOUCH_COUNT_EVENTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "activeViewportGestures",
    () => activeViewportGestures,
    (value) => {
      activeViewportGestures = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "activeTouchCount",
    () => activeTouchCount,
    (value) => {
      activeTouchCount = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isReroutingViewportEvent",
    () => isReroutingViewportEvent,
    (value) => {
      isReroutingViewportEvent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "updateTouchCount",
    () => updateTouchCount,
    (value) => {
      updateTouchCount = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "viewportGestureElementAtPoint",
    () => viewportGestureElementAtPoint,
    (value) => {
      viewportGestureElementAtPoint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rerouteViewportWheelEvent",
    () => rerouteViewportWheelEvent,
    (value) => {
      rerouteViewportWheelEvent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rerouteSafariGestureEvent",
    () => rerouteSafariGestureEvent,
    (value) => {
      rerouteSafariGestureEvent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "registerViewportGestureHandlers",
    () => registerViewportGestureHandlers,
    (value) => {
      registerViewportGestureHandlers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "attachViewportGestures",
    () => attachViewportGestures,
  );
  return () => {
    POINTER_STALE_TIMEOUT_MS = 1e4;
    SAFARI_GESTURE_WHEEL_SUPPRESSION_MS = 1000;
    SAFARI_GESTURE_EVENTS = ["gesturestart", "gesturechange", "gestureend"];
    TOUCH_COUNT_EVENTS = ["touchstart", "touchend", "touchcancel"];
    activeViewportGestures = new Map();
    activeTouchCount = 0;
    isReroutingViewportEvent = false;
    updateTouchCount = (event: TouchEvent): void => {
      activeTouchCount = event.touches?.length ?? 0;
    };
    viewportGestureElementAtPoint = (
      clientX?: number,
      clientY?: number,
    ): HTMLElement | undefined => {
      let value: HTMLElement | undefined;
      if (clientX === undefined || clientY === undefined) {
        return value;
      }
      for (let value2 of activeViewportGestures.keys()) {
        if (value2.closest("[inert]") || value2.checkVisibility?.() === false) {
          continue;
        }
        let bounds = value2.getBoundingClientRect();
        if (
          clientX >= bounds.left &&
          clientX < bounds.right &&
          clientY >= bounds.top &&
          clientY < bounds.bottom
        ) {
          value = value2;
        }
      }
      return value;
    };
    rerouteViewportWheelEvent = (event: WheelEvent): void => {
      if (
        !event.ctrlKey ||
        !event.cancelable ||
        event.defaultPrevented ||
        isReroutingViewportEvent
      ) {
        return;
      }
      let value = viewportGestureElementAtPoint(
        event.clientX,
        event.clientY,
      );
      if (!value) {
        return;
      }
      event.preventDefault();
      let value2 = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: event.clientX,
        clientY: event.clientY,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      });
      isReroutingViewportEvent = true;
      try {
        value.dispatchEvent(value2);
      } finally {
        isReroutingViewportEvent = false;
      }
    };
    rerouteSafariGestureEvent = (event: Event): void => {
      if (event.defaultPrevented || activeTouchCount > 0) {
        return;
      }
      let value = event as SafariGestureEvent,
        value2 = viewportGestureElementAtPoint(
          value.clientX,
          value.clientY,
        );
      if (!value2) {
        return;
      }
      event.preventDefault();
      activeViewportGestures.get(value2)?.[event.type as SafariGestureEventName](value);
    };
    registerViewportGestureHandlers = (
      element: HTMLElement,
      handlers: ViewportGestureHandlers,
    ): (() => void) => {
      activeViewportGestures.set(element, handlers);
      window.addEventListener("wheel", rerouteViewportWheelEvent, {
        passive: false,
      });
      for (let value of SAFARI_GESTURE_EVENTS)
        window.addEventListener(value, rerouteSafariGestureEvent, {
          passive: false,
        });
      for (let value of TOUCH_COUNT_EVENTS)
        window.addEventListener(value, updateTouchCount, {
          capture: true,
          passive: true,
        });
      return () => {
        if (activeViewportGestures.get(element) === handlers) {
          activeViewportGestures.delete(element);
        }
        if (activeViewportGestures.size > 0) {
          return;
        }
        window.removeEventListener(
          "wheel",
          rerouteViewportWheelEvent,
        );
        for (let value of SAFARI_GESTURE_EVENTS)
          window.removeEventListener(
            value,
            rerouteSafariGestureEvent,
          );
        for (let value of TOUCH_COUNT_EVENTS)
          window.removeEventListener(
            value,
            updateTouchCount,
            true,
          );
      };
    };
  };
}
