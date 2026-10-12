/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorChromeScrollbar(
  runtime: RuntimeBindings,
): () => void {
  var reactChromeScrollbar: Dynamic;
  var jsxChromeScrollbar: Dynamic;
  var ChromeScrollbarLabel: Dynamic;
  var ChromeScrollbarConstant: Dynamic;
  var ChromeScrollbarConstant_2: Dynamic;
  var ChromeScrollbarConstant_3: Dynamic;
  var ChromeScrollbarDelayMs: Dynamic;
  var ChromeScrollbarClassNames: Dynamic;
  function getScrollbarMetrics(input?: Dynamic, options?: Dynamic): Dynamic {
    let {
        scrollHeight: value,
        clientHeight: value2,
        scrollTop: value3,
      }: Dynamic = input,
      value4: Dynamic = value > value2 + 1,
      value5: Dynamic = value2,
      value6: Dynamic = value4
        ? Math.max(
            ChromeScrollbarConstant_3,
            Math.round((value2 / value) * value5),
          )
        : 0,
      value7: Dynamic = value5 - value6,
      value8: Dynamic = value4
        ? Math.round((value3 / (value - value2)) * value7)
        : 0,
      value9: Dynamic = ChromeScrollbarConstant_2,
      index: Dynamic = 0;
    if (options) {
      let offsetParent: Dynamic = input.offsetParent;
      value9 =
        (offsetParent ? offsetParent.clientWidth : input.offsetWidth) -
        (input.offsetLeft + input.offsetWidth) +
        ChromeScrollbarConstant_2;
      index = input.offsetTop;
    } else {
      let value10: Dynamic = getComputedStyle(input);
      value9 =
        ChromeScrollbarConstant_2 - (parseFloat(value10.paddingRight) || 0);
      value8 -= value2 - (parseFloat(value10.paddingBottom) || 0);
    }
    return {
      top: value8,
      height: value6,
      right: value9,
      overflows: value4,
      trackTop: index,
    };
  }
  function FloatingScrollbar({
    target: target,
    className: className,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, reactChromeScrollbar.useRef)(null),
      value2: Dynamic = (0, reactChromeScrollbar.useRef)(null),
      [value3, value4]: Dynamic = (0, reactChromeScrollbar.useState)(null),
      [value5, value6]: Dynamic = (0, reactChromeScrollbar.useState)(false),
      [value7, value8]: Dynamic = (0, reactChromeScrollbar.useState)(false),
      value9: Dynamic = (0, reactChromeScrollbar.useRef)(false),
      value10: Dynamic = (0, reactChromeScrollbar.useRef)(null),
      value11: Dynamic = (0, reactChromeScrollbar.useRef)(null),
      value12: Dynamic = (0, reactChromeScrollbar.useCallback)((): Dynamic => {
        value11.current && clearTimeout(value11.current);
        value11.current = setTimeout((): Dynamic => {
          value11.current = null;
          !value9.current && !value10.current && value6(false);
        }, ChromeScrollbarDelayMs);
      }, []);
    (0, reactChromeScrollbar.useEffect)((): Dynamic => {
      let value16: Dynamic = target !== undefined,
        value17: Dynamic = value16
          ? target.current
          : (value.current?.parentElement ?? null);
      if (!value17) return;
      let index: Dynamic = 0,
        callback7: Dynamic = (): Dynamic => {
          index ||
            (index = requestAnimationFrame((): Dynamic => {
              index = 0;
              let value20: Dynamic = getScrollbarMetrics(value17, value16);
              value4(
                (input?: Dynamic): Dynamic =>
                  input &&
                  input.top === value20.top &&
                  input.height === value20.height &&
                  input.right === value20.right &&
                  input.overflows === value20.overflows &&
                  input.trackTop === value20.trackTop
                    ? input
                    : value20,
              );
            }));
        },
        callback8: Dynamic = (): Dynamic => {
          callback7();
          value6(true);
          value12();
        },
        callback9: Dynamic = (event?: Dynamic): Dynamic => {
          let target2: Dynamic = event.target,
            value20: Dynamic =
              target2?.closest?.("[data-kit=overlay-scrollbar]") ?? null,
            value21: Dynamic =
              (value20 && value20 !== value.current
                ? null
                : (target2?.closest?.("[data-overlay-scroller]") ?? null)) ===
              value17;
          value9.current = value21;
          value21
            ? (callback7(), value6(true))
            : value10.current || value6(false);
        },
        callback10: Dynamic = (): Dynamic => {
          value9.current = false;
          value10.current || value12();
        };
      value17.setAttribute("data-overlay-scroller", "");
      value17.addEventListener("scroll", callback8, {
        passive: true,
      });
      value17.addEventListener("pointerover", callback9);
      value17.addEventListener("pointerleave", callback10);
      let value18: Dynamic =
        typeof ResizeObserver == "function"
          ? new ResizeObserver(callback7)
          : null;
      value18?.observe(value17);
      let value19: Dynamic =
        typeof MutationObserver == "function"
          ? new MutationObserver(callback7)
          : null;
      value19?.observe(value17, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      value17.addEventListener("input", callback7);
      callback7();
      return (): Dynamic => {
        value17.removeAttribute("data-overlay-scroller");
        value17.removeEventListener("scroll", callback8);
        value17.removeEventListener("pointerover", callback9);
        value17.removeEventListener("pointerleave", callback10);
        value17.removeEventListener("input", callback7);
        value18?.disconnect();
        value19?.disconnect();
        index && cancelAnimationFrame(index);
        value11.current && clearTimeout(value11.current);
      };
    }, [target, value12]);
    let callback: Dynamic = (): Dynamic =>
        target !== undefined
          ? target.current
          : (value.current?.parentElement ?? null),
      callback2: Dynamic = (event?: Dynamic): Dynamic => {
        if (event.button !== 0) return;
        let value16: Dynamic = callback();
        if (value16) {
          event.preventDefault();
          event.stopPropagation();
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {}
          value10.current = {
            startY: event.clientY,
            startTop: value16.scrollTop,
            pointerId: event.pointerId,
          };
          value8(true);
          value6(true);
        }
      },
      callback3: Dynamic = (input?: Dynamic): Dynamic => {
        let current: Dynamic = value10.current,
          value16: Dynamic = callback();
        if (!current || !value16 || input.pointerId !== current.pointerId)
          return;
        let { scrollHeight: value17, clientHeight: value18 }: Dynamic = value16,
          value19: Dynamic = value3?.height ?? ChromeScrollbarConstant_3,
          value20: Dynamic = value18 - value19;
        value20 <= 0 ||
          (value16.scrollTop =
            current.startTop +
            ((input.clientY - current.startY) * (value17 - value18)) / value20);
      },
      callback4: Dynamic = (input?: Dynamic): Dynamic => {
        let current: Dynamic = value10.current;
        !current ||
          input.pointerId !== current.pointerId ||
          ((value10.current = null),
          value8(false),
          input.currentTarget.hasPointerCapture(input.pointerId) &&
            input.currentTarget.releasePointerCapture(input.pointerId),
          value9.current || value12());
      },
      callback5: Dynamic = (): Dynamic => {
        value9.current = true;
        value6(true);
      },
      callback6: Dynamic = (): Dynamic => {
        value9.current = false;
        value10.current || value12();
      },
      value13: Dynamic = value5 && value3?.overflows === true,
      value14: Dynamic = target !== undefined,
      value15: Dynamic = value3 ? (
        <div
          ref={value2}
          data-kit={"overlay-scrollbar-thumb"}
          data-dragging={value7 ? "" : undefined}
          className={(0, runtime.joinClassNames)(
            "absolute cursor-default select-none",
            ChromeScrollbarClassNames,
            !value13 && "pointer-events-none",
          )}
          style={{
            width: ChromeScrollbarConstant,
            right: value3.right,
            top: (value14 ? value3.trackTop : 0) + value3.top,
            height: value3.height,
            opacity: value13 ? 1 : 0,
          }}
          onPointerEnter={callback5}
          onPointerLeave={callback6}
          onPointerDown={callback2}
          onPointerMove={callback3}
          onPointerUp={callback4}
          onPointerCancel={callback4}
        />
      ) : null;
    return (
      <div
        ref={value}
        aria-hidden={"true"}
        data-kit={"overlay-scrollbar"}
        className={(0, runtime.joinClassNames)(
          value14
            ? "contents"
            : "sticky bottom-0 z-10 h-0 w-full shrink-0 overflow-visible",
          className,
        )}
      >
        {value15}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactChromeScrollbar",
    () => reactChromeScrollbar,
    (value) => {
      reactChromeScrollbar = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxChromeScrollbar",
    () => jsxChromeScrollbar,
    (value) => {
      jsxChromeScrollbar = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromeScrollbarLabel",
    () => ChromeScrollbarLabel,
    (value) => {
      ChromeScrollbarLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromeScrollbarConstant",
    () => ChromeScrollbarConstant,
    (value) => {
      ChromeScrollbarConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromeScrollbarConstant_2",
    () => ChromeScrollbarConstant_2,
    (value) => {
      ChromeScrollbarConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromeScrollbarConstant_3",
    () => ChromeScrollbarConstant_3,
    (value) => {
      ChromeScrollbarConstant_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromeScrollbarDelayMs",
    () => ChromeScrollbarDelayMs,
    (value) => {
      ChromeScrollbarDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromeScrollbarClassNames",
    () => ChromeScrollbarClassNames,
    (value) => {
      ChromeScrollbarClassNames = value;
    },
  );
  bindRuntimeValue(runtime, "getScrollbarMetrics", () => getScrollbarMetrics);
  bindRuntimeValue(runtime, "FloatingScrollbar", () => FloatingScrollbar);
  return () => {
    reactChromeScrollbar = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    jsxChromeScrollbar = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    ChromeScrollbarLabel =
      "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
    ChromeScrollbarConstant = 6;
    ChromeScrollbarConstant_2 = 2;
    ChromeScrollbarConstant_3 = 24;
    ChromeScrollbarDelayMs = 800;
    ChromeScrollbarClassNames =
      "rounded-full bg-alpha-3 hover:bg-alpha-4 data-[dragging]:bg-alpha-4 transition-opacity duration-150 motion-reduce:transition-none touch-none";
  };
}
