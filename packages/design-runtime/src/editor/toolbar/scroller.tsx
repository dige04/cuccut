/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorToolbarScroller(
  runtime: RuntimeBindings,
): () => void {
  var ToolbarScrollerClassNames: Dynamic;
  function toolbarScrollPosition(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = Math.max(0, value - context),
      value3: Dynamic = Math.max(context - 2 * extra, 48),
      value4: Dynamic = options + input * value3;
    input === 1 && value2 - value4 <= extra && (value4 = value2);
    input === -1 && value4 <= extra && (value4 = 0);
    return Math.min(value2, Math.max(0, value4));
  }
  function isKeyboardFocused(input?: Dynamic): Dynamic {
    try {
      return input.matches(":focus-visible");
    } catch {
      return false;
    }
  }
  function ToolbarScrollPaddle({
    dir: dir,
    onPress: onPress,
    onLetGo: onLetGo,
  }: Dynamic): Dynamic {
    let value: Dynamic =
      dir === -1 ? "Scroll toolbar left" : "Scroll toolbar right";
    return (
      <div
        data-tb-paddle={""}
        onClick={(input?: Dynamic): Dynamic => onPress(input.detail === 0)}
        className={(0, runtime.joinClassNames)(
          ToolbarScrollerClassNames,
          dir === -1 ? "left-0" : "right-0",
        )}
      >
        <runtime.Button
          iconOnly={true}
          size={"xs"}
          variant={"ghost"}
          icon={dir === -1 ? "CaretLeft" : "CaretRight"}
          aria-label={value}
          tooltip={false}
          onBlur={onLetGo}
          onPointerDown={onLetGo}
        />
      </div>
    );
  }
  function ToolbarScroller({
    leading: leading,
    revealLeading: revealLeading,
    children: children,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactCanvasMeasurements.useRef)(null),
      value2: Dynamic = (0, runtime.reactCanvasMeasurements.useRef)(null),
      [value3, value4]: Dynamic = (0, runtime.reactCanvasMeasurements.useState)(
        false,
      ),
      [value5, value6]: Dynamic = (0, runtime.reactCanvasMeasurements.useState)(
        false,
      ),
      value7: Dynamic = (0, runtime.useTouchToolbar)(),
      value8: Dynamic = (0, runtime.reactCanvasMeasurements.useRef)(undefined),
      value9: Dynamic = (0, runtime.reactCanvasMeasurements.useRef)(false),
      value10: Dynamic = (0, runtime.reactCanvasMeasurements.useRef)(false);
    (0, runtime.reactCanvasMeasurements.useEffect)((): Dynamic => {
      revealLeading != null &&
        revealLeading !== value8.current &&
        value.current?.scrollTo({
          left: 0,
          behavior: "smooth",
        });
      value8.current = revealLeading;
    }, [revealLeading]);
    let value11: Dynamic = (0,
    runtime.reactCanvasMeasurements.useCallback)((): Dynamic => {
      let current: Dynamic = value.current;
      if (!current) return;
      let value12: Dynamic =
          (value2.current?.clientWidth ?? current.clientWidth) >=
          (value7 ? 80 : 48),
        value13: Dynamic = value12 && current.scrollLeft > 1,
        value14: Dynamic =
          value12 &&
          current.scrollLeft + current.clientWidth < current.scrollWidth - 1,
        current2: Dynamic = value2.current,
        activeElement: Dynamic = current.ownerDocument.activeElement,
        value15: Dynamic = activeElement?.closest("[data-tb-paddle]");
      if (
        current2 &&
        activeElement &&
        value15?.parentElement === current2 &&
        (value9.current || isKeyboardFocused(activeElement))
      ) {
        let value16: Dynamic = value15 === current2.lastElementChild;
        if (!(value16 ? value14 : value13)) {
          let value17: Dynamic = (0, runtime.getFocusableElements)(current);
          value10.current = true;
          try {
            for (let value18 of (value16
              ? value17.reverse()
              : value17) as Dynamic)
              if (
                !value18.hasAttribute("data-base-ui-focus-guard") &&
                (value18.focus({
                  preventScroll: true,
                }),
                !value15.contains(current.ownerDocument.activeElement))
              ) {
                (0, runtime.clearEscapeReleaseSuppression)();
                break;
              }
          } finally {
            value10.current = false;
          }
        }
      }
      value4(value13);
      value6(value14);
    }, [value7]);
    (0, runtime.reactCanvasMeasurements.useEffect)((): Dynamic => {
      let current: Dynamic = value.current;
      if (!current) return;
      value11();
      let ancestor: Dynamic = current.closest(".tb-root"),
        index: Dynamic = 0,
        observer: Dynamic = new ResizeObserver((): Dynamic => {
          value11();
          cancelAnimationFrame(index);
          ancestor &&
            (index = requestAnimationFrame(
              (): Dynamic => (0, runtime.updateToolbarPinnedWords)(ancestor),
            ));
        });
      observer.observe(current);
      for (let value13 of current.children as Dynamic)
        observer.observe(value13);
      let value12: Dynamic = ancestor?.querySelector(".tb-card-end");
      ancestor && observer.observe(ancestor);
      value12 && observer.observe(value12);
      let callback3: Dynamic = (event?: Dynamic): Dynamic => {
        if (
          (event.ctrlKey && current.closest("[data-tb-overlay]")) ||
          current.scrollWidth <= current.clientWidth
        )
          return;
        let value13: Dynamic =
          Math.abs(event.deltaX) > Math.abs(event.deltaY)
            ? event.deltaX
            : event.deltaY;
        value13 !== 0 &&
          ((current.scrollLeft += value13), event.preventDefault());
      };
      current.addEventListener("wheel", callback3, {
        passive: false,
      });
      let callback4: Dynamic = (event?: Dynamic): Dynamic => {
        let target: Dynamic = event.target,
          current2: Dynamic = value2.current;
        if (
          !current2 ||
          value10.current ||
          !(target instanceof Element) ||
          target.hasAttribute("data-base-ui-focus-guard") ||
          !isKeyboardFocused(target)
        )
          return;
        let bounds: Dynamic = target.getBoundingClientRect();
        if (bounds.width <= 1) return;
        let bounds2: Dynamic = current2.getBoundingClientRect(),
          callback5: Dynamic = (input?: Dynamic): Dynamic =>
            current2.querySelector(":scope > " + input)?.getBoundingClientRect()
              .width ?? 0,
          value13: Dynamic = callback5("[data-tb-paddle]"),
          value14: Dynamic =
            bounds2.width - 2 * (value13 + callback5("[data-tb-fade]")) >=
            bounds.width
              ? value13 + callback5("[data-tb-fade]")
              : value13,
          value15: Dynamic = bounds2.left + value14,
          value16: Dynamic = bounds2.right - value14,
          value17: Dynamic =
            bounds.left < value15 || bounds.width > value16 - value15
              ? bounds.left - value15
              : bounds.right > value16
                ? bounds.right - value16
                : 0;
        if (Math.round(value17) === 0) return;
        let value18: Dynamic = current.scrollWidth - current.clientWidth,
          value19: Dynamic = current.scrollLeft + value17;
        value19 <= value14 && bounds.right - value17 + value19 <= value16
          ? (value19 = 0)
          : value18 - value19 <= value14 &&
            bounds.left - value17 - (value18 - value19) >= value15 &&
            (value19 = value18);
        current.scrollLeft = Math.round(value19);
      };
      current.addEventListener("focusin", callback4);
      return (): Dynamic => {
        cancelAnimationFrame(index);
        observer.disconnect();
        current.removeEventListener("wheel", callback3);
        current.removeEventListener("focusin", callback4);
      };
    }, [value11]);
    let callback: Dynamic = (): Dynamic => {
        value9.current = false;
      },
      callback2: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        let current: Dynamic = value.current;
        if (!current) return;
        let value12: Dynamic = value2.current?.querySelector(
            ":scope > [data-tb-paddle]",
          ),
          value13: Dynamic = value2.current?.querySelector(
            ":scope > span[aria-hidden]",
          ),
          value14: Dynamic =
            (value12?.offsetWidth ?? 24) + (value13?.offsetWidth ?? 24),
          value15: Dynamic = value2.current?.clientWidth ?? current.clientWidth,
          value16: Dynamic = current.clientWidth - value15;
        value9.current = options;
        current.scrollTo({
          left: toolbarScrollPosition(
            input,
            current.scrollLeft,
            value15,
            current.scrollWidth - value16,
            value14,
          ),
          behavior: "smooth",
        });
      };
    return (
      <div
        ref={value2}
        className={"relative flex min-w-0 flex-1 items-center self-stretch"}
      >
        <div
          ref={value}
          onScroll={value11}
          className={
            "tb-scroll flex min-w-0 flex-1 items-center gap-1 self-stretch overflow-x-auto pointer-coarse:gap-1.5"
          }
        >
          {leading != null ? (
            <span
              data-tb-cluster={""}
              className={
                "tb-slot flex shrink-0 items-center gap-1 pointer-coarse:gap-1.5"
              }
            >
              {leading}
            </span>
          ) : null}
          <div
            className={
              "tb-slot flex min-w-max items-center gap-1 pointer-coarse:gap-1.5"
            }
          >
            {children}
          </div>
        </div>
        {value3 ? (
          <runtime.jsxToolbarLayout.Fragment>
            <ToolbarScrollPaddle
              dir={-1}
              onPress={(input?: Dynamic): Dynamic => callback2(-1, input)}
              onLetGo={callback}
            />
            <span
              aria-hidden={"true"}
              data-tb-fade={"start"}
              className={
                "pointer-events-none absolute inset-y-0 left-6 z-10 w-6 pointer-coarse:left-10"
              }
            />
          </runtime.jsxToolbarLayout.Fragment>
        ) : null}
        {value5 ? (
          <runtime.jsxToolbarLayout.Fragment>
            <span
              aria-hidden={"true"}
              data-tb-fade={"end"}
              className={
                "pointer-events-none absolute inset-y-0 right-6 z-10 w-6 pointer-coarse:right-10"
              }
            />
            <ToolbarScrollPaddle
              dir={1}
              onPress={(input?: Dynamic): Dynamic => callback2(1, input)}
              onLetGo={callback}
            />
          </runtime.jsxToolbarLayout.Fragment>
        ) : null}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "toolbarScrollPosition",
    () => toolbarScrollPosition,
  );
  bindRuntimeValue(
    runtime,
    "ToolbarScrollerClassNames",
    () => ToolbarScrollerClassNames,
    (value) => {
      ToolbarScrollerClassNames = value;
    },
  );
  bindRuntimeValue(runtime, "isKeyboardFocused", () => isKeyboardFocused);
  bindRuntimeValue(runtime, "ToolbarScrollPaddle", () => ToolbarScrollPaddle);
  bindRuntimeValue(runtime, "ToolbarScroller", () => ToolbarScroller);
  return () => {
    ToolbarScrollerClassNames =
      "absolute inset-y-0 z-10 flex w-6 items-center justify-center pointer-coarse:w-10";
  };
}
