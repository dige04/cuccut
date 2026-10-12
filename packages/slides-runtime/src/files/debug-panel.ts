/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { SlidesBootDebugger } from "../boot/bootstrap";
import type { HostRoom, RoomPeersEvent } from "../host/room-presence";
import type {
  BrowserFilesPort,
  FilesPublishCallOptions,
  FilesPublishResult,
} from "./browser-port";
import type {
  HotCapability,
  HotChangedDescription,
  HotRestartOrigin,
  HotUpdateEvent,
} from "./hot-updates";
import type { FilePublishEntries, FilePublishInput } from "./publish-inputs";

/** What kind of event a log row is; the panel can hide each kind. */
export type FilesDebugLevel =
  | "error"
  | "boot"
  | "hot"
  | "save"
  | "room"
  | "other";
/** The panel's tabs. */
export type FilesDebugTab = "events" | "timing" | "files" | "queue" | "reloads";
/** Where the panel docks. */
export type FilesDebugSide = "bottom" | "right";
/** A size in pixels for each dock side. */
export type FilesDebugPanelSize = Record<FilesDebugSide, number>;
/** The parts of the panel that are redrawn separately. */
export type FilesDebugSection = "header" | "events" | "timing" | "files" | "queue";
/** How a save became visible in this tab. */
export type FilesDebugVisibleHow = "adopted" | "restarted";
/** Whether this tab is level with the live version. */
export type FilesDebugHealth = "ok" | "behind" | "bad";

/** A text input of a publish: the panel only reads text it can show. */
export type FileInputDebugValue = string | (object & { content?: unknown }) | null;

/** One overlapping change the reconcile step reported. */
export interface FilesDebugOverlap {
  name: unknown;
  to: unknown;
  theirs: unknown;
}
/**
 * The facts attached to a log event. Which fields are present depends on the event
 * type; the panel prints the ones it knows for each type.
 */
export interface FilesDebugEventData {
  decision?: unknown;
  from?: unknown;
  to?: unknown;
  toSeq?: unknown;
  required?: unknown;
  /** The paths of a hot update. */
  changed?: HotChangedDescription[] | null;
  why?: unknown;
  early?: unknown;
  reason?: unknown;
  error?: unknown;
  path?: unknown;
  attempt?: unknown;
  ok?: unknown;
  /** The HTTP status of a read; 0 when the request failed. */
  status?: number;
  msAfterAdopt?: unknown;
  paths?: unknown;
  applied?: unknown;
  rows?: unknown;
  ms?: unknown;
  grantLagMs?: unknown;
  retries?: unknown;
  timedOut?: unknown;
  heldMs?: unknown;
  carried?: unknown;
  file?: unknown;
  trigger?: unknown;
  regions?: { template: unknown; script: unknown; outer: unknown };
  guard?: { baseTheirs: unknown; baseMine: unknown };
  overlapList?: FilesDebugOverlap[];
  overlaps?: unknown;
  choice?: unknown;
  how?: unknown;
  n?: unknown;
  bytes?: unknown;
  version?: unknown;
  code?: unknown;
  raw?: unknown;
  name?: unknown;
  fresh?: unknown;
  state?: unknown;
  key?: unknown;
  on?: unknown;
  saves?: unknown;
  hidden?: unknown;
  viaHot?: unknown;
  hotFrom?: unknown;
  crumb?: unknown;
  skewedMs?: unknown;
}
/** One row of the event log. */
export interface FilesDebugEvent {
  t: number;
  type: string;
  data?: FilesDebugEventData;
}
/** How a save ended, as `saveEnd` is told. */
export type FilesDebugSaveOutcome =
  | { ok: true; version?: string }
  | { ok: false; code?: string; raw?: unknown };
/** What the files list of the editor reports about one file. */
export interface FilesDebugFileRow {
  path: string;
  /** Space-separated state words (`conflicted`, `behind`, `held`, ...). */
  state?: string;
  sha?: string | null;
  liveSha?: string | null;
  size?: number;
}
/** What the save queue of the editor reports about itself. */
export interface FilesDebugQueueState {
  dirty: string[];
  inFlight?: boolean;
  conflicted?: string[];
  lastError?: string;
  note?: string;
}
/** What the editor lends the panel so it can show its files and save queue. */
export interface FilesDebugSources {
  files?: () => unknown;
  queue?: () => unknown;
}
/** Options for creating the files debugger. */
export interface FilesDebuggerOptions {
  product: string;
  hot?: HotCapability | null;
  bootStartedAt?: number;
  /** False skips the pings between tabs of the same room. */
  room?: boolean;
  /** Reserves space for the docked panel by shrinking the page. */
  makeRoom?: (side: FilesDebugSide | null, size: number) => void;
}
/** The files debugger: the real panel, or a stand-in that does nothing. */
export interface FilesDebugger {
  readonly tab: string;
  readonly reloadReason: string;
  field(name: string, value: string): void;
  event(type: string, data?: FilesDebugEventData): void;
  hotEvent(event: HotUpdateEvent): void;
  beforeRestart(reason: string): void;
  /** Starts timing a publish; returns its number. */
  saveStart(paths: Iterable<string>, bytes: number): number;
  saveEnd(save: number, outcome: FilesDebugSaveOutcome): void;
  phase(name: string): void;
  read(path: string, ms: number, status: number, fresh?: boolean): void;
  visible(version: string, how: FilesDebugVisibleHow): void;
  sample(name: string, ms: number): void;
  mount(kind: string): void;
  exportJson(): string;
  /** Registers a switch and returns a reader of its current value. */
  option(key: string, label: string): () => boolean;
  provide(sources: FilesDebugSources): void;
}

/** A save ping as a peer tab sends it (untrusted). */
interface RawFilesDebugPing {
  tab?: unknown;
  n?: unknown;
  at?: unknown;
  phase?: unknown;
  version?: unknown;
  paths?: unknown;
  /** Set when the ping arrives wrapped in a room event. */
  data?: RawFilesDebugPing | null;
}
/** A checked save ping, with the time it arrived. */
interface FilesDebugPing {
  tab: string;
  n: number;
  phase: "saving" | "saved";
  version?: string;
  at: number;
  recvAt: number;
  paths?: unknown[];
}
/** What this tab tells the others about its own save. */
interface FilesDebugPingUpdate {
  n: number;
  phase: "saving" | "saved";
  version?: string;
  paths?: string[];
}
interface FilesDebugPingMessage extends FilesDebugPingUpdate {
  tab: string;
  at: number;
}
/** A peer as the room lists it; only the debug ping is read. */
interface FilesDebugRoomPeer {
  sameTab?: unknown;
  presence?: { hotdbg?: RawFilesDebugPing } | null;
}
/** The room member the pings go through. */
interface FilesDebugRoomEmitter {
  emit?(channel: string, state: FilesDebugPingMessage): Promise<unknown>;
}
/** A publish that is still running. */
interface FilesDebugInFlightSave {
  t: number;
  paths: string[];
  bytes: number;
}
/** The last publish that went through. */
interface FilesDebugLastPublish {
  n: number;
  ms: number;
  version?: string;
  at: number;
}
/** A publish that failed. */
interface FilesDebugPublishError {
  t: number;
  n: number;
  code?: string;
  raw?: unknown;
}
interface FilesDebugErrorCounts {
  conflict: number;
  rate: number;
  other: number;
}
/** How long a save took to show up in this tab. */
interface FilesDebugSeriesPoint {
  how: FilesDebugVisibleHow;
  ms: number;
}
/** A boot phase and when it was reached. */
interface FilesDebugPhase {
  name: string;
  ms: number;
}
/** Why this page was last loaded. */
interface FilesDebugReload {
  t: number;
  reason: string;
}
/** What the previous load left behind in session storage. */
interface FilesDebugCrumb {
  phase?: string;
  reason?: string;
  paths?: string[];
  at?: number;
}
/** A switch of the panel. */
interface FilesDebugOption {
  label: string;
  on: boolean;
}
/** The panel's state as it was stored; any field may be missing or foreign. */
interface StoredFilesDebugUi {
  open?: boolean;
  side?: unknown;
  size?: Partial<FilesDebugPanelSize>;
  tab?: FilesDebugTab;
  kinds?: Partial<Record<FilesDebugLevel, boolean>>;
  text?: unknown;
}
export interface FilesDebugUiState {
  open: boolean;
  side: FilesDebugSide;
  size: FilesDebugPanelSize;
  tab: FilesDebugTab;
  kinds: Record<FilesDebugLevel, boolean>;
  text: string;
  paused: boolean;
}
/** How an event is drawn in the list. */
interface FilesDebugEventRow {
  cls: string;
  text: string;
}
/** The save and the saved ping of one publish of a peer. */
interface FilesDebugPingPair {
  saving?: FilesDebugPing;
  saved?: FilesDebugPing;
}

declare module "../bindings" {
  interface RuntimeBindings {
    FILES_DEBUG_REFRESH_MS: number;
    FILES_DEBUG_EVENT_STAGGER_MS: number;
    FILES_DEBUG_VIEW_REFRESH_MS: number;
    FILES_DEBUG_PANEL_DEFAULT_SIZE: FilesDebugPanelSize;
    FILES_DEBUG_PANEL_MIN_SIZE: FilesDebugPanelSize;
    FILES_DEBUG_TOGGLE_SHORTCUT: string;
    createFilesDebugTabId: () => string;
    formatFilesDebugTimestamp: (timestamp: number) => string;
    escapeFilesDebugHtml: (items: string | null | undefined) => string;
    fileInputDebugText: (input: FileInputDebugValue) => string;
    filesDebugEnabled: (
      getStorage?: () => Storage | null | undefined,
    ) => boolean;
    sortedSampleQuantile: (
      sortedSamples: readonly number[],
      quantile: number,
    ) => number;
    filesDebugEventLevel: (event: FilesDebugEvent) => FilesDebugLevel;
    createFilesDebugPanel: (options: FilesDebuggerOptions) => FilesDebugger;
    /** The boot sequence holds the debugger as its narrower `SlidesBootDebugger` view. */
    instrumentFilesPort(
      port: BrowserFilesPort,
      debug: FilesDebugger | SlidesBootDebugger,
    ): BrowserFilesPort;
    createNoopFilesDebugger: () => FilesDebugger;
    createFilesDebugger: (options: FilesDebuggerOptions) => FilesDebugger;
  }
}

export function installFilesDebugPanel(runtime: RuntimeBindings): () => void {
  var FILES_DEBUG_REFRESH_MS: number;
  var FILES_DEBUG_EVENT_STAGGER_MS: number;
  var FILES_DEBUG_VIEW_REFRESH_MS: number;
  var FILES_DEBUG_PANEL_DEFAULT_SIZE: FilesDebugPanelSize;
  var FILES_DEBUG_PANEL_MIN_SIZE: FilesDebugPanelSize;
  var FILES_DEBUG_TOGGLE_SHORTCUT: string;
  var createFilesDebugTabId: RuntimeBindings["createFilesDebugTabId"];
  var formatFilesDebugTimestamp: RuntimeBindings["formatFilesDebugTimestamp"];
  var escapeFilesDebugHtml: RuntimeBindings["escapeFilesDebugHtml"];
  function fileInputDebugText(input: FileInputDebugValue): string {
    if (input === null) {
      return "";
    }
    let content: unknown =
      typeof input === "object" &&
      !(typeof Blob !== "undefined" && input instanceof Blob)
        ? input.content
        : input;
    if (typeof content === "string") {
      return content;
    } else {
      return "";
    }
  }
  function filesDebugEnabled(
    getStorage: () => Storage | null | undefined = ():
      | Storage
      | null
      | undefined => globalThis.localStorage,
  ): boolean {
    try {
      return getStorage()?.getItem("appifact-files-debug") === "1";
    } catch {
      return false;
    }
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
    ]!;
  }
  function filesDebugEventLevel(event: FilesDebugEvent): FilesDebugLevel {
    let type: string = event.type;
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
      let value: number = event.data?.status ?? 200;
      if (value === 0 || value >= 400) {
        return "error";
      } else {
        return "boot";
      }
    }
    if (type === "reconcile") {
      if (event.data?.ok === false) {
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
  function createFilesDebugPanel(input: FilesDebuggerOptions): FilesDebugger {
    let value: string = "hotdbg/" + input.product + "/",
      value2: Storage | null = ((): Storage | null => {
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
      callback: <T>(input2: string, options: T) => T = <T>(
        input2: string,
        options: T,
      ): T => {
        try {
          let value62: string | null | undefined = value2?.getItem(
            value + input2,
          );
          if (value62 === null || value62 === undefined) {
            return options;
          } else {
            return JSON.parse(value62);
          }
        } catch {
          return options;
        }
      },
      callback2: (input2: string, options: unknown) => void = (
        input2: string,
        options: unknown,
      ): void => {
        try {
          if (options === null) {
            value2?.removeItem(value + input2);
          } else {
            value2?.setItem(value + input2, JSON.stringify(options));
          }
        } catch {}
      },
      callback3: () => number = (): number =>
        typeof performance !== "undefined" ? performance.now() : Date.now(),
      value3: HotCapability | null = input.hot ?? null,
      value4: string = callback<string>("tab", "") || createFilesDebugTabId();
    callback2("tab", value4);
    let value5: number = input.bootStartedAt ?? callback3(),
      value6: FilesDebugEvent[] = callback<FilesDebugEvent[]>("log", []),
      entries: Map<string, string> = new Map(),
      entries2: Map<string, number[]> = new Map(),
      items: FilesDebugSeriesPoint[] = [],
      entries3: Map<string, string> = new Map(),
      index: number = 0,
      flag: boolean = false,
      state: FilesDebugSources = {},
      state2: FilesDebugErrorCounts = {
        conflict: 0,
        rate: 0,
        other: 0,
      },
      value7: FilesDebugLastPublish | undefined,
      items2: FilesDebugPublishError[] = [],
      value8: FilesDebugCrumb | null = callback<FilesDebugCrumb | null>(
        "crumb",
        null,
      ),
      value9: boolean = callback<boolean>("seen", false),
      flag2: boolean = false,
      value10: HotRestartOrigin | null | undefined;
    try {
      value10 = value3?.from;
      flag2 = value10 !== null && value10 !== undefined;
    } catch {}
    let value11: string | undefined = ((): string | undefined => {
        let value62: string | undefined = value10?.note;
        if (typeof value62 === "string") {
          return value62;
        } else {
          return undefined;
        }
      })(),
      value12: string;
    if (value8?.phase === "hot-restart") {
      value12 = "hot restart: " + (value8.reason ?? "asked by this page");
    } else if (value8?.phase === "publishing") {
      value12 =
        "reloaded during a publish of " +
        (value8.paths ?? []).join(", ") +
        " (likely a conflict: the shell reboots the tab that lost)";
    } else if (flag2) {
      value12 =
        "hot restart by the shell" +
        (value11 !== undefined
          ? " (note: " + value11 + ")"
          : " (no reason recorded here: no accept handler was registered in time, or the kernel restarted on its own)");
    } else if (value9) {
      value12 = "plain reload";
    } else {
      value12 = "first load";
    }
    let value13: string =
        value8?.phase === "hot-restart"
          ? "hot restart: " + (value8.reason ?? "?")
          : value8?.phase === "publishing"
            ? "during a publish"
            : flag2
              ? "hot restart by the shell"
              : value9
                ? "plain reload"
                : "first load",
      value14: Record<string, number> = callback<Record<string, number>>(
        "reasons",
        {},
      );
    value14[value13] = (value14[value13] ?? 0) + 1;
    callback2("reasons", value14);
    let value15: FilesDebugReload[] = callback<FilesDebugReload[]>(
      "reloads",
      [],
    );
    value15.push({
      t: Date.now(),
      reason: value12,
    });
    if (value15.length > 60) {
      value15.splice(0, value15.length - 60);
    }
    callback2("reloads", value15);
    callback2("crumb", null);
    callback2("seen", true);
    let entries4: Map<string, FilesDebugOption> = new Map();
    function value16(input2: string, options: string): () => boolean {
      if (!entries4.has(input2)) {
        entries4.set(input2, {
          label: options,
          on: callback<boolean>("opt/" + input2, true),
        });
      }
      return (): boolean => entries4.get(input2)?.on ?? true;
    }
    let value17: ReturnType<typeof setTimeout> | undefined,
      flag3: boolean = false,
      callback4: () => void = (): void => {
        if (!flag3 || value17 !== undefined) {
          return;
        }
        value17 = setTimeout((): void => {
          value17 = undefined;
          if (flag3) {
            callback2("log", value6.slice(-FILES_DEBUG_EVENT_STAGGER_MS));
          }
        }, 250);
      };
    function value18(input2: string, options?: FilesDebugEventData): void {
      value6.push({
        t: Date.now(),
        type: input2,
        ...(options !== undefined
          ? {
              data: options,
            }
          : {}),
      });
      if (value6.length > FILES_DEBUG_REFRESH_MS) {
        value6.splice(0, value6.length - FILES_DEBUG_REFRESH_MS);
      }
      callback4();
      value44("events");
    }
    function value19(input2: string, options: number): void {
      if (!Number.isFinite(options)) {
        return;
      }
      let value62: number[] = entries2.get(input2) ?? [];
      value62.push(Math.round(options));
      if (value62.length > 300) {
        value62.shift();
      }
      entries2.set(input2, value62);
      value44("timing");
    }
    let callback5: () => boolean = (): boolean =>
        typeof document !== "undefined" &&
        document.visibilityState !== "visible",
      value20: number | undefined = callback5() ? Date.now() : undefined;
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", (): void => {
        value20 = callback5() ? Date.now() : undefined;
        value18("visibility", {
          state: document.visibilityState,
        });
      });
    }
    let value21: string = "hotdbg-" + input.product,
      value22: FilesDebugPing[] = callback<FilesDebugPing[]>("pings", []),
      callback6: () => void = (): void => {
        value22 = value22
          .filter(
            (input2: FilesDebugPing): boolean =>
              Date.now() - input2.recvAt < 60000,
          )
          .slice(-40);
        callback2("pings", value22);
      };
    function value23(input2?: RawFilesDebugPing | null): void {
      let value62: RawFilesDebugPing | null | undefined =
        input2?.data ?? input2;
      if (
        value62 === null ||
        typeof value62 !== "object" ||
        typeof value62.tab !== "string" ||
        value62.tab === value4 ||
        typeof value62.n !== "number" ||
        typeof value62.at !== "number"
      ) {
        return;
      }
      let state4: FilesDebugPing = {
        tab: value62.tab,
        n: value62.n,
        phase: value62.phase === "saved" ? "saved" : "saving",
        ...(typeof value62.version === "string"
          ? {
              version: value62.version,
            }
          : {}),
        at: value62.at,
        recvAt: Date.now(),
        ...(Array.isArray(value62.paths)
          ? {
              paths: value62.paths,
            }
          : {}),
      };
      value22.push(state4);
      callback6();
      value19("room ping", Math.max(0, state4.recvAt - state4.at));
      value18("peer-" + state4.phase, {
        from: state4.tab,
        n: state4.n,
        ...(state4.version !== undefined
          ? {
              version: state4.version,
            }
          : {}),
        ...(state4.paths !== undefined
          ? {
              paths: state4.paths,
            }
          : {}),
        skewedMs: state4.recvAt - state4.at,
      });
      value43();
    }
    let value24: (HostRoom & FilesDebugRoomEmitter) | null = null,
      flag4: boolean = false;
    if (input.room !== false) {
      (0, runtime.cachedHostRoom)().then(
        (input2: HostRoom | null): void => {
          value24 = input2;
          entries.set("room", value24 === null ? "off" : "connected");
          value44("header");
          if (value24 === null) {
            return;
          }
          try {
            value24.on?.(value21, value23, (): void => {
              return;
            });
          } catch {}
          let entries6: Map<string, number> = new Map();
          try {
            value24.onPeers?.((input3: RoomPeersEvent): void => {
              for (let value62 of input3.peers as readonly (FilesDebugRoomPeer | null)[]) {
                let value63: FilesDebugRoomPeer | null = value62,
                  value64: RawFilesDebugPing | undefined =
                    value63?.presence?.hotdbg;
                if (
                  value63 === null ||
                  value63.sameTab === true ||
                  value64 === undefined ||
                  typeof value64.tab !== "string" ||
                  typeof value64.n !== "number"
                ) {
                  continue;
                }
                let value65: string = value64.tab + "/" + String(value64.phase);
                if ((entries6.get(value65) ?? -1) >= value64.n) {
                  continue;
                }
                entries6.set(value65, value64.n);
                if (
                  !value22.some(
                    (input4: FilesDebugPing): boolean =>
                      input4.tab === value64.tab &&
                      input4.n === value64.n &&
                      input4.phase ===
                        (value64.phase === "saved" ? "saved" : "saving"),
                  )
                ) {
                  value23(value64);
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
    function value25(input2: FilesDebugPingUpdate): void {
      let state4: FilesDebugPingMessage = {
          tab: value4,
          at: Date.now(),
          ...input2,
        },
        value62: (HostRoom & FilesDebugRoomEmitter) | null = value24;
      if (value62 === null) {
        return;
      }
      let callback12: () => void = (): void => {
        flag4 = true;
        try {
          value62
            .presence?.({
              hotdbg: state4,
            })
            ?.catch?.((): void => {
              return;
            });
        } catch {}
      };
      if (flag4 || typeof value62.emit !== "function") {
        return callback12();
      }
      try {
        value62.emit(value21, state4).catch(callback12);
      } catch {
        callback12();
      }
    }
    let value26: number = callback<number>("saveN", 0),
      entries5: Map<number, FilesDebugInFlightSave> = new Map(),
      callback7: (input2: unknown) => unknown = (input2: unknown): unknown => {
        try {
          return JSON.parse(
            JSON.stringify(
              input2,
              (input3: string, items4: unknown): unknown =>
                typeof items4 === "string" && items4.length > 300
                  ? items4.slice(0, 300) + "…"
                  : items4,
            ),
          );
        } catch {
          return String(input2);
        }
      };
    function value27(input2: Iterable<string>, options: number): number {
      value26 += 1;
      callback2("saveN", value26);
      entries5.set(value26, {
        t: callback3(),
        paths: [...input2],
        bytes: options,
      });
      callback2("crumb", {
        phase: "publishing",
        paths: flag3 ? [...input2] : [],
        at: Date.now(),
      });
      value25({
        n: value26,
        phase: "saving",
        paths: [...input2],
      });
      value18("save-flush", {
        n: value26,
        paths: input2,
        bytes: options,
      });
      value44("queue");
      return value26;
    }
    function value28(input2: number, options: FilesDebugSaveOutcome): void {
      let entry: FilesDebugInFlightSave | undefined = entries5.get(input2);
      entries5.delete(input2);
      if (entries5.size === 0) {
        callback2("crumb", null);
      }
      let value62: number = entry !== undefined ? callback3() - entry.t : NaN;
      if (options.ok) {
        value19("publish call", value62);
        value7 = {
          n: input2,
          ms: Math.round(value62),
          ...(options.version !== undefined
            ? {
                version: options.version,
              }
            : {}),
          at: Date.now(),
        };
        if (options.version !== undefined) {
          entries.set("on version", options.version);
          for (let value63 of entry?.paths ?? [])
            entries3.set(value63, options.version);
          value25({
            n: input2,
            phase: "saved",
            version: options.version,
            ...(entry !== undefined
              ? {
                  paths: entry.paths,
                }
              : {}),
          });
        }
        value18("save-ok", {
          n: input2,
          ms: Math.round(value62),
          version: options.version,
        });
      } else {
        if (options.code === "conflict") {
          state2.conflict += 1;
        } else if (options.code === "rate_limited") {
          state2.rate += 1;
        } else {
          state2.other += 1;
        }
        items2.push({
          t: Date.now(),
          n: input2,
          ...(options.code !== undefined
            ? {
                code: options.code,
              }
            : {}),
          ...(options.raw !== undefined
            ? {
                raw: callback7(options.raw),
              }
            : {}),
        });
        if (items2.length > 30) {
          items2.shift();
        }
        value18(options.code === "conflict" ? "save-conflict" : "save-error", {
          n: input2,
          ms: Math.round(value62),
          code: options.code,
          ...(options.raw !== undefined
            ? {
                raw: callback7(options.raw),
              }
            : {}),
        });
      }
      value44("queue");
      value44("header");
      value43();
    }
    function value29(input2: string, options: FilesDebugVisibleHow): void {
      let value62: number = Date.now(),
        value63: boolean = value20 !== undefined,
        value64: number = value22.findIndex(
          (input3: FilesDebugPing): boolean =>
            input3.phase === "saved" && input3.version === input2,
        ),
        value65: number =
          value64 >= 0
            ? value22[value64]!.recvAt
            : options === "restarted"
              ? value62
              : -1;
      if (value65 < 0) {
        return;
      }
      let value66: FilesDebugPing[] = value22.filter(
        (input3: FilesDebugPing): boolean => input3.recvAt <= value65,
      );
      value22 = value22.filter(
        (input3: FilesDebugPing): boolean => input3.recvAt > value65,
      );
      callback6();
      let entries6: Map<string, FilesDebugPingPair> = new Map();
      for (let value67 of value66) {
        let value68: string = value67.tab + "#" + String(value67.n),
          value69: FilesDebugPingPair = entries6.get(value68) ?? {};
        value69[value67.phase] = value67;
        entries6.set(value68, value69);
      }
      for (let value67 of entries6.values()) {
        let value68: FilesDebugPing | undefined =
          value67.saving ?? value67.saved;
        if (value68 === undefined) {
          continue;
        }
        if (value63) {
          index += 1;
          continue;
        }
        let value69: number = value62 - value68.recvAt;
        value19(
          options === "adopted"
            ? "save → visible, adopted"
            : "save → visible, restarted",
          value69,
        );
        items.push({
          how: options,
          ms: value69,
        });
        if (items.length > 60) {
          items.shift();
        }
        if (value67.saved !== undefined) {
          value19("saved-ping → visible", value62 - value67.saved.recvAt);
        }
      }
      value18("visible", {
        version: input2,
        how: options,
        saves: entries6.size,
        hidden: value63,
      });
      value43();
    }
    function value30(input2: HotUpdateEvent): void {
      if (input2.type === "update") {
        entries.set(
          "hot shape",
          input2.shape === "calls" ? "three calls" : "string verdicts",
        );
        entries.set(
          "live seen",
          input2.to +
            (input2.toSeq !== undefined
              ? " · seq " + String(input2.toSeq)
              : ""),
        );
        if (input2.decision === "adopt") {
          entries.set(
            "on version",
            input2.to +
              (input2.toSeq !== undefined
                ? " · seq " + String(input2.toSeq)
                : ""),
          );
          flag = false;
        }
        if (input2.decision === "restart") {
          flag = true;
        }
      }
      if (input2.type === "restart") {
        flag = true;
      }
      if (input2.type === "applied") {
        flag = false;
        if (input2.grantLagMs !== undefined) {
          value19("adopt → first 200 (grant lag)", input2.grantLagMs);
        }
        for (let value62 of input2.paths ?? [])
          entries3.set(value62, input2.to);
        value44("files");
      }
      value18("hot-" + input2.type, input2);
      value44("header");
      value43();
    }
    function value31(input2: string): void {
      callback2("crumb", {
        phase: "hot-restart",
        reason: input2,
        at: Date.now(),
      });
      value18("restart-asked", {
        reason: input2,
      });
      if (flag3) {
        callback2("log", value6.slice(-FILES_DEBUG_EVENT_STAGGER_MS));
      }
    }
    let items3: FilesDebugPhase[] = [];
    function value32(input2: string): void {
      let value62: number = Math.round(callback3() - value5);
      items3.push({
        name: input2,
        ms: value62,
      });
      if (input2 === "first artboard painted" || input2 === "first paint") {
        value19("boot → first paint", value62);
      }
      if (input2 === "all painted") {
        value19("boot → all painted", value62);
      }
      value18("boot-phase", {
        name: input2,
        ms: value62,
      });
      value44("timing");
    }
    function value33(
      input2: string,
      options: number,
      context: number,
      value62?: boolean,
    ): void {
      value18("read", {
        path: input2,
        ms: Math.round(options),
        status: context,
        ...(value62
          ? {
              fresh: true,
            }
          : {}),
      });
    }
    let value34: StoredFilesDebugUi = callback<StoredFilesDebugUi>("ui", {}),
      state3: FilesDebugUiState = {
        open: value34.open === true,
        side: value34.side === "right" ? "right" : "bottom",
        size: {
          ...FILES_DEBUG_PANEL_DEFAULT_SIZE,
          ...(value34.size ?? {}),
        },
        tab: value34.tab ?? "events",
        kinds: {
          hot: true,
          save: true,
          boot: true,
          room: true,
          error: true,
          other: true,
          ...(value34.kinds ?? {}),
        },
        text: typeof value34.text === "string" ? value34.text : "",
        paused: false,
      };
    if (value34.open === undefined && callback<boolean>("open", false)) {
      state3.open = true;
    }
    let callback8: () => void = (): void => callback2("ui", state3);
    flag3 = state3.open;
    if (!flag3) {
      callback2("log", null);
    }
    let value35: HTMLDivElement | null = null,
      value36: ShadowRoot | null = null,
      value37: HTMLDivElement | null = null,
      value38: HTMLDivElement | null = null,
      value39: HTMLDivElement | null = null,
      value40: HTMLDivElement | null = null,
      value41: HTMLDivElement | null = null,
      value42: HTMLStyleElement | null = null,
      values: Set<FilesDebugEvent> = new Set(),
      values2: Set<FilesDebugSection> = new Set(),
      index2: number = 0,
      text: FilesDebugHealth = "ok";
    function value43(): void {
      let value62: number = Date.now(),
        value63: boolean =
          value22.some(
            (input2: FilesDebugPing): boolean =>
              input2.phase === "saved" && value62 - input2.recvAt < 15000,
          ) ||
          items2.some(
            (input2: FilesDebugPublishError): boolean =>
              value62 - input2.t < 1e4,
          ),
        value64: FilesDebugHealth = flag ? "bad" : value63 ? "behind" : "ok";
      if (value64 === text) {
        return;
      }
      text = value64;
      if (value38) {
        value38.dataset.status = text;
      }
      value44("header");
    }
    function value44(input2: FilesDebugSection): void {
      if (!state3.open || value36 === null) {
        return;
      }
      values2.add(input2);
      if (index2 !== 0 || typeof requestAnimationFrame !== "function") {
        return;
      }
      index2 = requestAnimationFrame((): void => {
        index2 = 0;
        value45();
      });
    }
    function value45(): void {
      if (!state3.open || value39 === null) {
        values2.clear();
        return;
      }
      if (values2.has("header")) {
        value49();
      }
      let tab: FilesDebugTab = state3.tab;
      if (tab === "events" && values2.has("events") && !state3.paused) {
        value51();
      }
      if (tab === "timing" && values2.has("timing")) {
        value53();
      }
      if (tab === "files" && (values2.has("files") || values2.has("queue"))) {
        value53();
      }
      if (tab === "queue" && (values2.has("queue") || values2.has("events"))) {
        value53();
      }
      values2.clear();
    }
    let callback9: (side: FilesDebugSide | null, size: number) => void = (
        input2: FilesDebugSide | null,
        options: number,
      ): void => {
        if (typeof document === "undefined") {
          return;
        }
        if (value42 === null) {
          value42 = document.createElement("style");
          value42.setAttribute("data-hot-debug-room", "");
          value42.textContent =
            ":root{--hotdbg-b:0px;--hotdbg-r:0px}html[data-hotdbg-open] .h-screen{height:calc(100vh - var(--hotdbg-b))!important}html[data-hotdbg-open] .h-dvh{height:calc(100dvh - var(--hotdbg-b))!important}html[data-hotdbg-open] .w-screen{width:calc(100vw - var(--hotdbg-r))!important}";
          document.head.appendChild(value42);
        }
        let documentElement: HTMLElement = document.documentElement;
        if (input2 === null) {
          documentElement.removeAttribute("data-hotdbg-open");
        } else {
          documentElement.setAttribute("data-hotdbg-open", input2);
        }
        documentElement.style.setProperty(
          "--hotdbg-b",
          input2 === "bottom" ? String(options) + "px" : "0px",
        );
        documentElement.style.setProperty(
          "--hotdbg-r",
          input2 === "right" ? String(options) + "px" : "0px",
        );
        try {
          window.dispatchEvent(new Event("resize"));
        } catch {}
      },
      value46: (side: FilesDebugSide | null, size: number) => void =
        input.makeRoom ?? callback9,
      value47: string = `
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
      callback10: <K extends keyof HTMLElementTagNameMap>(
        input2: K,
        options?: string,
        context?: string,
      ) => HTMLElementTagNameMap[K] = <K extends keyof HTMLElementTagNameMap>(
        input2: K,
        options?: string,
        context?: string,
      ): HTMLElementTagNameMap[K] => {
        let value62: HTMLElementTagNameMap[K] = document.createElement(input2);
        if (options !== undefined) {
          value62.className = options;
        }
        if (context !== undefined) {
          value62.textContent = context;
        }
        return value62;
      },
      callback11: () => "dark" | "light" = (): "dark" | "light" => {
        let value62: string | null =
          document.documentElement.getAttribute("data-theme") ??
          document.documentElement.getAttribute("data-mode");
        if (value62 === "dark" || value62 === "light") {
          return value62;
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
    function value48(input2: FilesDebugEvent): FilesDebugEventRow {
      let value62: FilesDebugEventData = input2.data ?? {},
        callback12: (input3?: unknown) => string = (
          input3?: unknown,
        ): string => {
          try {
            return JSON.stringify(input3);
          } catch {
            return String(input3);
          }
        };
      switch (input2.type) {
        case "hot-update": {
          let changed: HotChangedDescription[] | null = value62.changed!,
            value63: string =
              changed === null
                ? "changed: null"
                : changed
                    .map(
                      (input3: HotChangedDescription): string =>
                        input3.path +
                        (input3.klass === "code" ? " [CODE]" : ""),
                    )
                    .join(", ");
          return {
            cls:
              value62.decision === "restart"
                ? "error"
                : value62.decision === "defer"
                  ? "warn"
                  : "",
            text: `${String(value62.decision).toUpperCase()} · ${escapeFilesDebugHtml(String(value62.from))} → ${escapeFilesDebugHtml(String(value62.to))}${value62.toSeq !== undefined ? " seq " + String(value62.toSeq) : ""} · required ${String(value62.required)} · ${value63} · ${String(value62.why ?? "")}${value62.early === true ? " (early handler)" : ""}`,
          };
        }
        case "hot-fetch":
          return {
            cls: value62.ok === true ? "" : "warn",
            text: `${String(value62.path)} · try ${String(value62.attempt)} → ${value62.ok === true ? "200" : String(value62.status ?? "failed")} at +${String(value62.msAfterAdopt)} ms after adopt`,
          };
        case "hot-pending":
          return {
            cls: "warn",
            text: `still refused ${String(value62.msAfterAdopt)} ms after adopt: old content stays, retrying slowly · ${callback12(value62.paths)}`,
          };
        case "hot-applied":
          return {
            cls: "",
            text: `${String(value62.applied)}/${String(value62.rows)} rows in ${String(value62.ms)} ms · grant lag ${String(value62.grantLagMs ?? "—")} ms · retries ${String(value62.retries)} · ${callback12(value62.paths ?? [])}`,
          };
        case "hot-restart":
          return {
            cls: "error",
            text: `restart asked: ${String(value62.reason)}${value62.error !== undefined ? " · " + String(value62.error) : ""}`,
          };
        case "hot-deferred":
          return {
            cls: "warn",
            text: `deferred (${String(value62.reason)})`,
          };
        case "hot-reveal":
          return {
            cls: value62.timedOut === true ? "warn" : "",
            text: `restarted realm shown after holding the reveal ${String(value62.heldMs)} ms${value62.timedOut === true ? " (the hold ran out before the editor painted)" : ""}${value62.carried === true ? " · view carried" : ""}`,
          };
        case "reconcile": {
          let { regions: value63, guard: value64 }: FilesDebugEventData =
              value62,
            value65: FilesDebugOverlap[] = value62.overlapList ?? [];
          return {
            cls:
              value62.ok === true
                ? Number(value62.overlaps) > 0
                  ? "warn"
                  : ""
                : "error",
            text: `${String(value62.file)} · ${String(value62.trigger)} · ${value62.ok === true ? "FOLDED" : "NOT merged: " + String(value62.why ?? "")}${value63 !== undefined ? ` · template ${value63.template}, script ${value63.script}, outer ${value63.outer}` : ""} · ${String(value62.applied)} of mine re-applied · ${String(value62.overlaps)} overlaps${value65.length > 0 ? " (" + value65.map((input3: FilesDebugOverlap): string => `${input3.name}: mine ${String(input3.to)} over theirs ${String(input3.theirs)}`).join("; ") + ")" : ""}${value64 !== undefined ? ` · same tree: theirs ${String(value64.baseTheirs)}, mine ${String(value64.baseMine)}` : ""} · ${String(value62.ms)} ms`,
          };
        }
        case "reconcile-choice":
          return {
            cls: "",
            text: `${String(value62.file)} · the person chose: ${String(value62.choice)}`,
          };
        case "board-remote":
          return {
            cls: "",
            text: `${String(value62.file)} · ${String(value62.how)}${value62.why !== undefined ? " · " + String(value62.why) : ""}${value62.ms !== undefined ? " · " + String(value62.ms) + " ms" : ""}`,
          };
        case "save-flush":
          return {
            cls: "",
            text: `#${String(value62.n)} ${callback12(value62.paths)} · ${String(value62.bytes)} B`,
          };
        case "save-ok":
          return {
            cls: "",
            text: `#${String(value62.n)} published in ${String(value62.ms)} ms → ${escapeFilesDebugHtml(String(value62.version))}`,
          };
        case "save-conflict":
        case "save-error":
          return {
            cls: "error",
            text: `#${String(value62.n)} ${String(value62.code)} after ${String(value62.ms)} ms · ${callback12(value62.raw ?? "")}`,
          };
        case "boot":
          return {
            cls: "",
            text: String(value62.reason),
          };
        case "boot-phase":
          return {
            cls: "",
            text: `${String(value62.name)} at +${String(value62.ms)} ms`,
          };
        case "read":
          return {
            cls:
              Number(value62.status) >= 400 || value62.status === 0
                ? "warn"
                : "",
            text: `${String(value62.path)} · ${String(value62.status)} in ${String(value62.ms)} ms${value62.fresh === true ? " (no-store)" : ""}`,
          };
        case "peer-saving":
        case "peer-saved":
          return {
            cls: "",
            text: `${String(value62.from)} #${String(value62.n)}${value62.version !== undefined ? " → " + escapeFilesDebugHtml(String(value62.version)) : ""} ${callback12(value62.paths ?? [])}`,
          };
        default:
          return {
            cls: "",
            text: callback12(value62),
          };
      }
    }
    function value49(): void {
      let value62: Element | null | undefined = value39?.querySelector(".bar");
      if (!value62) {
        return;
      }
      value62.setAttribute("data-status", text);
      let callback12: (input2: string, options: string) => void = (
        input2: string,
        options: string,
      ): void => {
        let element: Element | null = value62.querySelector(
          '[data-f="' + input2 + '"]',
        );
        if (element && element.textContent !== options) {
          element.textContent = options;
        }
      };
      callback12("tab", value4);
      callback12("ver", entries.get("on version") ?? "—");
      callback12(
        "hot",
        value3 === null ? "absent" : (entries.get("hot shape") ?? "present"),
      );
      callback12(
        "status",
        text === "ok"
          ? "level with live"
          : text === "behind"
            ? "behind live"
            : "last update restarted",
      );
    }
    function value50(): FilesDebugEvent[] {
      let value62: string = state3.text.trim().toLowerCase(),
        items4: FilesDebugEvent[] = [];
      for (
        let value63: number = value6.length - 1;
        value63 >= 0 && items4.length < FILES_DEBUG_VIEW_REFRESH_MS;
        value63--
      ) {
        let value64: FilesDebugEvent = value6[value63]!;
        if (!state3.kinds[filesDebugEventLevel(value64)]) {
          continue;
        }
        if (value62 !== "") {
          let type: string = value64.type;
          try {
            type += " " + JSON.stringify(value64.data ?? "");
          } catch {}
          if (!type.toLowerCase().includes(value62)) {
            continue;
          }
        }
        items4.push(value64);
      }
      return items4;
    }
    function value51(): void {
      if (value41 === null) {
        return;
      }
      let value62: FilesDebugEvent[] = value50(),
        value63: DocumentFragment = document.createDocumentFragment();
      for (let value64 of value62) {
        let value65: FilesDebugEventRow = value48(value64),
          value66: FilesDebugLevel = filesDebugEventLevel(value64),
          value67: HTMLDivElement = callback10(
            "div",
            "row " + (value66 === "error" ? "error" : value65.cls),
          );
        value67.append(
          callback10("span", "t", formatFilesDebugTimestamp(value64.t)),
          callback10("span", "ty", value64.type),
          callback10("span", "s", value65.text),
        );
        value67.title = "click for the raw event";
        value67.addEventListener("click", (): void => {
          if (values.has(value64)) {
            values.delete(value64);
          } else {
            values.add(value64);
          }
          value51();
        });
        value63.append(value67);
        if (values.has(value64)) {
          let text2: string = "";
          try {
            text2 = JSON.stringify(value64.data ?? {}, null, 1);
          } catch {
            text2 = String(value64.data);
          }
          value63.append(callback10("div", "raw", text2));
        }
      }
      if (value62.length === 0) {
        value63.append(
          callback10(
            "div",
            "pad mut",
            value6.length === 0
              ? "Nothing logged yet."
              : "No event matches the filters.",
          ),
        );
      }
      value41.replaceChildren(value63);
    }
    function value52(
      input2: readonly string[],
      options: readonly (readonly unknown[])[],
      context?: string,
    ): HTMLTableElement {
      let value62: HTMLTableElement = callback10("table", context);
      if (input2.some((input3: string): boolean => input3 !== "")) {
        let value63: HTMLTableRowElement = callback10("tr");
        for (let value64 of input2)
          value63.append(callback10("th", undefined, value64));
        value62.append(value63);
      }
      for (let value63 of options) {
        let value64: HTMLTableRowElement = callback10("tr");
        for (let value65 of value63)
          value64.append(callback10("td", undefined, String(value65)));
        value62.append(value64);
      }
      return value62;
    }
    function value53(): void {
      if (value40 === null) {
        return;
      }
      let value62: HTMLDivElement = value40;
      value41 = null;
      value62.replaceChildren();
      if (state3.tab === "events") {
        let value64: HTMLDivElement = callback10("div", "tools");
        for (let value67 of [
          "hot",
          "save",
          "boot",
          "room",
          "error",
          "other",
        ] as const) {
          let value68: HTMLButtonElement = callback10(
            "button",
            "fchip",
            value67,
          );
          value68.setAttribute("aria-pressed", String(state3.kinds[value67]));
          value68.addEventListener("click", (): void => {
            state3.kinds[value67] = !state3.kinds[value67];
            value68.setAttribute("aria-pressed", String(state3.kinds[value67]));
            callback8();
            value51();
          });
          value64.append(value68);
        }
        let value65: HTMLInputElement = callback10("input");
        value65.type = "text";
        value65.placeholder = "filter (path, version, reason…)";
        value65.value = state3.text;
        value65.addEventListener("input", (): void => {
          state3.text = value65.value;
          callback8();
          value51();
        });
        let value66: HTMLButtonElement = callback10(
          "button",
          "fchip",
          state3.paused ? "paused" : "live",
        );
        value66.setAttribute("aria-pressed", String(!state3.paused));
        value66.title = "pause the list (events keep being recorded)";
        value66.addEventListener("click", (): void => {
          state3.paused = !state3.paused;
          value66.textContent = state3.paused ? "paused" : "live";
          value66.setAttribute("aria-pressed", String(!state3.paused));
          if (!state3.paused) {
            value51();
          }
        });
        value64.append(
          value65,
          value66,
          callback10(
            "span",
            "mut",
            `newest first · ${String(FILES_DEBUG_VIEW_REFRESH_MS)} drawn at most · ${String(FILES_DEBUG_REFRESH_MS)} kept`,
          ),
        );
        value41 = callback10("div");
        value62.append(value64, value41);
        value51();
        return;
      }
      let value63: HTMLDivElement = callback10("div", "pad");
      value62.append(value63);
      if (state3.tab === "timing") {
        value63.append(callback10("h4", undefined, "timing · ms"));
        let value64: (string | number)[][] = [...entries2.entries()].map(
          ([input2, input3]: [string, number[]]): (string | number)[] => {
            let value68: number[] = [...input3].sort(
              (input4: number, options: number): number => input4 - options,
            );
            return [
              input2,
              sortedSampleQuantile(value68, 0.5),
              sortedSampleQuantile(value68, 0.95),
              value68[value68.length - 1]!,
              value68.length,
            ];
          },
        );
        value63.append(
          value64.length > 0
            ? value52(["", "p50", "p95", "max", "n"], value64)
            : callback10(
                "div",
                "mut",
                "No samples yet. Save in another tab and watch this one.",
              ),
        );
        if (index > 0) {
          value63.append(
            callback10(
              "div",
              "mut",
              `${String(index)} samples taken while this tab was hidden were left out.`,
            ),
          );
        }
        value63.append(
          callback10(
            "h4",
            undefined,
            "save → visible, newest on the right · green adopted, red restarted",
          ),
        );
        let value65: HTMLDivElement = callback10("div", "spark"),
          value66: number = Math.max(
            1,
            ...items.map((input2: FilesDebugSeriesPoint): number => input2.ms),
          );
        for (let value68 of items) {
          let value69: HTMLElement = callback10(
            "i",
            value68.how === "restarted" ? "r" : "",
          );
          value69.style.height =
            String(Math.max(2, Math.round((value68.ms / value66) * 40))) + "px";
          value69.title = value68.how + " · " + String(value68.ms) + " ms";
          value65.append(value69);
        }
        value63.append(
          items.length > 0 ? value65 : callback10("div", "mut", "—"),
        );
        value63.append(
          callback10("h4", undefined, "boot, from the entry module"),
        );
        let value67: number = Math.max(
          1,
          ...items3.map((input2: FilesDebugPhase): number => input2.ms),
        );
        for (let value68 of items3) {
          let value69: HTMLDivElement = callback10("div", "wf"),
            value70: HTMLDivElement = callback10("div"),
            value71: HTMLDivElement = callback10("div", "barx");
          value71.style.width =
            String(Math.max(1, Math.round((value68.ms / value67) * 100))) + "%";
          value70.append(value71);
          value69.append(
            callback10("span", undefined, value68.name),
            value70,
            callback10("span", "ms", "+" + String(value68.ms)),
          );
          value63.append(value69);
        }
        if (items3.length === 0) {
          value63.append(callback10("div", "mut", "—"));
        }
        if (entries4.size > 0) {
          value63.append(callback10("h4", undefined, "options"));
          for (let [value68, value69] of entries4) {
            let value70: HTMLLabelElement = callback10("label"),
              value71: HTMLInputElement = callback10("input");
            value71.type = "checkbox";
            value71.checked = value69.on;
            value71.addEventListener("change", (): void => {
              value69.on = value71.checked;
              callback2("opt/" + value68, value69.on);
              value18("option", {
                key: value68,
                on: value69.on,
              });
            });
            value70.append(
              value71,
              document.createTextNode(" " + value69.label),
            );
            value63.append(value70);
          }
        }
        return;
      }
      if (state3.tab === "files") {
        let items4: FilesDebugFileRow[] = [];
        try {
          items4 = (state.files?.() as FilesDebugFileRow[] | undefined) ?? [];
        } catch {
          items4 = [];
        }
        value63.append(
          callback10(
            "h4",
            undefined,
            `files this tab knows · ${String(items4.length)}`,
          ),
        );
        if (items4.length === 0) {
          value63.append(
            callback10(
              "div",
              "mut",
              state.files === undefined
                ? "This editor did not provide its file list."
                : "No files.",
            ),
          );
          return;
        }
        let value64: HTMLTableElement = callback10("table", "l"),
          value65: HTMLTableRowElement = callback10("tr");
        for (let value66 of [
          "path",
          "state",
          "on screen",
          "live",
          "size",
          "last changed at",
        ])
          value65.append(callback10("th", undefined, value66));
        value64.append(value65);
        for (let value66 of [...items4].sort(
          (input2: FilesDebugFileRow, options: FilesDebugFileRow): number =>
            input2.path < options.path ? -1 : 1,
        )) {
          let value67: HTMLTableRowElement = callback10("tr"),
            value68: HTMLTableCellElement = callback10("td");
          for (let value69 of (value66.state ?? "").split(" ").filter(Boolean))
            value68.append(
              callback10(
                "span",
                "st" +
                  (value69 === "conflicted"
                    ? " b"
                    : value69 === "behind" || value69 === "held"
                      ? " w"
                      : ""),
                value69,
              ),
            );
          value67.append(
            callback10("td", undefined, value66.path),
            value68,
            callback10("td", undefined, (value66.sha ?? "—").slice(0, 10)),
            callback10(
              "td",
              undefined,
              value66.liveSha === undefined
                ? ""
                : (value66.liveSha ?? "removed").slice(0, 10),
            ),
            callback10(
              "td",
              undefined,
              value66.size !== undefined ? String(value66.size) : "",
            ),
            callback10(
              "td",
              undefined,
              escapeFilesDebugHtml(entries3.get(value66.path)),
            ),
          );
          value64.append(value67);
        }
        value63.append(value64);
        return;
      }
      if (state3.tab === "queue") {
        let value64: FilesDebugQueueState | undefined;
        try {
          value64 = state.queue?.() as FilesDebugQueueState | undefined;
        } catch {
          value64 = undefined;
        }
        value63.append(callback10("h4", undefined, "now"));
        value63.append(
          value52(
            ["", ""],
            [
              [
                "dirty",
                value64 === undefined
                  ? "(not provided)"
                  : value64.dirty.length === 0
                    ? "none"
                    : value64.dirty.join(", "),
              ],
              [
                "in flight",
                entries5.size > 0
                  ? [...entries5.values()]
                      .map(
                        (input2: FilesDebugInFlightSave): string =>
                          input2.paths.join(", "),
                      )
                      .join(" | ")
                  : value64?.inFlight === true
                    ? "yes"
                    : "no",
              ],
              [
                "conflicted",
                value64?.conflicted !== undefined &&
                value64.conflicted.length > 0
                  ? value64.conflicted.join(", ")
                  : "none",
              ],
              [
                "last publish",
                value7 === undefined
                  ? "—"
                  : `#${String(value7.n)} · ${String(value7.ms)} ms → ${escapeFilesDebugHtml(value7.version)} · ${formatFilesDebugTimestamp(value7.at)}`,
              ],
              ["queue says", value64?.lastError ?? "ok"],
              ["publishes", String(value26)],
              [
                "errors",
                `409 conflict ×${String(state2.conflict)} · 429 rate limit ×${String(state2.rate)} · other ×${String(state2.other)}`,
              ],
              [
                "catch-up waits",
                value64?.note ??
                  "this editor does not wait for a newer version before saving yet",
              ],
            ],
            "l",
          ),
        );
        value63.append(
          callback10("h4", undefined, "publish errors, newest first"),
        );
        if (items2.length === 0) {
          value63.append(callback10("div", "mut", "none"));
        }
        for (let value65 of [...items2].reverse()) {
          let text2: string = "";
          try {
            text2 = JSON.stringify(value65.raw ?? {}, null, 1);
          } catch {
            text2 = String(value65.raw);
          }
          let value66: HTMLDivElement = callback10("div", "raw", text2);
          value66.style.marginLeft = "0";
          value63.append(
            callback10(
              "div",
              "mut",
              `${formatFilesDebugTimestamp(value65.t)} · #${String(value65.n)} · ${String(value65.code)}`,
            ),
            value66,
          );
        }
        return;
      }
      value63.append(
        callback10("h4", undefined, "this tab last loaded because"),
      );
      value63.append(callback10("div", undefined, value12));
      value63.append(callback10("h4", undefined, "counts by reason"));
      value63.append(
        value52(
          ["reason", "times"],
          Object.entries(value14)
            .sort(
              (input2: [string, number], options: [string, number]): number =>
                options[1] - input2[1],
            )
            .map(([input2, input3]: [string, number]): [string, number] => [
              input2,
              input3,
            ]),
        ),
      );
      value63.append(callback10("h4", undefined, "history, newest first"));
      value63.append(
        value52(
          ["when", "reason"],
          [...value15]
            .reverse()
            .map((input2: FilesDebugReload): [string, string] => [
              formatFilesDebugTimestamp(input2.t),
              input2.reason,
            ]),
          "l",
        ),
      );
    }
    function value54(input2: FilesDebugSide, options: number): number {
      let value62: number = Math.round(
        (input2 === "bottom" ? window.innerHeight : window.innerWidth) * 0.8,
      );
      return Math.max(
        FILES_DEBUG_PANEL_MIN_SIZE[input2],
        Math.min(value62, Math.round(options)),
      );
    }
    function value55(): void {
      if (value39 === null || value37 === null) {
        return;
      }
      value37.className = "t-" + callback11();
      value39.className = "panel " + state3.side;
      let value62: number = value54(state3.side, state3.size[state3.side]);
      if (state3.side === "bottom") {
        value39.style.height = String(value62) + "px";
        value39.style.width = "";
      } else {
        value39.style.width = String(value62) + "px";
        value39.style.height = "";
      }
      value46(state3.open ? state3.side : null, state3.open ? value62 : 0);
    }
    function value56(): void {
      value39
        ?.querySelectorAll(".tab")
        .forEach((element: Element): void =>
          element.setAttribute(
            "aria-selected",
            String(element.getAttribute("data-tab") === state3.tab),
          ),
        );
    }
    function value57(input2: boolean): void {
      state3.open = input2;
      flag3 = input2;
      if (input2) {
        callback4();
      } else {
        callback2("log", null);
      }
      callback8();
      if (value38) {
        value38.dataset.open = input2 ? "1" : "0";
      }
      if (value39) {
        value39.style.display = input2 ? "flex" : "none";
      }
      if (input2) {
        value55();
        value49();
        value56();
        value53();
      } else {
        value46(null, 0);
      }
    }
    function value58(): void {
      if (value36 === null) {
        return;
      }
      value37 = callback10("div", "t-" + callback11());
      let value62: HTMLDivElement = value37;
      value38 = callback10("div", "chip");
      value38.dataset.status = text;
      value38.dataset.open = "0";
      value38.title =
        "hot-reload debug panel (" + FILES_DEBUG_TOGGLE_SHORTCUT + ")";
      value38.append(
        callback10("span", "dot"),
        callback10("span", undefined, "hot"),
        callback10("span", "mono", value4),
      );
      value38.addEventListener("click", (): void => value57(true));
      value39 = callback10("div", "panel " + state3.side);
      value39.style.display = "none";
      value39.tabIndex = -1;
      let value63: HTMLDivElement = callback10("div", "grip");
      value63.title = "drag to resize · double-click to reset";
      value63.addEventListener("dblclick", (): void => {
        state3.size[state3.side] = FILES_DEBUG_PANEL_DEFAULT_SIZE[state3.side];
        callback8();
        value55();
      });
      value63.addEventListener("pointerdown", (event: PointerEvent): void => {
        event.preventDefault();
        value63.classList.add("on");
        let value70: HTMLDivElement = callback10("div", "shield");
        value70.style.cursor =
          state3.side === "bottom" ? "ns-resize" : "ew-resize";
        value62.append(value70);
        let callback14: (input2: PointerEvent) => void = (
            input2: PointerEvent,
          ): void => {
            state3.size[state3.side] = value54(
              state3.side,
              state3.side === "bottom"
                ? window.innerHeight - input2.clientY
                : window.innerWidth - input2.clientX,
            );
            value55();
          },
          callback15: () => void = (): void => {
            value70.remove();
            value63.classList.remove("on");
            window.removeEventListener("pointermove", callback14, true);
            window.removeEventListener("pointerup", callback15, true);
            window.removeEventListener("pointercancel", callback15, true);
            callback8();
          };
        window.addEventListener("pointermove", callback14, true);
        window.addEventListener("pointerup", callback15, true);
        window.addEventListener("pointercancel", callback15, true);
      });
      let value64: HTMLDivElement = callback10("div", "bar");
      value64.setAttribute("data-status", text);
      let callback12: (input2: string, options: string) => void = (
        input2: string,
        options: string,
      ): void => {
        value64.append(callback10("span", "k", input2));
        let value70: HTMLSpanElement = callback10("span", "v");
        value70.setAttribute("data-f", options);
        value64.append(value70);
      };
      value64.append(callback10("span", "dot"));
      let value65: HTMLSpanElement = callback10("span");
      value65.setAttribute("data-f", "status");
      value64.append(value65);
      callback12("tab", "tab");
      callback12("version", "ver");
      callback12("slidesHost.hot", "hot");
      value64.append(callback10("span", "sp"));
      let callback13: (
        input2: string,
        options: string,
        context: () => void,
      ) => void = (
        input2: string,
        options: string,
        context: () => void,
      ): void => {
        let value70: HTMLButtonElement = callback10("button", "ib", input2);
        value70.title = options;
        value70.addEventListener("click", context);
        value64.append(value70);
      };
      callback13(
        "dock ⇄",
        "dock to the other side (bottom / right)",
        (): void => {
          state3.side = state3.side === "bottom" ? "right" : "bottom";
          callback8();
          value55();
        },
      );
      callback13("clear", "clear the log", (): void => {
        value6.length = 0;
        values.clear();
        callback2("log", value6);
        value53();
      });
      callback13("copy log", "copy the whole log as JSON", (): void => {
        let value70: string = value59(),
          flag6: boolean = false;
        try {
          navigator.clipboard?.writeText(value70).then(
            (): void => {
              flag6 = true;
            },
            (): void => {
              return;
            },
          );
        } catch {}
        setTimeout((): void => {
          if (flag6 || value40 === null) {
            return;
          }
          value40.querySelector("textarea")?.remove();
          let value71: HTMLTextAreaElement = callback10("textarea");
          value71.readOnly = true;
          value71.value = value70;
          value40.prepend(value71);
        }, 200);
      });
      callback13(
        "✕",
        "close (Esc while the panel has focus, or " +
          FILES_DEBUG_TOGGLE_SHORTCUT +
          ")",
        (): void => value57(false),
      );
      let value66: HTMLDivElement = callback10("div", "tabs");
      for (let [value70, value71] of [
        ["events", "Events"],
        ["timing", "Timing"],
        ["files", "Files"],
        ["queue", "Save queue"],
        ["reloads", "Reloads"],
      ] as const) {
        let value72: HTMLButtonElement = callback10("button", "tab", value71);
        value72.setAttribute("data-tab", value70);
        value72.addEventListener("click", (): void => {
          state3.tab = value70;
          callback8();
          value56();
          value53();
        });
        value66.append(value72);
      }
      value40 = callback10("div", "body");
      value39.append(value63, value64, value66, value40);
      value39.addEventListener("keydown", (input2: KeyboardEvent): void => {
        if (input2.key === "Escape") {
          input2.stopPropagation();
          value57(false);
        }
      });
      value62.append(value38, value39);
      let value67: HTMLStyleElement = callback10("style");
      value67.textContent = value47;
      value36.replaceChildren(value67, value62);
      if (state3.open) {
        value57(true);
      }
      try {
        new MutationObserver((): void => {
          if (value37) {
            value37.className = "t-" + callback11();
          }
        }).observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["data-theme", "data-mode"],
        });
      } catch {}
      let { innerWidth: value68, innerHeight: value69 }: Window = window;
      window.addEventListener("resize", (): void => {
        if (
          !state3.open ||
          (window.innerWidth === value68 && window.innerHeight === value69)
        ) {
          return;
        }
        value68 = window.innerWidth;
        value69 = window.innerHeight;
        value55();
      });
      setInterval(value43, 3000);
    }
    function value59(): string {
      let state4: Record<
        string,
        { p50: number; p95: number; max: number; n: number }
      > = {};
      for (let [value64, value65] of entries2) {
        let value66: number[] = [...value65].sort(
          (input2: number, options: number): number => input2 - options,
        );
        state4[value64] = {
          p50: sortedSampleQuantile(value66, 0.5),
          p95: sortedSampleQuantile(value66, 0.95),
          max: value66[value66.length - 1]!,
          n: value66.length,
        };
      }
      let value62: unknown, value63: unknown;
      try {
        value62 = state.files?.();
      } catch {}
      try {
        value63 = state.queue?.();
      } catch {}
      return JSON.stringify(
        {
          tab: value4,
          reloadReason: value12,
          reasons: value14,
          reloads: value15,
          fields: Object.fromEntries(entries),
          stats: state4,
          excludedHidden: index,
          phases: items3,
          counters: state2,
          publishErrors: items2,
          series: items,
          files: value62,
          queue: value63,
          log: value6,
        },
        null,
        1,
      );
    }
    let flag5: boolean = false;
    function value60(): void {
      if (flag5 || typeof window === "undefined") {
        return;
      }
      flag5 = true;
      let callback12: (input2: Event) => boolean = (input2: Event): boolean => {
        try {
          return value39 !== null && input2.composedPath().includes(value39);
        } catch {
          return false;
        }
      };
      window.addEventListener(
        "keydown",
        (event: KeyboardEvent): void => {
          if (
            event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            (event.key === "`" || event.code === "Backquote")
          ) {
            event.preventDefault();
            event.stopImmediatePropagation();
            value57(!state3.open);
            return;
          }
          if (!callback12(event)) {
            return;
          }
          event.stopImmediatePropagation();
          if (event.key === "Escape") {
            value57(false);
          }
        },
        true,
      );
      for (let value62 of [
        "keyup",
        "keypress",
        "copy",
        "cut",
        "paste",
        "wheel",
        "contextmenu",
      ] as const)
        window.addEventListener(
          value62,
          (input2: Event): void => {
            if (callback12(input2)) {
              input2.stopImmediatePropagation();
            }
          },
          true,
        );
    }
    function value61(input2: string): void {
      if (
        input2 !== "files" ||
        typeof document === "undefined" ||
        value35 !== null
      ) {
        return;
      }
      value60();
      let callback12: () => void = (): void => {
        if (value35 !== null) {
          return;
        }
        value35 = document.createElement("div");
        value35.setAttribute("data-hot-debug", "");
        value35.style.cssText =
          "position:fixed;left:0;top:0;width:0;height:0;z-index:2147483000;pointer-events:none";
        value36 = value35.attachShadow({
          mode: "open",
        });
        (document.body ?? document.documentElement).appendChild(value35);
        value58();
      };
      if (document.body !== null) {
        callback12();
      } else {
        document.addEventListener("DOMContentLoaded", callback12, {
          once: true,
        });
      }
    }
    value18("boot", {
      reason: value12,
      viaHot: flag2,
      ...(value10 !== undefined && value10 !== null
        ? {
            hotFrom: value10,
          }
        : {}),
      ...(value8 !== null
        ? {
            crumb: value8,
          }
        : {}),
    });
    return {
      tab: value4,
      reloadReason: value12,
      field(input2: string, options: string): void {
        entries.set(input2, options);
        value44("header");
      },
      event: value18,
      hotEvent: value30,
      beforeRestart: value31,
      saveStart: value27,
      saveEnd: value28,
      phase: value32,
      read: value33,
      visible: value29,
      sample: value19,
      mount: value61,
      exportJson: value59,
      option: value16,
      provide(input2: FilesDebugSources): void {
        state = {
          ...state,
          ...input2,
        };
        value44("files");
        value44("queue");
      },
    };
  }
  function instrumentFilesPort(
    port: BrowserFilesPort,
    debug: FilesDebugger,
  ): BrowserFilesPort {
    let value: BrowserFilesPort = Object.create(port);
    value.publish = async (
      input: FilePublishEntries,
      options?: FilesPublishCallOptions,
    ): Promise<FilesPublishResult> => {
      let value2: number | undefined;
      try {
        value2 = debug.saveStart(
          Object.keys(input),
          Object.values(input).reduce(
            (input2: number, options2: FilePublishInput): number =>
              input2 + (0, runtime.filePublishEncodedBytes)(options2),
            0,
          ),
        );
      } catch {}
      let value3: FilesPublishResult = await port.publish(input, options);
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
  function createNoopFilesDebugger(): FilesDebugger {
    let callback: () => void = (): void => {
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
      option: (): (() => boolean) => (): boolean => true,
      provide: callback,
    };
  }
  function createFilesDebugger(options: FilesDebuggerOptions): FilesDebugger {
    if (filesDebugEnabled()) {
      return createFilesDebugPanel(options);
    } else {
      return createNoopFilesDebugger();
    }
  }
  bindRuntimeValue(runtime, "fileInputDebugText", () => fileInputDebugText);
  bindRuntimeValue(runtime, "filesDebugEnabled", () => filesDebugEnabled);
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
    "escapeFilesDebugHtml",
    () => escapeFilesDebugHtml,
    (value) => {
      escapeFilesDebugHtml = value;
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
    createFilesDebugTabId = (): string =>
      Math.random().toString(36).slice(2, 6);
    formatFilesDebugTimestamp = (input: number): string =>
      new Date(input).toISOString().slice(11, 23);
    escapeFilesDebugHtml = (items: string | null | undefined): string =>
      items === undefined || items === null || items === ""
        ? "—"
        : items.length > 18
          ? items.slice(0, 10) + "…" + items.slice(-4)
          : items;
  };
}
