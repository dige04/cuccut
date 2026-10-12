/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";
import type { HostMessageOriginCheck } from "./frame-viewport";

/** The slice of `sessionStorage` the place-link memory uses. */
export type PlaceLinkStorage = Pick<Storage, "getItem" | "setItem">;
/** Slots of the pipe-separated place-link record kept in session storage. */
export type PlaceLinkField = "link" | "goto" | "sent" | "at";
/** Why a page-load fragment counts as a place link. */
export interface PlaceLinkResolution {
  place: string;
  why: "here" | "known" | "new";
}
/** Tells the host which anchor the page is currently showing. */
export interface PlaceLinkAnchorMessage {
  type: "current_anchor";
  fragment: string;
}
export interface PlaceLinkReporterOptions {
  post?: (message: PlaceLinkAnchorMessage) => void;
  enabled?: boolean;
  /** Storage override; `null` disables persistence. */
  store?: PlaceLinkStorage | null;
  /** Keeps the record of different documents on one page apart. */
  scope?: string;
}
export interface PlaceLinkReporter {
  /** Debounced: reports the fragment the user navigated to. */
  report(fragment: string): void;
  /** Immediate: answers a host's goto request. */
  answer(fragment: string): void;
  stop(): void;
}
/** Untrusted `postMessage` payload; only `goto_anchor` objects are acted on. */
export type GotoAnchorPayload =
  | { type?: unknown; fragment?: unknown }
  | string
  | number
  | boolean
  | null
  | undefined;
/** The parts of a `message` event the goto-anchor parser reads. */
export type GotoAnchorMessageEvent = Pick<
  MessageEvent<GotoAnchorPayload>,
  "source" | "origin" | "data"
>;
type PlaceLinkTimer = ReturnType<typeof setTimeout>;

declare module "../bindings" {
  interface RuntimeBindings {
    PLACE_LINK_MESSAGES_ENABLED: boolean;
    PLACE_LINK_INITIAL_POST_DELAY_MS: number;
    PLACE_LINK_RETRY_DELAYS_MS: readonly number[];
    PLACE_LINK_FRAGMENT_PATTERN: RegExp;
    RESERVED_PLACE_LINK_FRAGMENTS: ReadonlySet<string>;
    getPlaceLinkSessionStorage: () => PlaceLinkStorage | null;
    PLACE_LINK_STORAGE_FIELDS: readonly PlaceLinkField[];
    setPlaceLinkTimeout: (handler: () => void, delay: number) => PlaceLinkTimer;
    clearPlaceLinkTimeout: (timer: PlaceLinkTimer) => void;
    placeLinkMessagesEnabled: boolean;
    isValidPlaceFragment: (fragment: unknown) => fragment is string;
    placeLinkStorageKey: (memoryScope?: string) => string;
    readPlaceLinkFields: (
      memoryScope?: string,
      storage?: PlaceLinkStorage | null,
    ) => string[];
    writePlaceLinkField: (
      field: PlaceLinkField,
      value: string,
      memoryScope?: string,
      storage?: PlaceLinkStorage | null,
    ) => void;
    resolvePagePlaceLink: (
      memoryScope?: string,
      hash?: string,
      storage?: PlaceLinkStorage | null,
    ) => PlaceLinkResolution | null;
    createPlaceLinkReporter: (
      options?: PlaceLinkReporterOptions,
    ) => PlaceLinkReporter;
    parseGotoAnchorMessage: (
      event: GotoAnchorMessageEvent,
      parent: Window | null,
      originAllowed: HostMessageOriginCheck,
    ) => string | null;
    subscribeGotoAnchorMessages: (
      onGoto: (fragment: string) => void,
      hostWindow?: Window,
    ) => () => void;
  }
}

export function installBridgePlaceLinks(runtime: RuntimeBindings): () => void {
  var PLACE_LINK_MESSAGES_ENABLED: boolean;
  var PLACE_LINK_INITIAL_POST_DELAY_MS: number;
  var PLACE_LINK_RETRY_DELAYS_MS: readonly number[];
  var PLACE_LINK_FRAGMENT_PATTERN: RegExp;
  var RESERVED_PLACE_LINK_FRAGMENTS: ReadonlySet<string>;
  var getPlaceLinkSessionStorage: () => PlaceLinkStorage | null;
  var PLACE_LINK_STORAGE_FIELDS: readonly PlaceLinkField[];
  var setPlaceLinkTimeout: (handler: () => void, delay: number) => PlaceLinkTimer;
  var clearPlaceLinkTimeout: (timer: PlaceLinkTimer) => void;
  var placeLinkMessagesEnabled: boolean;
  function isValidPlaceFragment(fragment: unknown): fragment is string {
    return (
      typeof fragment === "string" &&
      PLACE_LINK_FRAGMENT_PATTERN.test(fragment) &&
      !fragment.startsWith("comment-") &&
      !RESERVED_PLACE_LINK_FRAGMENTS.has(fragment)
    );
  }
  function placeLinkStorageKey(memoryScope: string = "") {
    let path =
      typeof location === "undefined" ? "/" : location.pathname;
    return (
      "place-link/" +
      (0, runtime.artifactStashKey)(path).slice(
        (0, runtime.artifactStashKey)("").length,
      ) +
      (memoryScope ? "/" + memoryScope : "")
    );
  }
  function readPlaceLinkFields(
    memoryScope?: string,
    storage?: PlaceLinkStorage | null,
  ): string[] {
    try {
      return (storage?.getItem(placeLinkStorageKey(memoryScope)) ?? "").split(
        "|",
      );
    } catch {
      return [];
    }
  }
  function writePlaceLinkField(
    field: PlaceLinkField,
    value: string,
    memoryScope?: string,
    storage: PlaceLinkStorage | null = getPlaceLinkSessionStorage(),
  ): void {
    let stored = readPlaceLinkFields(memoryScope, storage),
      linkChanged = field === "link" && stored[0] !== value;
    try {
      storage?.setItem(
        placeLinkStorageKey(memoryScope),
        PLACE_LINK_STORAGE_FIELDS.map(
          (input, options) =>
            input === field
              ? value
              : linkChanged && input === "goto"
                ? ""
                : (stored[options] ?? ""),
        ).join("|"),
      );
    } catch {}
  }
  function resolvePagePlaceLink(
    memoryScope?: string,
    hash: string = typeof location === "undefined" ? "" : location.hash,
    storage: PlaceLinkStorage | null = getPlaceLinkSessionStorage(),
  ): PlaceLinkResolution | null {
    let fragment = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!isValidPlaceFragment(fragment)) {
      return null;
    }
    let [value, value2, value3, value4] = readPlaceLinkFields(
      memoryScope,
      storage,
    );
    return {
      place: fragment,
      why:
        fragment === value4
          ? "here"
          : [value, value2, value3].includes(fragment)
            ? "known"
            : "new",
    };
  }
  function createPlaceLinkReporter(
    input: PlaceLinkReporterOptions = {},
  ): PlaceLinkReporter {
    let value: (message: PlaceLinkAnchorMessage) => void =
        input.post ?? runtime.postToHost,
      value2 = input.enabled ?? placeLinkMessagesEnabled,
      callback = () =>
        input.store === undefined ? getPlaceLinkSessionStorage() : input.store,
      value3: string | null = null,
      value4: PlaceLinkTimer | null = null,
      items: PlaceLinkTimer[] = [],
      callback2 = () => {
        if (value4 !== null) {
          clearPlaceLinkTimeout(value4);
        }
        value4 = null;
      },
      callback3 = (input2: string) => {
        let value5 = value3 === null;
        value3 = input2;
        writePlaceLinkField("sent", input2, input.scope, callback());
        value({
          type: "current_anchor",
          fragment: input2,
        });
        if (value5) {
          items = PLACE_LINK_RETRY_DELAYS_MS.map(
            (input3) =>
              setPlaceLinkTimeout(
                () =>
                  value3 !== null &&
                  value({
                    type: "current_anchor",
                    fragment: value3,
                  }),
                input3,
              ),
          );
        }
      };
    return {
      report(input2: string) {
        if (!value2 || !isValidPlaceFragment(input2)) {
          return;
        }
        writePlaceLinkField("at", input2, input.scope, callback());
        callback2();
        value4 = setPlaceLinkTimeout(() => {
          value4 = null;
          if (input2 !== value3) {
            callback3(input2);
          }
        }, PLACE_LINK_INITIAL_POST_DELAY_MS);
      },
      answer(input2: string) {
        if (!value2 || !isValidPlaceFragment(input2)) {
          return;
        }
        writePlaceLinkField("at", input2, input.scope, callback());
        callback2();
        callback3(input2);
      },
      stop() {
        callback2();
        items.forEach(clearPlaceLinkTimeout);
      },
    };
  }
  function parseGotoAnchorMessage(
    event: GotoAnchorMessageEvent,
    parent: Window | null,
    originAllowed: HostMessageOriginCheck,
  ): string | null {
    if (
      parent === null ||
      event.source !== parent ||
      !originAllowed(event.origin)
    ) {
      return null;
    }
    let data = event.data;
    if (
      data !== null &&
      typeof data === "object" &&
      data.type === "goto_anchor" &&
      isValidPlaceFragment(data.fragment)
    ) {
      return data.fragment;
    } else {
      return null;
    }
  }
  function subscribeGotoAnchorMessages(
    onGoto: (fragment: string) => void,
    hostWindow: Window = window,
  ) {
    if (hostWindow.parent === hostWindow) {
      return () => {
        return;
      };
    }
    let listener = (dataset: MessageEvent<GotoAnchorPayload>) => {
      if (
        dataset.source !== hostWindow.parent ||
        !(0, runtime.isAllowedHostMessageOrigin)(dataset.origin)
      ) {
        return;
      }
      let value = parseGotoAnchorMessage(
        dataset,
        hostWindow.parent,
        runtime.isAllowedHostMessageOrigin,
      );
      if (value !== null) {
        onGoto(value);
      }
    };
    hostWindow.addEventListener("message", listener);
    return () => hostWindow.removeEventListener("message", listener);
  }
  bindRuntimeValue(
    runtime,
    "PLACE_LINK_MESSAGES_ENABLED",
    () => PLACE_LINK_MESSAGES_ENABLED,
    (value) => {
      PLACE_LINK_MESSAGES_ENABLED = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PLACE_LINK_INITIAL_POST_DELAY_MS",
    () => PLACE_LINK_INITIAL_POST_DELAY_MS,
    (value) => {
      PLACE_LINK_INITIAL_POST_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PLACE_LINK_RETRY_DELAYS_MS",
    () => PLACE_LINK_RETRY_DELAYS_MS,
    (value) => {
      PLACE_LINK_RETRY_DELAYS_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PLACE_LINK_FRAGMENT_PATTERN",
    () => PLACE_LINK_FRAGMENT_PATTERN,
    (value) => {
      PLACE_LINK_FRAGMENT_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESERVED_PLACE_LINK_FRAGMENTS",
    () => RESERVED_PLACE_LINK_FRAGMENTS,
    (value) => {
      RESERVED_PLACE_LINK_FRAGMENTS = value;
    },
  );
  bindRuntimeValue(runtime, "isValidPlaceFragment", () => isValidPlaceFragment);
  bindRuntimeValue(
    runtime,
    "getPlaceLinkSessionStorage",
    () => getPlaceLinkSessionStorage,
    (value) => {
      getPlaceLinkSessionStorage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PLACE_LINK_STORAGE_FIELDS",
    () => PLACE_LINK_STORAGE_FIELDS,
    (value) => {
      PLACE_LINK_STORAGE_FIELDS = value;
    },
  );
  bindRuntimeValue(runtime, "placeLinkStorageKey", () => placeLinkStorageKey);
  bindRuntimeValue(runtime, "readPlaceLinkFields", () => readPlaceLinkFields);
  bindRuntimeValue(runtime, "writePlaceLinkField", () => writePlaceLinkField);
  bindRuntimeValue(runtime, "resolvePagePlaceLink", () => resolvePagePlaceLink);
  bindRuntimeValue(
    runtime,
    "setPlaceLinkTimeout",
    () => setPlaceLinkTimeout,
    (value) => {
      setPlaceLinkTimeout = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clearPlaceLinkTimeout",
    () => clearPlaceLinkTimeout,
    (value) => {
      clearPlaceLinkTimeout = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "placeLinkMessagesEnabled",
    () => placeLinkMessagesEnabled,
    (value) => {
      placeLinkMessagesEnabled = value;
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
    "subscribeGotoAnchorMessages",
    () => subscribeGotoAnchorMessages,
  );
  return () => {
    PLACE_LINK_MESSAGES_ENABLED = true;
    PLACE_LINK_INITIAL_POST_DELAY_MS = 250;
    PLACE_LINK_RETRY_DELAYS_MS = [1500, 6000];
    PLACE_LINK_FRAGMENT_PATTERN = /^[A-Za-z0-9._~-]{1,128}$/;
    RESERVED_PLACE_LINK_FRAGMENTS = new Set([
      "sidebar",
      "settings",
      "customize",
      "upgrade",
      "downloads",
    ]);
    getPlaceLinkSessionStorage = () => {
      try {
        return sessionStorage;
      } catch {
        return null;
      }
    };
    PLACE_LINK_STORAGE_FIELDS = ["link", "goto", "sent", "at"];
    setPlaceLinkTimeout = (input, options) => setTimeout(input, options);
    clearPlaceLinkTimeout = (input) => clearTimeout(input);
    placeLinkMessagesEnabled = PLACE_LINK_MESSAGES_ENABLED;
  };
}
