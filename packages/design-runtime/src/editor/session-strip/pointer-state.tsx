/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorSessionStripPointerState(
  runtime: RuntimeBindings,
): () => void {
  var reactSessionStripPointerState: Dynamic;
  var jsxSessionStripPointerState: Dynamic;
  var SessionStripPointerStateAlias: Dynamic;
  var SessionStripPointerStateObservedElements: Dynamic;
  var SessionStripPointerStateNow: Dynamic;
  var SessionStripPointerStateLimit: Dynamic;
  var SessionStripPointerStateLimit_2: Dynamic;
  var SessionStripPointerStateLimit_3: Dynamic;
  var SessionStripPointerStateLimit_4: Dynamic;
  var SessionStripPointerStateConstant: Dynamic;
  var SessionStripPointerStateLimit_5: Dynamic;
  var SessionStripPointerStateGetBoundingClientRect: Dynamic;
  var SessionStripPointerStateAbs: Dynamic;
  var SessionStripPointerStateSubscribers: Dynamic;
  var SessionStripPointerStateCurrentState: Dynamic;
  var SessionStripPointerStateMinValue: Dynamic;
  var SessionStripPointerStateHandler: Dynamic;
  var SessionStripPointerStateLimit_6: Dynamic;
  var SessionStripPointerStateElementCache: Dynamic;
  var SessionStripContext: Dynamic;
  function recentStripPointer(
    input?: Dynamic,
    options: Dynamic = false,
  ): Dynamic {
    return input === null ||
      input.ended === null ||
      (input.onStrip && !(options && input.stray === true)) ||
      input.inPopup ||
      input.mouse ||
      !(input.ended.at - input.began.at >= 0)
      ? null
      : input;
  }
  function observeSessionStripPointers(input?: Dynamic): Dynamic {
    SessionStripPointerStateObservedElements.has(input) ||
      (SessionStripPointerStateObservedElements.add(input),
      input.addEventListener(
        "pointerdown",
        (event?: Dynamic): Dynamic => {
          if (event.isPrimary === false) return;
          let value: Dynamic = SessionStripPointerStateNow();
          for (let value7 of Array.from(
            input.querySelectorAll("[data-mc-through]"),
          ) as Dynamic) {
            let value8: Dynamic = Number(
              value7.getAttribute("data-mc-through") || Number.NaN,
            );
            (value !== null &&
              value < value8 &&
              value8 - value <= SessionStripPointerStateLimit_5) ||
              value7.removeAttribute("data-mc-through");
          }
          let target: Dynamic = event.target,
            value2: Dynamic = target?.closest?.("[data-mc-strip]") ?? null,
            state: Dynamic = {
              onStrip: value2 !== null,
              inPopup:
                target?.closest?.(runtime.blockingOverlaySelector) != null,
              mouse: event.pointerType === "mouse",
              began: {
                x: event.clientX,
                y: event.clientY,
                at: event.timeStamp,
                perf: value,
              },
              ended: null,
            },
            value3: Dynamic = value === null ? -1 : value - event.timeStamp;
          value2 !== null &&
            event.pointerType !== "mouse" &&
            value3 >= 0 &&
            value3 <= SessionStripPointerStateLimit_4 &&
            (state.early = event.timeStamp < sessionStripHoldUntil(value2));
          let value4: Dynamic = recentStripPointer(
              SessionStripPointerStateAlias,
              true,
            ),
            value5: Dynamic =
              value4 === null ? -1 : event.timeStamp - value4.ended.at,
            value6: Dynamic =
              value4 === null ? 0 : (value4.runAt ?? value4.ended.at);
          value4 !== null &&
            value5 >= 0 &&
            value5 <= SessionStripPointerStateLimit &&
            event.timeStamp - value6 < SessionStripPointerStateLimit_3 &&
            ((state.runAt = value6),
            (state.stray =
              event.pointerType !== "mouse" &&
              value2 !== null &&
              SessionStripPointerStateGetBoundingClientRect(
                value2,
                value4.ended.x,
                value4.ended.y,
              )));
          SessionStripPointerStateAlias = state;
        },
        true,
      ),
      input.addEventListener(
        "pointerup",
        (input2?: Dynamic): Dynamic => {
          input2.isPrimary !== false &&
            SessionStripPointerStateAlias !== null &&
            (SessionStripPointerStateAlias.ended = {
              at: input2.timeStamp,
              x: input2.clientX,
              y: input2.clientY,
              perf: SessionStripPointerStateNow(),
            });
          (0, runtime.refreshSessionStripPointers)();
        },
        true,
      ));
  }
  function suppressSessionStripClick(input?: Dynamic): Dynamic {
    let value: Dynamic = SessionStripPointerStateAlias;
    return input.detail === 0 || value === null
      ? false
      : value.stray === true || value.early === true
        ? SessionStripPointerStateAbs(
            input,
            value.began.at,
            value.began.x,
            value.began.y,
          ) ||
          (value.ended !== null &&
            SessionStripPointerStateAbs(
              input,
              value.ended.at,
              value.ended.x,
              value.ended.y,
            ))
        : !value.onStrip &&
          value.ended !== null &&
          SessionStripPointerStateAbs(
            input,
            value.ended.at,
            value.ended.x,
            value.ended.y,
          );
  }
  function sessionStripUsesTouch(): Dynamic {
    try {
      return (
        typeof matchMedia == "function" &&
        matchMedia(runtime.ToolbarPrimitivesMediaQuery)?.matches === true
      );
    } catch {
      return false;
    }
  }
  function recordSessionStripOcclusion(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let entry: Dynamic = SessionStripPointerStateElementCache.get(input);
    if (!options) {
      entry !== undefined && SessionStripPointerStateElementCache.delete(input);
      return;
    }
    let value: Dynamic = SessionStripPointerStateNow(),
      bounds: Dynamic = input.getBoundingClientRect(),
      value2: Dynamic =
        entry === undefined ||
        Math.abs(bounds.left - entry.left) > SessionStripPointerStateLimit_6 ||
        Math.abs(bounds.top - entry.top) > SessionStripPointerStateLimit_6,
      value3: Dynamic = SessionStripPointerStateAlias,
      value4: Dynamic =
        value3 === null
          ? null
          : value3.ended === null
            ? value3.began.perf
            : value3.ended.perf,
      value5: Dynamic = value === null || value4 === null ? -1 : value - value4,
      value6: Dynamic =
        value3 !== null &&
        ((value3.onStrip && value3.stray !== true && value3.early !== true) ||
          value3.inPopup) &&
        value5 >= 0 &&
        value5 <=
          (value3.ended === null
            ? SessionStripPointerStateLimit_3
            : SessionStripPointerStateLimit);
    value6 &&
      entry !== undefined &&
      ([entry.left, entry.top] = [bounds.left, bounds.top]);
    if (
      !value2 ||
      value === null ||
      !(bounds.width > 0 && bounds.height > 0) ||
      !sessionStripUsesTouch()
    )
      return;
    if (value6) {
      entry === undefined &&
        SessionStripPointerStateElementCache.set(input, {
          left: bounds.left,
          top: bounds.top,
          end: 0,
          since: value,
          movedAt: 0,
        });
      return;
    }
    let value7: Dynamic =
        entry !== undefined &&
        (value < entry.end ||
          value - entry.movedAt <= SessionStripPointerStateLimit_3)
          ? entry.since
          : value,
      state: Dynamic = {
        left: bounds.left,
        top: bounds.top,
        end: Math.min(
          value +
            SessionStripPointerStateConstant +
            SessionStripPointerStateLimit,
          value7 + SessionStripPointerStateLimit_5,
        ),
        since: value7,
        movedAt: value,
      };
    SessionStripPointerStateElementCache.set(input, state);
    SessionStripPointerStateHandler((): Dynamic => {
      let value8: Dynamic = SessionStripPointerStateNow();
      value8 !== null &&
        SessionStripPointerStateElementCache.get(input) === state &&
        (state.end = Math.min(
          state.end,
          value8 + SessionStripPointerStateLimit,
        ));
      (0, runtime.refreshSessionStripPointers)();
    });
  }
  function sessionStripHoldUntil(input?: Dynamic): Dynamic {
    let value: Dynamic = recentStripPointer(SessionStripPointerStateAlias),
      value2: Dynamic =
        value !== null &&
        value.end !== undefined &&
        SessionStripPointerStateGetBoundingClientRect(
          input,
          value.ended.x,
          value.ended.y,
        )
          ? value.end
          : 0;
    return Math.max(
      SessionStripPointerStateElementCache.get(input)?.end ?? 0,
      value2,
    );
  }
  function sessionStripPointerDeadline(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return Math.max(
      SessionStripPointerStateElementCache.get(input)?.end ?? 0,
      sessionStripReleaseDeadline(input, options),
    );
  }
  function sessionStripReleaseDeadline(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = recentStripPointer(SessionStripPointerStateAlias);
    if (value === null || value.ended.perf === null) return 0;
    if (value.end === undefined) {
      let value2: Dynamic = options - value.ended.perf;
      if (
        !(value2 >= 0 && value2 <= SessionStripPointerStateLimit_4) ||
        !SessionStripPointerStateGetBoundingClientRect(
          input,
          value.ended.x,
          value.ended.y,
        )
      )
        return 0;
      let value3: Dynamic =
        SessionStripPointerStateMinValue !== null &&
        value.began.perf !== null &&
        value.began.perf < SessionStripPointerStateMinValue;
      value3 ||
        (SessionStripPointerStateMinValue =
          options +
          SessionStripPointerStateConstant +
          SessionStripPointerStateLimit_3);
      let value4: Dynamic = SessionStripPointerStateMinValue ?? 0;
      value.end = Math.min(
        options +
          SessionStripPointerStateConstant +
          SessionStripPointerStateLimit,
        value4,
      );
      SessionStripPointerStateHandler((): Dynamic => {
        let value5: Dynamic = SessionStripPointerStateNow();
        value5 !== null &&
          !value3 &&
          SessionStripPointerStateMinValue === value4 &&
          (SessionStripPointerStateMinValue = Math.min(
            value4,
            value5 + SessionStripPointerStateLimit_3,
          ));
        value5 !== null &&
          value.end !== undefined &&
          (value.end = Math.min(
            value.end,
            value5 + SessionStripPointerStateLimit,
            SessionStripPointerStateMinValue ?? 0,
          ));
        (0, runtime.refreshSessionStripPointers)();
      });
    }
    return options < value.end &&
      SessionStripPointerStateGetBoundingClientRect(
        input,
        value.ended.x,
        value.ended.y,
      )
      ? value.end
      : 0;
  }
  bindRuntimeValue(
    runtime,
    "reactSessionStripPointerState",
    () => reactSessionStripPointerState,
    (value) => {
      reactSessionStripPointerState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxSessionStripPointerState",
    () => jsxSessionStripPointerState,
    (value) => {
      jsxSessionStripPointerState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateAlias",
    () => SessionStripPointerStateAlias,
    (value) => {
      SessionStripPointerStateAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateObservedElements",
    () => SessionStripPointerStateObservedElements,
    (value) => {
      SessionStripPointerStateObservedElements = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateNow",
    () => SessionStripPointerStateNow,
    (value) => {
      SessionStripPointerStateNow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateLimit",
    () => SessionStripPointerStateLimit,
    (value) => {
      SessionStripPointerStateLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateLimit_2",
    () => SessionStripPointerStateLimit_2,
    (value) => {
      SessionStripPointerStateLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateLimit_3",
    () => SessionStripPointerStateLimit_3,
    (value) => {
      SessionStripPointerStateLimit_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateLimit_4",
    () => SessionStripPointerStateLimit_4,
    (value) => {
      SessionStripPointerStateLimit_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateConstant",
    () => SessionStripPointerStateConstant,
    (value) => {
      SessionStripPointerStateConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateLimit_5",
    () => SessionStripPointerStateLimit_5,
    (value) => {
      SessionStripPointerStateLimit_5 = value;
    },
  );
  bindRuntimeValue(runtime, "recentStripPointer", () => recentStripPointer);
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateGetBoundingClientRect",
    () => SessionStripPointerStateGetBoundingClientRect,
    (value) => {
      SessionStripPointerStateGetBoundingClientRect = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "observeSessionStripPointers",
    () => observeSessionStripPointers,
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateAbs",
    () => SessionStripPointerStateAbs,
    (value) => {
      SessionStripPointerStateAbs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "suppressSessionStripClick",
    () => suppressSessionStripClick,
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateSubscribers",
    () => SessionStripPointerStateSubscribers,
    (value) => {
      SessionStripPointerStateSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateCurrentState",
    () => SessionStripPointerStateCurrentState,
    (value) => {
      SessionStripPointerStateCurrentState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateMinValue",
    () => SessionStripPointerStateMinValue,
    (value) => {
      SessionStripPointerStateMinValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateHandler",
    () => SessionStripPointerStateHandler,
    (value) => {
      SessionStripPointerStateHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateLimit_6",
    () => SessionStripPointerStateLimit_6,
    (value) => {
      SessionStripPointerStateLimit_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPointerStateElementCache",
    () => SessionStripPointerStateElementCache,
    (value) => {
      SessionStripPointerStateElementCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sessionStripUsesTouch",
    () => sessionStripUsesTouch,
  );
  bindRuntimeValue(
    runtime,
    "recordSessionStripOcclusion",
    () => recordSessionStripOcclusion,
  );
  bindRuntimeValue(
    runtime,
    "sessionStripHoldUntil",
    () => sessionStripHoldUntil,
  );
  bindRuntimeValue(
    runtime,
    "sessionStripPointerDeadline",
    () => sessionStripPointerDeadline,
  );
  bindRuntimeValue(
    runtime,
    "sessionStripReleaseDeadline",
    () => sessionStripReleaseDeadline,
  );
  bindRuntimeValue(
    runtime,
    "SessionStripContext",
    () => SessionStripContext,
    (value) => {
      SessionStripContext = value;
    },
  );
  return () => {
    reactSessionStripPointerState = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    jsxSessionStripPointerState = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    SessionStripPointerStateAlias = null;
    SessionStripPointerStateObservedElements = new WeakSet();
    SessionStripPointerStateNow = (): Dynamic =>
      typeof performance === "undefined" ? null : performance.now();
    SessionStripPointerStateLimit = 500;
    SessionStripPointerStateLimit_2 = 8;
    SessionStripPointerStateLimit_3 = 1e3;
    SessionStripPointerStateLimit_4 = 5e3;
    SessionStripPointerStateConstant = 3e3;
    SessionStripPointerStateLimit_5 = 8e3;
    SessionStripPointerStateGetBoundingClientRect = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => {
      let bounds: Dynamic = input.getBoundingClientRect();
      return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        options >= bounds.left &&
        options <= bounds.right &&
        context >= bounds.top &&
        context <= bounds.bottom
      );
    };
    typeof document !== "undefined" && observeSessionStripPointers(document);
    SessionStripPointerStateAbs = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      value?: Dynamic,
    ): Dynamic =>
      Math.abs(input.timeStamp - options) <= SessionStripPointerStateLimit &&
      Math.abs(input.clientX - context) <= SessionStripPointerStateLimit_2 &&
      Math.abs(input.clientY - value) <= SessionStripPointerStateLimit_2;
    SessionStripPointerStateSubscribers = new Set();
    SessionStripPointerStateCurrentState = null;
    SessionStripPointerStateMinValue = null;
    SessionStripPointerStateHandler = (input?: Dynamic): Dynamic => {
      typeof requestAnimationFrame == "function" &&
        requestAnimationFrame((): Dynamic => requestAnimationFrame(input));
    };
    SessionStripPointerStateLimit_6 = 4;
    SessionStripPointerStateElementCache = new WeakMap();
    SessionStripContext = (0, reactSessionStripPointerState.createContext)(
      true,
    );
  };
}
