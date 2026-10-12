/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsComponentsSkeleton(
  runtime: RuntimeBindings,
): () => void {
  var reactComponentsSkeleton: Dynamic;
  var jsxComponentsSkeleton: Dynamic;
  var ComponentsSkeletonDivSpanConfig: Dynamic;
  var ComponentsSkeletonSubscribers: Dynamic;
  var ComponentsSkeletonElementCache: Dynamic;
  var ComponentsSkeletonFreezeValue: Dynamic;
  var ComponentsSkeletonFreezeValue_2: Dynamic;
  var CdsSkeletonBreatheValue: Dynamic;
  var CdsSkeletonSweepValue: Dynamic;
  var ComponentsSkeletonConstant: Dynamic;
  var WaveValue: Dynamic;
  var ComponentsSkeletonConstant_2: Dynamic;
  var ComponentsSkeletonConstant_3: Dynamic;
  var ComponentsSkeletonLimit: Dynamic;
  var ComponentsSkeletonElementCache_2: Dynamic;
  var ComponentsSkeletonItems: Dynamic;
  var ComponentsSkeletonItems_2: Dynamic;
  var ComponentsSkeletonItems_3: Dynamic;
  var ComponentsSkeletonAssignValue: Dynamic;
  var initializeComponentsSkeleton: Dynamic;
  function isShimmerAnimation(input?: Dynamic): Dynamic {
    return input.animationName === "cds-shimmer";
  }
  function synchronizeDocumentShimmers(input?: Dynamic): Dynamic {
    let value: Dynamic,
      items: Dynamic = [];
    for (let value3 of input.getAnimations() as Dynamic) {
      if (!isShimmerAnimation(value3)) continue;
      let { startTime: value4 }: Dynamic = value3;
      typeof value4 == "number" &&
        (value === undefined || value4 < value) &&
        (value = value4);
      let value5: Dynamic = value3.effect?.target;
      value5 != null &&
        ComponentsSkeletonSubscribers.has(value5) &&
        value3.playState === "running" &&
        items.push(value3);
    }
    let value2: Dynamic =
      value ?? ComponentsSkeletonElementCache.get(input) ?? 0;
    for (let value3 of items as Dynamic) value3.startTime = value2;
    ComponentsSkeletonElementCache.set(input, value2);
  }
  function flushShimmerSynchronization(): Dynamic {
    try {
      let values: Dynamic = new Set();
      for (let value of ComponentsSkeletonSubscribers as Dynamic)
        values.add(value.ownerDocument);
      for (let value of values as Dynamic) synchronizeDocumentShimmers(value);
    } finally {
      ComponentsSkeletonSubscribers.clear();
    }
  }
  function scheduleShimmerSynchronization(element?: Dynamic): Dynamic {
    element === null ||
      typeof element.ownerDocument.getAnimations != "function" ||
      (ComponentsSkeletonSubscribers.size === 0 &&
        queueMicrotask(flushShimmerSynchronization),
      ComponentsSkeletonSubscribers.add(element));
  }
  function reportSkeletonError(input?: Dynamic): Dynamic {
    if (typeof reportError == "function") {
      reportError(input);
      return;
    }
    queueMicrotask((): Dynamic => {
      throw input instanceof Error ? input : new Error(String(input));
    });
  }
  function createSkeletonStore(): Dynamic {
    let value: Dynamic = ComponentsSkeletonFreezeValue,
      values: Dynamic = new Set(),
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        if (value !== input) {
          value = input;
          for (let value2 of values as Dynamic)
            try {
              value2();
            } catch (value3: Dynamic) {
              reportSkeletonError(value3);
            }
        }
      };
    return {
      getSnapshot: (): Dynamic => value,
      subscribe: (input?: Dynamic): Dynamic => (
        values.add(input),
        (): Dynamic => {
          values.delete(input);
        }
      ),
      markShown: (): Dynamic => callback(ComponentsSkeletonFreezeValue_2),
      reset: (): Dynamic => callback(ComponentsSkeletonFreezeValue),
    };
  }
  function notifySkeletonShown(input?: Dynamic, options?: Dynamic): Dynamic {
    try {
      input?.();
    } finally {
      options.markShown();
    }
  }
  function clearSkeletonElapsed(input?: Dynamic): Dynamic {
    input.style.removeProperty("--cds-skel-elapsed");
  }
  function setSkeletonMotion(input?: Dynamic, options?: Dynamic): Dynamic {
    input.dataset.motion = options;
  }
  function ensurePositionedElement(input?: Dynamic): Dynamic {
    let position: Dynamic = getComputedStyle(input).position;
    return position === "static" || position === ""
      ? ((input.style.position = "relative"), true)
      : false;
  }
  function synchronizeSkeletonAnimation(
    element?: Dynamic,
    options: Dynamic = CdsSkeletonBreatheValue,
    context: Dynamic = 0,
  ): Dynamic {
    if (typeof element.getAnimations != "function") return;
    let value: Dynamic = element
      .getAnimations()
      .find((input?: Dynamic): Dynamic => input.animationName === options);
    if (value === undefined || typeof value.startTime != "number") return;
    let value2: Dynamic = value.effect?.getComputedTiming();
    if (
      value2?.duration !== ComponentsSkeletonConstant ||
      value2.iterations !== 1 / 0
    )
      return;
    let value3: Dynamic = value.startTime + (value2.delay ?? 0),
      value4: Dynamic = value3 - context,
      ownerDocument: Dynamic = element.ownerDocument,
      entry: Dynamic = ComponentsSkeletonElementCache_2.get(ownerDocument);
    if (entry === undefined) {
      ComponentsSkeletonElementCache_2.set(ownerDocument, value4);
      return;
    }
    let value5: Dynamic =
      (((value4 - entry) % ComponentsSkeletonConstant) +
        ComponentsSkeletonConstant) %
      ComponentsSkeletonConstant;
    if (value5 < ComponentsSkeletonLimit || value5 > 1999) return;
    let value6: Dynamic =
        typeof value.currentTime == "number"
          ? value.startTime + value.currentTime
          : value3,
      value7: Dynamic = Math.ceil(
        (Math.max(value6, value3) - (entry + context)) /
          ComponentsSkeletonConstant,
      );
    value.startTime =
      entry +
      context +
      value7 * ComponentsSkeletonConstant -
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
    as: as,
    motion = WaveValue,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, reactComponentsSkeleton.useContext)(
        runtime.SkeletonDecorativeContext,
      ),
      value2: Dynamic = (0, reactComponentsSkeleton.useContext)(
        runtime.SkeletonElementContext,
      ),
      [value3]: Dynamic = (0, reactComponentsSkeleton.useState)(as ?? value2),
      value4: Dynamic = ComponentsSkeletonDivSpanConfig[value3],
      value5: Dynamic = value3 === "span",
      value6: Dynamic = (0, reactComponentsSkeleton.useContext)(
        runtime.PlatformRootFontSizeContext,
      ),
      value7: Dynamic = (0, reactComponentsSkeleton.useContext)(
        runtime.SkeletonMotionContext,
      ),
      [value8]: Dynamic = (0, reactComponentsSkeleton.useState)((): Dynamic => {
        let value26: Dynamic = createSkeletonStore();
        (value ? value7?.getSnapshot().shown === true : hold !== "delayed") &&
          value26.markShown();
        return value26;
      }),
      [value9]: Dynamic = (0, reactComponentsSkeleton.useState)(value6),
      [value10, value11]: Dynamic = (0, reactComponentsSkeleton.useState)(
        false,
      ),
      value12: Dynamic = (0, reactComponentsSkeleton.useRef)(false),
      value13: Dynamic = value && !value10,
      value14: Dynamic = (0, reactComponentsSkeleton.useCallback)(
        (input?: Dynamic): Dynamic => {
          input !== null &&
            input.parentElement !== null &&
            input.parentElement.closest('[data-cds="SkeletonGroup"]') ===
              null &&
            ((value12.current = true), value8.reset(), value11(true));
        },
        [value8],
      ),
      value15: Dynamic = (0, runtime.useLabel)("loading", "Loading"),
      [value16]: Dynamic = (0, reactComponentsSkeleton.useState)(hold),
      value17: Dynamic = value16 === "delayed",
      value18: Dynamic = label ?? value15,
      value19: Dynamic = (0, reactComponentsSkeleton.useRef)(null),
      value20: Dynamic = (0, reactComponentsSkeleton.useCallback)(
        (input?: Dynamic): Dynamic => {
          value19.current = input;
        },
        [],
      ),
      value21: Dynamic = (0, reactComponentsSkeleton.useRef)(false),
      value22: Dynamic = (0, reactComponentsSkeleton.useRef)({
        onShown: onShown,
        onHidden: onHidden,
        labelText: value18,
      });
    (0, reactComponentsSkeleton.useEffect)((): Dynamic => {
      value22.current = {
        onShown: onShown,
        onHidden: onHidden,
        labelText: value18,
      };
      if (value21.current && value19.current !== null) {
        let element: Dynamic = value19.current.querySelector(
          "[data-skeleton-label]",
        );
        element !== null &&
          element.textContent !== value18 &&
          (element.textContent = value18);
      }
    }, [onShown, onHidden, value18, decorative]);
    (0, reactComponentsSkeleton.useLayoutEffect)((): Dynamic => {
      !value13 &&
        !value17 &&
        !value21.current &&
        ((value21.current = true),
        notifySkeletonShown(value22.current.onShown, value8));
    }, [value13, value17, value8]);
    (0, reactComponentsSkeleton.useLayoutEffect)((): Dynamic => {
      if (!value13 || value12.current || value7 === null) return;
      let callback: Dynamic = (): Dynamic => {
        value7.getSnapshot().shown
          ? value21.current
            ? value8.markShown()
            : ((value21.current = true),
              notifySkeletonShown(value22.current.onShown, value8))
          : value8.reset();
      };
      callback();
      return value7.subscribe(callback);
    }, [value13, value7, value8]);
    (0, reactComponentsSkeleton.useEffect)(
      (): Dynamic => (): Dynamic => {
        value21.current &&
          (value22.current.onHidden?.(), (value21.current = false));
        value8.reset();
      },
      [value8],
    );
    (0, reactComponentsSkeleton.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value19.current;
      if (current === null || value13 || !value17 || value9 === null) return;
      let value26: Dynamic = performance.now() - value9;
      if (!(!Number.isFinite(value26) || value26 <= 0)) {
        current.style.setProperty("--cds-skel-elapsed", `${value26}ms`);
        return (): Dynamic => clearSkeletonElapsed(current);
      }
    }, [value13, value17, value9]);
    let value23: Dynamic = (0, reactComponentsSkeleton.useRef)(null),
      value24: Dynamic = (0, reactComponentsSkeleton.useCallback)(
        (input?: Dynamic): Dynamic => {
          value23.current = input;
        },
        [],
      );
    (0, reactComponentsSkeleton.useEffect)((): Dynamic => {
      let current: Dynamic = value23.current,
        current2: Dynamic = value19.current;
      if (
        motion !== "sweep" ||
        value13 ||
        current === null ||
        current2 === null
      )
        return;
      let value26: Dynamic = ensurePositionedElement(current2),
        callback: Dynamic = (): Dynamic => {
          let items: Dynamic = [],
            value27: Dynamic = current2.querySelectorAll(
              '[data-cds="Skeleton"]',
            );
          setSkeletonMotion(
            current2,
            value27.length === 0 ? "lockstep" : "sweep",
          );
          for (let value28 of value27 as Dynamic) {
            let index: Dynamic = 0,
              index2: Dynamic = 0,
              value29: Dynamic = value28;
            for (; value29 !== null && value29 !== current2; ) {
              index += value29.offsetLeft;
              index2 += value29.offsetTop;
              value29 = value29.offsetParent;
              value29 !== null &&
                value29 !== current2 &&
                ((index += value29.clientLeft - value29.scrollLeft),
                (index2 += value29.clientTop - value29.scrollTop));
            }
            value29 === current2 &&
              items.push(
                `M${index},${index2}h${value28.offsetWidth}v${value28.offsetHeight}h${-value28.offsetWidth}Z`,
              );
          }
          current.style.clipPath = items.length
            ? `path("${items.join(" ")}")`
            : "";
          current.style.visibility = items.length ? "visible" : "hidden";
        };
      callback();
      let observer: Dynamic = new ResizeObserver(callback);
      observer.observe(current2);
      return (): Dynamic => {
        observer.disconnect();
        value26 && current2.style.removeProperty("position");
      };
    }, [motion, value13]);
    (0, reactComponentsSkeleton.useEffect)((): Dynamic => {
      let current: Dynamic = value19.current;
      if (motion !== "wave" || value13 || current === null) return;
      let callback: Dynamic = (): Dynamic => {
        let value26: Dynamic = current.querySelectorAll(
            '[data-cds="Skeleton"]',
          ),
          value27: Dynamic = Math.floor(
            ComponentsSkeletonConstant / ComponentsSkeletonConstant_2,
          ),
          index: Dynamic = 0;
        for (let value28 of value26 as Dynamic)
          value28.style.getPropertyValue("--cds-skel-i") !== "" && (index += 1);
        for (let value28 of value26 as Dynamic)
          value28.style.getPropertyValue("--cds-skel-i") === "" &&
            (value28.style.setProperty("--cds-skel-i", String(index % value27)),
            (index += 1));
        setSkeletonMotion(current, value26.length === 0 ? "lockstep" : "wave");
      };
      callback();
      let observer: Dynamic = new MutationObserver(callback);
      observer.observe(current, {
        childList: true,
        subtree: true,
      });
      return (): Dynamic => observer.disconnect();
    }, [motion, value13]);
    let value25: Dynamic = value5
      ? (0, runtime.cn)("block", className)
      : className;
    return value13
      ? (() => {
          const _Component = value4;
          return (
            <_Component
              ref={value14}
              data-cds={"SkeletonGroup"}
              className={value25}
            >
              <runtime.SkeletonElementContext.Provider value={value3}>
                <runtime.SkeletonMotionContext.Provider value={value8}>
                  {children}
                </runtime.SkeletonMotionContext.Provider>
              </runtime.SkeletonElementContext.Provider>
            </_Component>
          );
        })()
      : (() => {
          const _Component5 = value4;
          return (
            <_Component5
              ref={value20}
              data-cds={"SkeletonGroup"}
              data-motion={motion}
              data-hold={value17 ? "delayed" : "none"}
              data-hold-reason={value17 ? undefined : value16.none}
              data-shown={value17 ? undefined : ""}
              role={decorative ? undefined : "status"}
              aria-hidden={decorative ? true : undefined}
              className={value25}
              onAnimationEnd={(event?: Dynamic): Dynamic => {
                event.animationName === "cds-placeholder-reveal" &&
                  event.target === event.currentTarget &&
                  (event.currentTarget.style.setProperty(
                    "--cds-skel-settled",
                    `${ComponentsSkeletonConstant_3}ms`,
                  ),
                  event.currentTarget.setAttribute("data-settled", ""));
              }}
              onAnimationStart={(event?: Dynamic): Dynamic => {
                if (
                  event.animationName === "cds-placeholder-reveal" &&
                  event.target === event.currentTarget
                ) {
                  event.currentTarget.setAttribute("data-shown", "");
                  let element: Dynamic = event.currentTarget.querySelector(
                    "[data-skeleton-label]",
                  );
                  element !== null &&
                    element.textContent === "" &&
                    (element.textContent = value22.current.labelText);
                  value21.current ||
                    ((value21.current = true),
                    notifySkeletonShown(value22.current.onShown, value8));
                } else if (
                  (event.animationName === CdsSkeletonBreatheValue &&
                    event.target === event.currentTarget) ||
                  (event.animationName === CdsSkeletonSweepValue &&
                    typeof event.target?.getAnimations == "function")
                )
                  synchronizeSkeletonAnimation(
                    event.target,
                    event.animationName,
                  );
                else if (
                  event.animationName === CdsSkeletonBreatheValue &&
                  motion === "wave" &&
                  typeof event.target?.getAnimations == "function"
                ) {
                  let target: Dynamic = event.target;
                  synchronizeSkeletonAnimation(
                    target,
                    CdsSkeletonBreatheValue,
                    (Number.parseInt(
                      target.style.getPropertyValue("--cds-skel-i"),
                      10,
                    ) || 0) * ComponentsSkeletonConstant_2,
                  );
                }
              }}
            >
              {decorative ? null : (
                <span className={"sr-only"} data-skeleton-label={true}>
                  {value17 ? "" : value18}
                </span>
              )}
              {motion === "sweep"
                ? (() => {
                    const _Component3 = value4;
                    return (
                      <_Component3
                        aria-hidden={true}
                        ref={value24}
                        className={"cds-skel-sweep-clip"}
                        style={{
                          visibility: "hidden",
                        }}
                      >
                        {(() => {
                          const _Component2 = value4;
                          return (
                            <_Component2 className={"cds-skel-sweep-band"} />
                          );
                        })()}
                      </_Component3>
                    );
                  })()
                : null}
              <runtime.SkeletonDecorativeContext.Provider value={true}>
                <runtime.SkeletonElementContext.Provider value={value3}>
                  <runtime.SkeletonMotionContext.Provider value={value8}>
                    {(() => {
                      const _Component4 = value4;
                      return (
                        <_Component4 aria-hidden={true} className={"contents"}>
                          {children}
                        </_Component4>
                      );
                    })()}
                  </runtime.SkeletonMotionContext.Provider>
                </runtime.SkeletonElementContext.Provider>
              </runtime.SkeletonDecorativeContext.Provider>
            </_Component5>
          );
        })();
  }
  function Skeleton({
    width: width,
    height: height,
    className: className,
    decorative = false,
    as: as,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, reactComponentsSkeleton.useContext)(
        runtime.SkeletonDecorativeContext,
      ),
      value2: Dynamic = (0, reactComponentsSkeleton.useContext)(
        runtime.SkeletonElementContext,
      ),
      value3: Dynamic = ComponentsSkeletonDivSpanConfig[as ?? value2],
      value4: Dynamic = value3 === "span" ? "block" : undefined,
      value5: Dynamic = (0, runtime.useLabel)("loading", "Loading");
    return value
      ? (() => {
          const _Component6 = value3;
          return (
            <_Component6
              data-cds={"Skeleton"}
              className={(0, runtime.cn)(
                value4,
                "h-[1em] max-w-full rounded bg-[var(--cds-skeleton-base)]",
                className,
              )}
              style={{
                width: width,
                height: height,
              }}
            />
          );
        })()
      : (() => {
          const _Component7 = value3;
          return (
            <_Component7
              ref={scheduleShimmerSynchronization}
              data-cds={"Skeleton"}
              role={decorative ? undefined : "status"}
              aria-hidden={decorative ? true : undefined}
              className={(0, runtime.cn)(
                value4,
                "relative h-[1em] max-w-full overflow-hidden rounded bg-[var(--cds-skeleton-base)] after:absolute after:inset-0 after:animate-[cds-shimmer_2s_linear_infinite] after:bg-[linear-gradient(90deg,transparent,var(--cds-skeleton-sheen),transparent)] motion-reduce:after:hidden",
                className,
              )}
              style={{
                width: width,
                height: height,
              }}
            >
              {decorative ? null : <span className={"sr-only"}>{value5}</span>}
            </_Component7>
          );
        })();
  }
  function SkeletonRows({ rows = 3, icon = true }: Dynamic): Dynamic {
    let value: Dynamic =
        ComponentsSkeletonDivSpanConfig[
          (0, reactComponentsSkeleton.useContext)(
            runtime.SkeletonElementContext,
          )
        ],
      value2: Dynamic = value === "span" ? "block" : undefined,
      value3: Dynamic = icon
        ? ComponentsSkeletonItems
        : ComponentsSkeletonItems_2,
      value4: Dynamic = (typeof rows == "number" ? [rows] : rows).filter(
        (input?: Dynamic): Dynamic => input > 0,
      ),
      value5: Dynamic = value4.length > 0 ? value4 : [3],
      items: Dynamic = [],
      index: Dynamic = 0;
    for (let [value6, value7] of value5.entries() as Dynamic) {
      value6 > 0 &&
        items.push(
          (() => {
            const _Component8 = value;
            const _props = {
              "aria-hidden": true,
              "data-slot": "menu-skeleton-separator",
              className: (0, runtime.cn)(
                value2,
                "compact:mx-2 comfortable:mx-2.5 my-1 h-px bg-border",
              ),
            } as const;
            const _key = `separator-${value6}`;
            return <_Component8 key={_key} {..._props} />;
          })(),
        );
      for (let value8: Dynamic = index + value7; index < value8; index++)
        items.push(
          (() => {
            const _Component9 = value;
            const _props2 = {
              "aria-hidden": index > 0 ? true : undefined,
              className:
                "flex h-control items-center gap-xs compact:px-2 comfortable:px-2.5",
              children: [
                icon && (
                  <ComponentsSkeletonAssignValue width={20} height={20} />
                ),
                <span
                  aria-hidden={icon ? true : undefined}
                  className={"contents"}
                >
                  <ComponentsSkeletonAssignValue
                    width={value3[index % value3.length]}
                    height={16}
                  />
                </span>,
              ],
            } as const;
            const _key2 = index;
            return <_Component9 key={_key2} {..._props2} />;
          })(),
        );
    }
    return (() => {
      const _Component0 = value;
      return <_Component0 className={value2}>{items}</_Component0>;
    })();
  }
  function SkeletonChip({ width = 120, shape = "pill" }: Dynamic): Dynamic {
    return (
      <ComponentsSkeletonAssignValue
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
  }: Dynamic): Dynamic {
    let value: Dynamic =
      ComponentsSkeletonDivSpanConfig[
        (0, reactComponentsSkeleton.useContext)(runtime.SkeletonElementContext)
      ];
    return (() => {
      const _Component1 = value;
      return (
        <_Component1
          className={(0, runtime.cn)("flex flex-col gap-sm", className)}
        >
          {Array.from(
            {
              length: lines,
            },
            (input?: Dynamic, options?: Dynamic): Dynamic => (
              <span
                key={options}
                aria-hidden={options > 0 ? true : undefined}
                className={"contents"}
              >
                <ComponentsSkeletonAssignValue
                  width={
                    ComponentsSkeletonItems_3[
                      options % ComponentsSkeletonItems_3.length
                    ]
                  }
                  height={14}
                />
              </span>
            ),
          )}
        </_Component1>
      );
    })();
  }
  function SkeletonBlock({
    height: height,
    className: className,
  }: Dynamic): Dynamic {
    return (
      <ComponentsSkeletonAssignValue
        className={className}
        width={"100%"}
        height={height}
      />
    );
  }
  bindRuntimeValue(runtime, "isShimmerAnimation", () => isShimmerAnimation);
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
  bindRuntimeValue(runtime, "reportSkeletonError", () => reportSkeletonError);
  bindRuntimeValue(runtime, "createSkeletonStore", () => createSkeletonStore);
  bindRuntimeValue(runtime, "notifySkeletonShown", () => notifySkeletonShown);
  bindRuntimeValue(runtime, "clearSkeletonElapsed", () => clearSkeletonElapsed);
  bindRuntimeValue(runtime, "setSkeletonMotion", () => setSkeletonMotion);
  bindRuntimeValue(
    runtime,
    "ensurePositionedElement",
    () => ensurePositionedElement,
  );
  bindRuntimeValue(
    runtime,
    "synchronizeSkeletonAnimation",
    () => synchronizeSkeletonAnimation,
  );
  bindRuntimeValue(runtime, "SkeletonGroup", () => SkeletonGroup);
  bindRuntimeValue(runtime, "Skeleton", () => Skeleton);
  bindRuntimeValue(runtime, "SkeletonRows", () => SkeletonRows);
  bindRuntimeValue(runtime, "SkeletonChip", () => SkeletonChip);
  bindRuntimeValue(runtime, "SkeletonLines", () => SkeletonLines);
  bindRuntimeValue(runtime, "SkeletonBlock", () => SkeletonBlock);
  bindRuntimeValue(
    runtime,
    "reactComponentsSkeleton",
    () => reactComponentsSkeleton,
    (value) => {
      reactComponentsSkeleton = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsSkeleton",
    () => jsxComponentsSkeleton,
    (value) => {
      jsxComponentsSkeleton = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSkeletonDivSpanConfig",
    () => ComponentsSkeletonDivSpanConfig,
    (value) => {
      ComponentsSkeletonDivSpanConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSkeletonSubscribers",
    () => ComponentsSkeletonSubscribers,
    (value) => {
      ComponentsSkeletonSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSkeletonElementCache",
    () => ComponentsSkeletonElementCache,
    (value) => {
      ComponentsSkeletonElementCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSkeletonFreezeValue",
    () => ComponentsSkeletonFreezeValue,
    (value) => {
      ComponentsSkeletonFreezeValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSkeletonFreezeValue_2",
    () => ComponentsSkeletonFreezeValue_2,
    (value) => {
      ComponentsSkeletonFreezeValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsSkeletonBreatheValue",
    () => CdsSkeletonBreatheValue,
    (value) => {
      CdsSkeletonBreatheValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsSkeletonSweepValue",
    () => CdsSkeletonSweepValue,
    (value) => {
      CdsSkeletonSweepValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSkeletonConstant",
    () => ComponentsSkeletonConstant,
    (value) => {
      ComponentsSkeletonConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "WaveValue",
    () => WaveValue,
    (value) => {
      WaveValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSkeletonConstant_2",
    () => ComponentsSkeletonConstant_2,
    (value) => {
      ComponentsSkeletonConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSkeletonConstant_3",
    () => ComponentsSkeletonConstant_3,
    (value) => {
      ComponentsSkeletonConstant_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSkeletonLimit",
    () => ComponentsSkeletonLimit,
    (value) => {
      ComponentsSkeletonLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSkeletonElementCache_2",
    () => ComponentsSkeletonElementCache_2,
    (value) => {
      ComponentsSkeletonElementCache_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSkeletonItems",
    () => ComponentsSkeletonItems,
    (value) => {
      ComponentsSkeletonItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSkeletonItems_2",
    () => ComponentsSkeletonItems_2,
    (value) => {
      ComponentsSkeletonItems_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSkeletonItems_3",
    () => ComponentsSkeletonItems_3,
    (value) => {
      ComponentsSkeletonItems_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSkeletonAssignValue",
    () => ComponentsSkeletonAssignValue,
    (value) => {
      ComponentsSkeletonAssignValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsSkeleton",
    () => initializeComponentsSkeleton,
    (value) => {
      initializeComponentsSkeleton = value;
    },
  );
  return () => {
    initializeComponentsSkeleton = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeSheetsStyles_2)();
      (0, runtime.initializePlatformRootFontSize)();
      reactComponentsSkeleton = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxComponentsSkeleton = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      ComponentsSkeletonDivSpanConfig = {
        div: "div",
        span: "span",
      };
      ComponentsSkeletonSubscribers = new Set();
      ComponentsSkeletonElementCache = new WeakMap();
      ComponentsSkeletonFreezeValue = Object.freeze({
        shown: false,
      });
      ComponentsSkeletonFreezeValue_2 = Object.freeze({
        shown: true,
      });
      CdsSkeletonBreatheValue = "cds-skeleton-breathe";
      CdsSkeletonSweepValue = "cds-skeleton-sweep";
      ComponentsSkeletonConstant = 2e3;
      WaveValue = "wave";
      ComponentsSkeletonConstant_2 = 90;
      ComponentsSkeletonConstant_3 = 1e5;
      ComponentsSkeletonLimit = 1;
      ComponentsSkeletonElementCache_2 = new WeakMap();
      ComponentsSkeletonItems = [160, 128, 144];
      ComponentsSkeletonItems_2 = [120, 88, 104];
      (SkeletonRows as Dynamic).displayName = "Skeleton.Rows";
      (SkeletonChip as Dynamic).displayName = "Skeleton.Chip";
      ComponentsSkeletonItems_3 = ["92%", "100%", "96%", "58%"];
      (SkeletonLines as Dynamic).displayName = "Skeleton.Lines";
      (SkeletonBlock as Dynamic).displayName = "Skeleton.Block";
      (Skeleton as Dynamic).displayName = "Skeleton";
      (SkeletonGroup as Dynamic).displayName = "SkeletonGroup";
      ComponentsSkeletonAssignValue = Object.assign(Skeleton, {
        Rows: SkeletonRows,
        Chip: SkeletonChip,
        Lines: SkeletonLines,
        Block: SkeletonBlock,
      });
    });
  };
}
