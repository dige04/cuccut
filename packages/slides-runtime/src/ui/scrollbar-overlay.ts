/** Restored application module; prepare first, initialize in original order. */
import type {
  PointerEvent as ReactPointerEvent,
  ReactElement,
  RefObject,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";

/** Where the overlay thumb sits inside its scroller, in pixels. */
export interface ScrollbarMetrics {
  /** Thumb offset from the top of the track. */
  top: number;
  height: number;
  right: number;
  overflows: boolean;
  /** Offset of the track from the top of the overlay's container. */
  trackTop: number;
}
export interface ScrollbarOverlayProps {
  /** The scroller to overlay; defaults to the overlay's parent element. */
  target?: RefObject<HTMLElement | null>;
  className?: string;
}
/** An in-progress drag of the thumb. */
interface ScrollbarThumbDrag {
  startY: number;
  startTop: number;
  pointerId: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactw8: ReactNamespace;
    reactU3: ReactNamespace;
    jsxRK0: JsxNamespace;
    HIDDEN_NATIVE_SCROLLBAR_CLASS: string;
    SCROLLBAR_WIDTH: number;
    SCROLLBAR_INSET: number;
    MIN_SCROLLBAR_THUMB_SIZE: number;
    SCROLLBAR_IDLE_HIDE_MS: number;
    SCROLLBAR_THUMB_CLASS: string;
    scrollbarMetrics: (target: HTMLElement, now?: boolean) => ScrollbarMetrics;
    ScrollbarOverlay: (props: ScrollbarOverlayProps) => ReactElement;
  }
}

export function installUiScrollbarOverlay(
  runtime: RuntimeBindings,
): () => void {
  var reactw8: ReactNamespace;
  var reactU3: ReactNamespace;
  var jsxRK0: JsxNamespace;
  var HIDDEN_NATIVE_SCROLLBAR_CLASS: string;
  var SCROLLBAR_WIDTH: number;
  var SCROLLBAR_INSET: number;
  var MIN_SCROLLBAR_THUMB_SIZE: number;
  var SCROLLBAR_IDLE_HIDE_MS: number;
  var SCROLLBAR_THUMB_CLASS: string;
  function scrollbarMetrics(
    target: HTMLElement,
    now?: boolean,
  ): ScrollbarMetrics {
    let {
        scrollHeight: scrollHeight,
        clientHeight: clientHeight,
        scrollTop: scrollTop,
      } = target,
      value = scrollHeight > clientHeight + 1,
      value2 = clientHeight,
      value3 = value
        ? Math.max(
            MIN_SCROLLBAR_THUMB_SIZE,
            Math.round((clientHeight / scrollHeight) * value2),
          )
        : 0,
      value4 = value2 - value3,
      value5 = value
        ? Math.round((scrollTop / (scrollHeight - clientHeight)) * value4)
        : 0,
      value6 = SCROLLBAR_INSET,
      index = 0;
    if (now) {
      let offsetParent = target.offsetParent;
      value6 =
        (offsetParent ? offsetParent.clientWidth : target.offsetWidth) -
        (target.offsetLeft + target.offsetWidth) +
        SCROLLBAR_INSET;
      index = target.offsetTop;
    } else {
      let value7 = getComputedStyle(target);
      value6 = SCROLLBAR_INSET - (parseFloat(value7.paddingRight) || 0);
      value5 -= clientHeight - (parseFloat(value7.paddingBottom) || 0);
    }
    return {
      top: value5,
      height: value3,
      right: value6,
      overflows: value,
      trackTop: index,
    };
  }
  function ScrollbarOverlay({
    target: target,
    className: className,
  }: ScrollbarOverlayProps): ReactElement {
    let ref = reactU3.useRef<HTMLDivElement>(null),
      ref2 = reactU3.useRef<HTMLDivElement>(null),
      [value, value2] = reactU3.useState<ScrollbarMetrics | null>(null),
      [value3, value4] = reactU3.useState(false),
      [value5, value6] = reactU3.useState(false),
      ref3 = reactU3.useRef(false),
      ref4 = reactU3.useRef<ScrollbarThumbDrag | null>(null),
      ref5 = reactU3.useRef<ReturnType<typeof setTimeout> | null>(null),
      callback = reactU3.useCallback((): void => {
        if (ref5.current) {
          clearTimeout(ref5.current);
        }
        ref5.current = setTimeout((): void => {
          ref5.current = null;
          if (!ref3.current && !ref4.current) {
            value4(false);
          }
        }, SCROLLBAR_IDLE_HIDE_MS);
      }, []);
    reactU3.useEffect((): (() => void) | undefined => {
      let value10 = target !== undefined,
        value11 = value10
          ? target!.current
          : (ref.current?.parentElement ?? null);
      if (!value11) {
        return;
      }
      let index = 0,
        callback8 = (): void => {
          if (index) {
            return;
          }
          index = requestAnimationFrame((): void => {
            index = 0;
            let value14 = scrollbarMetrics(value11, value10);
            value2(
              (input: ScrollbarMetrics | null): ScrollbarMetrics =>
                input &&
                input.top === value14.top &&
                input.height === value14.height &&
                input.right === value14.right &&
                input.overflows === value14.overflows &&
                input.trackTop === value14.trackTop
                  ? input
                  : value14,
            );
          });
        },
        callback9 = (): void => {
          callback8();
          value4(true);
          callback();
        },
        callback10 = (event: Event): void => {
          let target2 = event.target as Element | null,
            value14 =
              target2?.closest?.("[data-kit=overlay-scrollbar]") ?? null,
            value15 =
              (value14 && value14 !== ref.current
                ? null
                : (target2?.closest?.("[data-overlay-scroller]") ?? null)) ===
              value11;
          ref3.current = value15;
          if (value15) {
            callback8();
            value4(true);
          } else if (!ref4.current) {
            value4(false);
          }
        },
        callback11 = (): void => {
          ref3.current = false;
          if (!ref4.current) {
            callback();
          }
        };
      value11.setAttribute("data-overlay-scroller", "");
      value11.addEventListener("scroll", callback9, {
        passive: true,
      });
      value11.addEventListener("pointerover", callback10);
      value11.addEventListener("pointerleave", callback11);
      let value12 =
        typeof ResizeObserver === "function"
          ? new ResizeObserver(callback8)
          : null;
      value12?.observe(value11);
      let value13 =
        typeof MutationObserver === "function"
          ? new MutationObserver(callback8)
          : null;
      value13?.observe(value11, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      value11.addEventListener("input", callback8);
      callback8();
      return (): void => {
        value11.removeAttribute("data-overlay-scroller");
        value11.removeEventListener("scroll", callback9);
        value11.removeEventListener("pointerover", callback10);
        value11.removeEventListener("pointerleave", callback11);
        value11.removeEventListener("input", callback8);
        value12?.disconnect();
        value13?.disconnect();
        if (index) {
          cancelAnimationFrame(index);
        }
        if (ref5.current) {
          clearTimeout(ref5.current);
        }
      };
    }, [target, callback]);
    let callback2 = (): HTMLElement | null =>
        target !== undefined
          ? target.current
          : (ref.current?.parentElement ?? null),
      callback3 = (event: ReactPointerEvent<HTMLDivElement>): void => {
        if (event.button !== 0) {
          return;
        }
        let value10 = callback2();
        if (!value10) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {}
        ref4.current = {
          startY: event.clientY,
          startTop: value10.scrollTop,
          pointerId: event.pointerId,
        };
        value6(true);
        value4(true);
      },
      callback4 = (input: ReactPointerEvent<HTMLDivElement>): void => {
        let current = ref4.current,
          value10 = callback2();
        if (!current || !value10 || input.pointerId !== current.pointerId) {
          return;
        }
        let { scrollHeight: value11, clientHeight: value12 } = value10,
          value13 = value?.height ?? MIN_SCROLLBAR_THUMB_SIZE,
          value14 = value12 - value13;
        if (value14 <= 0) {
          return;
        }
        value10.scrollTop =
          current.startTop +
          ((input.clientY - current.startY) * (value11 - value12)) / value14;
      },
      callback5 = (input: ReactPointerEvent<HTMLDivElement>): void => {
        let current = ref4.current;
        if (!current || input.pointerId !== current.pointerId) {
          return;
        }
        ref4.current = null;
        value6(false);
        if (input.currentTarget.hasPointerCapture(input.pointerId)) {
          input.currentTarget.releasePointerCapture(input.pointerId);
        }
        if (!ref3.current) {
          callback();
        }
      },
      callback6 = (): void => {
        ref3.current = true;
        value4(true);
      },
      callback7 = (): void => {
        ref3.current = false;
        if (!ref4.current) {
          callback();
        }
      },
      value7 = value3 && value?.overflows === true,
      value8 = target !== undefined,
      value9 = value
        ? jsxRK0.jsx("div", {
            ref: ref2,
            "data-kit": "overlay-scrollbar-thumb",
            "data-dragging": value5 ? "" : undefined,
            className: (0, runtime.joinClassNames)(
              "absolute cursor-default select-none",
              SCROLLBAR_THUMB_CLASS,
              !value7 && "pointer-events-none",
            ),
            style: {
              width: SCROLLBAR_WIDTH,
              right: value.right,
              top: (value8 ? value.trackTop : 0) + value.top,
              height: value.height,
              opacity: value7 ? 1 : 0,
            },
            onPointerEnter: callback6,
            onPointerLeave: callback7,
            onPointerDown: callback3,
            onPointerMove: callback4,
            onPointerUp: callback5,
            onPointerCancel: callback5,
          })
        : null;
    return jsxRK0.jsx("div", {
      ref: ref,
      "aria-hidden": "true",
      "data-kit": "overlay-scrollbar",
      className: (0, runtime.joinClassNames)(
        value8
          ? "contents"
          : "sticky bottom-0 z-10 h-0 w-full shrink-0 overflow-visible",
        className,
      ),
      children: value9,
    });
  }
  bindRuntimeValue(
    runtime,
    "reactw8",
    () => reactw8,
    (value) => {
      reactw8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactU3",
    () => reactU3,
    (value) => {
      reactU3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxRK0",
    () => jsxRK0,
    (value) => {
      jsxRK0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HIDDEN_NATIVE_SCROLLBAR_CLASS",
    () => HIDDEN_NATIVE_SCROLLBAR_CLASS,
    (value) => {
      HIDDEN_NATIVE_SCROLLBAR_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SCROLLBAR_WIDTH",
    () => SCROLLBAR_WIDTH,
    (value) => {
      SCROLLBAR_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SCROLLBAR_INSET",
    () => SCROLLBAR_INSET,
    (value) => {
      SCROLLBAR_INSET = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIN_SCROLLBAR_THUMB_SIZE",
    () => MIN_SCROLLBAR_THUMB_SIZE,
    (value) => {
      MIN_SCROLLBAR_THUMB_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SCROLLBAR_IDLE_HIDE_MS",
    () => SCROLLBAR_IDLE_HIDE_MS,
    (value) => {
      SCROLLBAR_IDLE_HIDE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SCROLLBAR_THUMB_CLASS",
    () => SCROLLBAR_THUMB_CLASS,
    (value) => {
      SCROLLBAR_THUMB_CLASS = value;
    },
  );
  bindRuntimeValue(runtime, "scrollbarMetrics", () => scrollbarMetrics);
  bindRuntimeValue(runtime, "ScrollbarOverlay", () => ScrollbarOverlay);
  return () => {
    (0, runtime.initializeSlideRenderer)();
    reactw8 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeFontCatalog)();
    (0, runtime.initializeUiPropertyPopover2)();
    reactU3 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxRK0 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    HIDDEN_NATIVE_SCROLLBAR_CLASS =
      "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
    SCROLLBAR_WIDTH = 6;
    SCROLLBAR_INSET = 2;
    MIN_SCROLLBAR_THUMB_SIZE = 24;
    SCROLLBAR_IDLE_HIDE_MS = 800;
    SCROLLBAR_THUMB_CLASS =
      "rounded-full bg-alpha-3 hover:bg-alpha-4 data-[dragging]:bg-alpha-4 transition-opacity duration-150 motion-reduce:transition-none touch-none";
  };
}
