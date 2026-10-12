/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorSessionElementState(
  runtime: RuntimeBindings,
): () => void {
  var reactSessionElementState: Dynamic;
  var SessionElementStateCroppingTargetSelectedConfig: Dynamic;
  var SessionElementStateCache: Dynamic;
  var SessionElementStateSubscribers: Dynamic;
  var SessionElementStateGet: Dynamic;
  var SessionElementStateCache_2: Dynamic;
  var SessionElementStateItems: Dynamic;
  var SessionElementStateKey: Dynamic;
  var SessionElementStateCache_3: Dynamic;
  var CropIsNotAvailableHereForMessage: Dynamic;
  var SessionElementStateUnloadedTurnedAutoConfig: Dynamic;
  function updateElementSessionState(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let state: Dynamic = {
      ...SessionElementStateGet(input),
      ...options,
    };
    if (
      JSON.stringify(state) !== JSON.stringify(SessionElementStateGet(input))
    ) {
      JSON.stringify(state) ===
      JSON.stringify(SessionElementStateCroppingTargetSelectedConfig)
        ? SessionElementStateCache.delete(input)
        : SessionElementStateCache.set(input, state);
      for (let value of SessionElementStateSubscribers as Dynamic) value();
    }
  }
  function useElementSessionState(input?: Dynamic): Dynamic {
    return (0, reactSessionElementState.useSyncExternalStore)(
      (input2?: Dynamic): Dynamic => (
        SessionElementStateSubscribers.add(input2),
        (): Dynamic => SessionElementStateSubscribers.delete(input2)
      ),
      (): Dynamic =>
        input === null
          ? SessionElementStateCroppingTargetSelectedConfig
          : SessionElementStateGet(input),
    );
  }
  function registerElementSession(input?: Dynamic, options?: Dynamic): Dynamic {
    SessionElementStateCache_2.set(input, [
      ...(SessionElementStateCache_2.get(input) ?? []),
      {
        el: options,
      },
    ]);
  }
  function unregisterElementSession(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = [...(SessionElementStateCache_2.get(input) ?? [])]
      .reverse()
      .find((input2?: Dynamic): Dynamic => input2.el === options);
    value &&
      (context
        ? setTimeout((): Dynamic => SessionElementStateKey(input, value), 3e3)
        : SessionElementStateKey(input, value));
  }
  function dispatchElementSessionGesture(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = false,
  ): Dynamic {
    let value2: Dynamic = SessionElementStateCache_2.get(input) ?? [],
      value3: Dynamic =
        options.gestureKey === undefined
          ? undefined
          : value2.find(
              (input2?: Dynamic): Dynamic => input2.key === options.gestureKey,
            );
    if (!value3) {
      if (
        SessionElementStateItems.includes(
          input + "|" + String(options.gestureKey),
        ) ||
        ((value3 = value2.find(
          (input2?: Dynamic): Dynamic => input2.key === undefined,
        )),
        !value3 ||
          options.gestureKey === undefined ||
          context.element(options.tid) !== value3.el)
      )
        return null;
      value3.key = options.gestureKey;
    }
    value && SessionElementStateKey(input, value3);
    let value4: Dynamic = parseInt(
      value3.el.getAttribute(runtime.DcTplAttribute) ?? "",
      10,
    );
    return context.element(value4) === value3.el ? value4 : null;
  }
  function registerLateGesture(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input + "|" + String(options);
    SessionElementStateCache_3.set(value, context);
    setTimeout((): Dynamic => {
      SessionElementStateCache_3.get(value) === context &&
        (SessionElementStateCache_3.delete(value), context.lapsed("late"));
    }, 3e3);
  }
  function claimLateGesture(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = input + "|" + String(options),
      entry: Dynamic = SessionElementStateCache_3.get(value2);
    return entry === undefined
      ? value
        ? undefined
        : null
      : !value && entry.el !== context
        ? null
        : (SessionElementStateCache_3.delete(value2),
          value && entry.el === context
            ? entry.edits
            : (entry.lapsed("stale"), value ? undefined : null));
  }
  function activeCropElement(): Dynamic {
    for (let [value, value2] of SessionElementStateCache as Dynamic)
      if (value2.cropping !== null) return value;
    return null;
  }
  function useActiveCropElement(): Dynamic {
    return (0, reactSessionElementState.useSyncExternalStore)(
      (input?: Dynamic): Dynamic => (
        SessionElementStateSubscribers.add(input),
        (): Dynamic => SessionElementStateSubscribers.delete(input)
      ),
      activeCropElement,
    );
  }
  bindRuntimeValue(
    runtime,
    "reactSessionElementState",
    () => reactSessionElementState,
    (value) => {
      reactSessionElementState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionElementStateCroppingTargetSelectedConfig",
    () => SessionElementStateCroppingTargetSelectedConfig,
    (value) => {
      SessionElementStateCroppingTargetSelectedConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionElementStateCache",
    () => SessionElementStateCache,
    (value) => {
      SessionElementStateCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionElementStateSubscribers",
    () => SessionElementStateSubscribers,
    (value) => {
      SessionElementStateSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionElementStateGet",
    () => SessionElementStateGet,
    (value) => {
      SessionElementStateGet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "updateElementSessionState",
    () => updateElementSessionState,
  );
  bindRuntimeValue(
    runtime,
    "useElementSessionState",
    () => useElementSessionState,
  );
  bindRuntimeValue(
    runtime,
    "SessionElementStateCache_2",
    () => SessionElementStateCache_2,
    (value) => {
      SessionElementStateCache_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionElementStateItems",
    () => SessionElementStateItems,
    (value) => {
      SessionElementStateItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionElementStateKey",
    () => SessionElementStateKey,
    (value) => {
      SessionElementStateKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "registerElementSession",
    () => registerElementSession,
  );
  bindRuntimeValue(
    runtime,
    "unregisterElementSession",
    () => unregisterElementSession,
  );
  bindRuntimeValue(
    runtime,
    "dispatchElementSessionGesture",
    () => dispatchElementSessionGesture,
  );
  bindRuntimeValue(
    runtime,
    "SessionElementStateCache_3",
    () => SessionElementStateCache_3,
    (value) => {
      SessionElementStateCache_3 = value;
    },
  );
  bindRuntimeValue(runtime, "registerLateGesture", () => registerLateGesture);
  bindRuntimeValue(runtime, "claimLateGesture", () => claimLateGesture);
  bindRuntimeValue(
    runtime,
    "CropIsNotAvailableHereForMessage",
    () => CropIsNotAvailableHereForMessage,
    (value) => {
      CropIsNotAvailableHereForMessage = value;
    },
  );
  bindRuntimeValue(runtime, "activeCropElement", () => activeCropElement);
  bindRuntimeValue(runtime, "useActiveCropElement", () => useActiveCropElement);
  bindRuntimeValue(
    runtime,
    "SessionElementStateUnloadedTurnedAutoConfig",
    () => SessionElementStateUnloadedTurnedAutoConfig,
    (value) => {
      SessionElementStateUnloadedTurnedAutoConfig = value;
    },
  );
  return () => {
    reactSessionElementState = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    SessionElementStateCroppingTargetSelectedConfig = {
      cropping: null,
      target: null,
      selected: null,
    };
    SessionElementStateCache = new Map();
    SessionElementStateSubscribers = new Set();
    SessionElementStateGet = (input?: Dynamic): Dynamic =>
      SessionElementStateCache.get(input) ??
      SessionElementStateCroppingTargetSelectedConfig;
    SessionElementStateCache_2 = new Map();
    SessionElementStateItems = [];
    SessionElementStateKey = (input?: Dynamic, options?: Dynamic): Dynamic => {
      options.key !== undefined &&
        SessionElementStateItems.push(input + "|" + options.key) > 32 &&
        SessionElementStateItems.shift();
      let value: Dynamic = (SessionElementStateCache_2.get(input) ?? []).filter(
        (input2?: Dynamic): Dynamic => input2 !== options,
      );
      value.length
        ? SessionElementStateCache_2.set(input, value)
        : SessionElementStateCache_2.delete(input);
    };
    SessionElementStateCache_3 = new Map();
    CropIsNotAvailableHereForMessage =
      "Crop is not available here, for example inside a component or scrolled out of view.";
    SessionElementStateUnloadedTurnedAutoConfig = {
      unloaded:
        "This has not loaded, or its file is missing, so there is nothing to crop.",
      turned:
        "Crop does not work while this is flipped, skewed or unevenly scaled, or sits in a rotated or unevenly scaled container.",
      auto: "This has no set width or height, so a crop would resize it. Set a width or height first.",
      offboard: "Bring this back onto the artboard to crop it.",
      custom:
        "Its own CSS places or crops this in a form this editor cannot edit. Remove object-position or object-view-box to crop it here.",
      "foreign-zoom":
        "This was zoomed in Chrome or Edge. Crop it there: this browser cannot show the zoom.",
    };
  };
}
