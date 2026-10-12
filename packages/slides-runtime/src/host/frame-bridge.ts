/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";
import type {
  HostExportDescriptor,
  HostExportSender,
} from "../delivery/provider";

/** The save status the host draws in its own chrome. */
export type HostSaveChrome =
  | "saving"
  | "saved"
  | "reconnecting"
  | "readonly"
  | "unsaved";
/** The document save states `hostSaveStatus` maps to the host chrome. */
export type HostSaveInput =
  | "loading"
  | "cached"
  | "ready"
  | "saved"
  | "dirty"
  | "saving"
  | "readonly"
  | "error";
/** A command or destination the page lets the host chrome offer. */
export interface HostCommand {
  id: string;
  disabled?: boolean;
}
/** What the page asks the host to reserve at the bottom of the frame. */
export interface HostFootState {
  inset?: number;
  /** A hex background color (`#rrggbb`), or null when none applies. */
  ground?: string | null;
}
/** The validated foot state, as reported to the host. */
export interface HostFootSnapshot {
  footInset?: number;
  ground?: string;
}
/** Everything the page tells the host chrome (posted as `snapshot`). */
export interface HostChromeSnapshot {
  v: 1;
  saved?: HostSaveChrome;
  actions?: HostCommand[];
  leaveLosesWork?: boolean;
  exports?: HostExportDescriptor[];
  handoffs?: Omit<HostExportDescriptor, "handoff">[];
  destinations?: HostCommand[];
  footInset?: number;
  ground?: string;
}
/** The save state the page last reported. */
interface HostSaveReport {
  saved: HostSaveChrome;
  saveNow: boolean;
}
/** A command message from the host. Every field is untrusted and read defensively. */
export interface HostChromeMessage {
  __frame_chrome_poke?: unknown;
  __frame_chrome_cmd?: unknown;
  rows?: unknown;
  words?: unknown;
  cmd?: unknown;
  id?: unknown;
  format?: unknown;
  request?: unknown;
  interactive?: unknown;
  variant?: unknown;
  bundle?: unknown;
  windowMs?: unknown;
  sender?: unknown;
}
/** Handles a validated export request; `windowMs` is undefined when the host sent no valid one. */
export interface HostExportReceiver {
  receive(
    format: string,
    request: string,
    interactive: boolean,
    variant: string | undefined,
    bundle: boolean,
    windowMs: number | undefined,
    sender: HostExportSender | undefined,
  ): void;
}
export type HostExportHandler = HostExportReceiver["receive"];
/** A window whose page may declare, in `__FRAME_PREAMBLE`, which host origins it trusts. */
export type FramePreambleWindow = Window & {
  __FRAME_PREAMBLE?: { origins?: unknown };
};
export interface HostFrameBridgeOptions {
  ownWindow: Window;
  /** The embedding window, or null when the page is not framed. */
  parentWindow: Window | null;
  origins: readonly string[];
}
/** The page side of the channel to the host chrome around a framed page. */
export interface HostFrameBridge {
  report(input: HostSaveChrome | null, saveNow?: boolean): void;
  setSaveNowHandler(handler: (() => void) | null): void;
  setDestinations(destinations: readonly HostCommand[] | null): void;
  setDestinationHandler(handler: ((id: string) => void) | null): void;
  setFoot(foot: HostFootState | null): void;
  setExports(formats: readonly HostExportDescriptor[] | null): void;
  setExportHandler(handler: HostExportHandler | null): void;
  setFind(enabled: boolean, onOpen: (() => void) | null): void;
  declineExport(request: string, cancelled?: boolean): void;
  holdLeaveLosesWork(): () => void;
  witnessed(): boolean;
  hostDrawsSave(): boolean;
  hostDrawsReadOnly(): boolean;
  hostDrawsAgentTips(): boolean;
  hostTakesRetry(): boolean;
  subscribeHostDrawsSave(listener: () => void): () => void;
  dispose(): void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    react_z: ReactNamespace;
    SAVE_NOW_COMMAND: "save_now";
    OPEN_FIND_COMMAND: "open_find";
    EXPORT_FORMAT_PATTERN: RegExp;
    validExportTimeout: (value: unknown) => number | undefined;
    MAX_HOST_EXPORT_FORMATS: number;
    HOST_DESTINATION_PATTERN: RegExp;
    MAX_HOST_DESTINATIONS: number;
    HOST_REQUEST_ID_PATTERN: RegExp;
    HOST_COMMAND_PATTERN: RegExp;
    MAX_HOST_COMMANDS: number;
    MAX_HOST_FOOT_INSET: number;
    HOST_BACKGROUND_HEX_PATTERN: RegExp;
    normalizeHostBackgroundColor: (color: string) => string | null;
    readHostBackgroundColor: (element: Element) => string | null;
    hostSaveStatus: (status: HostSaveInput) => HostSaveChrome | null;
    DEFAULT_HOST_ORIGINS: readonly string[];
    hostOrigins: (ownWindow: FramePreambleWindow) => readonly string[];
    isAllowedHostOrigin: (
      origin: string,
      allowedOrigins: readonly string[],
    ) => boolean;
    normalizeHostExportFormats: (
      formats: readonly HostExportDescriptor[],
    ) => HostExportDescriptor[];
    normalizeHostDestinations: (
      destinations: readonly HostCommand[],
    ) => HostCommand[];
    normalizeHostCommands: (commands: readonly HostCommand[]) => HostCommand[];
    normalizeHostTips: (tips: unknown) => string[];
    createHostFrameBridge: (options: HostFrameBridgeOptions) => HostFrameBridge;
    allowedHostOrigins: readonly string[];
    isAllowedHostMessageOrigin: (origin: string) => boolean;
    postToHost: (
      message: unknown,
      ownWindow?: Window,
      origins?: readonly string[],
    ) => void;
    hostFrameBridge: HostFrameBridge | null;
    getHostFrameBridge: () => HostFrameBridge;
    reportToHost: (state: HostSaveChrome | null, reason?: boolean) => void;
    holdHostLeaveWarning: () => () => void;
    useHostDestinations: (
      destinations: readonly HostCommand[] | null,
      onPress: (id: string) => void,
    ) => void;
    hostFootState: HostFootState | null;
    hostFootInsets: Map<string, number>;
    setHostFootState: (state: HostFootState | null) => void;
    updateHostFoot: () => void;
    setHostExports: (formats: readonly HostExportDescriptor[] | null) => void;
    setHostExportHandler: (handler: HostExportHandler | null) => void;
    declineHostExport: (requestId: string, reason?: boolean) => void;
    useHostSaveState: (
      status: HostSaveInput | null,
      message?: () => void,
    ) => void;
    useHostFindCommand: (enabled: boolean, onOpen: () => void) => void;
    hostDrawsSave: () => boolean;
    hostDrawsReadOnly: () => boolean;
    useHostDrawsAgentTips: () => boolean;
    hostTakesRetry: () => boolean;
    subscribeHostSaveChrome: (listener: () => void) => () => void;
  }
}

export function installHostFrameBridge(runtime: RuntimeBindings): () => void {
  var react_z: ReactNamespace;
  var SAVE_NOW_COMMAND: RuntimeBindings["SAVE_NOW_COMMAND"];
  var OPEN_FIND_COMMAND: RuntimeBindings["OPEN_FIND_COMMAND"];
  var EXPORT_FORMAT_PATTERN: RegExp;
  var validExportTimeout: RuntimeBindings["validExportTimeout"];
  var MAX_HOST_EXPORT_FORMATS: number;
  var HOST_DESTINATION_PATTERN: RegExp;
  var MAX_HOST_DESTINATIONS: number;
  var HOST_REQUEST_ID_PATTERN: RegExp;
  var HOST_COMMAND_PATTERN: RegExp;
  var MAX_HOST_COMMANDS: number;
  var MAX_HOST_FOOT_INSET: number;
  var HOST_BACKGROUND_HEX_PATTERN: RegExp;
  var DEFAULT_HOST_ORIGINS: readonly string[];
  var allowedHostOrigins: readonly string[];
  var hostFrameBridge: HostFrameBridge | null;
  var hostFootState: HostFootState | null;
  var hostFootInsets: Map<string, number>;
  function normalizeHostBackgroundColor(color: string): string | null {
    let value: string = color.trim(),
      value2: RegExpExecArray | null =
        /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:\s*[,/]\s*(\d*\.?\d+%?))?\s*\)$/.exec(
          value,
        ),
      text: string = "(\\d*\\.?\\d+(?:e[-+]?\\d+)?%?)",
      value3: RegExpExecArray | null =
        value2 === null
          ? new RegExp(
              "^color\\(\\s*srgb\\s+(\\d*\\.?\\d+(?:e[-+]?\\d+)?%?)\\s+(\\d*\\.?\\d+(?:e[-+]?\\d+)?%?)\\s+(\\d*\\.?\\d+(?:e[-+]?\\d+)?%?)(?:\\s*\\/\\s*(\\d*\\.?\\d+(?:e[-+]?\\d+)?%?))?\\s*\\)$",
            ).exec(value)
          : null,
      value4: RegExpExecArray | null = value2 ?? value3;
    if (value4 === null) {
      return null;
    }
    let callback: (input: string) => number = (input: string): number =>
        input.endsWith("%")
          ? Number.parseFloat(input) / 100
          : Number.parseFloat(input),
      value5: string | undefined = value4[4];
    if (value5 !== undefined && callback(value5) < 1) {
      return null;
    }
    let value6: number[] = [value4[1]!, value4[2]!, value4[3]!].map(
      (input: string): number =>
        value2 !== null
          ? Number.parseInt(input, 10)
          : Math.round(callback(input) * 255),
    );
    if (value6.some((input: number): boolean => !(input >= 0 && input <= 255))) {
      return null;
    }
    return (
      "#" +
      value6
        .map((input: number): string => input.toString(16).padStart(2, "0"))
        .join("")
    );
  }
  function readHostBackgroundColor(element: Element): string | null {
    try {
      return normalizeHostBackgroundColor(
        getComputedStyle(element).backgroundColor,
      );
    } catch {
      return null;
    }
  }
  function hostSaveStatus(status: HostSaveInput): HostSaveChrome | null {
    switch (status) {
      case "loading":
        return null;
      case "cached":
        return "reconnecting";
      case "ready":
      case "saved":
        return "saved";
      case "dirty":
      case "saving":
        return "saving";
      case "readonly":
        return "readonly";
      case "error":
        return "unsaved";
    }
  }
  function hostOrigins(ownWindow: FramePreambleWindow): readonly string[] {
    let value: unknown = ownWindow.__FRAME_PREAMBLE?.origins;
    if (Array.isArray(value)) {
      return value.filter(
        (input: unknown): input is string => typeof input === "string",
      );
    }
    return DEFAULT_HOST_ORIGINS;
  }
  function isAllowedHostOrigin(
    origin: string,
    allowedOrigins: readonly string[],
  ): boolean {
    for (let value of allowedOrigins)
      if (value.endsWith(":*")) {
        try {
          let value2: URL = new URL(origin);
          if (`${value2.protocol}//${value2.hostname}:*` === value) {
            return true;
          }
        } catch {}
      } else if (origin === value) {
        return true;
      }
    return false;
  }
  function normalizeHostExportFormats(
    formats: readonly HostExportDescriptor[],
  ): HostExportDescriptor[] {
    let items: HostExportDescriptor[] = [],
      values: Set<string> = new Set();
    for (let value of formats) {
      if (
        typeof value.format !== "string" ||
        !EXPORT_FORMAT_PATTERN.test(value.format) ||
        values.has(value.format)
      ) {
        continue;
      }
      values.add(value.format);
      let value2: boolean = value.handoff === true,
        state: HostExportDescriptor = {
          format: value.format,
          ...(value.disabled === true && {
            disabled: true,
          }),
          ...(!value2 &&
            value.interactive === true && {
              interactive: true,
            }),
          ...(!value2 &&
            value.bundle === true && {
              bundle: true,
            }),
          ...(value2 && {
            handoff: value2,
          }),
        },
        value3: HostCommand[] =
          !value2 && Array.isArray(value.variants)
            ? normalizeHostDestinations(value.variants)
            : [];
      if (value3.length > 0) {
        state.variants = value3;
      }
      items.push(state);
      if (items.length === MAX_HOST_EXPORT_FORMATS) {
        break;
      }
    }
    return items;
  }
  function normalizeHostDestinations(
    destinations: readonly HostCommand[],
  ): HostCommand[] {
    let items: HostCommand[] = [],
      values: Set<string> = new Set();
    for (let value of destinations) {
      if (
        typeof value?.id !== "string" ||
        !HOST_DESTINATION_PATTERN.test(value.id) ||
        values.has(value.id)
      ) {
        continue;
      }
      values.add(value.id);
      items.push(
        value.disabled === true
          ? {
              id: value.id,
              disabled: true,
            }
          : {
              id: value.id,
            },
      );
      if (items.length === MAX_HOST_DESTINATIONS) {
        break;
      }
    }
    return items;
  }
  function normalizeHostCommands(
    commands: readonly HostCommand[],
  ): HostCommand[] {
    let items: HostCommand[] = [],
      values: Set<string> = new Set();
    for (let value of commands) {
      if (
        typeof value.id !== "string" ||
        !HOST_COMMAND_PATTERN.test(value.id) ||
        values.has(value.id)
      ) {
        continue;
      }
      values.add(value.id);
      items.push(
        value.disabled === true
          ? {
              id: value.id,
              disabled: true,
            }
          : {
              id: value.id,
            },
      );
      if (items.length === MAX_HOST_COMMANDS) {
        break;
      }
    }
    return items;
  }
  function normalizeHostTips(tips: unknown): string[] {
    if (
      Array.isArray(tips) &&
      tips.length <= 8 &&
      tips.every(
        (input: unknown): input is string => typeof input === "string",
      )
    ) {
      return tips;
    } else {
      return [];
    }
  }
  function createHostFrameBridge(
    options: HostFrameBridgeOptions,
  ): HostFrameBridge {
    let parentWindow: Window | null = options.parentWindow,
      value: string | null = null,
      flag: boolean = false,
      values: Set<string> = new Set(),
      flag2: boolean = false,
      value2: (() => void) | null = null,
      value3: HostSaveReport | null = null,
      value4: HostExportDescriptor[] | null = null,
      value5: HostCommand[] | null = null,
      value6: HostFootSnapshot | null = null,
      index: number = 0,
      value7: HostChromeSnapshot | null = null,
      value8: string | undefined,
      value9: (() => void) | null = null,
      value10: ((id: string) => void) | null = null,
      value11: HostExportHandler | null = null,
      values2: Set<() => void> = new Set(),
      callback: () => boolean = (): boolean =>
        flag && value7?.saved !== undefined,
      callback2: () => boolean = (): boolean =>
        flag && values.has("readonly") && value7?.saved === "readonly",
      callback3: () => boolean = (): boolean =>
        flag && values.has("claude_tips"),
      callback4: () => boolean = (): boolean =>
        callback() &&
        value9 !== null &&
        value7?.actions?.some(
          (input: HostCommand): boolean => input.id === SAVE_NOW_COMMAND,
        ) === true,
      callback5: () => string = (): string =>
        String(callback()) +
        String(callback4()) +
        String(callback2()) +
        String(callback3()),
      value12: string = callback5(),
      callback6: () => void = (): void => {
        let value13: string = callback5();
        if (value13 === value12) {
          return;
        }
        value12 = value13;
        for (let value14 of values2)
          try {
            value14();
          } catch {}
      },
      callback7: () => HostChromeSnapshot | null =
        (): HostChromeSnapshot | null => {
          if (
            value3 === null &&
            value4 === null &&
            value5 === null &&
            value6 === null &&
            index === 0
          ) {
            return null;
          }
          let state: HostChromeSnapshot = {
            v: 1,
          };
          if (value3 !== null) {
            state.saved = value3.saved;
            state.actions = value3.saveNow
              ? [
                  {
                    id: SAVE_NOW_COMMAND,
                  },
                ]
              : [];
          }
          if (index > 0) {
            state.leaveLosesWork = true;
          }
          let value13: HostExportDescriptor[] =
              value4?.filter(
                (input: HostExportDescriptor): boolean =>
                  input.handoff !== true,
              ) ?? [],
            value14: Omit<HostExportDescriptor, "handoff">[] =
              value4
                ?.filter(
                  (input: HostExportDescriptor): boolean =>
                    input.handoff === true,
                )
                .map(
                  ({
                    handoff: handoff,
                    ...props
                  }: HostExportDescriptor): Omit<
                    HostExportDescriptor,
                    "handoff"
                  > => props,
                ) ?? [];
          if (value13.length > 0) {
            state.exports = value13;
          }
          if (value14.length > 0) {
            state.handoffs = value14;
          }
          if (value5 !== null) {
            state.destinations = value5;
          }
          if (value6?.footInset !== undefined) {
            state.footInset = value6.footInset;
          }
          if (value6?.ground !== undefined) {
            state.ground = value6.ground;
          }
          return state;
        },
      callback8: () => void = (): void => {
        let value13: HostChromeSnapshot | null = callback7(),
          value14: HostChromeSnapshot = value13 ?? {
            v: 1,
          },
          value15: HostChromeSnapshot | null = flag2
            ? {
                ...value14,
                actions: [
                  ...(value14.actions ?? []),
                  {
                    id: OPEN_FIND_COMMAND,
                  },
                ],
              }
            : value13,
          value16: string = JSON.stringify(value15);
        if (value16 === value8) {
          return;
        }
        value7 = value15;
        value8 = value16;
        if (value !== null) {
          callback10(value15, value);
        }
        callback6();
      },
      callback9: (input: string, options2?: string) => boolean = (
        input: string,
        options2?: string,
      ): boolean => {
        let value13: HostExportDescriptor | undefined = [
          ...(value7?.exports ?? []),
          ...(value7?.handoffs ?? []),
        ].find(
          (input2: Omit<HostExportDescriptor, "handoff">): boolean =>
            input2.format === input && input2.disabled !== true,
        );
        if (value13 === undefined) {
          return false;
        }
        return (
          options2 === undefined ||
          value13.variants?.some(
            (input2: HostCommand): boolean =>
              input2.id === options2 && input2.disabled !== true,
          ) === true
        );
      },
      callback10: (
        input: HostChromeSnapshot | null,
        options2: string,
      ) => void = (input: HostChromeSnapshot | null, options2: string): void => {
        try {
          parentWindow?.postMessage(
            {
              __frame_chrome_report: true,
              snapshot: input,
            },
            options2,
          );
        } catch {}
      },
      callback11: (
        dataset: MessageEvent<HostChromeMessage | null | undefined>,
      ) => void = (
        dataset: MessageEvent<HostChromeMessage | null | undefined>,
      ): void => {
        if (
          parentWindow === null ||
          dataset.source !== parentWindow ||
          !isAllowedHostOrigin(dataset.origin, options.origins)
        ) {
          return;
        }
        let data: HostChromeMessage | null | undefined = dataset.data,
          value13: boolean = data?.__frame_chrome_poke === true,
          value14: boolean = data?.__frame_chrome_cmd === true;
        if (!value13 && !value14) {
          return;
        }
        value = dataset.origin;
        if (data?.rows !== false) {
          flag = true;
        }
        if (value13) {
          values = new Set(normalizeHostTips(data?.words));
        }
        if (value13 && value7 !== null) {
          callback10(value7, dataset.origin);
        }
        callback6();
        if (
          value14 &&
          data?.cmd === "action" &&
          data.id === OPEN_FIND_COMMAND &&
          value7?.actions?.some(
            (input: HostCommand): boolean => input.id === OPEN_FIND_COMMAND,
          )
        ) {
          try {
            value2?.();
          } catch (value15: unknown) {
            if (typeof reportError === "function") {
              reportError(value15);
            } else {
              console.error(value15);
            }
          }
        }
        if (
          value14 &&
          data?.cmd === "action" &&
          data.id === SAVE_NOW_COMMAND &&
          value7?.actions?.some(
            (input: HostCommand): boolean => input.id === SAVE_NOW_COMMAND,
          )
        ) {
          try {
            value9?.();
          } catch (value15: unknown) {
            if (typeof reportError === "function") {
              reportError(value15);
            } else {
              console.error(value15);
            }
          }
        }
        if (value14 && data?.cmd === "action" && typeof data.id === "string") {
          let value15: HostCommand | undefined = value7?.destinations?.find(
            (input: HostCommand): boolean => input.id === data.id,
          );
          if (value15 !== undefined && value15.disabled !== true) {
            try {
              value10?.(data.id);
            } catch (value16: unknown) {
              if (typeof reportError === "function") {
                reportError(value16);
              } else {
                console.error(value16);
              }
            }
          }
        }
        if (value14 && data?.cmd === "export") {
          let {
            format: value15,
            request: value16,
            interactive: value17,
            variant: value18,
            bundle: value19,
            windowMs: value20,
            sender: value21,
          }: HostChromeMessage = data;
          if (
            typeof value15 === "string" &&
            EXPORT_FORMAT_PATTERN.test(value15) &&
            (value18 === undefined ||
              (typeof value18 === "string" &&
                HOST_DESTINATION_PATTERN.test(value18))) &&
            callback9(value15, value18) &&
            typeof value16 === "string" &&
            HOST_REQUEST_ID_PATTERN.test(value16)
          ) {
            try {
              value11?.(
                value15,
                value16,
                value17 === true,
                value18,
                value17 === true && value19 === true,
                validExportTimeout(value20),
                value17 !== true &&
                  (value21 === "viewer" || value21 === "claude")
                  ? value21
                  : undefined,
              );
            } catch (value22: unknown) {
              if (typeof reportError === "function") {
                reportError(value22);
              } else {
                console.error(value22);
              }
            }
          }
        }
      };
    if (parentWindow !== null) {
      options.ownWindow.addEventListener("message", callback11);
      for (let value13 of options.origins) {
        if (value13.endsWith(":*")) {
          continue;
        }
        try {
          parentWindow.postMessage(
            {
              __frame_chrome_hello: true,
            },
            value13,
          );
        } catch {}
      }
    }
    return {
      report(input: HostSaveChrome | null, options2: boolean = false): void {
        if (parentWindow === null) {
          return;
        }
        value3 =
          input === null
            ? null
            : {
                saved: input,
                saveNow: options2,
              };
        callback8();
      },
      setSaveNowHandler(input: (() => void) | null): void {
        value9 = input;
        callback6();
      },
      setDestinations(input: readonly HostCommand[] | null): void {
        if (parentWindow === null) {
          return;
        }
        let value13: HostCommand[] =
          input === null ? [] : normalizeHostCommands(input);
        value5 = value13.length === 0 ? null : value13;
        callback8();
      },
      setDestinationHandler(input: ((id: string) => void) | null): void {
        value10 = input;
      },
      setFoot(input: HostFootState | null): void {
        if (parentWindow === null) {
          return;
        }
        let state: HostFootSnapshot = {};
        if (
          input !== null &&
          typeof input.inset === "number" &&
          Number.isFinite(input.inset)
        ) {
          state.footInset = Math.min(
            Math.max(0, Math.round(input.inset)),
            MAX_HOST_FOOT_INSET,
          );
        }
        let value13: string | null =
          typeof input?.ground === "string" ? input.ground.toLowerCase() : null;
        if (value13 !== null && HOST_BACKGROUND_HEX_PATTERN.test(value13)) {
          state.ground = value13;
        }
        value6 =
          state.footInset === undefined && state.ground === undefined
            ? null
            : state;
        callback8();
      },
      setExports(input: readonly HostExportDescriptor[] | null): void {
        if (parentWindow === null) {
          return;
        }
        let value13: HostExportDescriptor[] =
          input === null ? [] : normalizeHostExportFormats(input);
        value4 = value13.length === 0 ? null : value13;
        callback8();
      },
      setExportHandler(input: HostExportHandler | null): void {
        value11 = input;
      },
      setFind(input: boolean, options2: (() => void) | null): void {
        value2 = options2;
        if (parentWindow === null || flag2 === input) {
          return;
        }
        flag2 = input;
        callback8();
      },
      declineExport(input: string, options2: boolean = false): void {
        if (
          parentWindow === null ||
          value === null ||
          !HOST_REQUEST_ID_PATTERN.test(input)
        ) {
          return;
        }
        try {
          parentWindow.postMessage(
            {
              __frame_chrome_decline: true,
              request: input,
              ...(options2 && {
                cancelled: options2,
              }),
            },
            value,
          );
        } catch {}
      },
      holdLeaveLosesWork(): () => void {
        if (parentWindow === null) {
          return (): void => {
            return;
          };
        }
        let flag3: boolean = false;
        index += 1;
        callback8();
        return (): void => {
          if (flag3) {
            return;
          }
          flag3 = true;
          index -= 1;
          callback8();
        };
      },
      witnessed: (): boolean => flag,
      hostDrawsSave: callback,
      hostDrawsReadOnly: callback2,
      hostDrawsAgentTips: callback3,
      hostTakesRetry: callback4,
      subscribeHostDrawsSave(input: () => void): () => void {
        values2.add(input);
        return (): void => {
          values2.delete(input);
        };
      },
      dispose(): void {
        if (parentWindow !== null) {
          options.ownWindow.removeEventListener("message", callback11);
        }
        values2.clear();
      },
    };
  }
  function isAllowedHostMessageOrigin(origin: string): boolean {
    return isAllowedHostOrigin(origin, allowedHostOrigins);
  }
  function postToHost(
    message: unknown,
    ownWindow: Window = window,
    origins: readonly string[] = allowedHostOrigins,
  ): void {
    if (ownWindow.parent === ownWindow) {
      return;
    }
    let value: string | undefined = ownWindow.location.ancestorOrigins?.[0];
    for (let value2 of value !== undefined &&
    isAllowedHostOrigin(value, origins)
      ? [value]
      : origins) {
      if (value2.endsWith(":*")) {
        continue;
      }
      try {
        ownWindow.parent.postMessage(message, value2);
      } catch {}
    }
  }
  function getHostFrameBridge(): HostFrameBridge {
    if (hostFrameBridge === null) {
      let value: boolean =
        typeof window === "object" && window.parent !== window;
      hostFrameBridge = createHostFrameBridge({
        ownWindow: window,
        parentWindow: value ? window.parent : null,
        origins: allowedHostOrigins,
      });
    }
    return hostFrameBridge;
  }
  function reportToHost(state: HostSaveChrome | null, reason?: boolean): void {
    getHostFrameBridge().report(state, reason);
  }
  function holdHostLeaveWarning(): () => void {
    try {
      if (hostFrameBridge === null && typeof window !== "object") {
        return (): void => {
          return;
        };
      }
      let value: () => void = getHostFrameBridge().holdLeaveLosesWork();
      return (): void => {
        try {
          value();
        } catch {}
      };
    } catch {
      return (): void => {
        return;
      };
    }
  }
  function useHostDestinations(
    destinations: readonly HostCommand[] | null,
    onPress: (id: string) => void,
  ): void {
    let ref = react_z.useRef({
      rows: destinations,
      onPress: onPress,
    });
    ref.current = {
      rows: destinations,
      onPress: onPress,
    };
    let value: string = JSON.stringify(destinations);
    react_z.useEffect((): void => {
      getHostFrameBridge().setDestinations(ref.current.rows);
    }, [value]);
    react_z.useEffect((): (() => void) => {
      getHostFrameBridge().setDestinationHandler((input: string): void =>
        ref.current.onPress(input),
      );
      return (): void => {
        getHostFrameBridge().setDestinationHandler(null);
        getHostFrameBridge().setDestinations(null);
      };
    }, []);
  }
  function setHostFootState(state: HostFootState | null): void {
    hostFootState = state;
    updateHostFoot();
  }
  function updateHostFoot(): void {
    let value: number[] = [...hostFootInsets.values()].filter(
      (input: number): boolean => Number.isFinite(input),
    );
    if (
      typeof hostFootState?.inset === "number" &&
      Number.isFinite(hostFootState.inset)
    ) {
      value.push(hostFootState.inset);
    }
    if (value.length === 0 && hostFootState === null) {
      getHostFrameBridge().setFoot(null);
      return;
    }
    getHostFrameBridge().setFoot({
      ...(value.length > 0 && {
        inset: Math.max(...value),
      }),
      ground: hostFootState?.ground ?? null,
    });
  }
  function setHostExports(
    formats: readonly HostExportDescriptor[] | null,
  ): void {
    getHostFrameBridge().setExports(formats);
  }
  function setHostExportHandler(handler: HostExportHandler | null): void {
    getHostFrameBridge().setExportHandler(handler);
  }
  function declineHostExport(requestId: string, reason?: boolean): void {
    getHostFrameBridge().declineExport(requestId, reason);
  }
  function useHostSaveState(
    status: HostSaveInput | null,
    message?: () => void,
  ): void {
    let ref = react_z.useRef(false),
      value: boolean = status === "loading" && ref.current;
    if (status !== "loading") {
      ref.current = status === "error";
    }
    let value2: HostSaveChrome | null =
        status === null ? null : value ? "saving" : hostSaveStatus(status),
      value3: boolean =
        message !== undefined && (status === "error" || status === "dirty"),
      ref2 = react_z.useRef(message);
    ref2.current = message;
    react_z.useEffect((): void => {
      reportToHost(value2, value3);
    }, [value2, value3]);
    react_z.useEffect((): (() => void) => {
      getHostFrameBridge().setSaveNowHandler((): void => ref2.current?.());
      return (): void => {
        getHostFrameBridge().setSaveNowHandler(null);
        reportToHost(null);
      };
    }, []);
  }
  function useHostFindCommand(enabled: boolean, onOpen: () => void): void {
    let ref = react_z.useRef(onOpen);
    ref.current = onOpen;
    react_z.useEffect((): (() => void) => {
      getHostFrameBridge().setFind(enabled, (): void => ref.current());
      return (): void => getHostFrameBridge().setFind(false, null);
    }, [enabled]);
  }
  function hostDrawsSave(): boolean {
    return getHostFrameBridge().hostDrawsSave();
  }
  function hostDrawsReadOnly(): boolean {
    return getHostFrameBridge().hostDrawsReadOnly();
  }
  function useHostDrawsAgentTips(): boolean {
    return react_z.useSyncExternalStore(
      subscribeHostSaveChrome,
      (): boolean => getHostFrameBridge().hostDrawsAgentTips(),
      (): boolean => false,
    );
  }
  function hostTakesRetry(): boolean {
    return getHostFrameBridge().hostTakesRetry();
  }
  function subscribeHostSaveChrome(listener: () => void): () => void {
    return getHostFrameBridge().subscribeHostDrawsSave(listener);
  }
  bindRuntimeValue(
    runtime,
    "react_z",
    () => react_z,
    (value) => {
      react_z = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SAVE_NOW_COMMAND",
    () => SAVE_NOW_COMMAND,
    (value) => {
      SAVE_NOW_COMMAND = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OPEN_FIND_COMMAND",
    () => OPEN_FIND_COMMAND,
    (value) => {
      OPEN_FIND_COMMAND = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EXPORT_FORMAT_PATTERN",
    () => EXPORT_FORMAT_PATTERN,
    (value) => {
      EXPORT_FORMAT_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "validExportTimeout",
    () => validExportTimeout,
    (value) => {
      validExportTimeout = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_HOST_EXPORT_FORMATS",
    () => MAX_HOST_EXPORT_FORMATS,
    (value) => {
      MAX_HOST_EXPORT_FORMATS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOST_DESTINATION_PATTERN",
    () => HOST_DESTINATION_PATTERN,
    (value) => {
      HOST_DESTINATION_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_HOST_DESTINATIONS",
    () => MAX_HOST_DESTINATIONS,
    (value) => {
      MAX_HOST_DESTINATIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOST_REQUEST_ID_PATTERN",
    () => HOST_REQUEST_ID_PATTERN,
    (value) => {
      HOST_REQUEST_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOST_COMMAND_PATTERN",
    () => HOST_COMMAND_PATTERN,
    (value) => {
      HOST_COMMAND_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_HOST_COMMANDS",
    () => MAX_HOST_COMMANDS,
    (value) => {
      MAX_HOST_COMMANDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_HOST_FOOT_INSET",
    () => MAX_HOST_FOOT_INSET,
    (value) => {
      MAX_HOST_FOOT_INSET = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOST_BACKGROUND_HEX_PATTERN",
    () => HOST_BACKGROUND_HEX_PATTERN,
    (value) => {
      HOST_BACKGROUND_HEX_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeHostBackgroundColor",
    () => normalizeHostBackgroundColor,
  );
  bindRuntimeValue(
    runtime,
    "readHostBackgroundColor",
    () => readHostBackgroundColor,
  );
  bindRuntimeValue(runtime, "hostSaveStatus", () => hostSaveStatus);
  bindRuntimeValue(
    runtime,
    "DEFAULT_HOST_ORIGINS",
    () => DEFAULT_HOST_ORIGINS,
    (value) => {
      DEFAULT_HOST_ORIGINS = value;
    },
  );
  bindRuntimeValue(runtime, "hostOrigins", () => hostOrigins);
  bindRuntimeValue(runtime, "isAllowedHostOrigin", () => isAllowedHostOrigin);
  bindRuntimeValue(
    runtime,
    "normalizeHostExportFormats",
    () => normalizeHostExportFormats,
  );
  bindRuntimeValue(
    runtime,
    "normalizeHostDestinations",
    () => normalizeHostDestinations,
  );
  bindRuntimeValue(
    runtime,
    "normalizeHostCommands",
    () => normalizeHostCommands,
  );
  bindRuntimeValue(runtime, "normalizeHostTips", () => normalizeHostTips);
  bindRuntimeValue(
    runtime,
    "createHostFrameBridge",
    () => createHostFrameBridge,
  );
  bindRuntimeValue(
    runtime,
    "allowedHostOrigins",
    () => allowedHostOrigins,
    (value) => {
      allowedHostOrigins = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isAllowedHostMessageOrigin",
    () => isAllowedHostMessageOrigin,
  );
  bindRuntimeValue(runtime, "postToHost", () => postToHost);
  bindRuntimeValue(
    runtime,
    "hostFrameBridge",
    () => hostFrameBridge,
    (value) => {
      hostFrameBridge = value;
    },
  );
  bindRuntimeValue(runtime, "getHostFrameBridge", () => getHostFrameBridge);
  bindRuntimeValue(runtime, "reportToHost", () => reportToHost);
  bindRuntimeValue(runtime, "holdHostLeaveWarning", () => holdHostLeaveWarning);
  bindRuntimeValue(runtime, "useHostDestinations", () => useHostDestinations);
  bindRuntimeValue(
    runtime,
    "hostFootState",
    () => hostFootState,
    (value) => {
      hostFootState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hostFootInsets",
    () => hostFootInsets,
    (value) => {
      hostFootInsets = value;
    },
  );
  bindRuntimeValue(runtime, "setHostFootState", () => setHostFootState);
  bindRuntimeValue(runtime, "updateHostFoot", () => updateHostFoot);
  bindRuntimeValue(runtime, "setHostExports", () => setHostExports);
  bindRuntimeValue(runtime, "setHostExportHandler", () => setHostExportHandler);
  bindRuntimeValue(runtime, "declineHostExport", () => declineHostExport);
  bindRuntimeValue(runtime, "useHostSaveState", () => useHostSaveState);
  bindRuntimeValue(runtime, "useHostFindCommand", () => useHostFindCommand);
  bindRuntimeValue(runtime, "hostDrawsSave", () => hostDrawsSave);
  bindRuntimeValue(runtime, "hostDrawsReadOnly", () => hostDrawsReadOnly);
  bindRuntimeValue(
    runtime,
    "useHostDrawsAgentTips",
    () => useHostDrawsAgentTips,
  );
  bindRuntimeValue(runtime, "hostTakesRetry", () => hostTakesRetry);
  bindRuntimeValue(
    runtime,
    "subscribeHostSaveChrome",
    () => subscribeHostSaveChrome,
  );
  return () => {
    react_z = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    SAVE_NOW_COMMAND = "save_now";
    OPEN_FIND_COMMAND = "open_find";
    EXPORT_FORMAT_PATTERN = /^[a-z0-9]{1,8}$/;
    validExportTimeout = (value: unknown): number | undefined =>
      typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value > 5000 &&
      value <= 900000
        ? value
        : undefined;
    MAX_HOST_EXPORT_FORMATS = 8;
    HOST_DESTINATION_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
    MAX_HOST_DESTINATIONS = 8;
    HOST_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
    HOST_COMMAND_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
    MAX_HOST_COMMANDS = 8;
    MAX_HOST_FOOT_INSET = 9999;
    HOST_BACKGROUND_HEX_PATTERN = /^#[0-9a-f]{6}$/;
    // CucCut: no host frame is trusted by default; the editor talks to CucCut through its own shim
    // (packages/slides/src/editor). A page that needs this bridge declares origins in __FRAME_PREAMBLE.
    DEFAULT_HOST_ORIGINS = [];
    allowedHostOrigins = ((): readonly string[] => {
      try {
        if (typeof window === "object") {
          return hostOrigins(window);
        } else {
          return DEFAULT_HOST_ORIGINS;
        }
      } catch {
        return DEFAULT_HOST_ORIGINS;
      }
    })();
    hostFrameBridge = null;
    hostFootState = null;
    hostFootInsets = new Map();
  };
}
