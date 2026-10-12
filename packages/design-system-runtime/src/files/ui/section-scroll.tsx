/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as JsxRuntime from "react/jsx-runtime";
import type {
  SectionPosition,
  ScrollEdge,
  ScrollViewport,
  SectionRefs,
  SectionScroller,
  LazySectionProps,
} from "../../contracts/application";
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installFilesUiSectionScroll(
  runtime: RuntimeBindings,
): () => void {
  var reactSectionScroller: typeof React;
  var jsxLazySection: typeof JsxRuntime;
  var SECTION_SCROLL_MIN_LEAD_PX: number;
  var SECTION_SCROLL_VIEWPORT_LEAD_RATIO: number;
  var SECTION_SCROLL_ANCHOR_HOLD_MS: number;
  function sectionAtScrollPosition(
    sections: SectionPosition[],
    leadY: number,
    edge: ScrollEdge,
    wanted: string | null,
    viewport: ScrollViewport,
  ) {
    if (sections.length === 0) {
      return null;
    }
    let wantedSection =
        wanted === null
          ? undefined
          : sections.find((input) => input.id === wanted),
      wantedVisible =
        wantedSection !== undefined &&
        wantedSection.top >= viewport.top - 1 &&
        wantedSection.top < viewport.bottom;
    if (edge === "top") {
      if (wantedVisible) {
        return (wantedSection as SectionPosition).id;
      } else {
        return sections[0].id;
      }
    }
    let current = sections[0].id;
    for (let value of sections) {
      if (value.top <= leadY) {
        current = value.id;
      }
    }
    if (edge === "bottom") {
      if (wantedVisible) {
        return (wantedSection as SectionPosition).id;
      } else {
        return sections[sections.length - 1].id;
      }
    }
    return current;
  }
  function sectionsThroughTarget(sections: string[], target: string) {
    let index = sections.indexOf(target);
    if (index < 0) {
      return [target];
    } else {
      return sections.slice(0, index + 1);
    }
  }
  function focusIsEditingElsewhere(section: HTMLElement): boolean {
    let active = document.activeElement;
    if (
      !(active instanceof HTMLElement) ||
      active === document.body ||
      active === section
    ) {
      return false;
    }
    return (
      active.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) ||
      active.closest('[role="dialog"]') !== null
    );
  }
  function useSectionScroller(
    sectionIds: string[],
    headerBottom: () => number | undefined,
    sectionRefs: SectionRefs,
    initialSection: string,
  ): SectionScroller {
    let [port, setPort] = reactSectionScroller.useState<HTMLElement | null>(
        null,
      ),
      attach = reactSectionScroller.useCallback(
        (input: HTMLElement | null) => setPort(input),
        [],
      ),
      [current, setCurrent] = reactSectionScroller.useState(initialSection),
      currentRef = reactSectionScroller.useRef(current);
    currentRef.current = current;
    let [wanted, setWanted] = reactSectionScroller.useState(
        () =>
          new Set(
            initialSection === sectionIds[0]
              ? []
              : sectionsThroughTarget(sectionIds, initialSection),
          ),
      ),
      [moved, setMoved] = reactSectionScroller.useState(
        initialSection !== sectionIds[0],
      ),
      targetRef = reactSectionScroller.useRef<string | null>(
        initialSection === sectionIds[0] ? null : initialSection,
      ),
      holdUntilRef = reactSectionScroller.useRef(0),
      focusPending = reactSectionScroller.useRef(false),
      sectionIdsRef = reactSectionScroller.useRef(sectionIds);
    sectionIdsRef.current = sectionIds;
    let headerBottomRef = reactSectionScroller.useRef(headerBottom);
    headerBottomRef.current = headerBottom;
    let markedRef = reactSectionScroller.useRef<string | null>(null),
      markedUntilRef = reactSectionScroller.useRef(0),
      markedTimerRef = reactSectionScroller.useRef(0);
    reactSectionScroller.useEffect(
      () => () => window.clearTimeout(markedTimerRef.current),
      [],
    );
    let clearTarget = reactSectionScroller.useCallback(() => {
        holdUntilRef.current = 0;
        targetRef.current = null;
        focusPending.current = false;
      }, []),
      measureCurrent = reactSectionScroller.useCallback(() => {
        if (port === null) {
          return;
        }
        let bounds = port.getBoundingClientRect(),
          value =
            (headerBottomRef.current() ?? bounds.top) +
            Math.max(
              SECTION_SCROLL_MIN_LEAD_PX,
              port.clientHeight * SECTION_SCROLL_VIEWPORT_LEAD_RATIO,
            ),
          items: SectionPosition[] = [];
        for (let value7 of sectionIdsRef.current) {
          let value8 = sectionRefs.current[value7];
          if (value8 !== null && value8 !== undefined) {
            items.push({
              id: value7,
              top: value8.getBoundingClientRect().top,
            });
          }
        }
        let value2: ScrollEdge =
            port.scrollTop <= 1
              ? "top"
              : port.scrollTop + port.clientHeight >= port.scrollHeight - 2
                ? "bottom"
                : null,
          value3 = sectionAtScrollPosition(
            items,
            value,
            value2,
            targetRef.current,
            bounds,
          ),
          current2 = markedRef.current,
          value4 =
            current2 === null || !sectionIdsRef.current.includes(current2)
              ? undefined
              : sectionRefs.current[current2]?.getBoundingClientRect(),
          value5 =
            Date.now() >= markedUntilRef.current &&
            value4 !== undefined &&
            (value4.bottom <= bounds.top ||
              value4.top >= bounds.bottom ||
              value3 === current2);
        if (current2 !== null && (value4 === undefined || value5)) {
          markedRef.current = null;
        }
        let value6 =
          Date.now() < holdUntilRef.current && targetRef.current !== null
            ? targetRef.current
            : (markedRef.current ?? value3);
        if (value6 !== null && value6 !== currentRef.current) {
          currentRef.current = value6;
          setMoved(true);
          setCurrent(value6);
        }
      }, [port, sectionRefs]),
      scrollToTarget = reactSectionScroller.useCallback(() => {
        let current2 = targetRef.current,
          value = current2 === null ? null : sectionRefs.current[current2];
        if (port === null || value === null || value === undefined) {
          return false;
        }
        let bounds = port.getBoundingClientRect(),
          value2 = headerBottomRef.current(),
          value3 =
            value2 !== undefined ? Math.max(0, value2 - bounds.top + 8) : 0,
          value4 = Math.max(0, port.scrollHeight - port.clientHeight),
          value5 = Math.min(
            value4,
            Math.max(
              0,
              port.scrollTop +
                value.getBoundingClientRect().top -
                bounds.top -
                value3,
            ),
          );
        if (Math.abs(value5 - port.scrollTop) < 1) {
          return false;
        }
        port.scrollTo({
          top: value5,
          behavior: "instant",
        });
        return true;
      }, [port, sectionRefs]),
      focusTarget = reactSectionScroller.useCallback(() => {
        let value =
          targetRef.current === null
            ? null
            : sectionRefs.current[targetRef.current];
        if (!focusPending.current || value === null || value === undefined) {
          return;
        }
        focusPending.current = false;
        if (!focusIsEditingElsewhere(value)) {
          value.focus({
            preventScroll: true,
          });
        }
      }, [sectionRefs]);
    reactSectionScroller.useEffect(() => {
      if (port === null) {
        return;
      }
      let index = 0,
        callback = () => {
          if (index === 0) {
            index = requestAnimationFrame(() => {
              index = 0;
              measureCurrent();
            });
          }
        };
      port.addEventListener("scroll", callback, {
        passive: true,
      });
      let callback2 = () => {
        clearTarget();
        if (markedRef.current === null) {
          return;
        }
        markedUntilRef.current = 0;
        callback();
      };
      for (let value3 of ["wheel", "touchstart", "pointerdown"]) {
        port.addEventListener(value3, callback2, {
          passive: true,
        });
      }
      port.addEventListener("keydown", callback2);
      let value =
        typeof ResizeObserver === "function"
          ? new ResizeObserver(() => {
              if (Date.now() < holdUntilRef.current) {
                scrollToTarget();
              }
              callback();
            })
          : null;
      if (value !== null) {
        for (let value3 of Array.from(port.children)) {
          value.observe(value3);
        }
      }
      let value2 =
        typeof MutationObserver === "function" && value !== null
          ? new MutationObserver((input) => {
              for (let value3 of input) {
                value3.addedNodes.forEach((input2) => {
                  if (input2 instanceof Element) {
                    value.observe(input2);
                  }
                });
                value3.removedNodes.forEach((input2) => {
                  if (input2 instanceof Element) {
                    value.unobserve(input2);
                  }
                });
              }
            })
          : null;
      value2?.observe(port, {
        childList: true,
      });
      measureCurrent();
      return () => {
        port.removeEventListener("scroll", callback);
        for (let value3 of ["wheel", "touchstart", "pointerdown"]) {
          port.removeEventListener(value3, callback2);
        }
        port.removeEventListener("keydown", callback2);
        if (index !== 0) {
          cancelAnimationFrame(index);
        }
        value?.disconnect();
        value2?.disconnect();
      };
    }, [port, measureCurrent, scrollToTarget, clearTarget]);
    reactSectionScroller.useEffect(measureCurrent, [
      measureCurrent,
      sectionIds,
    ]);
    let wantThrough = reactSectionScroller.useCallback(
        (input: string) =>
          setWanted((input2) => {
            let value = sectionsThroughTarget(
              sectionIdsRef.current,
              input,
            ).filter((input3) => !input2.has(input3));
            if (value.length === 0) {
              return input2;
            } else {
              return new Set([...input2, ...value]);
            }
          }),
        [],
      ),
      want = reactSectionScroller.useCallback(
        (input: string) => {
          markedRef.current = null;
          wantThrough(input);
        },
        [wantThrough],
      ),
      mark = reactSectionScroller.useCallback(
        (input: string) => {
          clearTarget();
          markedRef.current = input;
          markedUntilRef.current = Date.now() + SECTION_SCROLL_ANCHOR_HOLD_MS;
          window.clearTimeout(markedTimerRef.current);
          markedTimerRef.current = window.setTimeout(() => {
            if (markedRef.current !== null) {
              measureCurrent();
            }
          }, SECTION_SCROLL_ANCHOR_HOLD_MS + 20);
          currentRef.current = input;
          setMoved(true);
          setCurrent(input);
          wantThrough(input);
        },
        [clearTarget, wantThrough, measureCurrent],
      ),
      jump = reactSectionScroller.useCallback(
        (input: string) => {
          markedRef.current = null;
          targetRef.current = input;
          holdUntilRef.current = Date.now() + SECTION_SCROLL_ANCHOR_HOLD_MS;
          focusPending.current = true;
          currentRef.current = input;
          setMoved(true);
          setCurrent(input);
          wantThrough(input);
          scrollToTarget();
          focusTarget();
        },
        [wantThrough, scrollToTarget, focusTarget],
      ),
      initialJumpPending = reactSectionScroller.useRef(
        initialSection !== sectionIds[0],
      );
    reactSectionScroller.useLayoutEffect(() => {
      if (port !== null && initialJumpPending.current) {
        initialJumpPending.current = false;
        jump(initialSection);
        return;
      }
      if (Date.now() < holdUntilRef.current) {
        scrollToTarget();
        focusTarget();
      }
    });
    return {
      current: current,
      jump: jump,
      wanted: wanted,
      want: want,
      mark: mark,
      attach: attach,
      moved: moved,
      port: port,
    };
  }
  function LazySection({
    root: root,
    eager = false,
    standIn: standIn,
    children: children,
  }: LazySectionProps) {
    let [value, value2] = reactSectionScroller.useState(false),
      value3 = eager || value,
      ref = reactSectionScroller.useRef<HTMLDivElement | null>(null);
    reactSectionScroller.useEffect(() => {
      if (value3) {
        return;
      }
      if (typeof IntersectionObserver !== "function") {
        value2(true);
        return;
      }
      let current = ref.current;
      if (current === null) {
        return;
      }
      let value4 = new IntersectionObserver(
        (input) => {
          if (input.some((input2) => input2.isIntersecting)) {
            value2(true);
          }
        },
        {
          root: root,
          rootMargin: "1500px 0px",
        },
      );
      value4.observe(current);
      return () => value4.disconnect();
    }, [value3, root]);
    reactSectionScroller.useEffect(() => {
      if (value3 && !value) {
        value2(true);
      }
    }, [value3, value]);
    if (value3) {
      return <jsxLazySection.Fragment>{children()}</jsxLazySection.Fragment>;
    } else {
      return (
        <div
          ref={ref}
          className={"ds-lazy flex flex-col"}
          data-testid={"ds-lazy"}
        >
          {standIn}
        </div>
      );
    }
  }
  bindRuntimeValue(
    runtime,
    "reactSectionScroller",
    () => reactSectionScroller,
    (value) => {
      reactSectionScroller = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxLazySection",
    () => jsxLazySection,
    (value) => {
      jsxLazySection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SECTION_SCROLL_MIN_LEAD_PX",
    () => SECTION_SCROLL_MIN_LEAD_PX,
    (value) => {
      SECTION_SCROLL_MIN_LEAD_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SECTION_SCROLL_VIEWPORT_LEAD_RATIO",
    () => SECTION_SCROLL_VIEWPORT_LEAD_RATIO,
    (value) => {
      SECTION_SCROLL_VIEWPORT_LEAD_RATIO = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SECTION_SCROLL_ANCHOR_HOLD_MS",
    () => SECTION_SCROLL_ANCHOR_HOLD_MS,
    (value) => {
      SECTION_SCROLL_ANCHOR_HOLD_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sectionAtScrollPosition",
    () => sectionAtScrollPosition,
  );
  bindRuntimeValue(
    runtime,
    "sectionsThroughTarget",
    () => sectionsThroughTarget,
  );
  bindRuntimeValue(
    runtime,
    "focusIsEditingElsewhere",
    () => focusIsEditingElsewhere,
  );
  bindRuntimeValue(runtime, "useSectionScroller", () => useSectionScroller);
  bindRuntimeValue(runtime, "LazySection", () => LazySection);
  return () => {
    reactSectionScroller = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxLazySection = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    SECTION_SCROLL_MIN_LEAD_PX = 40;
    SECTION_SCROLL_VIEWPORT_LEAD_RATIO = 0.25;
    SECTION_SCROLL_ANCHOR_HOLD_MS = 1200;
  };
}
