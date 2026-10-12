/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { ReactElement } from "react";

/** Text to announce, or a function producing it lazily once the announcement settles. */
export type AnnouncementMessage =
  | string
  | null
  | undefined
  | (() => string | null | undefined);
export interface AnnounceOptions {
  /** Only announce while no other announcement is pending. */
  ifIdle?: boolean;
}
export type AnnouncementListener = (
  message: AnnouncementMessage,
  options: AnnounceOptions,
) => void;
export interface LiveAnnouncerProps {
  settleMs?: number;
  clearMs?: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactLC: ReactNamespace;
    jsxW20: JsxNamespace;
    liveAnnouncementListeners: Set<AnnouncementListener>;
    ANNOUNCEMENT_SETTLE_MS: number;
    ANNOUNCEMENT_CLEAR_MS: number;
    MAX_ANNOUNCEMENT_LENGTH: number;
    initializeUiAnnouncements: () => void;
    announceLiveMessage: (
      message: AnnouncementMessage,
      options?: AnnounceOptions,
    ) => void;
    subscribeLiveAnnouncements: (listener: AnnouncementListener) => () => void;
    LiveAnnouncer: (props: LiveAnnouncerProps) => ReactElement;
  }
}

export function installUiAnnouncements(runtime: RuntimeBindings): () => void {
  var reactLC: ReactNamespace;
  var jsxW20: JsxNamespace;
  var liveAnnouncementListeners: Set<AnnouncementListener>;
  var ANNOUNCEMENT_SETTLE_MS: number;
  var ANNOUNCEMENT_CLEAR_MS: number;
  var MAX_ANNOUNCEMENT_LENGTH: number;
  var initializeUiAnnouncements: () => void;
  function announceLiveMessage(
    input: AnnouncementMessage,
    options: AnnounceOptions = {},
  ): void {
    for (let value of liveAnnouncementListeners)
      value(input, options);
  }
  function subscribeLiveAnnouncements(input: AnnouncementListener): () => void {
    liveAnnouncementListeners.add(input);
    return () => {
      liveAnnouncementListeners.delete(input);
    };
  }
  function LiveAnnouncer({
    settleMs = ANNOUNCEMENT_SETTLE_MS,
    clearMs = ANNOUNCEMENT_CLEAR_MS,
  }: LiveAnnouncerProps): ReactElement {
    let [value, value2] = reactLC.useState("");
    reactLC.useEffect(() => {
      let value3: ReturnType<typeof setTimeout> | undefined,
        flag = false,
        value4: ReturnType<typeof setTimeout> | undefined,
        value5 = subscribeLiveAnnouncements(
          (input, options) => {
            if (value3 !== undefined) {
              if (options.ifIdle && !flag) {
                return;
              }
              clearTimeout(value3);
            }
            flag = options.ifIdle === true;
            if (value4 !== undefined) {
              clearTimeout(value4);
            }
            value4 = undefined;
            value2("");
            value3 = setTimeout(() => {
              value3 = undefined;
              let value6 =
                typeof input === "function" ? input() : input;
              if (value6 == null || value6 === "") {
                return;
              }
              let value7 =
                value6.length > MAX_ANNOUNCEMENT_LENGTH
                  ? value6
                      .slice(0, MAX_ANNOUNCEMENT_LENGTH - 1)
                      .replace(/[\uD800-\uDBFF]$/, "") + "…"
                  : value6;
              value2(value7);
              value4 = setTimeout(() => {
                value4 = undefined;
                value2("");
              }, clearMs);
            }, settleMs);
          },
        );
      return () => {
        value5();
        if (value3 !== undefined) {
          clearTimeout(value3);
        }
        if (value4 !== undefined) {
          clearTimeout(value4);
        }
      };
    }, [settleMs, clearMs]);
    return jsxW20.jsx("span", {
      className: "sr-only",
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true",
      "data-kit": "live-announcer",
      children: value,
    });
  }
  bindRuntimeValue(runtime, "announceLiveMessage", () => announceLiveMessage);
  bindRuntimeValue(
    runtime,
    "subscribeLiveAnnouncements",
    () => subscribeLiveAnnouncements,
  );
  bindRuntimeValue(runtime, "LiveAnnouncer", () => LiveAnnouncer);
  bindRuntimeValue(
    runtime,
    "reactLC",
    () => reactLC,
    (value) => {
      reactLC = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxW20",
    () => jsxW20,
    (value) => {
      jsxW20 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "liveAnnouncementListeners",
    () => liveAnnouncementListeners,
    (value) => {
      liveAnnouncementListeners = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ANNOUNCEMENT_SETTLE_MS",
    () => ANNOUNCEMENT_SETTLE_MS,
    (value) => {
      ANNOUNCEMENT_SETTLE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ANNOUNCEMENT_CLEAR_MS",
    () => ANNOUNCEMENT_CLEAR_MS,
    (value) => {
      ANNOUNCEMENT_CLEAR_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_ANNOUNCEMENT_LENGTH",
    () => MAX_ANNOUNCEMENT_LENGTH,
    (value) => {
      MAX_ANNOUNCEMENT_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiAnnouncements",
    () => initializeUiAnnouncements,
    (value) => {
      initializeUiAnnouncements = value;
    },
  );
  return () => {
    ANNOUNCEMENT_SETTLE_MS = 350;
    ANNOUNCEMENT_CLEAR_MS = 5000;
    MAX_ANNOUNCEMENT_LENGTH = 120;
    initializeUiAnnouncements = (0, runtime.initializeOnce)(() => {
      reactLC = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxW20 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      liveAnnouncementListeners = new Set();
    });
  };
}
