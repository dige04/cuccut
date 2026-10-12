/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasPlaceLink(runtime: RuntimeBindings): () => void {
  var defaultPlaceLinkReportingEnabled: Dynamic;
  var placeLinkReportDebounceMs: Dynamic;
  var placeLinkReportRetryDelays: Dynamic;
  var placeFragmentPattern: Dynamic;
  var reservedPlaceFragments: Dynamic;
  var getPlaceLinkStorage: Dynamic;
  var placeLinkStorageFields: Dynamic;
  var schedulePlaceLinkReport: Dynamic;
  var cancelPlaceLinkReport: Dynamic;
  var placeLinkReportingEnabled: Dynamic;
  function isValidPlaceFragment(fragment?: Dynamic): Dynamic {
    return (
      typeof fragment == "string" &&
      placeFragmentPattern.test(fragment) &&
      !fragment.startsWith("comment-") &&
      !reservedPlaceFragments.has(fragment)
    );
  }
  function placeLinkStorageKey(scope: Dynamic = ""): Dynamic {
    let value: Dynamic =
      typeof location === "undefined" ? "/" : location.pathname;
    return (
      "place-link/" +
      (0, runtime.getDocumentStashKey)(value).slice(
        (0, runtime.getDocumentStashKey)("").length,
      ) +
      (scope ? "/" + scope : "")
    );
  }
  function readPlaceLinkHistory(scope?: Dynamic, storage?: Dynamic): Dynamic {
    try {
      return (storage?.getItem(placeLinkStorageKey(scope)) ?? "").split("|");
    } catch {
      return [];
    }
  }
  function rememberPlaceLink(
    field?: Dynamic,
    fragment?: Dynamic,
    scope?: Dynamic,
    storage: Dynamic = getPlaceLinkStorage(),
  ): Dynamic {
    let value: Dynamic = readPlaceLinkHistory(scope, storage),
      value2: Dynamic = field === "link" && value[0] !== fragment;
    try {
      storage?.setItem(
        placeLinkStorageKey(scope),
        placeLinkStorageFields
          .map(
            (input?: Dynamic, options?: Dynamic): Dynamic =>
              input === field
                ? fragment
                : value2 && input === "goto"
                  ? ""
                  : (value[options] ?? ""),
          )
          .join("|"),
      );
    } catch {}
  }
  function classifyPlaceLink(
    scope?: Dynamic,
    hash: Dynamic = typeof location === "undefined" ? "" : location.hash,
    storage: Dynamic = getPlaceLinkStorage(),
  ): Dynamic {
    let value: Dynamic = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!isValidPlaceFragment(value)) return null;
    let [value2, value3, value4, value5]: Dynamic = readPlaceLinkHistory(
      scope,
      storage,
    );
    return {
      place: value,
      why:
        value === value5
          ? "here"
          : [value2, value3, value4].includes(value)
            ? "known"
            : "new",
    };
  }
  function createPlaceLinkReporter(options: Dynamic = {}): Dynamic {
    let value: Dynamic = options.post ?? runtime.postToFrameHost,
      value2: Dynamic = options.enabled ?? placeLinkReportingEnabled,
      callback: Dynamic = (): Dynamic =>
        options.store === undefined ? getPlaceLinkStorage() : options.store,
      value3: Dynamic = null,
      value4: Dynamic = null,
      items: Dynamic = [],
      callback2: Dynamic = (): Dynamic => {
        value4 !== null && cancelPlaceLinkReport(value4);
        value4 = null;
      },
      callback3: Dynamic = (input?: Dynamic): Dynamic => {
        let value5: Dynamic = value3 === null;
        value3 = input;
        rememberPlaceLink("sent", input, options.scope, callback());
        value({
          type: "current_anchor",
          fragment: input,
        });
        value5 &&
          (items = placeLinkReportRetryDelays.map(
            (input2?: Dynamic): Dynamic =>
              schedulePlaceLinkReport(
                (): Dynamic =>
                  value3 !== null &&
                  value({
                    type: "current_anchor",
                    fragment: value3,
                  }),
                input2,
              ),
          ));
      };
    return {
      report(input: Dynamic): Dynamic {
        !value2 ||
          !isValidPlaceFragment(input) ||
          (rememberPlaceLink("at", input, options.scope, callback()),
          callback2(),
          (value4 = schedulePlaceLinkReport((): Dynamic => {
            value4 = null;
            input !== value3 && callback3(input);
          }, placeLinkReportDebounceMs)));
      },
      answer(input: Dynamic): Dynamic {
        !value2 ||
          !isValidPlaceFragment(input) ||
          (rememberPlaceLink("at", input, options.scope, callback()),
          callback2(),
          callback3(input));
      },
      stop(): Dynamic {
        callback2();
        items.forEach(cancelPlaceLinkReport);
      },
    };
  }
  function parseGotoAnchorMessage(
    event?: Dynamic,
    parentWindow?: Dynamic,
    allowedOrigin?: Dynamic,
  ): Dynamic {
    if (
      parentWindow === null ||
      event.source !== parentWindow ||
      !allowedOrigin(event.origin)
    )
      return null;
    let data: Dynamic = event.data;
    return data !== null &&
      typeof data == "object" &&
      data.type === "goto_anchor" &&
      isValidPlaceFragment(data.fragment)
      ? data.fragment
      : null;
  }
  function observeGotoAnchorMessages(
    onGoto?: Dynamic,
    targetWindow: Dynamic = window,
  ): Dynamic {
    if (targetWindow.parent === targetWindow) return (): Dynamic => {};
    let callback: Dynamic = (dataset?: Dynamic): Dynamic => {
      if (
        dataset.source !== targetWindow.parent ||
        !(0, runtime.isTrustedHostOrigin)(dataset.origin)
      )
        return;
      let value: Dynamic = parseGotoAnchorMessage(
        dataset,
        targetWindow.parent,
        runtime.isTrustedHostOrigin,
      );
      value !== null && onGoto(value);
    };
    targetWindow.addEventListener("message", callback);
    return (): Dynamic => targetWindow.removeEventListener("message", callback);
  }
  bindRuntimeValue(
    runtime,
    "defaultPlaceLinkReportingEnabled",
    () => defaultPlaceLinkReportingEnabled,
    (value) => {
      defaultPlaceLinkReportingEnabled = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "placeLinkReportDebounceMs",
    () => placeLinkReportDebounceMs,
    (value) => {
      placeLinkReportDebounceMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "placeLinkReportRetryDelays",
    () => placeLinkReportRetryDelays,
    (value) => {
      placeLinkReportRetryDelays = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "placeFragmentPattern",
    () => placeFragmentPattern,
    (value) => {
      placeFragmentPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reservedPlaceFragments",
    () => reservedPlaceFragments,
    (value) => {
      reservedPlaceFragments = value;
    },
  );
  bindRuntimeValue(runtime, "isValidPlaceFragment", () => isValidPlaceFragment);
  bindRuntimeValue(
    runtime,
    "getPlaceLinkStorage",
    () => getPlaceLinkStorage,
    (value) => {
      getPlaceLinkStorage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "placeLinkStorageFields",
    () => placeLinkStorageFields,
    (value) => {
      placeLinkStorageFields = value;
    },
  );
  bindRuntimeValue(runtime, "placeLinkStorageKey", () => placeLinkStorageKey);
  bindRuntimeValue(runtime, "readPlaceLinkHistory", () => readPlaceLinkHistory);
  bindRuntimeValue(runtime, "rememberPlaceLink", () => rememberPlaceLink);
  bindRuntimeValue(runtime, "classifyPlaceLink", () => classifyPlaceLink);
  bindRuntimeValue(
    runtime,
    "schedulePlaceLinkReport",
    () => schedulePlaceLinkReport,
    (value) => {
      schedulePlaceLinkReport = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cancelPlaceLinkReport",
    () => cancelPlaceLinkReport,
    (value) => {
      cancelPlaceLinkReport = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "placeLinkReportingEnabled",
    () => placeLinkReportingEnabled,
    (value) => {
      placeLinkReportingEnabled = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createPlaceLinkReporter",
    () => createPlaceLinkReporter,
  );
  bindRuntimeValue(
    runtime,
    "parseGotoAnchorMessage",
    () => parseGotoAnchorMessage,
  );
  bindRuntimeValue(
    runtime,
    "observeGotoAnchorMessages",
    () => observeGotoAnchorMessages,
  );
  return () => {
    defaultPlaceLinkReportingEnabled = true;
    placeLinkReportDebounceMs = 250;
    placeLinkReportRetryDelays = [1500, 6e3];
    placeFragmentPattern = /^[A-Za-z0-9._~-]{1,128}$/;
    reservedPlaceFragments = new Set([
      "sidebar",
      "settings",
      "customize",
      "upgrade",
      "downloads",
    ]);
    getPlaceLinkStorage = (): Dynamic => {
      try {
        return sessionStorage;
      } catch {
        return null;
      }
    };
    placeLinkStorageFields = ["link", "goto", "sent", "at"];
    schedulePlaceLinkReport = (input?: Dynamic, options?: Dynamic): Dynamic =>
      setTimeout(input, options);
    cancelPlaceLinkReport = (input?: Dynamic): Dynamic => clearTimeout(input);
    placeLinkReportingEnabled = defaultPlaceLinkReportingEnabled;
  };
}
