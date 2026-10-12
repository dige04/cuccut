/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as C from "../contracts/controls";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiSkeleton(runtime: RuntimeBindings): () => void {
  var reactForUiSkeleton: typeof React;
  var jsxForUiSkeleton: typeof import("react/jsx-runtime");
  var skeletonElementTags: Record<C.SkeletonTag, C.SkeletonTag>;
  var pendingShimmerElements: Set<Element>;
  var shimmerStartTimes: WeakMap<Document, number>;
  var skeletonNotShownSnapshot: C.SkeletonSnapshot;
  var skeletonShownSnapshot: C.SkeletonSnapshot;
  var SKELETON_BREATHE_ANIMATION: string;
  var SKELETON_SWEEP_ANIMATION: string;
  var SKELETON_ANIMATION_DURATION_MS: number;
  var DEFAULT_SKELETON_MOTION: C.SkeletonMotion;
  var SKELETON_MINIMUM_HOLD_MS: number;
  var SKELETON_DURATION_LIMIT_MS: number;
  var SKELETON_SYNC_TOLERANCE_MS: number;
  var skeletonAnimationStartTimes: WeakMap<Document, number>;
  var skeletonIconRowWidths: number[];
  var skeletonTextRowWidths: number[];
  var skeletonLineWidths: string[];
  var SkeletonPrimitive: C.SkeletonComponent;
  function isShimmerAnimation(input: C.NamedAnimation): boolean {
    return input.animationName === "cds-shimmer";
  }
  function synchronizeDocumentShimmers(input: C.AnimationDocument): void {
    let value: number | undefined,
      items: C.NamedAnimation[] = [];
    for (let value3 of input.getAnimations()) {
      if (!isShimmerAnimation(value3)) {
        continue;
      }
      let { startTime: value4 } = value3;
      if (
        typeof value4 === "number" &&
        (value === undefined || value4 < value)
      ) {
        value = value4;
      }
      let value5 = value3.effect?.target;
      if (
        value5 !== undefined &&
        value5 !== null &&
        pendingShimmerElements.has(value5) &&
        value3.playState === "running"
      ) {
        items.push(value3);
      }
    }
    let value2 = value ?? shimmerStartTimes.get(input) ?? 0;
    for (let value3 of items) {
      value3.startTime = value2;
    }
    shimmerStartTimes.set(input, value2);
  }
  function flushShimmerSynchronization() {
    try {
      let values = new Set<C.AnimationDocument>();
      for (let value of pendingShimmerElements) {
        values.add(value.ownerDocument);
      }
      for (let value of values) {
        synchronizeDocumentShimmers(value);
      }
    } finally {
      pendingShimmerElements.clear();
    }
  }
  function scheduleShimmerSynchronization(element: Element | null): void {
    if (
      element === null ||
      typeof element.ownerDocument.getAnimations !== "function"
    ) {
      return;
    }
    if (pendingShimmerElements.size === 0) {
      queueMicrotask(flushShimmerSynchronization);
    }
    pendingShimmerElements.add(element);
  }
  function createSkeletonShownStore(): C.SkeletonShownStore {
    let snapshot = skeletonNotShownSnapshot,
      listeners = new Set<() => void>(),
      setSnapshot = (input: C.SkeletonSnapshot) => {
        if (snapshot === input) {
          return;
        }
        snapshot = input;
        for (let value of listeners) {
          (0, runtime.invokeAndReportError)(value);
        }
      };
    return {
      getSnapshot: () => snapshot,
      subscribe: (input: () => void) => {
        listeners.add(input);
        return () => {
          listeners.delete(input);
        };
      },
      markShown: () => setSnapshot(skeletonShownSnapshot),
      reset: () => setSnapshot(skeletonNotShownSnapshot),
    };
  }
  function markSkeletonShownAfterCallback(
    input: (() => void) | undefined,
    options: C.SkeletonShownStore,
  ) {
    try {
      input?.();
    } finally {
      options.markShown();
    }
  }
  function clearSkeletonElapsedStyle(input: HTMLElement): void {
    input.style.removeProperty("--cds-skel-elapsed");
  }
  function setSkeletonMotion(
    input: HTMLElement,
    options: C.SkeletonMotion,
  ): void {
    input.dataset.motion = options;
  }
  function ensurePositionedSkeletonHost(input: HTMLElement): boolean {
    let position = getComputedStyle(input).position;
    if (position === "static" || position === "") {
      input.style.position = "relative";
      return true;
    }
    return false;
  }
  function synchronizeSkeletonAnimation(
    element: C.AnimationElement,
    options = SKELETON_BREATHE_ANIMATION,
    context = 0,
  ) {
    if (typeof element.getAnimations !== "function") {
      return;
    }
    let value = element
      .getAnimations()
      .find((input: C.NamedAnimation) => input.animationName === options);
    if (value === undefined || typeof value.startTime !== "number") {
      return;
    }
    let value2 = value.effect?.getComputedTiming();
    if (
      value2?.duration !== SKELETON_ANIMATION_DURATION_MS ||
      value2.iterations !== 1 / 0
    ) {
      return;
    }
    let value3 = value.startTime + (value2.delay ?? 0),
      value4 = value3 - context,
      ownerDocument = element.ownerDocument,
      entry = skeletonAnimationStartTimes.get(ownerDocument);
    if (entry === undefined) {
      skeletonAnimationStartTimes.set(ownerDocument, value4);
      return;
    }
    let value5 =
      (((value4 - entry) % SKELETON_ANIMATION_DURATION_MS) +
        SKELETON_ANIMATION_DURATION_MS) %
      SKELETON_ANIMATION_DURATION_MS;
    if (value5 < SKELETON_SYNC_TOLERANCE_MS || value5 > 1999) {
      return;
    }
    let value6 =
        typeof value.currentTime === "number"
          ? value.startTime + value.currentTime
          : value3,
      value7 = Math.ceil(
        (Math.max(value6, value3) - (entry + context)) /
          SKELETON_ANIMATION_DURATION_MS,
      );
    value.startTime =
      entry +
      context +
      value7 * SKELETON_ANIMATION_DURATION_MS -
      (value2.delay ?? 0);
  }
  function SkeletonGroup({
    children: children,
    hold = "delayed",
    label: label,
    className: className,
    decorative = false,
    onShown: onShown,
    onHidden: onHidden,
    as: as2,
    motion = DEFAULT_SKELETON_MOTION,
  }: C.SkeletonGroupProps) {
    let value = reactForUiSkeleton.useContext<boolean>(
        runtime.skeletonActiveContext,
      ),
      value2 = reactForUiSkeleton.useContext<C.SkeletonTag>(
        runtime.skeletonElementContext,
      ),
      [value3] = reactForUiSkeleton.useState(as2 ?? value2),
      value4 = skeletonElementTags[value3],
      value5 = value3 === "span",
      value6 = reactForUiSkeleton.useContext<number | null>(
        runtime.skeletonGroupContext,
      ),
      value7 = reactForUiSkeleton.useContext<C.SkeletonShownStore | null>(
        runtime.skeletonShownStoreContext,
      ),
      [value8] = reactForUiSkeleton.useState(() => {
        let value18 = createSkeletonShownStore();
        if (value ? value7?.getSnapshot().shown === true : hold !== "delayed") {
          value18.markShown();
        }
        return value18;
      }),
      [value9] = reactForUiSkeleton.useState(value6),
      [value10, value11] = reactForUiSkeleton.useState(false),
      ref = reactForUiSkeleton.useRef(false),
      value12 = value && !value10,
      callback = reactForUiSkeleton.useCallback(
        (input: HTMLElement | null) => {
          if (
            input !== null &&
            input.parentElement !== null &&
            input.parentElement.closest('[data-cds="SkeletonGroup"]') === null
          ) {
            ref.current = true;
            value8.reset();
            value11(true);
          }
        },
        [value8],
      ),
      value13: string = (0, runtime.useTranslation)("loading", "Loading"),
      [value14] = reactForUiSkeleton.useState(hold),
      value15 = value14 === "delayed",
      value16 = label ?? value13,
      ref2 = reactForUiSkeleton.useRef<HTMLElement>(null),
      callback2 = reactForUiSkeleton.useCallback(
        (input: HTMLElement | null) => {
          ref2.current = input;
        },
        [],
      ),
      ref3 = reactForUiSkeleton.useRef(false),
      ref4 = reactForUiSkeleton.useRef({
        onShown: onShown,
        onHidden: onHidden,
        labelText: value16,
      });
    reactForUiSkeleton.useEffect(() => {
      ref4.current = {
        onShown: onShown,
        onHidden: onHidden,
        labelText: value16,
      };
      if (ref3.current && ref2.current !== null) {
        let element = ref2.current.querySelector("[data-skeleton-label]");
        if (element !== null && element.textContent !== value16) {
          element.textContent = value16;
        }
      }
    }, [onShown, onHidden, value16, decorative]);
    reactForUiSkeleton.useLayoutEffect(() => {
      if (!value12 && !value15 && !ref3.current) {
        ref3.current = true;
        markSkeletonShownAfterCallback(ref4.current.onShown, value8);
      }
    }, [value12, value15, value8]);
    reactForUiSkeleton.useLayoutEffect(() => {
      if (!value12 || ref.current || value7 === null) {
        return;
      }
      let callback4 = () => {
        if (!value7.getSnapshot().shown) {
          value8.reset();
        } else if (!ref3.current) {
          ref3.current = true;
          markSkeletonShownAfterCallback(ref4.current.onShown, value8);
        } else {
          value8.markShown();
        }
      };
      callback4();
      return value7.subscribe(callback4);
    }, [value12, value7, value8]);
    reactForUiSkeleton.useEffect(
      () => () => {
        if (ref3.current) {
          ref4.current.onHidden?.();
          ref3.current = false;
        }
        value8.reset();
      },
      [value8],
    );
    reactForUiSkeleton.useLayoutEffect(() => {
      let current = ref2.current;
      if (current === null || value12 || !value15 || value9 === null) {
        return;
      }
      let value18 = performance.now() - value9;
      if (!Number.isFinite(value18) || value18 <= 0) {
        return;
      }
      current.style.setProperty("--cds-skel-elapsed", `${value18}ms`);
      return () => clearSkeletonElapsedStyle(current);
    }, [value12, value15, value9]);
    let ref5 = reactForUiSkeleton.useRef<HTMLElement>(null),
      callback3 = reactForUiSkeleton.useCallback(
        (input: HTMLElement | null) => {
          ref5.current = input;
        },
        [],
      );
    reactForUiSkeleton.useEffect(() => {
      let current = ref5.current,
        current2 = ref2.current;
      if (
        motion !== "sweep" ||
        value12 ||
        current === null ||
        current2 === null
      ) {
        return;
      }
      let value18 = ensurePositionedSkeletonHost(current2),
        callback4 = () => {
          let items = [],
            value20 = current2.querySelectorAll<HTMLElement>(
              '[data-cds="Skeleton"]',
            );
          setSkeletonMotion(
            current2,
            value20.length === 0 ? "lockstep" : "sweep",
          );
          for (let value21 of value20) {
            let index = 0,
              index2 = 0,
              value22: HTMLElement | null = value21;
            while (value22 !== null && value22 !== current2) {
              if (
                ((index += value22.offsetLeft),
                (index2 += value22.offsetTop),
                (value22 = value22.offsetParent as HTMLElement | null),
                value22 !== null && value22 !== current2)
              ) {
                index +=
                  (value22 as HTMLElement).clientLeft -
                  (value22 as HTMLElement).scrollLeft;
                index2 +=
                  (value22 as HTMLElement).clientTop -
                  (value22 as HTMLElement).scrollTop;
              }
            }
            if (value22 !== current2) {
              continue;
            }
            items.push(
              `M${index},${index2}h${value21.offsetWidth}v${value21.offsetHeight}h${-value21.offsetWidth}Z`,
            );
          }
          current.style.clipPath = items.length
            ? `path("${items.join(" ")}")`
            : "";
          current.style.visibility = items.length ? "visible" : "hidden";
        };
      callback4();
      let value19: Pick<ResizeObserver, "observe" | "disconnect"> = (0,
      runtime.createSafeResizeObserver)(
        (0, runtime.getResizeObserverConstructor)(current2) ?? ResizeObserver,
        callback4,
      );
      value19.observe(current2);
      return () => {
        value19.disconnect();
        if (value18) {
          current2.style.removeProperty("position");
        }
      };
    }, [motion, value12]);
    reactForUiSkeleton.useEffect(() => {
      let current = ref2.current;
      if (motion !== "wave" || value12 || current === null) {
        return;
      }
      let callback4 = () => {
        let value19 = current.querySelectorAll<HTMLElement>(
            '[data-cds="Skeleton"]',
          ),
          value20 = Math.floor(
            SKELETON_ANIMATION_DURATION_MS / SKELETON_MINIMUM_HOLD_MS,
          ),
          index = 0;
        for (let value21 of value19) {
          if (value21.style.getPropertyValue("--cds-skel-i") !== "") {
            index += 1;
          }
        }
        for (let value21 of value19) {
          if (value21.style.getPropertyValue("--cds-skel-i") === "") {
            value21.style.setProperty("--cds-skel-i", String(index % value20));
            index += 1;
          }
        }
        setSkeletonMotion(current, value19.length === 0 ? "lockstep" : "wave");
      };
      callback4();
      let value18: Pick<MutationObserver, "observe" | "disconnect"> = (0,
      runtime.createSafeMutationObserver)(MutationObserver, callback4);
      value18.observe(current, {
        childList: true,
        subtree: true,
      });
      return () => value18.disconnect();
    }, [motion, value12]);
    let value17: string | undefined = value5
      ? (0, runtime.cn)("block", className)
      : className;
    if (value12) {
      return (() => {
        const _Element = value4;
        const _elementProps = {
          ref: callback,
          "data-cds": "SkeletonGroup",
          className: value17,
          children: (
            <runtime.skeletonElementContext.Provider value={value3}>
              <runtime.skeletonShownStoreContext.Provider value={value8}>
                {children}
              </runtime.skeletonShownStoreContext.Provider>
            </runtime.skeletonElementContext.Provider>
          ),
        };
        return <_Element {..._elementProps} />;
      })();
    }
    return (() => {
      const _Element5 = value4;
      const _elementProps5 = {
        ref: callback2,
        "data-cds": "SkeletonGroup",
        "data-motion": motion,
        "data-hold": value15 ? "delayed" : "none",
        "data-hold-reason": value15
          ? undefined
          : (
              value14 as {
                none: string;
              }
            ).none,
        "data-shown": value15 ? undefined : "",
        role: decorative ? undefined : "status",
        "aria-hidden": decorative ? true : undefined,
        className: value17,
        onAnimationEnd: (event: React.AnimationEvent<HTMLElement>) => {
          if (
            event.animationName === "cds-placeholder-reveal" &&
            (event.target as C.AnimationElement) === event.currentTarget
          ) {
            event.currentTarget.style.setProperty(
              "--cds-skel-settled",
              `${SKELETON_DURATION_LIMIT_MS}ms`,
            );
            event.currentTarget.setAttribute("data-settled", "");
          }
        },
        onAnimationStart: (event: React.AnimationEvent<HTMLElement>) => {
          if (
            event.animationName === "cds-placeholder-reveal" &&
            (event.target as C.AnimationElement) === event.currentTarget
          ) {
            event.currentTarget.setAttribute("data-shown", "");
            let element = event.currentTarget.querySelector(
              "[data-skeleton-label]",
            );
            if (element !== null && element.textContent === "") {
              element.textContent = ref4.current.labelText;
            }
            if (!ref3.current) {
              ref3.current = true;
              markSkeletonShownAfterCallback(ref4.current.onShown, value8);
            }
          } else if (
            (event.animationName === SKELETON_BREATHE_ANIMATION &&
              (event.target as C.AnimationElement) === event.currentTarget) ||
            (event.animationName === SKELETON_SWEEP_ANIMATION &&
              typeof (event.target as C.AnimationElement)?.getAnimations ===
                "function")
          ) {
            synchronizeSkeletonAnimation(
              event.target as C.AnimationElement,
              event.animationName,
            );
          } else if (
            event.animationName === SKELETON_BREATHE_ANIMATION &&
            motion === "wave" &&
            typeof (event.target as C.AnimationElement)?.getAnimations ===
              "function"
          ) {
            let target = event.target as C.AnimationElement;
            synchronizeSkeletonAnimation(
              target,
              SKELETON_BREATHE_ANIMATION,
              (Number.parseInt(
                target.style.getPropertyValue("--cds-skel-i"),
                10,
              ) || 0) * SKELETON_MINIMUM_HOLD_MS,
            );
          }
        },
        children: [
          decorative ? null : (
            <span className={"sr-only"} data-skeleton-label={true}>
              {value15 ? "" : value16}
            </span>
          ),
          motion === "sweep"
            ? (() => {
                const _Element3 = value4;
                const _elementProps3 = {
                  "aria-hidden": true,
                  ref: callback3,
                  className: "cds-skel-sweep-clip",
                  style: {
                    visibility: "hidden" as const,
                  },
                  children: (() => {
                    const _Element2 = value4;
                    const _elementProps2 = {
                      className: "cds-skel-sweep-band",
                    };
                    return <_Element2 {..._elementProps2} />;
                  })(),
                };
                return <_Element3 {..._elementProps3} />;
              })()
            : null,
          <runtime.skeletonActiveContext.Provider value={true}>
            <runtime.skeletonElementContext.Provider value={value3}>
              <runtime.skeletonShownStoreContext.Provider value={value8}>
                {(() => {
                  const _Element4 = value4;
                  const _elementProps4 = {
                    "aria-hidden": true,
                    className: "contents",
                    children: children,
                  };
                  return <_Element4 {..._elementProps4} />;
                })()}
              </runtime.skeletonShownStoreContext.Provider>
            </runtime.skeletonElementContext.Provider>
          </runtime.skeletonActiveContext.Provider>,
        ],
      };
      return <_Element5 {..._elementProps5} />;
    })();
  }
  function Skeleton({
    width: width,
    height: height,
    className: className,
    decorative = false,
    as: as2,
  }: C.SkeletonProps) {
    let value = reactForUiSkeleton.useContext<boolean>(
        runtime.skeletonActiveContext,
      ),
      value2 = reactForUiSkeleton.useContext<C.SkeletonTag>(
        runtime.skeletonElementContext,
      ),
      value3 = skeletonElementTags[as2 ?? value2],
      value4 = value3 === "span" ? "block" : undefined,
      value5: string = (0, runtime.useTranslation)("loading", "Loading");
    if (value) {
      return (() => {
        const _Element6 = value3;
        const _elementProps6 = {
          "data-cds": "Skeleton",
          className: (0, runtime.cn)(
            value4,
            "h-[1em] max-w-full rounded bg-[var(--cds-skeleton-base)]",
            className,
          ),
          style: {
            width: width,
            height: height,
          },
        };
        return <_Element6 {..._elementProps6} />;
      })();
    }
    return (() => {
      const _Element7 = value3;
      const _elementProps7 = {
        ref: scheduleShimmerSynchronization,
        "data-cds": "Skeleton",
        role: decorative ? undefined : "status",
        "aria-hidden": decorative ? true : undefined,
        className: (0, runtime.cn)(
          value4,
          "relative h-[1em] max-w-full overflow-hidden rounded bg-[var(--cds-skeleton-base)] after:absolute after:inset-0 after:animate-[cds-shimmer_2s_linear_infinite] after:bg-[linear-gradient(90deg,transparent,var(--cds-skeleton-sheen),transparent)] motion-reduce:after:hidden",
          className,
        ),
        style: {
          width: width,
          height: height,
        },
        children: decorative ? null : (
          <span className={"sr-only"}>{value5}</span>
        ),
      };
      return <_Element7 {..._elementProps7} />;
    })();
  }
  function SkeletonRows({ rows = 3, icon = true }: C.SkeletonRowsProps) {
    let value =
        skeletonElementTags[
          reactForUiSkeleton.useContext<C.SkeletonTag>(
            runtime.skeletonElementContext,
          )
        ],
      value2 = value === "span" ? "block" : undefined,
      value3 = icon ? skeletonIconRowWidths : skeletonTextRowWidths,
      value4 = (typeof rows === "number" ? [rows] : rows).filter(
        (input: number) => input > 0,
      ),
      value5 = value4.length > 0 ? value4 : [3],
      items = [],
      index = 0;
    for (let [value6, value7] of value5.entries()) {
      if (value6 > 0) {
        items.push(
          (() => {
            const _Element8 = value;
            const _elementProps8 = {
              "aria-hidden": true,
              "data-slot": "menu-skeleton-separator",
              className: (0, runtime.cn)(
                value2,
                "compact:mx-2 comfortable:mx-2.5 my-1 h-px bg-border",
              ),
            };
            const _elementKey = `separator-${value6}`;
            return <_Element8 key={_elementKey} {..._elementProps8} />;
          })(),
        );
      }
      for (let value8 = index + value7; index < value8; index++) {
        items.push(
          (() => {
            const _Element9 = value;
            const _elementProps9 = {
              "aria-hidden": index > 0 ? true : undefined,
              className:
                "flex h-control items-center gap-xs compact:px-2 comfortable:px-2.5",
              children: [
                icon && <SkeletonPrimitive width={20} height={20} />,
                <span
                  aria-hidden={icon ? true : undefined}
                  className={"contents"}
                >
                  <SkeletonPrimitive
                    width={value3[index % value3.length]}
                    height={16}
                  />
                </span>,
              ],
            };
            const _elementKey2 = index;
            return <_Element9 key={_elementKey2} {..._elementProps9} />;
          })(),
        );
      }
    }
    return (() => {
      const _Element0 = value;
      const _elementProps0 = {
        className: value2,
        children: items,
      };
      return <_Element0 {..._elementProps0} />;
    })();
  }
  function SkeletonChip({ width = 120, shape = "pill" }: C.SkeletonChipProps) {
    return (
      <SkeletonPrimitive
        className={
          shape === "pill"
            ? "h-control shrink-0 rounded-full"
            : "h-control shrink-0 rounded"
        }
        width={width}
      />
    );
  }
  function SkeletonLines({
    lines = 8,
    className: className,
  }: C.SkeletonLinesProps) {
    let value =
      skeletonElementTags[
        reactForUiSkeleton.useContext<C.SkeletonTag>(
          runtime.skeletonElementContext,
        )
      ];
    return (() => {
      const _Element10 = value;
      const _elementProps10 = {
        className: (0, runtime.cn)("flex flex-col gap-sm", className),
        children: Array.from<unknown, React.ReactElement>(
          {
            length: lines,
          },
          (input: unknown, options: number) =>
            (() => {
              const _Element1 = "span";
              const _elementProps1 = {
                "aria-hidden": options > 0 ? true : undefined,
                className: "contents",
                children: (
                  <SkeletonPrimitive
                    width={
                      skeletonLineWidths[options % skeletonLineWidths.length]
                    }
                    height={14}
                  />
                ),
              };
              const _elementKey3 = options;
              return <_Element1 key={_elementKey3} {..._elementProps1} />;
            })(),
        ),
      };
      return <_Element10 {..._elementProps10} />;
    })();
  }
  function SkeletonBlock({
    height: height,
    className: className,
  }: C.SkeletonBlockProps) {
    return (
      <SkeletonPrimitive className={className} width={"100%"} height={height} />
    );
  }
  bindRuntimeValue(
    runtime,
    "reactForUiSkeleton",
    () => reactForUiSkeleton,
    (value) => {
      reactForUiSkeleton = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiSkeleton",
    () => jsxForUiSkeleton,
    (value) => {
      jsxForUiSkeleton = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "skeletonElementTags",
    () => skeletonElementTags,
    (value) => {
      skeletonElementTags = value;
    },
  );
  bindRuntimeValue(runtime, "isShimmerAnimation", () => isShimmerAnimation);
  bindRuntimeValue(
    runtime,
    "pendingShimmerElements",
    () => pendingShimmerElements,
    (value) => {
      pendingShimmerElements = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shimmerStartTimes",
    () => shimmerStartTimes,
    (value) => {
      shimmerStartTimes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "synchronizeDocumentShimmers",
    () => synchronizeDocumentShimmers,
  );
  bindRuntimeValue(
    runtime,
    "flushShimmerSynchronization",
    () => flushShimmerSynchronization,
  );
  bindRuntimeValue(
    runtime,
    "scheduleShimmerSynchronization",
    () => scheduleShimmerSynchronization,
  );
  bindRuntimeValue(
    runtime,
    "skeletonNotShownSnapshot",
    () => skeletonNotShownSnapshot,
    (value) => {
      skeletonNotShownSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "skeletonShownSnapshot",
    () => skeletonShownSnapshot,
    (value) => {
      skeletonShownSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createSkeletonShownStore",
    () => createSkeletonShownStore,
  );
  bindRuntimeValue(
    runtime,
    "markSkeletonShownAfterCallback",
    () => markSkeletonShownAfterCallback,
  );
  bindRuntimeValue(
    runtime,
    "SKELETON_BREATHE_ANIMATION",
    () => SKELETON_BREATHE_ANIMATION,
    (value) => {
      SKELETON_BREATHE_ANIMATION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SKELETON_SWEEP_ANIMATION",
    () => SKELETON_SWEEP_ANIMATION,
    (value) => {
      SKELETON_SWEEP_ANIMATION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SKELETON_ANIMATION_DURATION_MS",
    () => SKELETON_ANIMATION_DURATION_MS,
    (value) => {
      SKELETON_ANIMATION_DURATION_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_SKELETON_MOTION",
    () => DEFAULT_SKELETON_MOTION,
    (value) => {
      DEFAULT_SKELETON_MOTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SKELETON_MINIMUM_HOLD_MS",
    () => SKELETON_MINIMUM_HOLD_MS,
    (value) => {
      SKELETON_MINIMUM_HOLD_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SKELETON_DURATION_LIMIT_MS",
    () => SKELETON_DURATION_LIMIT_MS,
    (value) => {
      SKELETON_DURATION_LIMIT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SKELETON_SYNC_TOLERANCE_MS",
    () => SKELETON_SYNC_TOLERANCE_MS,
    (value) => {
      SKELETON_SYNC_TOLERANCE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "skeletonAnimationStartTimes",
    () => skeletonAnimationStartTimes,
    (value) => {
      skeletonAnimationStartTimes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clearSkeletonElapsedStyle",
    () => clearSkeletonElapsedStyle,
  );
  bindRuntimeValue(runtime, "setSkeletonMotion", () => setSkeletonMotion);
  bindRuntimeValue(
    runtime,
    "ensurePositionedSkeletonHost",
    () => ensurePositionedSkeletonHost,
  );
  bindRuntimeValue(
    runtime,
    "synchronizeSkeletonAnimation",
    () => synchronizeSkeletonAnimation,
  );
  bindRuntimeValue(runtime, "SkeletonGroup", () => SkeletonGroup);
  bindRuntimeValue(runtime, "Skeleton", () => Skeleton);
  bindRuntimeValue(
    runtime,
    "skeletonIconRowWidths",
    () => skeletonIconRowWidths,
    (value) => {
      skeletonIconRowWidths = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "skeletonTextRowWidths",
    () => skeletonTextRowWidths,
    (value) => {
      skeletonTextRowWidths = value;
    },
  );
  bindRuntimeValue(runtime, "SkeletonRows", () => SkeletonRows);
  bindRuntimeValue(runtime, "SkeletonChip", () => SkeletonChip);
  bindRuntimeValue(
    runtime,
    "skeletonLineWidths",
    () => skeletonLineWidths,
    (value) => {
      skeletonLineWidths = value;
    },
  );
  bindRuntimeValue(runtime, "SkeletonLines", () => SkeletonLines);
  bindRuntimeValue(runtime, "SkeletonBlock", () => SkeletonBlock);
  bindRuntimeValue(
    runtime,
    "SkeletonPrimitive",
    () => SkeletonPrimitive,
    (value) => {
      SkeletonPrimitive = value;
    },
  );
  return () => {
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeTranslations)();
    (0, runtime.initializeIconSupport)();
    (0, runtime.initializeSkeletonContexts)();
    reactForUiSkeleton = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxForUiSkeleton = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    skeletonElementTags = {
      div: "div",
      span: "span",
    };
    pendingShimmerElements = new Set();
    shimmerStartTimes = new WeakMap();
    skeletonNotShownSnapshot = Object.freeze({
      shown: false,
    });
    skeletonShownSnapshot = Object.freeze({
      shown: true,
    });
    SKELETON_BREATHE_ANIMATION = "cds-skeleton-breathe";
    SKELETON_SWEEP_ANIMATION = "cds-skeleton-sweep";
    SKELETON_ANIMATION_DURATION_MS = 2000;
    DEFAULT_SKELETON_MOTION = "wave";
    SKELETON_MINIMUM_HOLD_MS = 90;
    SKELETON_DURATION_LIMIT_MS = 1e5;
    SKELETON_SYNC_TOLERANCE_MS = 1;
    skeletonAnimationStartTimes = new WeakMap();
    skeletonIconRowWidths = [160, 128, 144];
    skeletonTextRowWidths = [120, 88, 104];
    (SkeletonRows as React.FunctionComponent<C.SkeletonRowsProps>).displayName =
      "Skeleton.Rows";
    (SkeletonChip as React.FunctionComponent<C.SkeletonChipProps>).displayName =
      "Skeleton.Chip";
    skeletonLineWidths = ["92%", "100%", "96%", "58%"];
    (
      SkeletonLines as React.FunctionComponent<C.SkeletonLinesProps>
    ).displayName = "Skeleton.Lines";
    (
      SkeletonBlock as React.FunctionComponent<C.SkeletonBlockProps>
    ).displayName = "Skeleton.Block";
    (Skeleton as React.FunctionComponent<C.SkeletonProps>).displayName =
      "Skeleton";
    (
      SkeletonGroup as React.FunctionComponent<C.SkeletonGroupProps>
    ).displayName = "SkeletonGroup";
    SkeletonPrimitive = Object.assign(Skeleton, {
      Rows: SkeletonRows,
      Chip: SkeletonChip,
      Lines: SkeletonLines,
      Block: SkeletonBlock,
    });
    (0, runtime.initializeClassNames)();
  };
}
