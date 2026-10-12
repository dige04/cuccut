/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformHotReload(runtime: RuntimeBindings): () => void {
  var isHotReloadCodeFile: Dynamic;
  var hotReloadControllers: Dynamic;
  var applicationBootTime: Dynamic;
  var isEmbeddedApplication: Dynamic;
  var hotReloadController: Dynamic;
  function getHotReloadCapability(): Dynamic {
    try {
      // CucCut: the host is globalThis.designHost (packages/design/src/editor/design-host.ts), not globalThis.claude.
      let value: Dynamic = (globalThis as Dynamic).designHost?.hot;
      return (typeof value == "object" || typeof value == "function") &&
        value !== null
        ? value
        : null;
    } catch {
      return null;
    }
  }
  function createDisabledHotReloadController(): Dynamic {
    return {
      active: false,
      queued: [],
      restarted: false,
      carried: undefined,
      events: [],
      owed: (): Dynamic => {},
      takeOwed: (): Dynamic => {},
      attach(): Dynamic {},
      release(): Dynamic {},
      detach(): Dynamic {},
      armReady(): Dynamic {},
    };
  }
  function getHotReloadController(input?: Dynamic): Dynamic {
    let value: Dynamic = input === undefined ? getHotReloadCapability() : input;
    if (value === null) return;
    let entry: Dynamic = hotReloadControllers.get(value);
    return entry !== undefined && entry.live() ? entry : undefined;
  }
  function createHotReloadController(input: Dynamic = {}): Dynamic {
    let value: Dynamic =
      input.hot !== undefined ? input.hot : getHotReloadCapability();
    if (
      input.embedded === true ||
      value === null ||
      typeof value.accept != "function"
    )
      return createDisabledHotReloadController();
    let entry: Dynamic = hotReloadControllers.get(value);
    if (entry !== undefined && entry.live()) return entry;
    let value2: Dynamic = input.isCode ?? isHotReloadCodeFile,
      value3: Dynamic = input.now ?? ((): Dynamic => Date.now()),
      callback: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic =>
        input.timers !== undefined
          ? input.timers.setTimeout(input2, options)
          : setTimeout(input2, options),
      callback2: Dynamic = (input2?: Dynamic): Dynamic => {
        input.timers !== undefined
          ? input.timers.clearTimeout?.(input2)
          : clearTimeout(input2);
      },
      items: Dynamic = [],
      items2: Dynamic = [],
      items3: Dynamic = [],
      state: Dynamic = {},
      value4: Dynamic,
      value5: Dynamic,
      flag: Dynamic = false,
      flag2: Dynamic = false,
      flag3: Dynamic = false,
      flag4: Dynamic = false,
      value6: Dynamic;
    function value7(input2?: Dynamic): Dynamic {
      items2.push(input2);
      items2.length > 50 && items2.shift();
      if (state.onEvent === undefined) {
        items3.push(input2);
        items3.length > 50 && items3.shift();
        return;
      }
      try {
        state.onEvent(input2);
      } catch {}
    }
    let callback3: Dynamic = (input2?: Dynamic): Dynamic => ({
      version: input2.ver,
      ...(input2.seq !== undefined
        ? {
            seq: input2.seq,
          }
        : {}),
    });
    function value8(): Dynamic {
      let value11: Dynamic = value6;
      value11 !== undefined &&
        (state.reveal !== undefined
          ? Promise.resolve(state.reveal).then(
              (): Dynamic => value11(false),
              (): Dynamic => value11(false),
            )
          : (flag3 || flag4) && value11(false));
    }
    function value9(
      input2?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      value11?: Dynamic,
      extra?: Dynamic,
    ): Dynamic {
      value4 = {
        reason: context,
        from: value4?.from ?? value11,
        to: extra,
        at: value3(),
      };
      let value12: Dynamic =
        context === "code"
          ? "a changed path is the page\u2019s own code"
          : "required is " + String(input2.required);
      value7({
        ...options,
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
      if (typeof input2.defer == "function") {
        try {
          input2.defer();
        } catch {}
        return;
      }
      return "deferred";
    }
    value.accept((input2?: Dynamic): Dynamic => {
      if (flag4) {
        if (typeof input2.restart == "function") {
          try {
            input2.restart();
          } catch {}
          return;
        }
        return "restart";
      }
      if (flag3) return;
      let value11: Dynamic = callback3(input2.from),
        value12: Dynamic = callback3(input2.to),
        value13: Dynamic =
          input2.required !== "none"
            ? "required"
            : input2.changed !== null &&
                input2.changed.some(
                  (input3?: Dynamic): Dynamic => value2(input3.path),
                )
              ? "code"
              : undefined,
        state3: Dynamic = {
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
          required: String(input2.required),
          shape: typeof input2.adopt == "function" ? "calls" : "string",
          changed:
            input2.changed === null
              ? null
              : input2.changed.map(
                  (source?: Dynamic): Dynamic => ({
                    path: source.path,
                    kind: String(source.kind),
                    klass: value2(source.path) ? "code" : "content",
                  }),
                ),
          busy: false,
          early: true,
        };
      if (value13 !== undefined)
        return value9(input2, state3, value13, value11, value12);
      if (typeof input2.adopt == "function")
        try {
          input2.adopt();
        } catch {
          return value9(input2, state3, "required", value11, value12);
        }
      items.push({
        from: value11,
        to: value12,
        changed: input2.changed,
        at: value3(),
      });
      value7({
        ...state3,
        decision: "adopt",
        why: "content only; the editor is still booting, so the rows wait for it",
      });
      return "applied";
    });
    let flag5: Dynamic = false;
    function value10(): Dynamic {
      if (!(flag5 || typeof value?.ready != "function")) {
        flag5 = true;
        try {
          value.ready((input2?: Dynamic): Dynamic => {
            value5 = input2;
            flag = true;
            if (state.restore !== undefined && !flag2) {
              flag2 = true;
              try {
                state.restore(input2);
              } catch {}
            }
            let value11: Dynamic = value3();
            return new Promise((input3?: Dynamic): Dynamic => {
              let callback4: Dynamic = (input4?: Dynamic): Dynamic => {
                  value6 === callback4 &&
                    ((value6 = undefined),
                    input4 || callback2(value12),
                    value7({
                      type: "reveal",
                      heldMs: value3() - value11,
                      timedOut: input4,
                      carried: input2 != null,
                    }),
                    input3());
                },
                value12: Dynamic = callback(
                  (): Dynamic => callback4(true),
                  input.revealHoldMs ?? 4500,
                );
              value6 = callback4;
              value8();
            });
          });
        } catch {}
      }
    }
    input.ready === "now" && value10();
    if (typeof value.snapshot == "function")
      try {
        value.snapshot(
          (input2?: Dynamic): Dynamic =>
            flag4
              ? null
              : state.snapshot !== undefined
                ? state.snapshot(input2)
                : (value5 ?? null),
        );
      } catch {}
    let state2: Dynamic = {
      active: true,
      queued: items,
      get restarted(): Dynamic {
        return flag;
      },
      get carried(): Dynamic {
        return value5;
      },
      events: items2,
      owed: (): Dynamic => value4,
      takeOwed(): Dynamic {
        let value11: Dynamic = value4;
        value4 = undefined;
        return value11;
      },
      attach(input2: Dynamic): Dynamic {
        value10();
        input2.snapshot !== undefined && (state.snapshot = input2.snapshot);
        input2.restore !== undefined && (state.restore = input2.restore);
        input2.reveal !== undefined && (state.reveal = input2.reveal);
        input2.onBeforeRestart !== undefined &&
          (state.onBeforeRestart = input2.onBeforeRestart);
        if (input2.onEvent !== undefined) {
          state.onEvent = input2.onEvent;
          for (let value11 of items3.splice(0) as Dynamic)
            try {
              input2.onEvent(value11);
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
      release(): Dynamic {
        flag3 = true;
        value8();
      },
      detach(): Dynamic {
        if (flag4) return;
        flag3 = true;
        flag4 = true;
        value8();
        let value11: Dynamic = value4;
        value4 = undefined;
        if (value11 !== undefined) {
          try {
            state.onBeforeRestart?.("deferred-update");
          } catch {}
          try {
            value.restart?.({
              note: "deferred-update",
            });
          } catch {}
        }
      },
      armReady(): Dynamic {
        flag4 || value10();
      },
      live: (): Dynamic => !flag3 && !flag4,
    };
    hotReloadControllers.set(value, state2);
    return state2;
  }
  bindRuntimeValue(
    runtime,
    "isHotReloadCodeFile",
    () => isHotReloadCodeFile,
    (value) => {
      isHotReloadCodeFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hotReloadControllers",
    () => hotReloadControllers,
    (value) => {
      hotReloadControllers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getHotReloadCapability",
    () => getHotReloadCapability,
  );
  bindRuntimeValue(
    runtime,
    "createDisabledHotReloadController",
    () => createDisabledHotReloadController,
  );
  bindRuntimeValue(
    runtime,
    "getHotReloadController",
    () => getHotReloadController,
  );
  bindRuntimeValue(
    runtime,
    "createHotReloadController",
    () => createHotReloadController,
  );
  bindRuntimeValue(
    runtime,
    "applicationBootTime",
    () => applicationBootTime,
    (value) => {
      applicationBootTime = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isEmbeddedApplication",
    () => isEmbeddedApplication,
    (value) => {
      isEmbeddedApplication = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hotReloadController",
    () => hotReloadController,
    (value) => {
      hotReloadController = value;
    },
  );
  return () => {
    isHotReloadCodeFile = (input?: Dynamic): Dynamic =>
      input === "index.html" ||
      input === "SKILL.md" ||
      input.startsWith("artifact-type/");
    hotReloadControllers = new WeakMap();
    applicationBootTime =
      typeof performance !== "undefined" ? performance.now() : 0;
    isEmbeddedApplication =
      typeof window !== "undefined" &&
      (window as Dynamic).__appifactEmbed !== undefined;
    hotReloadController = createHotReloadController({
      embedded: isEmbeddedApplication,
    });
  };
}
