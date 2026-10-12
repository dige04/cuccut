/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** What the document still had to save when the page was being hidden or unloaded. */
export interface UnloadFlushPending {
  /** Slide files with unsaved edits. */
  paths: string[];
  /** Whether the deck index has unsaved edits. */
  index: boolean;
  /** A gesture is still in progress, so part of the edit is owed to the next publish. */
  owed: boolean;
}

/** The part of a slides files document the unload flush drives. */
export interface UnloadFlushDocument {
  dirty(): boolean;
  /** Commits and force-publishes whatever is dirty; `why` names the trigger. */
  flushForUnload(why: string): UnloadFlushPending;
  /** Resolves once the save queue is idle. */
  settle(): Promise<unknown>;
  saveState(): { status: string; message?: string };
}

/** Outcome record written to session storage, reported to the debugger, and read back on the next load. */
export interface UnloadFlushReport extends Partial<UnloadFlushPending> {
  /** What triggered the flush (`pagehide`, `visibility hidden`, `beforeunload`). */
  why: string;
  result: "nothing-to-save" | "attempted" | "landed" | "failed";
  note?: string;
  /** Milliseconds from the flush to the save settling. */
  ms?: number;
  /** Timestamp the record was stored at. */
  at?: number;
}

/** The unload-time page event; `beforeunload` is the one that can ask the browser to confirm leaving. */
export interface UnloadFlushEvent {
  preventDefault(): void;
  returnValue: unknown;
}

/** Anything that dispatches the page lifecycle events. */
export interface UnloadFlushEventTarget {
  addEventListener(
    type: string,
    listener: (event: UnloadFlushEvent) => void,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: UnloadFlushEvent) => void,
  ): void;
}

/** The window (or a stand-in) the flush listens on. */
export interface UnloadFlushWindow extends UnloadFlushEventTarget {
  document?: UnloadFlushEventTarget & { visibilityState?: string };
}

export type UnloadFlushStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export interface UnloadFlushOptions {
  win?: UnloadFlushWindow;
  now?: () => number;
  /** Where the last attempt is recorded; `null` disables recording. */
  storage?: UnloadFlushStorage | null;
  report?: (report: UnloadFlushReport) => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    installUnloadSaveFlush: (
      document2: UnloadFlushDocument,
      options?: UnloadFlushOptions,
    ) => () => void;
    readLastUnloadFlushReport: (
      storage?: UnloadFlushStorage | null,
    ) => UnloadFlushReport | undefined;
  }
}

export function installFilesUnloadFlush(runtime: RuntimeBindings): () => void {
  function installUnloadSaveFlush(
    document2: UnloadFlushDocument,
    options: UnloadFlushOptions = {},
  ): () => void {
    let window2: UnloadFlushWindow = options.win ?? globalThis;
    if (typeof window2?.addEventListener !== "function") {
      return () => {
        return;
      };
    }
    let now = options.now ?? (() => Date.now()),
      storage =
        options.storage !== undefined
          ? options.storage
          : ((): Storage | null => {
              try {
                return sessionStorage;
              } catch {
                return null;
              }
            })(),
      callback = (input: UnloadFlushReport | null): void => {
        try {
          if (input === null) {
            storage?.removeItem("slides-files/last-unload-flush");
          } else {
            storage?.setItem(
              "slides-files/last-unload-flush",
              JSON.stringify({
                ...input,
                at: now(),
              }),
            );
          }
        } catch {}
      },
      callback2 = (input: UnloadFlushReport): void => {
        try {
          options.report?.(input);
        } catch {}
      };
    function value(input: string): void {
      let value3 = document2.dirty(),
        value4 = now(),
        value5 = document2.flushForUnload(input);
      if (!value3 && value5.paths.length === 0 && !value5.index) {
        callback(null);
        return void callback2({
          why: input,
          ...value5,
          result: "nothing-to-save",
        });
      }
      let state: UnloadFlushReport = {
        why: input,
        ...value5,
        result: "attempted",
        ...(value5.owed
          ? {
              note: "a publish was already in flight; these ride the next one if the page lives that long",
            }
          : {}),
      };
      callback(state);
      callback2(state);
      document2.settle().then(
        () => {
          let status = document2.saveState().status,
            value6 = !document2.dirty() && status !== "error",
            state2: UnloadFlushReport = {
              why: input,
              ...value5,
              result: value6 ? "landed" : "failed",
              ms: now() - value4,
              ...(value6
                ? {}
                : {
                    note: document2.saveState().message ?? status,
                  }),
            };
          callback(value6 ? null : state2);
          callback2(state2);
        },
        () => {
          return;
        },
      );
    }
    let callback3 = (): void => value("pagehide"),
      callback4 = (): void => {
        if (window2.document?.visibilityState === "hidden") {
          value("visibility hidden");
        }
      },
      callback5 = (event: UnloadFlushEvent): void => {
        if (!document2.dirty()) {
          return;
        }
        value("beforeunload");
        event.preventDefault();
        event.returnValue = "";
      },
      value2: UnloadFlushEventTarget =
        typeof window2.document?.addEventListener === "function"
          ? window2.document
          : window2;
    window2.addEventListener("pagehide", callback3);
    value2.addEventListener("visibilitychange", callback4);
    window2.addEventListener("beforeunload", callback5);
    return () => {
      window2.removeEventListener("pagehide", callback3);
      value2.removeEventListener("visibilitychange", callback4);
      window2.removeEventListener("beforeunload", callback5);
    };
  }
  function readLastUnloadFlushReport(
    storage?: UnloadFlushStorage | null,
  ): UnloadFlushReport | undefined {
    let resolvedStorage =
      storage !== undefined
        ? storage
        : ((): Storage | null => {
            try {
              return sessionStorage;
            } catch {
              return null;
            }
          })();
    try {
      let value =
        resolvedStorage?.getItem("slides-files/last-unload-flush") ?? null;
      if (value === null) {
        return;
      }
      resolvedStorage?.removeItem("slides-files/last-unload-flush");
      return JSON.parse(value);
    } catch {
      return;
    }
  }
  bindRuntimeValue(
    runtime,
    "installUnloadSaveFlush",
    () => installUnloadSaveFlush,
  );
  bindRuntimeValue(
    runtime,
    "readLastUnloadFlushReport",
    () => readLastUnloadFlushReport,
  );
  return () => {};
}
