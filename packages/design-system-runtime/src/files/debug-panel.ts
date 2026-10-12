import type * as Debug from "../contracts/debug-panel";
import type * as Core from "../contracts/files-core";
import type * as Model from "../contracts";
import type * as Host from "../contracts/platform-host";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesDebugPanel(runtime: RuntimeBindings): () => void {
  var FILES_DEBUG_REFRESH_MS: number;
  var FILES_DEBUG_EVENT_STAGGER_MS: number;
  var FILES_DEBUG_VIEW_REFRESH_MS: number;
  var FILES_DEBUG_PANEL_DEFAULT_SIZE: Record<Debug.DebugSide, number>;
  var FILES_DEBUG_PANEL_MIN_SIZE: Record<Debug.DebugSide, number>;
  var FILES_DEBUG_TOGGLE_SHORTCUT: string;
  var createFilesDebugTabId: () => string;
  var formatFilesDebugTimestamp: (timestamp: number) => string;
  var shortDebugValue: (value: string | null | undefined) => string;
  function filesDebugEnabled(
    getStorage: () => Pick<Storage, "getItem"> | null | undefined = () =>
      globalThis.localStorage,
  ): boolean {
    try {
      return getStorage()?.getItem("appifact-files-debug") === "1";
    } catch {
      return false;
    }
  }
  function filesModeDebugEnabled(
    mode: string,
    storage?: () => Pick<Storage, "getItem"> | null | undefined,
  ): boolean {
    return mode === "files" && filesDebugEnabled(storage);
  }
  function sortedSampleQuantile(
    sortedSamples: readonly number[],
    quantile: number,
  ): number {
    if (sortedSamples.length === 0) {
      return NaN;
    }
    return sortedSamples[
      Math.min(
        sortedSamples.length - 1,
        Math.floor((sortedSamples.length - 1) * quantile + 0.5),
      )
    ];
  }
  function filesDebugEventLevel(
    input: Debug.DebugEvent,
  ): Debug.DebugEventLevel {
    let type = input.type;
    if (
      type === "hot-restart" ||
      type === "save-conflict" ||
      type === "save-error" ||
      type === "publish-raw-error" ||
      type === "restart-asked"
    ) {
      return "error";
    }
    if (type === "read") {
      let value =
        (input.data as Debug.DebugEventData | undefined)?.status ?? 200;
      if (value === 0 || value >= 400) {
        return "error";
      } else {
        return "boot";
      }
    }
    if (type === "reconcile") {
      if ((input.data as Debug.DebugEventData | undefined)?.ok === false) {
        return "error";
      } else {
        return "hot";
      }
    }
    if (
      type.startsWith("hot-") ||
      type === "apply" ||
      type === "visible" ||
      type === "board-remote" ||
      type === "reveal-held" ||
      type === "reconcile-choice"
    ) {
      return "hot";
    }
    if (type.startsWith("save-") || type === "notice") {
      return "save";
    }
    if (type.startsWith("boot") || type === "listing-retried") {
      return "boot";
    }
    if (type.startsWith("peer-") || type === "visibility") {
      return "room";
    }
    return "other";
  }
  function createFilesDebugPanel(
    options: Core.FilesDebuggerOptions,
  ): Core.FilesDebugger {
    let storagePrefix: string = "hotdbg/" + options.product + "/",
      storage = (() => {
        try {
          if (typeof sessionStorage === "undefined") {
            return null;
          } else {
            return sessionStorage;
          }
        } catch {
          return null;
        }
      })(),
      readStored = <Key extends keyof Debug.DebugStoredValues>(
        input: Key,
        options2: Debug.DebugStoredValues[Key],
      ): Debug.DebugStoredValues[Key] => {
        try {
          let value = storage?.getItem(storagePrefix + input);
          if (value === null || value === undefined) {
            return options2;
          } else {
            return JSON.parse(value) as unknown as Debug.DebugStoredValues[Key];
          }
        } catch {
          return options2;
        }
      },
      writeStored = (input: string, options2: unknown): void => {
        try {
          if (options2 === null) {
            storage?.removeItem(storagePrefix + input);
          } else {
            storage?.setItem(storagePrefix + input, JSON.stringify(options2));
          }
        } catch {}
      },
      clockNow = () =>
        typeof performance !== "undefined" ? performance.now() : Date.now(),
      hot = (options.hot ?? null) as
        | (Host.HotCapability & { from?: unknown })
        | null,
      tabId = readStored("tab", "") || createFilesDebugTabId();
    writeStored("tab", tabId);
    let bootStartedAt = options.bootStartedAt ?? clockNow(),
      eventLog = readStored("log", []),
      fields = new Map<string, unknown>(),
      timingSamples = new Map<string, number[]>(),
      visibilitySeries: Debug.DebugVisibilitySample[] = [],
      lastVersionByPath = new Map<string, string | undefined>(),
      hiddenSamplesExcluded = 0,
      lastUpdateRestarted: boolean = false,
      providers: Core.DebugProviders = {},
      errorCounts = {
        conflict: 0,
        rate: 0,
        other: 0,
      },
      lastPublish: Debug.DebugLastPublish | undefined,
      publishErrors: Debug.DebugPublishError[] = [],
      restartBreadcrumb = readStored("crumb", null),
      loadedBefore = readStored("seen", false),
      cameFromHotRestart = false,
      hotFrom: unknown;
    try {
      hotFrom = hot?.from;
      cameFromHotRestart = hotFrom !== null && hotFrom !== undefined;
    } catch {}
    let hotRestartNote = (() => {
        let value = (hotFrom as { note?: unknown } | null | undefined)?.note;
        if (typeof value === "string") {
          return value;
        } else {
          return undefined;
        }
      })(),
      reloadReason: string;
    if (restartBreadcrumb?.phase === "hot-restart") {
      reloadReason =
        "hot restart: " + (restartBreadcrumb.reason ?? "asked by this page");
    } else if (restartBreadcrumb?.phase === "publishing") {
      reloadReason =
        "reloaded during a publish of " +
        (restartBreadcrumb.paths ?? []).join(", ") +
        " (likely a conflict: the shell reboots the tab that lost)";
    } else if (cameFromHotRestart) {
      reloadReason =
        "hot restart by the shell" +
        (hotRestartNote !== undefined
          ? " (note: " + hotRestartNote + ")"
          : " (no reason recorded here: no accept handler was registered in time, or the kernel restarted on its own)");
    } else if (loadedBefore) {
      reloadReason = "plain reload";
    } else {
      reloadReason = "first load";
    }
    let reloadReasonKey: string =
        restartBreadcrumb?.phase === "hot-restart"
          ? "hot restart: " + (restartBreadcrumb.reason ?? "?")
          : restartBreadcrumb?.phase === "publishing"
            ? "during a publish"
            : cameFromHotRestart
              ? "hot restart by the shell"
              : loadedBefore
                ? "plain reload"
                : "first load",
      reasonCounts = readStored("reasons", {});
    reasonCounts[reloadReasonKey] = (reasonCounts[reloadReasonKey] ?? 0) + 1;
    writeStored("reasons", reasonCounts);
    let reloadHistory = readStored("reloads", []);
    reloadHistory.push({
      t: Date.now(),
      reason: reloadReason,
    });
    if (reloadHistory.length > 60) {
      reloadHistory.splice(0, reloadHistory.length - 60);
    }
    writeStored("reloads", reloadHistory);
    writeStored("crumb", null);
    writeStored("seen", true);
    let debugOptions = new Map<string, Debug.DebugToggle>();
    function option(input: string, options2: string): () => boolean {
      if (!debugOptions.has(input)) {
        debugOptions.set(input, {
          label: options2,
          on: readStored(("opt/" + input) as `opt/${string}`, true),
        });
      }
      return () => debugOptions.get(input)?.on ?? true;
    }
    let logPersistTimer: ReturnType<typeof setTimeout> | undefined,
      persistLog = false,
      schedulePersistLog = (): void => {
        if (!persistLog || logPersistTimer !== undefined) {
          return;
        }
        logPersistTimer = setTimeout((): void => {
          logPersistTimer = undefined;
          if (persistLog) {
            writeStored("log", eventLog.slice(-FILES_DEBUG_EVENT_STAGGER_MS));
          }
        }, 250);
      };
    function recordEvent(input: string, options2?: unknown): void {
      eventLog.push({
        t: Date.now(),
        type: input,
        ...(options2 !== undefined
          ? {
              data: options2,
            }
          : {}),
      });
      if (eventLog.length > FILES_DEBUG_REFRESH_MS) {
        eventLog.splice(0, eventLog.length - FILES_DEBUG_REFRESH_MS);
      }
      schedulePersistLog();
      invalidateView("events");
    }
    function recordTiming(input: string, options2: number): void {
      if (!Number.isFinite(options2)) {
        return;
      }
      let value = timingSamples.get(input) ?? [];
      value.push(Math.round(options2));
      if (value.length > 300) {
        value.shift();
      }
      timingSamples.set(input, value);
      invalidateView("timing");
    }
    let documentHidden = () =>
        typeof document !== "undefined" &&
        document.visibilityState !== "visible",
      hiddenSince: number | undefined = documentHidden()
        ? Date.now()
        : undefined;
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", (): void => {
        hiddenSince = documentHidden() ? Date.now() : undefined;
        recordEvent("visibility", {
          state: document.visibilityState,
        });
      });
    }
    let roomTopic: string = "hotdbg-" + options.product,
      peerPings = readStored("pings", []),
      prunePeerPings = (): void => {
        peerPings = peerPings
          .filter((input): boolean => Date.now() - input.recvAt < 60000)
          .slice(-40);
        writeStored("pings", peerPings);
      };
    function receivePeerPing(input: unknown): void {
      let value = ((input as { data?: unknown } | null | undefined)?.data ??
        input) as Debug.DebugPeerWire | null;
      if (
        value === null ||
        typeof value !== "object" ||
        typeof value.tab !== "string" ||
        value.tab === tabId ||
        typeof value.n !== "number" ||
        typeof value.at !== "number"
      ) {
        return;
      }
      let state: Debug.DebugPeerPing = {
        tab: value.tab,
        n: value.n,
        phase: value.phase === "saved" ? "saved" : "saving",
        ...(typeof value.version === "string"
          ? {
              version: value.version,
            }
          : {}),
        at: value.at,
        recvAt: Date.now(),
        ...(Array.isArray(value.paths)
          ? {
              paths: value.paths as unknown[],
            }
          : {}),
      };
      peerPings.push(state);
      prunePeerPings();
      recordTiming("room ping", Math.max(0, state.recvAt - state.at));
      recordEvent("peer-" + state.phase, {
        from: state.tab,
        n: state.n,
        ...(state.version !== undefined
          ? {
              version: state.version,
            }
          : {}),
        ...(state.paths !== undefined
          ? {
              paths: state.paths,
            }
          : {}),
        skewedMs: state.recvAt - state.at,
      });
      refreshStatus();
    }
    let room: Debug.DebugRoom | null = null,
      usePresenceFallback: boolean = false;
    if (options.room !== false) {
      (0, runtime.cachedClaudeRoom)().then(
        (input): void => {
          room = input as Debug.DebugRoom | null;
          fields.set("room", room === null ? "off" : "connected");
          invalidateView("header");
          if (room === null) {
            return;
          }
          try {
            room.on?.(roomTopic, receivePeerPing, (): void => {
              return;
            });
          } catch {}
          let entries = new Map<string, number>();
          try {
            room.onPeers?.((input2): void => {
              for (let value of input2.peers) {
                let value2 = value as Debug.DebugRoomPeer | null,
                  value3 = value2?.presence?.hotdbg;
                if (
                  value2 === null ||
                  value2.sameTab === true ||
                  value3 === undefined ||
                  typeof value3.tab !== "string" ||
                  typeof value3.n !== "number"
                ) {
                  continue;
                }
                let value4: string = value3.tab + "/" + String(value3.phase);
                if ((entries.get(value4) ?? -1) >= value3.n) {
                  continue;
                }
                entries.set(value4, value3.n);
                if (
                  !peerPings.some(
                    (input3) =>
                      input3.tab === value3.tab &&
                      input3.n === value3.n &&
                      input3.phase ===
                        (value3.phase === "saved" ? "saved" : "saving"),
                  )
                ) {
                  receivePeerPing(value3);
                }
              }
            });
          } catch {}
        },
        (): void => {
          return;
        },
      );
    }
    function sendPeerPing(input: Debug.DebugPingInput): void {
      let state: Debug.DebugPingSent = {
          tab: tabId,
          at: Date.now(),
          ...input,
        },
        value = room;
      if (value === null) {
        return;
      }
      let callback = (): void => {
        usePresenceFallback = true;
        try {
          value
            .presence?.({
              hotdbg: state,
            })
            ?.catch?.((): void => {
              return;
            });
        } catch {}
      };
      if (usePresenceFallback || typeof value.emit !== "function") {
        return callback();
      }
      try {
        value.emit(roomTopic, state).catch(callback);
      } catch {
        callback();
      }
    }
    let publishCount = readStored("saveN", 0),
      inFlightPublishes = new Map<number, Debug.DebugPublish>(),
      safeDebugValue = (input: unknown): unknown => {
        try {
          return JSON.parse(
            JSON.stringify(input, (input2: string, items: unknown) =>
              typeof items === "string" && items.length > 300
                ? items.slice(0, 300) + "…"
                : items,
            ),
          );
        } catch {
          return String(input);
        }
      };
    function saveStart(input: string[], options2: number): number {
      publishCount += 1;
      writeStored("saveN", publishCount);
      inFlightPublishes.set(publishCount, {
        t: clockNow(),
        paths: [...input],
        bytes: options2,
      });
      writeStored("crumb", {
        phase: "publishing",
        paths: persistLog ? [...input] : [],
        at: Date.now(),
      });
      sendPeerPing({
        n: publishCount,
        phase: "saving",
        paths: [...input],
      });
      recordEvent("save-flush", {
        n: publishCount,
        paths: input,
        bytes: options2,
      });
      invalidateView("queue");
      return publishCount;
    }
    function saveEnd(input: number, options2: Debug.DebugPublishOutcome): void {
      let entry = inFlightPublishes.get(input);
      inFlightPublishes.delete(input);
      if (inFlightPublishes.size === 0) {
        writeStored("crumb", null);
      }
      let value = entry !== undefined ? clockNow() - entry.t : NaN;
      if (options2.ok) {
        recordTiming("publish call", value);
        lastPublish = {
          n: input,
          ms: Math.round(value),
          ...(options2.version !== undefined
            ? {
                version: options2.version,
              }
            : {}),
          at: Date.now(),
        };
        if (options2.version !== undefined) {
          fields.set("on version", options2.version);
          for (let value2 of entry?.paths ?? []) {
            lastVersionByPath.set(value2, options2.version);
          }
          sendPeerPing({
            n: input,
            phase: "saved",
            version: options2.version,
            ...(entry !== undefined
              ? {
                  paths: entry.paths,
                }
              : {}),
          });
        }
        recordEvent("save-ok", {
          n: input,
          ms: Math.round(value),
          version: options2.version,
        });
      } else {
        if (options2.code === "conflict") {
          errorCounts.conflict += 1;
        } else if (options2.code === "rate_limited") {
          errorCounts.rate += 1;
        } else {
          errorCounts.other += 1;
        }
        publishErrors.push({
          t: Date.now(),
          n: input,
          ...(options2.code !== undefined
            ? {
                code: options2.code,
              }
            : {}),
          ...(options2.raw !== undefined
            ? {
                raw: safeDebugValue(options2.raw),
              }
            : {}),
        });
        if (publishErrors.length > 30) {
          publishErrors.shift();
        }
        recordEvent(
          options2.code === "conflict" ? "save-conflict" : "save-error",
          {
            n: input,
            ms: Math.round(value),
            code: options2.code,
            ...(options2.raw !== undefined
              ? {
                  raw: safeDebugValue(options2.raw),
                }
              : {}),
          },
        );
      }
      invalidateView("queue");
      invalidateView("header");
      refreshStatus();
    }
    function recordVisible(input: string, options2: string): void {
      let value: number = Date.now(),
        value2: boolean = hiddenSince !== undefined,
        value3 = peerPings.findIndex(
          (input2) => input2.phase === "saved" && input2.version === input,
        ),
        value4 =
          value3 >= 0
            ? peerPings[value3].recvAt
            : options2 === "restarted"
              ? value
              : -1;
      if (value4 < 0) {
        return;
      }
      let value5 = peerPings.filter(
        (input2): boolean => input2.recvAt <= value4,
      );
      peerPings = peerPings.filter((input2): boolean => input2.recvAt > value4);
      prunePeerPings();
      let entries = new Map<string, Debug.DebugSavePairs>();
      for (let value6 of value5) {
        let value7: string = value6.tab + "#" + String(value6.n),
          value8 = entries.get(value7) ?? {};
        value8[value6.phase] = value6;
        entries.set(value7, value8);
      }
      for (let value6 of entries.values()) {
        let value7 = value6.saving ?? value6.saved;
        if (value7 === undefined) {
          continue;
        }
        if (value2) {
          hiddenSamplesExcluded += 1;
          continue;
        }
        let value8: number = value - value7.recvAt;
        recordTiming(
          options2 === "adopted"
            ? "save → visible, adopted"
            : "save → visible, restarted",
          value8,
        );
        visibilitySeries.push({
          how: options2,
          ms: value8,
        });
        if (visibilitySeries.length > 60) {
          visibilitySeries.shift();
        }
        if (value6.saved !== undefined) {
          recordTiming("saved-ping → visible", value - value6.saved.recvAt);
        }
      }
      recordEvent("visible", {
        version: input,
        how: options2,
        saves: entries.size,
        hidden: value2,
      });
      refreshStatus();
    }
    function recordHotEvent(input: Debug.DebugHotEvent): void {
      if (input.type === "update") {
        fields.set(
          "hot shape",
          input.shape === "calls" ? "three calls" : "string verdicts",
        );
        fields.set(
          "live seen",
          input.to +
            (input.toSeq !== undefined ? " · seq " + String(input.toSeq) : ""),
        );
        if (input.decision === "adopt") {
          fields.set(
            "on version",
            input.to +
              (input.toSeq !== undefined
                ? " · seq " + String(input.toSeq)
                : ""),
          );
          lastUpdateRestarted = false;
        }
        if (input.decision === "restart") {
          lastUpdateRestarted = true;
        }
      }
      if (input.type === "restart") {
        lastUpdateRestarted = true;
      }
      if (input.type === "applied") {
        lastUpdateRestarted = false;
        if (input.grantLagMs !== undefined) {
          recordTiming("adopt → first 200 (grant lag)", input.grantLagMs);
        }
        for (let value of input.paths ?? []) {
          lastVersionByPath.set(value, input.to);
        }
        invalidateView("files");
      }
      recordEvent("hot-" + input.type, input);
      invalidateView("header");
      refreshStatus();
    }
    function beforeRestart(input: string): void {
      writeStored("crumb", {
        phase: "hot-restart",
        reason: input,
        at: Date.now(),
      });
      recordEvent("restart-asked", {
        reason: input,
      });
      if (persistLog) {
        writeStored("log", eventLog.slice(-FILES_DEBUG_EVENT_STAGGER_MS));
      }
    }
    let bootPhases: Debug.DebugPhase[] = [];
    function recordPhase(input: string): void {
      let value: number = Math.round(clockNow() - bootStartedAt);
      bootPhases.push({
        name: input,
        ms: value,
      });
      if (input === "first artboard painted" || input === "first paint") {
        recordTiming("boot → first paint", value);
      }
      if (input === "all painted") {
        recordTiming("boot → all painted", value);
      }
      recordEvent("boot-phase", {
        name: input,
        ms: value,
      });
      invalidateView("timing");
    }
    function recordRead(
      input: string,
      options2: number,
      context: number,
      value?: boolean,
    ): void {
      recordEvent("read", {
        path: input,
        ms: Math.round(options2),
        status: context,
        ...(value
          ? {
              fresh: true,
            }
          : {}),
      });
    }
    let storedUi = readStored("ui", {}),
      ui2: Debug.DebugPanelUi = {
        open: storedUi.open === true,
        side: storedUi.side === "right" ? "right" : "bottom",
        size: {
          ...FILES_DEBUG_PANEL_DEFAULT_SIZE,
          ...(storedUi.size ?? {}),
        },
        tab: storedUi.tab ?? "events",
        kinds: {
          hot: true,
          save: true,
          boot: true,
          room: true,
          error: true,
          other: true,
          ...(storedUi.kinds ?? {}),
        },
        text: typeof storedUi.text === "string" ? storedUi.text : "",
        paused: false,
      };
    if (storedUi.open === undefined && readStored("open", false)) {
      ui2.open = true;
    }
    let saveUi = () => writeStored("ui", ui2);
    persistLog = ui2.open;
    if (!persistLog) {
      writeStored("log", null);
    }
    let hostElement: HTMLDivElement | null = null,
      shadowRoot: ShadowRoot | null = null,
      themeElement: HTMLDivElement | null = null,
      chipElement: HTMLDivElement | null = null,
      panelElement: HTMLDivElement | null = null,
      panelBody: HTMLDivElement | null = null,
      eventListElement: HTMLDivElement | null = null,
      roomStyleElement: HTMLStyleElement | null = null,
      expandedEvents = new Set<Debug.DebugEvent>(),
      dirtyViews = new Set<string>(),
      paintFrame = 0,
      status = "ok";
    function refreshStatus(): void {
      let value: number = Date.now(),
        value2 =
          peerPings.some(
            (input) => input.phase === "saved" && value - input.recvAt < 15000,
          ) || publishErrors.some((input): boolean => value - input.t < 1e4),
        value3: string = lastUpdateRestarted ? "bad" : value2 ? "behind" : "ok";
      if (value3 === status) {
        return;
      }
      status = value3;
      if (chipElement) {
        chipElement.dataset.status = status;
      }
      invalidateView("header");
    }
    function invalidateView(input: string): void {
      if (!ui2.open || shadowRoot === null) {
        return;
      }
      dirtyViews.add(input);
      if (paintFrame !== 0 || typeof requestAnimationFrame !== "function") {
        return;
      }
      paintFrame = requestAnimationFrame((): void => {
        paintFrame = 0;
        paintDirtyViews();
      });
    }
    function paintDirtyViews(): void {
      if (!ui2.open || panelElement === null) {
        dirtyViews.clear();
        return;
      }
      if (dirtyViews.has("header")) {
        paintHeader();
      }
      let tab = ui2.tab;
      if (tab === "events" && dirtyViews.has("events") && !ui2.paused) {
        paintEvents();
      }
      if (tab === "timing" && dirtyViews.has("timing")) {
        paintActiveTab();
      }
      if (
        tab === "files" &&
        (dirtyViews.has("files") || dirtyViews.has("queue"))
      ) {
        paintActiveTab();
      }
      if (
        tab === "queue" &&
        (dirtyViews.has("queue") || dirtyViews.has("events"))
      ) {
        paintActiveTab();
      }
      dirtyViews.clear();
    }
    let resizePageForPanel = (
        input: Debug.DebugSide | null,
        options2: number,
      ): void => {
        if (typeof document === "undefined") {
          return;
        }
        if (roomStyleElement === null) {
          roomStyleElement = document.createElement("style");
          roomStyleElement.setAttribute("data-hot-debug-room", "");
          roomStyleElement.textContent =
            ":root{--hotdbg-b:0px;--hotdbg-r:0px}html[data-hotdbg-open] .h-screen{height:calc(100vh - var(--hotdbg-b))!important}html[data-hotdbg-open] .h-dvh{height:calc(100dvh - var(--hotdbg-b))!important}html[data-hotdbg-open] .w-screen{width:calc(100vw - var(--hotdbg-r))!important}";
          document.head.appendChild(roomStyleElement);
        }
        let documentElement = document.documentElement;
        if (input === null) {
          documentElement.removeAttribute("data-hotdbg-open");
        } else {
          documentElement.setAttribute("data-hotdbg-open", input);
        }
        documentElement.style.setProperty(
          "--hotdbg-b",
          input === "bottom" ? String(options2) + "px" : "0px",
        );
        documentElement.style.setProperty(
          "--hotdbg-r",
          input === "right" ? String(options2) + "px" : "0px",
        );
        try {
          window.dispatchEvent(new Event("resize"));
        } catch {}
      },
      makeRoom = options.makeRoom ?? resizePageForPanel,
      panelCss: string = `
    :host{all:initial}
    *{box-sizing:border-box}
    .t-dark{--bg:#17181a;--bg2:#1e2023;--fg:#e6e6e3;--mut:#8b9098;--line:#ffffff14;--acc:#6fcfb0;--warn:#f0b35a;--bad:#f07a7a;--sel:#ffffff0d}
    .t-light{--bg:#fbfaf7;--bg2:#f1efea;--fg:#1b1b19;--mut:#6d6f73;--line:#0000001a;--acc:#1f8f6d;--warn:#a96a00;--bad:#c23c3c;--sel:#0000000a}
    .chip{position:fixed;left:10px;bottom:10px;z-index:2147483001;display:flex;align-items:center;gap:6px;font:500 11px/1 system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:999px;padding:5px 9px;cursor:pointer;pointer-events:auto;user-select:none;box-shadow:0 1px 6px #0003}
    .chip[data-open="1"]{display:none}
    .dot{width:7px;height:7px;border-radius:50%;background:var(--acc);flex:none}
    [data-status="behind"] .dot{background:var(--warn)}
    [data-status="bad"] .dot{background:var(--bad)}
    .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    .panel{position:fixed;z-index:2147483000;background:var(--bg);color:var(--fg);font:12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;pointer-events:auto;display:flex;flex-direction:column;outline:none}
    .panel.bottom{left:0;right:0;bottom:0;border-top:1px solid var(--line)}
    .panel.right{top:0;right:0;bottom:0;border-left:1px solid var(--line)}
    .grip{position:absolute;z-index:2}
    .bottom .grip{left:0;right:0;top:-3px;height:7px;cursor:ns-resize}
    .right .grip{top:0;bottom:0;left:-3px;width:7px;cursor:ew-resize}
    .grip:hover,.grip.on{background:color-mix(in srgb,var(--acc) 40%,transparent)}
    .shield{position:fixed;inset:0;z-index:2147483002;pointer-events:auto}
    .bar{display:flex;align-items:center;gap:10px;padding:0 8px;height:30px;flex:none;border-bottom:1px solid var(--line);white-space:nowrap;overflow:hidden}
    .bar .k{color:var(--mut);margin-right:-6px}
    .bar .sp{flex:1}
    .bar .v{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;overflow:hidden;text-overflow:ellipsis}
    .ib{all:unset;cursor:pointer;color:var(--mut);padding:3px 6px;border-radius:5px;font:inherit;flex:none}
    .ib:hover{color:var(--fg);background:var(--sel)}
    .tabs{display:flex;gap:2px;padding:0 6px;height:28px;flex:none;border-bottom:1px solid var(--line);align-items:stretch}
    .tab{all:unset;cursor:pointer;padding:0 9px;color:var(--mut);display:flex;align-items:center;border-bottom:2px solid transparent;font:inherit}
    .tab:hover{color:var(--fg)}
    .tab[aria-selected="true"]{color:var(--fg);border-bottom-color:var(--acc)}
    .body{flex:1;min-height:0;overflow:auto;padding:0}
    .tools{display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg);z-index:1;flex-wrap:wrap}
    .fchip{all:unset;cursor:pointer;padding:1px 8px;border-radius:999px;color:var(--mut);border:1px solid var(--line);font-size:11px}
    .fchip[aria-pressed="true"]{color:var(--fg);background:var(--sel);border-color:transparent}
    input[type=text]{all:unset;flex:1;min-width:120px;padding:2px 8px;border:1px solid var(--line);border-radius:6px;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--fg)}
    .row{display:grid;grid-template-columns:86px 120px 1fr;gap:8px;padding:2px 8px;cursor:default;align-items:baseline}
    .row:hover{background:var(--sel)}
    .row .t{color:var(--mut);font:11px ui-monospace,SFMono-Regular,Menlo,monospace}
    .row .ty{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--acc);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .row.error .ty{color:var(--bad)} .row.warn .ty{color:var(--warn)}
    .row .s{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
    .raw{margin:0 8px 4px 102px;padding:6px 8px;background:var(--bg2);border-radius:6px;font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word;user-select:text}
    .pad{padding:8px 10px}
    h4{margin:12px 0 4px;font:600 10px/1 system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:var(--mut)}
    h4:first-child{margin-top:2px}
    table{border-collapse:collapse;width:100%;font-size:12px}
    th{color:var(--mut);font-weight:400;text-align:right;padding:2px 10px 2px 0}
    td{padding:2px 10px 2px 0;text-align:right;white-space:nowrap;font:11px ui-monospace,SFMono-Regular,Menlo,monospace}
    td:first-child,th:first-child{text-align:left;font-family:inherit;font-size:12px}
    table.l td,table.l th{text-align:left;white-space:normal}
    tr:hover td{background:var(--sel)}
    .wf{display:grid;grid-template-columns:minmax(120px,240px) 1fr 60px;gap:8px;align-items:center;padding:1px 0;font-size:12px}
    .wf .barx{height:8px;border-radius:2px;background:color-mix(in srgb,var(--acc) 65%,transparent)}
    .wf .ms{font:11px ui-monospace,monospace;color:var(--mut);text-align:right}
    .spark{display:flex;align-items:flex-end;gap:2px;height:44px;padding:2px 0}
    .spark i{display:block;width:6px;border-radius:1px;background:var(--acc)}
    .spark i.r{background:var(--bad)}
    .mut{color:var(--mut)}
    .st{display:inline-block;padding:0 6px;border-radius:999px;font-size:10px;background:var(--sel);margin-right:4px}
    .st.b{color:var(--bad)} .st.w{color:var(--warn)}
    label{display:block;padding:1px 0}
    textarea{width:100%;height:120px;background:var(--bg2);color:var(--fg);border:0;font:10px/1.3 ui-monospace,monospace;padding:6px}
  `,
      element = <Tag extends keyof HTMLElementTagNameMap>(
        input: Tag,
        options2?: string,
        context?: string,
      ): HTMLElementTagNameMap[Tag] => {
        let value = document.createElement(input);
        if (options2 !== undefined) {
          value.className = options2;
        }
        if (context !== undefined) {
          value.textContent = context;
        }
        return value;
      },
      themeMode = () => {
        let value =
          document.documentElement.getAttribute("data-theme") ??
          document.documentElement.getAttribute("data-mode");
        if (value === "dark" || value === "light") {
          return value;
        }
        try {
          if (matchMedia("(prefers-color-scheme: dark)").matches) {
            return "dark";
          } else {
            return "light";
          }
        } catch {
          return "dark";
        }
      };
    function describeEvent(
      input: Debug.DebugEvent,
    ): Debug.DebugEventDescription {
      let value = (input.data ?? {}) as Debug.DebugEventData,
        callback = (input2: unknown): string | undefined => {
          try {
            return JSON.stringify(input2);
          } catch {
            return String(input2);
          }
        };
      switch (input.type) {
        case "hot-update": {
          let changed = value.changed as NonNullable<
              Debug.DebugEventData["changed"]
            > | null,
            value2 =
              changed === null
                ? "changed: null"
                : changed
                    .map(
                      (input2): string =>
                        input2.path +
                        (input2.klass === "code" ? " [CODE]" : ""),
                    )
                    .join(", ");
          return {
            cls:
              value.decision === "restart"
                ? "error"
                : value.decision === "defer"
                  ? "warn"
                  : "",
            text: `${String(value.decision).toUpperCase()} · ${shortDebugValue(String(value.from))} → ${shortDebugValue(String(value.to))}${value.toSeq !== undefined ? " seq " + String(value.toSeq) : ""} · required ${String(value.required)} · ${value2} · ${String(value.why ?? "")}${value.early === true ? " (early handler)" : ""}`,
          };
        }
        case "hot-fetch":
          return {
            cls: value.ok === true ? "" : "warn",
            text: `${String(value.path)} · try ${String(value.attempt)} → ${value.ok === true ? "200" : String(value.status ?? "failed")} at +${String(value.msAfterAdopt)} ms after adopt`,
          };
        case "hot-pending":
          return {
            cls: "warn",
            text: `still refused ${String(value.msAfterAdopt)} ms after adopt: old content stays, retrying slowly · ${callback(value.paths)}`,
          };
        case "hot-applied":
          return {
            cls: "",
            text: `${String(value.applied)}/${String(value.rows)} rows in ${String(value.ms)} ms · grant lag ${String(value.grantLagMs ?? "—")} ms · retries ${String(value.retries)} · ${callback(value.paths ?? [])}`,
          };
        case "hot-restart":
          return {
            cls: "error",
            text: `restart asked: ${String(value.reason)}${value.error !== undefined ? " · " + String(value.error) : ""}`,
          };
        case "hot-deferred":
          return {
            cls: "warn",
            text: `deferred (${String(value.reason)})`,
          };
        case "hot-reveal":
          return {
            cls: value.timedOut === true ? "warn" : "",
            text: `restarted realm shown after holding the reveal ${String(value.heldMs)} ms${value.timedOut === true ? " (the hold ran out before the editor painted)" : ""}${value.carried === true ? " · view carried" : ""}`,
          };
        case "reconcile": {
          let { regions: value2, guard: value3 } = value,
            value4 = value.overlapList ?? [];
          return {
            cls:
              value.ok === true
                ? Number(value.overlaps) > 0
                  ? "warn"
                  : ""
                : "error",
            text: `${String(value.file)} · ${String(value.trigger)} · ${value.ok === true ? "FOLDED" : "NOT merged: " + String(value.why ?? "")}${value2 !== undefined ? ` · template ${value2.template}, script ${value2.script}, outer ${value2.outer}` : ""} · ${String(value.applied)} of mine re-applied · ${String(value.overlaps)} overlaps${value4.length > 0 ? " (" + value4.map((input2): string => `${input2.name}: mine ${String(input2.to)} over theirs ${String(input2.theirs)}`).join("; ") + ")" : ""}${value3 !== undefined ? ` · same tree: theirs ${String(value3.baseTheirs)}, mine ${String(value3.baseMine)}` : ""} · ${String(value.ms)} ms`,
          };
        }
        case "reconcile-choice":
          return {
            cls: "",
            text: `${String(value.file)} · the person chose: ${String(value.choice)}`,
          };
        case "board-remote":
          return {
            cls: "",
            text: `${String(value.file)} · ${String(value.how)}${value.why !== undefined ? " · " + String(value.why) : ""}${value.ms !== undefined ? " · " + String(value.ms) + " ms" : ""}`,
          };
        case "save-flush":
          return {
            cls: "",
            text: `#${String(value.n)} ${callback(value.paths)} · ${String(value.bytes)} B`,
          };
        case "save-ok":
          return {
            cls: "",
            text: `#${String(value.n)} published in ${String(value.ms)} ms → ${shortDebugValue(String(value.version))}`,
          };
        case "save-conflict":
        case "save-error":
          return {
            cls: "error",
            text: `#${String(value.n)} ${String(value.code)} after ${String(value.ms)} ms · ${callback(value.raw ?? "")}`,
          };
        case "boot":
          return {
            cls: "",
            text: String(value.reason),
          };
        case "boot-phase":
          return {
            cls: "",
            text: `${String(value.name)} at +${String(value.ms)} ms`,
          };
        case "read":
          return {
            cls:
              Number(value.status) >= 400 || value.status === 0 ? "warn" : "",
            text: `${String(value.path)} · ${String(value.status)} in ${String(value.ms)} ms${value.fresh === true ? " (no-store)" : ""}`,
          };
        case "peer-saving":
        case "peer-saved":
          return {
            cls: "",
            text: `${String(value.from)} #${String(value.n)}${value.version !== undefined ? " → " + shortDebugValue(String(value.version)) : ""} ${callback(value.paths ?? [])}`,
          };
        default:
          return {
            cls: "",
            text: callback(value),
          };
      }
    }
    function paintHeader(): void {
      let value = panelElement?.querySelector(".bar");
      if (!value) {
        return;
      }
      value.setAttribute("data-status", status);
      let callback = (input: string, options2: unknown): void => {
        let element2 = value.querySelector('[data-f="' + input + '"]');
        if (element2 && element2.textContent !== options2) {
          element2.textContent = options2 as string;
        }
      };
      callback("tab", tabId);
      callback("ver", fields.get("on version") ?? "—");
      callback(
        "hot",
        hot === null ? "absent" : (fields.get("hot shape") ?? "present"),
      );
      callback(
        "status",
        status === "ok"
          ? "level with live"
          : status === "behind"
            ? "behind live"
            : "last update restarted",
      );
    }
    function filteredEvents(): Debug.DebugEvent[] {
      let value = ui2.text.trim().toLowerCase(),
        items: Debug.DebugEvent[] = [];
      for (
        let value2: number = eventLog.length - 1;
        value2 >= 0 && items.length < FILES_DEBUG_VIEW_REFRESH_MS;
        value2--
      ) {
        let value3 = eventLog[value2];
        if (!ui2.kinds[filesDebugEventLevel(value3)]) {
          continue;
        }
        if (value !== "") {
          let type = value3.type;
          try {
            type += " " + JSON.stringify(value3.data ?? "");
          } catch {}
          if (!type.toLowerCase().includes(value)) {
            continue;
          }
        }
        items.push(value3);
      }
      return items;
    }
    function paintEvents(): void {
      if (eventListElement === null) {
        return;
      }
      let value = filteredEvents(),
        value2 = document.createDocumentFragment();
      for (let value3 of value) {
        let value4 = describeEvent(value3),
          value5 = filesDebugEventLevel(value3),
          value6 = element(
            "div",
            "row " + (value5 === "error" ? "error" : value4.cls),
          );
        value6.append(
          element("span", "t", formatFilesDebugTimestamp(value3.t)),
          element("span", "ty", value3.type),
          element("span", "s", value4.text),
        );
        value6.title = "click for the raw event";
        value6.addEventListener("click", (): void => {
          if (expandedEvents.has(value3)) {
            expandedEvents.delete(value3);
          } else {
            expandedEvents.add(value3);
          }
          paintEvents();
        });
        value2.append(value6);
        if (expandedEvents.has(value3)) {
          let text = "";
          try {
            text = JSON.stringify(value3.data ?? {}, null, 1);
          } catch {
            text = String(value3.data);
          }
          value2.append(element("div", "raw", text));
        }
      }
      if (value.length === 0) {
        value2.append(
          element(
            "div",
            "pad mut",
            eventLog.length === 0
              ? "Nothing logged yet."
              : "No event matches the filters.",
          ),
        );
      }
      eventListElement.replaceChildren(value2);
    }
    function table(
      input: readonly string[],
      options2: readonly (readonly unknown[])[],
      context?: string,
    ): HTMLTableElement {
      let value = element("table", context);
      if (input.some((input2): boolean => input2 !== "")) {
        let value2 = element("tr");
        for (let value3 of input) {
          value2.append(element("th", undefined, value3));
        }
        value.append(value2);
      }
      for (let value2 of options2) {
        let value3 = element("tr");
        for (let value4 of value2) {
          value3.append(element("td", undefined, String(value4)));
        }
        value.append(value3);
      }
      return value;
    }
    function paintActiveTab(): void {
      if (panelBody === null) {
        return;
      }
      let value = panelBody;
      eventListElement = null;
      value.replaceChildren();
      if (ui2.tab === "events") {
        let value3 = element("div", "tools");
        for (let value6 of [
          "hot",
          "save",
          "boot",
          "room",
          "error",
          "other",
        ] as const) {
          let value7 = element("button", "fchip", value6);
          value7.setAttribute("aria-pressed", String(ui2.kinds[value6]));
          value7.addEventListener("click", (): void => {
            ui2.kinds[value6] = !ui2.kinds[value6];
            value7.setAttribute("aria-pressed", String(ui2.kinds[value6]));
            saveUi();
            paintEvents();
          });
          value3.append(value7);
        }
        let value4 = element("input");
        value4.type = "text";
        value4.placeholder = "filter (path, version, reason…)";
        value4.value = ui2.text;
        value4.addEventListener("input", (): void => {
          ui2.text = value4.value;
          saveUi();
          paintEvents();
        });
        let value5 = element("button", "fchip", ui2.paused ? "paused" : "live");
        value5.setAttribute("aria-pressed", String(!ui2.paused));
        value5.title = "pause the list (events keep being recorded)";
        value5.addEventListener("click", (): void => {
          ui2.paused = !ui2.paused;
          value5.textContent = ui2.paused ? "paused" : "live";
          value5.setAttribute("aria-pressed", String(!ui2.paused));
          if (!ui2.paused) {
            paintEvents();
          }
        });
        value3.append(
          value4,
          value5,
          element(
            "span",
            "mut",
            `newest first · ${String(FILES_DEBUG_VIEW_REFRESH_MS)} drawn at most · ${String(FILES_DEBUG_REFRESH_MS)} kept`,
          ),
        );
        eventListElement = element("div");
        value.append(value3, eventListElement);
        paintEvents();
        return;
      }
      let value2 = element("div", "pad");
      value.append(value2);
      if (ui2.tab === "timing") {
        value2.append(element("h4", undefined, "timing · ms"));
        let value3 = [...timingSamples.entries()].map(([input, input2]) => {
          let value7 = [...input2].sort(
            (input3, options2) => input3 - options2,
          );
          return [
            input,
            sortedSampleQuantile(value7, 0.5),
            sortedSampleQuantile(value7, 0.95),
            value7[value7.length - 1],
            value7.length,
          ];
        });
        value2.append(
          value3.length > 0
            ? table(["", "p50", "p95", "max", "n"], value3)
            : element(
                "div",
                "mut",
                "No samples yet. Save in another tab and watch this one.",
              ),
        );
        if (hiddenSamplesExcluded > 0) {
          value2.append(
            element(
              "div",
              "mut",
              `${String(hiddenSamplesExcluded)} samples taken while this tab was hidden were left out.`,
            ),
          );
        }
        value2.append(
          element(
            "h4",
            undefined,
            "save → visible, newest on the right · green adopted, red restarted",
          ),
        );
        let value4 = element("div", "spark"),
          value5: number = Math.max(
            1,
            ...visibilitySeries.map((input) => input.ms),
          );
        for (let value7 of visibilitySeries) {
          let value8 = element("i", value7.how === "restarted" ? "r" : "");
          value8.style.height =
            String(Math.max(2, Math.round((value7.ms / value5) * 40))) + "px";
          value8.title = value7.how + " · " + String(value7.ms) + " ms";
          value4.append(value8);
        }
        value2.append(
          visibilitySeries.length > 0 ? value4 : element("div", "mut", "—"),
        );
        value2.append(element("h4", undefined, "boot, from the entry module"));
        let value6: number = Math.max(
          1,
          ...bootPhases.map((input) => input.ms),
        );
        for (let value7 of bootPhases) {
          let value8 = element("div", "wf"),
            value9 = element("div"),
            value10 = element("div", "barx");
          value10.style.width =
            String(Math.max(1, Math.round((value7.ms / value6) * 100))) + "%";
          value9.append(value10);
          value8.append(
            element("span", undefined, value7.name),
            value9,
            element("span", "ms", "+" + String(value7.ms)),
          );
          value2.append(value8);
        }
        if (bootPhases.length === 0) {
          value2.append(element("div", "mut", "—"));
        }
        if (debugOptions.size > 0) {
          value2.append(element("h4", undefined, "options"));
          for (let [value7, value8] of debugOptions) {
            let value9 = element("label"),
              value10 = element("input");
            value10.type = "checkbox";
            value10.checked = value8.on;
            value10.addEventListener("change", (): void => {
              value8.on = value10.checked;
              writeStored("opt/" + value7, value8.on);
              recordEvent("option", {
                key: value7,
                on: value8.on,
              });
            });
            value9.append(value10, document.createTextNode(" " + value8.label));
            value2.append(value9);
          }
        }
        return;
      }
      if (ui2.tab === "files") {
        let items: Core.DebugFileRow[] = [];
        try {
          items = providers.files?.() ?? [];
        } catch {
          items = [];
        }
        value2.append(
          element(
            "h4",
            undefined,
            `files this tab knows · ${String(items.length)}`,
          ),
        );
        if (items.length === 0) {
          value2.append(
            element(
              "div",
              "mut",
              providers.files === undefined
                ? "This editor did not provide its file list."
                : "No files.",
            ),
          );
          return;
        }
        let value3 = element("table", "l"),
          value4 = element("tr");
        for (let value5 of [
          "path",
          "state",
          "on screen",
          "live",
          "size",
          "last changed at",
        ]) {
          value4.append(element("th", undefined, value5));
        }
        value3.append(value4);
        for (let value5 of [...items].sort((input, options2): number =>
          input.path < options2.path ? -1 : 1,
        )) {
          let value6 = element("tr"),
            value7 = element("td");
          for (let value8 of (value5.state ?? "").split(" ").filter(Boolean)) {
            value7.append(
              element(
                "span",
                "st" +
                  (value8 === "conflicted"
                    ? " b"
                    : value8 === "behind" || value8 === "held"
                      ? " w"
                      : ""),
                value8,
              ),
            );
          }
          value6.append(
            element("td", undefined, value5.path),
            value7,
            element("td", undefined, (value5.sha ?? "—").slice(0, 10)),
            element(
              "td",
              undefined,
              value5.liveSha === undefined
                ? ""
                : (value5.liveSha ?? "removed").slice(0, 10),
            ),
            element(
              "td",
              undefined,
              value5.size !== undefined ? String(value5.size) : "",
            ),
            element(
              "td",
              undefined,
              shortDebugValue(lastVersionByPath.get(value5.path)),
            ),
          );
          value3.append(value6);
        }
        value2.append(value3);
        return;
      }
      if (ui2.tab === "queue") {
        let value3: Core.DebugQueueView | undefined;
        try {
          value3 = providers.queue?.();
        } catch {
          value3 = undefined;
        }
        value2.append(element("h4", undefined, "now"));
        value2.append(
          table(
            ["", ""],
            [
              [
                "dirty",
                value3 === undefined
                  ? "(not provided)"
                  : value3.dirty.length === 0
                    ? "none"
                    : value3.dirty.join(", "),
              ],
              [
                "in flight",
                inFlightPublishes.size > 0
                  ? [...inFlightPublishes.values()]
                      .map((input) => input.paths.join(", "))
                      .join(" | ")
                  : value3?.inFlight === true
                    ? "yes"
                    : "no",
              ],
              [
                "conflicted",
                value3?.conflicted !== undefined && value3.conflicted.length > 0
                  ? value3.conflicted.join(", ")
                  : "none",
              ],
              [
                "last publish",
                lastPublish === undefined
                  ? "—"
                  : `#${String(lastPublish.n)} · ${String(lastPublish.ms)} ms → ${shortDebugValue(lastPublish.version)} · ${formatFilesDebugTimestamp(lastPublish.at)}`,
              ],
              ["queue says", value3?.lastError ?? "ok"],
              ["publishes", String(publishCount)],
              [
                "errors",
                `409 conflict ×${String(errorCounts.conflict)} · 429 rate limit ×${String(errorCounts.rate)} · other ×${String(errorCounts.other)}`,
              ],
              [
                "catch-up waits",
                value3?.note ??
                  "this editor does not wait for a newer version before saving yet",
              ],
            ],
            "l",
          ),
        );
        value2.append(element("h4", undefined, "publish errors, newest first"));
        if (publishErrors.length === 0) {
          value2.append(element("div", "mut", "none"));
        }
        for (let value4 of [...publishErrors].reverse()) {
          let text = "";
          try {
            text = JSON.stringify(value4.raw ?? {}, null, 1);
          } catch {
            text = String(value4.raw);
          }
          let value5 = element("div", "raw", text);
          value5.style.marginLeft = "0";
          value2.append(
            element(
              "div",
              "mut",
              `${formatFilesDebugTimestamp(value4.t)} · #${String(value4.n)} · ${String(value4.code)}`,
            ),
            value5,
          );
        }
        return;
      }
      value2.append(element("h4", undefined, "this tab last loaded because"));
      value2.append(element("div", undefined, reloadReason));
      value2.append(element("h4", undefined, "counts by reason"));
      value2.append(
        table(
          ["reason", "times"],
          Object.entries(reasonCounts)
            .sort((input, options2) => options2[1] - input[1])
            .map(([input, input2]) => [input, input2]),
        ),
      );
      value2.append(element("h4", undefined, "history, newest first"));
      value2.append(
        table(
          ["when", "reason"],
          [...reloadHistory]
            .reverse()
            .map((input) => [formatFilesDebugTimestamp(input.t), input.reason]),
          "l",
        ),
      );
    }
    function clampPanelSize(input: Debug.DebugSide, options2: number): number {
      let value: number = Math.round(
        (input === "bottom" ? window.innerHeight : window.innerWidth) * 0.8,
      );
      return Math.max(
        FILES_DEBUG_PANEL_MIN_SIZE[input],
        Math.min(value, Math.round(options2)),
      );
    }
    function applyPanelLayout(): void {
      if (panelElement === null || themeElement === null) {
        return;
      }
      themeElement.className = "t-" + themeMode();
      panelElement.className = "panel " + ui2.side;
      let value = clampPanelSize(ui2.side, ui2.size[ui2.side]);
      if (ui2.side === "bottom") {
        panelElement.style.height = String(value) + "px";
        panelElement.style.width = "";
      } else {
        panelElement.style.width = String(value) + "px";
        panelElement.style.height = "";
      }
      makeRoom(ui2.open ? ui2.side : null, ui2.open ? value : 0);
    }
    function paintTabs(): void {
      panelElement
        ?.querySelectorAll(".tab")
        .forEach((element2) =>
          element2.setAttribute(
            "aria-selected",
            String(element2.getAttribute("data-tab") === ui2.tab),
          ),
        );
    }
    function setOpen(input: boolean): void {
      ui2.open = input;
      persistLog = input;
      if (input) {
        schedulePersistLog();
      } else {
        writeStored("log", null);
      }
      saveUi();
      if (chipElement) {
        chipElement.dataset.open = input ? "1" : "0";
      }
      if (panelElement) {
        panelElement.style.display = input ? "flex" : "none";
      }
      if (input) {
        applyPanelLayout();
        paintHeader();
        paintTabs();
        paintActiveTab();
      } else {
        makeRoom(null, 0);
      }
    }
    function buildPanel(): void {
      if (shadowRoot === null) {
        return;
      }
      themeElement = element("div", "t-" + themeMode());
      let value = themeElement;
      chipElement = element("div", "chip");
      chipElement.dataset.status = status;
      chipElement.dataset.open = "0";
      chipElement.title =
        "hot-reload debug panel (" + FILES_DEBUG_TOGGLE_SHORTCUT + ")";
      chipElement.append(
        element("span", "dot"),
        element("span", undefined, "hot"),
        element("span", "mono", tabId),
      );
      chipElement.addEventListener("click", () => setOpen(true));
      panelElement = element("div", "panel " + ui2.side);
      panelElement.style.display = "none";
      panelElement.tabIndex = -1;
      let value2 = element("div", "grip");
      value2.title = "drag to resize · double-click to reset";
      value2.addEventListener("dblclick", (): void => {
        ui2.size[ui2.side] = FILES_DEBUG_PANEL_DEFAULT_SIZE[ui2.side];
        saveUi();
        applyPanelLayout();
      });
      value2.addEventListener("pointerdown", (event): void => {
        event.preventDefault();
        value2.classList.add("on");
        let value9 = element("div", "shield");
        value9.style.cursor = ui2.side === "bottom" ? "ns-resize" : "ew-resize";
        value.append(value9);
        let callback3 = (input: PointerEvent): void => {
            ui2.size[ui2.side] = clampPanelSize(
              ui2.side,
              ui2.side === "bottom"
                ? window.innerHeight - input.clientY
                : window.innerWidth - input.clientX,
            );
            applyPanelLayout();
          },
          callback4 = (): void => {
            value9.remove();
            value2.classList.remove("on");
            window.removeEventListener("pointermove", callback3, true);
            window.removeEventListener("pointerup", callback4, true);
            window.removeEventListener("pointercancel", callback4, true);
            saveUi();
          };
        window.addEventListener("pointermove", callback3, true);
        window.addEventListener("pointerup", callback4, true);
        window.addEventListener("pointercancel", callback4, true);
      });
      let value3 = element("div", "bar");
      value3.setAttribute("data-status", status);
      let callback = (input: string, options2: string): void => {
        value3.append(element("span", "k", input));
        let value9 = element("span", "v");
        value9.setAttribute("data-f", options2);
        value3.append(value9);
      };
      value3.append(element("span", "dot"));
      let value4 = element("span");
      value4.setAttribute("data-f", "status");
      value3.append(value4);
      callback("tab", "tab");
      callback("version", "ver");
      // CucCut: the host global is designSystemHost, not claude.
      callback("designSystemHost.hot", "hot");
      value3.append(element("span", "sp"));
      let callback2 = (
        input: string,
        options2: string,
        context: EventListener,
      ): void => {
        let value9 = element("button", "ib", input);
        value9.title = options2;
        value9.addEventListener("click", context);
        value3.append(value9);
      };
      callback2(
        "dock ⇄",
        "dock to the other side (bottom / right)",
        (): void => {
          ui2.side = ui2.side === "bottom" ? "right" : "bottom";
          saveUi();
          applyPanelLayout();
        },
      );
      callback2("clear", "clear the log", (): void => {
        eventLog.length = 0;
        expandedEvents.clear();
        writeStored("log", eventLog);
        paintActiveTab();
      });
      callback2("copy log", "copy the whole log as JSON", (): void => {
        let value9 = exportJson(),
          flag: boolean = false;
        try {
          navigator.clipboard?.writeText(value9).then(
            (): void => {
              flag = true;
            },
            (): void => {
              return;
            },
          );
        } catch {}
        setTimeout((): void => {
          if (flag || panelBody === null) {
            return;
          }
          panelBody.querySelector("textarea")?.remove();
          let value10 = element("textarea");
          value10.readOnly = true;
          value10.value = value9;
          panelBody.prepend(value10);
        }, 200);
      });
      callback2(
        "✕",
        "close (Esc while the panel has focus, or " +
          FILES_DEBUG_TOGGLE_SHORTCUT +
          ")",
        () => setOpen(false),
      );
      let value5 = element("div", "tabs");
      for (let [value9, value10] of [
        ["events", "Events"],
        ["timing", "Timing"],
        ["files", "Files"],
        ["queue", "Save queue"],
        ["reloads", "Reloads"],
      ]) {
        let value11 = element("button", "tab", value10);
        value11.setAttribute("data-tab", value9);
        value11.addEventListener("click", (): void => {
          ui2.tab = value9;
          saveUi();
          paintTabs();
          paintActiveTab();
        });
        value5.append(value11);
      }
      panelBody = element("div", "body");
      panelElement.append(value2, value3, value5, panelBody);
      panelElement.addEventListener("keydown", (input): void => {
        if (input.key === "Escape") {
          input.stopPropagation();
          setOpen(false);
        }
      });
      value.append(chipElement, panelElement);
      let value6 = element("style");
      value6.textContent = panelCss;
      shadowRoot.replaceChildren(value6, value);
      if (ui2.open) {
        setOpen(true);
      }
      try {
        new MutationObserver((): void => {
          if (themeElement) {
            themeElement.className = "t-" + themeMode();
          }
        }).observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["data-theme", "data-mode"],
        });
      } catch {}
      let { innerWidth: value7, innerHeight: value8 } = window;
      window.addEventListener("resize", (): void => {
        if (
          !ui2.open ||
          (window.innerWidth === value7 && window.innerHeight === value8)
        ) {
          return;
        }
        value7 = window.innerWidth;
        value8 = window.innerHeight;
        applyPanelLayout();
      });
      setInterval(refreshStatus, 3000);
    }
    function exportJson(): string {
      let state: Record<string, Debug.DebugQuantiles> = {};
      for (let [value3, value4] of timingSamples) {
        let value5 = [...value4].sort((input, options2) => input - options2);
        state[value3] = {
          p50: sortedSampleQuantile(value5, 0.5),
          p95: sortedSampleQuantile(value5, 0.95),
          max: value5[value5.length - 1],
          n: value5.length,
        };
      }
      let value: Core.DebugFileRow[] | undefined,
        value2: Core.DebugQueueView | undefined;
      try {
        value = providers.files?.();
      } catch {}
      try {
        value2 = providers.queue?.();
      } catch {}
      return JSON.stringify(
        {
          tab: tabId,
          reloadReason: reloadReason,
          reasons: reasonCounts,
          reloads: reloadHistory,
          fields: Object.fromEntries(fields),
          stats: state,
          excludedHidden: hiddenSamplesExcluded,
          phases: bootPhases,
          counters: errorCounts,
          publishErrors: publishErrors,
          series: visibilitySeries,
          files: value,
          queue: value2,
          log: eventLog,
        },
        null,
        1,
      );
    }
    let eventGuardsInstalled: boolean = false;
    function installEventGuards(): void {
      if (eventGuardsInstalled || typeof window === "undefined") {
        return;
      }
      eventGuardsInstalled = true;
      let callback = (input: Event) => {
        try {
          return (
            panelElement !== null && input.composedPath().includes(panelElement)
          );
        } catch {
          return false;
        }
      };
      window.addEventListener(
        "keydown",
        (event): void => {
          if (
            event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            (event.key === "`" || event.code === "Backquote")
          ) {
            event.preventDefault();
            event.stopImmediatePropagation();
            setOpen(!ui2.open);
            return;
          }
          if (!callback(event)) {
            return;
          }
          event.stopImmediatePropagation();
          if (event.key === "Escape") {
            setOpen(false);
          }
        },
        true,
      );
      for (let value of [
        "keyup",
        "keypress",
        "copy",
        "cut",
        "paste",
        "wheel",
        "contextmenu",
      ]) {
        window.addEventListener(
          value,
          (input): void => {
            if (callback(input)) {
              input.stopImmediatePropagation();
            }
          },
          true,
        );
      }
    }
    function mount(input: string): void {
      if (
        input !== "files" ||
        typeof document === "undefined" ||
        hostElement !== null
      ) {
        return;
      }
      installEventGuards();
      let callback = (): void => {
        if (hostElement !== null) {
          return;
        }
        hostElement = document.createElement("div");
        hostElement.setAttribute("data-hot-debug", "");
        hostElement.style.cssText =
          "position:fixed;left:0;top:0;width:0;height:0;z-index:2147483000;pointer-events:none";
        shadowRoot = hostElement.attachShadow({
          mode: "open",
        });
        (document.body ?? document.documentElement).appendChild(hostElement);
        buildPanel();
      };
      if (document.body !== null) {
        callback();
      } else {
        document.addEventListener("DOMContentLoaded", callback, {
          once: true,
        });
      }
    }
    recordEvent("boot", {
      reason: reloadReason,
      viaHot: cameFromHotRestart,
      ...(hotFrom !== undefined && hotFrom !== null
        ? {
            hotFrom: hotFrom,
          }
        : {}),
      ...(restartBreadcrumb !== null
        ? {
            crumb: restartBreadcrumb,
          }
        : {}),
    });
    return {
      tab: tabId,
      reloadReason: reloadReason,
      field(input: string, options2: unknown): void {
        fields.set(input, options2);
        invalidateView("header");
      },
      event: recordEvent,
      hotEvent: recordHotEvent,
      beforeRestart: beforeRestart,
      saveStart: saveStart,
      saveEnd: saveEnd,
      phase: recordPhase,
      read: recordRead,
      visible: recordVisible,
      sample: recordTiming,
      mount: mount,
      exportJson: exportJson,
      option: option,
      provide(input: Core.DebugProviders): void {
        providers = {
          ...providers,
          ...input,
        };
        invalidateView("files");
        invalidateView("queue");
      },
    };
  }
  function instrumentFilesPort<Port extends Model.BrowserFilesPort>(
    port: Port,
    debug: Core.FilesDebugger,
  ): Port {
    let value: Port = Object.create(port);
    value.publish = async (
      input: Model.FilePublishEntries,
      options?: Model.FilePublishPreconditions,
    ): Promise<Model.FilePublishResult> => {
      let value2: number | undefined;
      try {
        value2 = debug.saveStart(
          Object.keys(input),
          Object.values(input).reduce(
            (input2, options2) =>
              input2 + (0, runtime.filePublishEncodedBytes)(options2),
            0,
          ),
        );
      } catch {}
      let value3 = await port.publish(input, options);
      try {
        if (value2 !== undefined) {
          debug.saveEnd(
            value2,
            value3.ok
              ? {
                  ok: true,
                  version: value3.version,
                }
              : {
                  ok: false,
                  code: value3.code,
                  raw: value3,
                },
          );
        }
      } catch {}
      return value3;
    };
    return value;
  }
  function createNoopFilesDebugger(): Core.FilesDebugger {
    let callback = (): void => {
      return;
    };
    return {
      tab: "",
      reloadReason: "",
      field: callback,
      event: callback,
      hotEvent: callback,
      beforeRestart: callback,
      saveStart: (): number => 0,
      saveEnd: callback,
      phase: callback,
      read: callback,
      visible: callback,
      sample: callback,
      mount: callback,
      exportJson: (): string => "{}",
      option: () => (): boolean => true,
      provide: callback,
    };
  }
  function createFilesDebugger(
    options: Core.FilesDebuggerOptions,
  ): Core.FilesDebugger {
    if (filesDebugEnabled()) {
      return createFilesDebugPanel(options);
    } else {
      return createNoopFilesDebugger();
    }
  }
  bindRuntimeValue(runtime, "filesDebugEnabled", () => filesDebugEnabled);
  bindRuntimeValue(
    runtime,
    "filesModeDebugEnabled",
    () => filesModeDebugEnabled,
  );
  bindRuntimeValue(
    runtime,
    "FILES_DEBUG_REFRESH_MS",
    () => FILES_DEBUG_REFRESH_MS,
    (value) => {
      FILES_DEBUG_REFRESH_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_DEBUG_EVENT_STAGGER_MS",
    () => FILES_DEBUG_EVENT_STAGGER_MS,
    (value) => {
      FILES_DEBUG_EVENT_STAGGER_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_DEBUG_VIEW_REFRESH_MS",
    () => FILES_DEBUG_VIEW_REFRESH_MS,
    (value) => {
      FILES_DEBUG_VIEW_REFRESH_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_DEBUG_PANEL_DEFAULT_SIZE",
    () => FILES_DEBUG_PANEL_DEFAULT_SIZE,
    (value) => {
      FILES_DEBUG_PANEL_DEFAULT_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_DEBUG_PANEL_MIN_SIZE",
    () => FILES_DEBUG_PANEL_MIN_SIZE,
    (value) => {
      FILES_DEBUG_PANEL_MIN_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_DEBUG_TOGGLE_SHORTCUT",
    () => FILES_DEBUG_TOGGLE_SHORTCUT,
    (value) => {
      FILES_DEBUG_TOGGLE_SHORTCUT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createFilesDebugTabId",
    () => createFilesDebugTabId,
    (value) => {
      createFilesDebugTabId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "formatFilesDebugTimestamp",
    () => formatFilesDebugTimestamp,
    (value) => {
      formatFilesDebugTimestamp = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shortDebugValue",
    () => shortDebugValue,
    (value) => {
      shortDebugValue = value;
    },
  );
  bindRuntimeValue(runtime, "sortedSampleQuantile", () => sortedSampleQuantile);
  bindRuntimeValue(runtime, "filesDebugEventLevel", () => filesDebugEventLevel);
  bindRuntimeValue(
    runtime,
    "createFilesDebugPanel",
    () => createFilesDebugPanel,
  );
  bindRuntimeValue(runtime, "instrumentFilesPort", () => instrumentFilesPort);
  bindRuntimeValue(
    runtime,
    "createNoopFilesDebugger",
    () => createNoopFilesDebugger,
  );
  bindRuntimeValue(runtime, "createFilesDebugger", () => createFilesDebugger);
  return () => {
    FILES_DEBUG_REFRESH_MS = 1500;
    FILES_DEBUG_EVENT_STAGGER_MS = 150;
    FILES_DEBUG_VIEW_REFRESH_MS = 250;
    FILES_DEBUG_PANEL_DEFAULT_SIZE = {
      bottom: 300,
      right: 440,
    };
    FILES_DEBUG_PANEL_MIN_SIZE = {
      bottom: 140,
      right: 300,
    };
    FILES_DEBUG_TOGGLE_SHORTCUT = "Ctrl+`";
    createFilesDebugTabId = () => Math.random().toString(36).slice(2, 6);
    formatFilesDebugTimestamp = (input: number) =>
      new Date(input).toISOString().slice(11, 23);
    shortDebugValue = (items: string | null | undefined) =>
      items === undefined || items === null || items === ""
        ? "—"
        : items.length > 18
          ? items.slice(0, 10) + "…" + items.slice(-4)
          : items;
  };
}
