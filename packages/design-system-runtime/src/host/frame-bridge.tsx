import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installHostFrameBridge(runtime: RuntimeBindings): () => void {
  var react_z: typeof React;
  var SAVE_NOW_COMMAND: string;
  var OPEN_FIND_COMMAND: string;
  var EXPORT_FORMAT_PATTERN: RegExp;
  var validExportTimeout: (input: unknown) => number | undefined;
  var MAX_HOST_EXPORT_FORMATS: number;
  var HOST_DESTINATION_PATTERN: RegExp;
  var MAX_HOST_DESTINATIONS: number;
  var HOST_REQUEST_ID_PATTERN: RegExp;
  var HOST_COMMAND_PATTERN: RegExp;
  var MAX_HOST_COMMANDS: number;
  var MAX_HOST_FOOT_INSET: number;
  var HOST_BACKGROUND_HEX_PATTERN: RegExp;
  var DEFAULT_HOST_ORIGINS: string[];
  var allowedHostOrigins: string[];
  var hostFrameBridge: Host.HostFrameBridge | null;
  function hostSaveStatus(
    status: Host.SaveState["status"],
  ): null | string | undefined {
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
  function hostOrigins(ownWindow: Host.ProtocolGlobal): string[] {
    let value = ownWindow.__FRAME_PREAMBLE?.origins;
    if (Array.isArray(value)) {
      return (value as unknown[]).filter(
        (input: unknown): input is string => typeof input === "string",
      );
    }
    return DEFAULT_HOST_ORIGINS;
  }
  function isAllowedHostOrigin(
    origin: string,
    allowedOrigins: readonly string[],
  ): boolean {
    for (let value of allowedOrigins) {
      if (value.endsWith(":*")) {
        try {
          let value2 = new URL(origin);
          if (`${value2.protocol}//${value2.hostname}:*` === value) {
            return true;
          }
        } catch {}
      } else if (origin === value) {
        return true;
      }
    }
    return false;
  }
  function normalizeHostExportFormats(
    formats: readonly {
      format?: unknown;
      disabled?: unknown;
      handoff?: unknown;
      interactive?: unknown;
      bundle?: unknown;
      variants?: unknown;
    }[],
  ): Host.HostExport[] {
    let items = [],
      values = new Set();
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
        state: Host.HostExport = {
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
        value3 =
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
    destinations: readonly (
      | {
          id?: unknown;
          disabled?: unknown;
        }
      | null
      | undefined
    )[],
  ): Host.HostDestination[] {
    let items = [],
      values = new Set();
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
    commands: readonly {
      id?: unknown;
      disabled?: unknown;
    }[],
  ): Host.HostDestination[] {
    let items = [],
      values = new Set();
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
      tips.every((input: unknown): input is string => typeof input === "string")
    ) {
      return tips;
    } else {
      return [];
    }
  }
  function createHostFrameBridge(
    options: Host.HostFrameOptions,
  ): Host.HostFrameBridge {
    let parentWindow = options.parentWindow,
      hostOrigin: string | null = null,
      hostAcknowledgedRows: boolean = false,
      hostChromeWords = new Set<string>(),
      findEnabled = false,
      findHandler: (() => void) | null = null,
      saveReport: {
        saved: string | null | undefined;
        saveNow: boolean;
      } | null = null,
      exportFormats: Host.HostExport[] | null = null,
      destinations: Host.HostDestination[] | null = null,
      footerReport: Host.HostFoot | null = null,
      unsavedLeaveHolds = 0,
      currentSnapshot: Host.HostSnapshot | null = null,
      previousSnapshotJson: string | undefined,
      saveNowHandler: (() => void) | null = null,
      destinationHandler: ((id: string) => void) | null = null,
      exportHandler: Host.HostExportHandler | null = null,
      hostChromeListeners = new Set<() => void>(),
      hostDrawsSave2 = () =>
        hostAcknowledgedRows && currentSnapshot?.saved !== undefined,
      hostDrawsReadOnly2 = () =>
        hostAcknowledgedRows &&
        hostChromeWords.has("readonly") &&
        currentSnapshot?.saved === "readonly",
      hostDrawsClaudeTips = () =>
        hostAcknowledgedRows && hostChromeWords.has("claude_tips"),
      hostTakesRetry2 = () =>
        hostDrawsSave2() &&
        saveNowHandler !== null &&
        currentSnapshot?.actions?.some(
          (input): boolean => input.id === SAVE_NOW_COMMAND,
        ) === true,
      hostChromeStateKey = (): string =>
        String(hostDrawsSave2()) +
        String(hostTakesRetry2()) +
        String(hostDrawsReadOnly2()) +
        String(hostDrawsClaudeTips()),
      previousHostChromeStateKey = hostChromeStateKey(),
      notifyHostChromeChanged = (): void => {
        let value = hostChromeStateKey();
        if (value === previousHostChromeStateKey) {
          return;
        }
        previousHostChromeStateKey = value;
        for (let value2 of hostChromeListeners) {
          try {
            value2();
          } catch {}
        }
      },
      buildChromeSnapshot = () => {
        if (
          saveReport === null &&
          exportFormats === null &&
          destinations === null &&
          footerReport === null &&
          unsavedLeaveHolds === 0
        ) {
          return null;
        }
        let state: Host.HostSnapshot = {
          v: 1,
        };
        if (saveReport !== null) {
          state.saved = saveReport.saved;
          state.actions = saveReport.saveNow
            ? [
                {
                  id: SAVE_NOW_COMMAND,
                },
              ]
            : [];
        }
        if (unsavedLeaveHolds > 0) {
          state.leaveLosesWork = true;
        }
        let value =
            exportFormats?.filter((input): boolean => input.handoff !== true) ??
            [],
          value2 =
            exportFormats
              ?.filter((input): boolean => input.handoff === true)
              .map(({ handoff: handoff, ...props }) => props) ?? [];
        if (value.length > 0) {
          state.exports = value;
        }
        if (value2.length > 0) {
          state.handoffs = value2;
        }
        if (destinations !== null) {
          state.destinations = destinations;
        }
        if (footerReport?.footInset !== undefined) {
          state.footInset = footerReport.footInset;
        }
        if (footerReport?.ground !== undefined) {
          state.ground = footerReport.ground;
        }
        return state;
      },
      refreshChromeSnapshot = (): void => {
        let value = buildChromeSnapshot(),
          value2 = value ?? {
            v: 1,
          },
          value3 = findEnabled
            ? {
                ...value2,
                actions: [
                  ...(value2.actions ?? []),
                  {
                    id: OPEN_FIND_COMMAND,
                  },
                ],
              }
            : value,
          value4 = JSON.stringify(value3);
        if (value4 === previousSnapshotJson) {
          return;
        }
        currentSnapshot = value3;
        previousSnapshotJson = value4;
        if (hostOrigin !== null) {
          sendChromeSnapshot(value3, hostOrigin);
        }
        notifyHostChromeChanged();
      },
      exportVariantIsEnabled = (input: string, options2?: string) => {
        let value = [
          ...(currentSnapshot?.exports ?? []),
          ...(currentSnapshot?.handoffs ?? []),
        ].find((input2) => input2.format === input && input2.disabled !== true);
        if (value === undefined) {
          return false;
        }
        return (
          options2 === undefined ||
          value.variants?.some(
            (input2) => input2.id === options2 && input2.disabled !== true,
          ) === true
        );
      },
      sendChromeSnapshot = (
        input: Host.HostSnapshot | null,
        options2: string,
      ): void => {
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
      handleHostChromeMessage = (dataset: MessageEvent<unknown>): void => {
        if (
          parentWindow === null ||
          dataset.source !== parentWindow ||
          !isAllowedHostOrigin(dataset.origin, options.origins)
        ) {
          return;
        }
        let data = dataset.data as Host.HostIncomingData | null | undefined,
          value: boolean = data?.__frame_chrome_poke === true,
          value2: boolean = data?.__frame_chrome_cmd === true;
        if (!value && !value2) {
          return;
        }
        hostOrigin = dataset.origin;
        if (data?.rows !== false) {
          hostAcknowledgedRows = true;
        }
        if (value) {
          hostChromeWords = new Set(normalizeHostTips(data?.words));
        }
        if (value && currentSnapshot !== null) {
          sendChromeSnapshot(currentSnapshot, dataset.origin);
        }
        notifyHostChromeChanged();
        if (
          value2 &&
          data?.cmd === "action" &&
          data.id === OPEN_FIND_COMMAND &&
          currentSnapshot?.actions?.some(
            (input): boolean => input.id === OPEN_FIND_COMMAND,
          )
        ) {
          try {
            findHandler?.();
          } catch (value3: unknown) {
            if (typeof reportError === "function") {
              reportError(value3);
            } else {
              console.error(value3);
            }
          }
        }
        if (
          value2 &&
          data?.cmd === "action" &&
          data.id === SAVE_NOW_COMMAND &&
          currentSnapshot?.actions?.some(
            (input): boolean => input.id === SAVE_NOW_COMMAND,
          )
        ) {
          try {
            saveNowHandler?.();
          } catch (value3: unknown) {
            if (typeof reportError === "function") {
              reportError(value3);
            } else {
              console.error(value3);
            }
          }
        }
        if (value2 && data?.cmd === "action" && typeof data.id === "string") {
          let value3 = currentSnapshot?.destinations?.find(
            (input): boolean => input.id === data.id,
          );
          if (value3 !== undefined && value3.disabled !== true) {
            try {
              destinationHandler?.(data.id);
            } catch (value4: unknown) {
              if (typeof reportError === "function") {
                reportError(value4);
              } else {
                console.error(value4);
              }
            }
          }
        }
        if (value2 && data?.cmd === "export") {
          let {
            format: value3,
            request: value4,
            interactive: value5,
            variant: value6,
            bundle: value7,
            windowMs: value8,
            sender: value9,
          } = data;
          if (
            typeof value3 === "string" &&
            EXPORT_FORMAT_PATTERN.test(value3) &&
            (value6 === undefined ||
              (typeof value6 === "string" &&
                HOST_DESTINATION_PATTERN.test(value6))) &&
            exportVariantIsEnabled(value3, value6) &&
            typeof value4 === "string" &&
            HOST_REQUEST_ID_PATTERN.test(value4)
          ) {
            try {
              exportHandler?.(
                value3,
                value4,
                value5 === true,
                value6,
                value5 === true && value7 === true,
                validExportTimeout(value8),
                value5 !== true && (value9 === "viewer" || value9 === "claude")
                  ? value9
                  : undefined,
              );
            } catch (value10: unknown) {
              if (typeof reportError === "function") {
                reportError(value10);
              } else {
                console.error(value10);
              }
            }
          }
        }
      };
    if (parentWindow !== null) {
      options.ownWindow.addEventListener("message", handleHostChromeMessage);
      for (let value of options.origins) {
        if (value.endsWith(":*")) {
          continue;
        }
        try {
          parentWindow.postMessage(
            {
              __frame_chrome_hello: true,
            },
            value,
          );
        } catch {}
      }
    }
    return {
      report(input, options2 = false): void {
        if (parentWindow === null) {
          return;
        }
        saveReport =
          input === null
            ? null
            : {
                saved: input,
                saveNow: options2,
              };
        refreshChromeSnapshot();
      },
      setSaveNowHandler(input): void {
        saveNowHandler = input;
        notifyHostChromeChanged();
      },
      setDestinations(input): void {
        if (parentWindow === null) {
          return;
        }
        let value = input === null ? [] : normalizeHostCommands(input);
        destinations = value.length === 0 ? null : value;
        refreshChromeSnapshot();
      },
      setDestinationHandler(input): void {
        destinationHandler = input;
      },
      setFoot(input): void {
        if (parentWindow === null) {
          return;
        }
        let state: Host.HostFoot = {};
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
        let value =
          typeof input?.ground === "string" ? input.ground.toLowerCase() : null;
        if (value !== null && HOST_BACKGROUND_HEX_PATTERN.test(value)) {
          state.ground = value;
        }
        footerReport =
          state.footInset === undefined && state.ground === undefined
            ? null
            : state;
        refreshChromeSnapshot();
      },
      setExports(input): void {
        if (parentWindow === null) {
          return;
        }
        let value = input === null ? [] : normalizeHostExportFormats(input);
        exportFormats = value.length === 0 ? null : value;
        refreshChromeSnapshot();
      },
      setExportHandler(input): void {
        exportHandler = input;
      },
      setFind(input, options2): void {
        findHandler = options2;
        if (parentWindow === null || findEnabled === input) {
          return;
        }
        findEnabled = input;
        refreshChromeSnapshot();
      },
      declineExport(input, options2 = false): void {
        if (
          parentWindow === null ||
          hostOrigin === null ||
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
            hostOrigin,
          );
        } catch {}
      },
      holdLeaveLosesWork() {
        if (parentWindow === null) {
          return (): void => {
            return;
          };
        }
        let flag: boolean = false;
        unsavedLeaveHolds += 1;
        refreshChromeSnapshot();
        return (): void => {
          if (flag) {
            return;
          }
          flag = true;
          unsavedLeaveHolds -= 1;
          refreshChromeSnapshot();
        };
      },
      witnessed: (): boolean => hostAcknowledgedRows,
      hostDrawsSave: hostDrawsSave2,
      hostDrawsReadOnly: hostDrawsReadOnly2,
      hostDrawsClaudeTips: hostDrawsClaudeTips,
      hostTakesRetry: hostTakesRetry2,
      subscribeHostDrawsSave(input) {
        hostChromeListeners.add(input);
        return (): void => {
          hostChromeListeners.delete(input);
        };
      },
      dispose(): void {
        if (parentWindow !== null) {
          options.ownWindow.removeEventListener(
            "message",
            handleHostChromeMessage,
          );
        }
        hostChromeListeners.clear();
      },
    };
  }
  function getHostFrameBridge(): Host.HostFrameBridge {
    if (hostFrameBridge === null) {
      let value =
        typeof window === "object" &&
        (window as Host.ProtocolGlobal).parent !== window;
      hostFrameBridge = createHostFrameBridge({
        ownWindow: window,
        parentWindow: value ? (window as Host.ProtocolGlobal).parent : null,
        origins: allowedHostOrigins,
      });
    }
    return hostFrameBridge;
  }
  function reportToHost(
    state: string | null | undefined,
    reason?: boolean,
  ): void {
    getHostFrameBridge().report(state, reason);
  }
  function useHostSaveState(
    status: Host.SaveState["status"] | null,
    message?: () => void,
  ): void {
    let ref = react_z.useRef(false),
      value = status === "loading" && ref.current;
    if (status !== "loading") {
      ref.current = status === "error";
    }
    let value2 =
        status === null ? null : value ? "saving" : hostSaveStatus(status),
      value3 =
        message !== undefined && (status === "error" || status === "dirty"),
      ref2 = react_z.useRef(message);
    ref2.current = message;
    react_z.useEffect((): void => {
      reportToHost(value2, value3);
    }, [value2, value3]);
    react_z.useEffect(() => {
      getHostFrameBridge().setSaveNowHandler(() => ref2.current?.());
      return (): void => {
        getHostFrameBridge().setSaveNowHandler(null);
        reportToHost(null);
      };
    }, []);
  }
  function hostDrawsSave(): boolean {
    return getHostFrameBridge().hostDrawsSave();
  }
  function hostDrawsReadOnly(): boolean {
    return getHostFrameBridge().hostDrawsReadOnly();
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
    "hostFrameBridge",
    () => hostFrameBridge,
    (value) => {
      hostFrameBridge = value;
    },
  );
  bindRuntimeValue(runtime, "getHostFrameBridge", () => getHostFrameBridge);
  bindRuntimeValue(runtime, "reportToHost", () => reportToHost);
  bindRuntimeValue(runtime, "useHostSaveState", () => useHostSaveState);
  bindRuntimeValue(runtime, "hostDrawsSave", () => hostDrawsSave);
  bindRuntimeValue(runtime, "hostDrawsReadOnly", () => hostDrawsReadOnly);
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
    validExportTimeout = (value) =>
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
    // CucCut: no host frame origin is trusted by default. The editor talks to CucCut through its own shim
    // (packages/design-system/src/editor), not this frame bridge; a page that needs the bridge declares its
    // origins in __FRAME_PREAMBLE.
    DEFAULT_HOST_ORIGINS = [];
    allowedHostOrigins = (() => {
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
  };
}
