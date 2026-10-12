/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { SlidesHost } from "../../../slides/src/editor/slides-host";
import type {
  HotAcceptResult,
  HotCapability,
  HotChangedDescription,
  HotEarlyAttachment,
  HotEarlyBridge,
  HotIdleTimers,
  HotListingRef,
  HotQueuedUpdate,
  HotTimerHandle,
  HotUpdate,
  HotUpdateEvent,
  HotUpdateRecord,
} from "../files/hot-updates";
import type { FilesVersion } from "../files/read-retries";

/** The restart a deferred update owes: it is carried out when the editor detaches. */
export interface HotOwedRestart {
  reason: "required" | "code";
  from: FilesVersion;
  to: FilesVersion;
  /** When the update was deferred (ms). */
  at: number;
}
/** The hot-update listener registered at module start, before the editor exists; it queues what arrives. */
export interface HotReloadBridge extends HotEarlyBridge {
  /** False when the host has no hot capability (or the page is embedded): nothing is listened to. */
  readonly active: boolean;
  /** Content updates accepted while the editor was booting. */
  readonly queued: HotQueuedUpdate[];
  /** Whether this page was started by a hot restart. */
  readonly restarted: boolean;
  /** What the previous page carried over through `snapshot`. */
  readonly carried: unknown;
  /** The most recent events (at most 50). */
  readonly events: HotUpdateEvent[];
  owed(): HotOwedRestart | undefined;
  takeOwed(): HotOwedRestart | undefined;
  attach(attachment: HotEarlyAttachment): void;
  release(): void;
  /** Gives up listening; a restart owed by a deferred update is performed now. */
  detach(): void;
  /** Registers the `ready` handler (when not done at creation). */
  armReady(): void;
}
/** A bridge that listens to a live hot capability. */
interface ActiveHotReloadBridge extends HotReloadBridge {
  /** False once released or detached. */
  live(): boolean;
}
export interface HotReloadBridgeOptions {
  /** The hot capability; defaults to `slidesHost.hot`. */
  hot?: HotCapability | null;
  /** Embedded pages never take hot updates. */
  embedded?: boolean;
  /** Whether a changed path is the page's own code. */
  isCode?: (path: string) => boolean;
  now?: () => number;
  timers?: HotIdleTimers;
  /** "now" registers the `ready` handler immediately instead of at `armReady`. */
  ready?: "now";
  /** How long the reveal waits for the editor (ms). */
  revealHoldMs?: number;
}
/** `slidesHost` may carry a `hot` capability next to the declared ones. */
type HotHostGlobal = typeof globalThis & {
  slidesHost?: SlidesHost & { hot?: unknown };
};

declare module "../bindings" {
  interface RuntimeBindings {
    noop: () => void;
    /** Whether a changed path is the page's own code (not deck content). */
    isAppCodePath: (path: string) => boolean;
    hotReloadBridges: WeakMap<HotCapability, ActiveHotReloadBridge>;
    /** The host's `hot` capability, or null. */
    resolveHostHotApi: () => HotCapability | null;
    createInactiveHotReloadBridge: () => HotReloadBridge;
    /** The live bridge on the given (default: the host's) capability, if any. */
    currentHotReloadBridge: (
      hot?: HotCapability | null,
    ) => HotReloadBridge | undefined;
    createHotReloadBridge: (options?: HotReloadBridgeOptions) => HotReloadBridge;
    /** Whether the page is embedded in another artifact. */
    isEmbeddedArtifact: boolean;
    hotReloadBridge: HotReloadBridge;
  }
}

export function installHostHotReload(runtime: RuntimeBindings): () => void {
  var noop: () => void;
  var isAppCodePath: (path: string) => boolean;
  var hotReloadBridges: WeakMap<HotCapability, ActiveHotReloadBridge>;
  var isEmbeddedArtifact: boolean;
  var hotReloadBridge: HotReloadBridge;
  function resolveHostHotApi(): HotCapability | null {
    try {
      let value = (globalThis as HotHostGlobal).slidesHost?.hot;
      if (
        (typeof value === "object" || typeof value === "function") &&
        value !== null
      ) {
        return value as HotCapability;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  function createInactiveHotReloadBridge(): HotReloadBridge {
    return {
      active: false,
      queued: [],
      restarted: false,
      carried: undefined,
      events: [],
      owed: (): undefined => {
        return;
      },
      takeOwed: (): undefined => {
        return;
      },
      attach(): void {},
      release(): void {},
      detach(): void {},
      armReady(): void {},
    };
  }
  function currentHotReloadBridge(
    hot?: HotCapability | null,
  ): ActiveHotReloadBridge | undefined {
    let value = hot === undefined ? resolveHostHotApi() : hot;
    if (value === null) {
      return;
    }
    let entry = hotReloadBridges.get(value);
    if (entry !== undefined && entry.live()) {
      return entry;
    } else {
      return undefined;
    }
  }
  function createHotReloadBridge(
    options: HotReloadBridgeOptions = {},
  ): HotReloadBridge {
    let value =
      options.hot !== undefined ? options.hot : resolveHostHotApi();
    if (
      options.embedded === true ||
      value === null ||
      typeof value.accept !== "function"
    ) {
      return createInactiveHotReloadBridge();
    }
    let entry = hotReloadBridges.get(value);
    if (entry !== undefined && entry.live()) {
      return entry;
    }
    let value2 = options.isCode ?? isAppCodePath,
      value3 = options.now ?? ((): number => Date.now()),
      callback = (input: () => void, options2?: number): HotTimerHandle =>
        options.timers !== undefined
          ? options.timers.setTimeout(input, options2)
          : setTimeout(input, options2),
      callback2 = (input: HotTimerHandle): void => {
        if (options.timers !== undefined) {
          options.timers.clearTimeout?.(input);
        } else {
          clearTimeout(input);
        }
      },
      items: HotQueuedUpdate[] = [],
      items2: HotUpdateEvent[] = [],
      items3: HotUpdateEvent[] = [],
      state: Partial<HotEarlyAttachment> = {},
      value4: HotOwedRestart | undefined,
      value5: unknown,
      flag = false,
      flag2 = false,
      flag3 = false,
      flag4 = false,
      value6: ((timedOut: boolean) => void) | undefined;
    function value7(input: HotUpdateEvent): void {
      items2.push(input);
      if (items2.length > 50) {
        items2.shift();
      }
      if (state.onEvent === undefined) {
        items3.push(input);
        if (items3.length > 50) {
          items3.shift();
        }
        return;
      }
      try {
        state.onEvent(input);
      } catch {}
    }
    let callback3 = (input: HotListingRef): FilesVersion => ({
      version: input.ver,
      ...(input.seq !== undefined
        ? {
            seq: input.seq,
          }
        : {}),
    });
    function value8(): void {
      let value11 = value6;
      if (value11 === undefined) {
        return;
      }
      if (state.reveal !== undefined) {
        Promise.resolve(state.reveal).then(
          (): void => value11(false),
          (): void => value11(false),
        );
      } else if (flag3 || flag4) {
        value11(false);
      }
    }
    function value9(
      input: HotUpdate,
      options2: HotUpdateRecord,
      context: "required" | "code",
      value11: FilesVersion,
      extra: FilesVersion,
    ): "deferred" | undefined {
      value4 = {
        reason: context,
        from: value4?.from ?? value11,
        to: extra,
        at: value3(),
      };
      let value12 =
        context === "code"
          ? "a changed path is the page’s own code"
          : "required is " + String(input.required);
      value7({
        ...options2,
        decision: "defer",
        why:
          value12 +
          "; the editor is still booting, so the restart waits until it has attached",
      });
      value7({
        type: "deferred",
        from: value11.version,
        to: extra.version,
        reason: context,
      });
      if (typeof input.defer === "function") {
        try {
          input.defer();
        } catch {}
        return;
      }
      return "deferred";
    }
    value.accept((input: HotUpdate): HotAcceptResult => {
      if (flag4) {
        if (typeof input.restart === "function") {
          try {
            input.restart();
          } catch {}
          return;
        }
        return "restart";
      }
      if (flag3) {
        return;
      }
      let value11 = callback3(input.from),
        value12 = callback3(input.to),
        value13: "required" | "code" | undefined =
          input.required !== "none"
            ? "required"
            : input.changed !== null &&
                input.changed.some((input2): boolean => value2(input2.path))
              ? "code"
              : undefined,
        state3: HotUpdateRecord = {
          type: "update",
          from: value11.version,
          to: value12.version,
          ...(value11.seq !== undefined
            ? {
                fromSeq: value11.seq,
              }
            : {}),
          ...(value12.seq !== undefined
            ? {
                toSeq: value12.seq,
              }
            : {}),
          required: String(input.required),
          shape: typeof input.adopt === "function" ? "calls" : "string",
          changed:
            input.changed === null
              ? null
              : input.changed.map(
                  (source): HotChangedDescription => ({
                    path: source.path,
                    kind: String(source.kind),
                    klass: value2(source.path) ? "code" : "content",
                  }),
                ),
          busy: false,
          early: true,
        };
      if (value13 !== undefined) {
        return value9(input, state3, value13, value11, value12);
      }
      if (typeof input.adopt === "function") {
        try {
          input.adopt();
        } catch {
          return value9(input, state3, "required", value11, value12);
        }
      }
      items.push({
        from: value11,
        to: value12,
        changed: input.changed,
        at: value3(),
      });
      value7({
        ...state3,
        decision: "adopt",
        why: "content only; the editor is still booting, so the rows wait for it",
      });
      return "applied";
    });
    let flag5 = false;
    function value10(): void {
      if (flag5 || typeof value?.ready !== "function") {
        return;
      }
      flag5 = true;
      try {
        value.ready((input?: unknown): Promise<void> => {
          value5 = input;
          flag = true;
          if (state.restore !== undefined && !flag2) {
            flag2 = true;
            try {
              state.restore(input);
            } catch {}
          }
          let value11 = value3();
          return new Promise<void>((input2): void => {
            let callback4 = (input3: boolean): void => {
                if (value6 !== callback4) {
                  return;
                }
                value6 = undefined;
                if (!input3) {
                  callback2(value12);
                }
                value7({
                  type: "reveal",
                  heldMs: value3() - value11,
                  timedOut: input3,
                  carried: input !== undefined && input !== null,
                });
                input2();
              },
              value12: HotTimerHandle = callback(
                (): void => callback4(true),
                options.revealHoldMs ?? 4500,
              );
            value6 = callback4;
            value8();
          });
        });
      } catch {}
    }
    if (options.ready === "now") {
      value10();
    }
    if (typeof value.snapshot === "function") {
      try {
        value.snapshot(
          (input?: unknown): unknown =>
            flag4
              ? null
              : state.snapshot !== undefined
                ? state.snapshot(input)
                : (value5 ?? null),
        );
      } catch {}
    }
    let state2: ActiveHotReloadBridge = {
      active: true,
      queued: items,
      get restarted(): boolean {
        return flag;
      },
      get carried(): unknown {
        return value5;
      },
      events: items2,
      owed: (): HotOwedRestart | undefined => value4,
      takeOwed(): HotOwedRestart | undefined {
        let value11 = value4;
        value4 = undefined;
        return value11;
      },
      attach(input: HotEarlyAttachment): void {
        value10();
        if (input.snapshot !== undefined) {
          state.snapshot = input.snapshot;
        }
        if (input.restore !== undefined) {
          state.restore = input.restore;
        }
        if (input.reveal !== undefined) {
          state.reveal = input.reveal;
        }
        if (input.onBeforeRestart !== undefined) {
          state.onBeforeRestart = input.onBeforeRestart;
        }
        if (input.onEvent !== undefined) {
          state.onEvent = input.onEvent;
          for (let value11 of items3.splice(0))
            try {
              input.onEvent(value11);
            } catch {}
        }
        if (flag && !flag2 && state.restore !== undefined) {
          flag2 = true;
          try {
            state.restore(value5);
          } catch {}
        }
        value8();
      },
      release(): void {
        flag3 = true;
        value8();
      },
      detach(): void {
        if (flag4) {
          return;
        }
        flag3 = true;
        flag4 = true;
        value8();
        let value11 = value4;
        value4 = undefined;
        if (value11 === undefined) {
          return;
        }
        try {
          state.onBeforeRestart?.("deferred-update");
        } catch {}
        try {
          value.restart?.({
            note: "deferred-update",
          });
        } catch {}
      },
      armReady(): void {
        if (!flag4) {
          value10();
        }
      },
      live: (): boolean => !flag3 && !flag4,
    };
    hotReloadBridges.set(value, state2);
    return state2;
  }
  bindRuntimeValue(
    runtime,
    "noop",
    () => noop,
    (value) => {
      noop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isAppCodePath",
    () => isAppCodePath,
    (value) => {
      isAppCodePath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hotReloadBridges",
    () => hotReloadBridges,
    (value) => {
      hotReloadBridges = value;
    },
  );
  bindRuntimeValue(runtime, "resolveHostHotApi", () => resolveHostHotApi);
  bindRuntimeValue(
    runtime,
    "createInactiveHotReloadBridge",
    () => createInactiveHotReloadBridge,
  );
  bindRuntimeValue(
    runtime,
    "currentHotReloadBridge",
    () => currentHotReloadBridge,
  );
  bindRuntimeValue(
    runtime,
    "createHotReloadBridge",
    () => createHotReloadBridge,
  );
  bindRuntimeValue(
    runtime,
    "isEmbeddedArtifact",
    () => isEmbeddedArtifact,
    (value) => {
      isEmbeddedArtifact = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hotReloadBridge",
    () => hotReloadBridge,
    (value) => {
      hotReloadBridge = value;
    },
  );
  return () => {
    noop = (): void => {};
    isAppCodePath = (path: string): boolean =>
      path === "index.html" ||
      path === "SKILL.md" ||
      path.startsWith("artifact-type/");
    hotReloadBridges = new WeakMap();
    isEmbeddedArtifact =
      typeof window !== "undefined" &&
      (window as Window & { __appifactEmbed?: unknown }).__appifactEmbed !==
        undefined;
    hotReloadBridge = createHotReloadBridge({
      embedded: isEmbeddedArtifact,
    });
  };
}
