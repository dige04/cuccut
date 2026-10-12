import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installHostHotReload(runtime: RuntimeBindings): () => void {
  var isAppCodePath: (path: string) => boolean;
  var hotReloadBridges: WeakMap<object, Host.ActiveHotReloadBridge>;
  var activeHotReloadSession: Host.HotReloadBridge | undefined;
  function resolveClaudeHotApi(): Host.HotCapability | null {
    try {
      // CucCut: the host is globalThis.designSystemHost (packages/design-system/src/editor/design-system-host.ts), not globalThis.claude.
      let value = (
        globalThis as typeof globalThis &
          Pick<Host.ProtocolGlobal, "designSystemHost">
      ).designSystemHost?.hot;
      if (
        (typeof value === "object" || typeof value === "function") &&
        value !== null
      ) {
        return value;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  function createInactiveHotReloadBridge(): Host.HotReloadBridge {
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
    hot?: Host.HotCapability | null,
  ): Host.ActiveHotReloadBridge | undefined {
    let value = hot === undefined ? resolveClaudeHotApi() : hot;
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
    options: Host.HotReloadOptions = {},
  ): Host.HotReloadBridge {
    let value = options.hot !== undefined ? options.hot : resolveClaudeHotApi();
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
      callback = (input: () => void, options2: number) =>
        options.timers !== undefined
          ? options.timers.setTimeout(input, options2)
          : setTimeout(input, options2),
      callback2 = (input: ReturnType<typeof setTimeout>): void => {
        if (options.timers !== undefined) {
          options.timers.clearTimeout?.(input);
        } else {
          clearTimeout(input);
        }
      },
      items: Host.HotQueuedUpdate[] = [],
      items2: Host.HotEvent[] = [],
      items3: Host.HotEvent[] = [],
      state: Host.HotAttachment = {},
      value4: Host.HotOwedUpdate | undefined,
      value5: unknown,
      flag: boolean = false,
      flag2: boolean = false,
      flag3: boolean = false,
      flag4: boolean = false,
      value6: ((timedOut: boolean) => void) | undefined;
    function value7(input: Host.HotEvent): void {
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
    let callback3 = (input: Host.HotVersion) => ({
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
          () => value11(false),
          () => value11(false),
        );
      } else if (flag3 || flag4) {
        value11(false);
      }
    }
    function value9(
      input: Host.HotUpdate,
      options2: Host.HotEvent,
      context: string,
      value11: { version: string; seq?: number },
      extra: { version: string; seq?: number },
    ): "deferred" | undefined {
      value4 = {
        reason: context,
        from: value4?.from ?? value11,
        to: extra,
        at: value3(),
      };
      let value12: string =
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
    value.accept((input) => {
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
        value13: string | string | undefined =
          input.required !== "none"
            ? "required"
            : input.changed !== null &&
                input.changed.some((input2) => value2(input2.path))
              ? "code"
              : undefined,
        state3 = {
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
              : input.changed.map((source) => ({
                  path: source.path,
                  kind: String(source.kind),
                  klass: value2(source.path) ? "code" : "content",
                })),
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
    let flag5: boolean = false;
    function value10(): void {
      if (flag5 || typeof value?.ready !== "function") {
        return;
      }
      flag5 = true;
      try {
        value.ready((input) => {
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
              value12 = callback(
                () => callback4(true),
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
        value.snapshot((input) =>
          flag4
            ? null
            : state.snapshot !== undefined
              ? state.snapshot(input)
              : (value5 ?? null),
        );
      } catch {}
    }
    let state2: Host.ActiveHotReloadBridge = {
      active: true,
      queued: items,
      get restarted(): boolean {
        return flag;
      },
      get carried() {
        return value5;
      },
      events: items2,
      owed: () => value4,
      takeOwed() {
        let value11 = value4;
        value4 = undefined;
        return value11;
      },
      attach(input): void {
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
          for (let value11 of items3.splice(0)) {
            try {
              input.onEvent(value11);
            } catch {}
          }
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
      live: () => !flag3 && !flag4,
    };
    hotReloadBridges.set(value, state2);
    return state2;
  }
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
  bindRuntimeValue(runtime, "resolveClaudeHotApi", () => resolveClaudeHotApi);
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
    "activeHotReloadSession",
    () => activeHotReloadSession,
    (value) => {
      activeHotReloadSession = value;
    },
  );
  return () => {
    isAppCodePath = (path: string) =>
      path === "index.html" ||
      path === "SKILL.md" ||
      path.startsWith("artifact-type/");
    hotReloadBridges = new WeakMap();
    activeHotReloadSession =
      typeof window === "undefined" ? undefined : createHotReloadBridge();
  };
}
