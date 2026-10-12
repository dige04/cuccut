/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformHotDebugger(
  runtime: RuntimeBindings,
): () => void {
  var FILES_DEBUG_STORAGE_KEY: Dynamic;
  var HOT_DEBUG_SAMPLE_PERIOD_MS: Dynamic;
  var HOT_DEBUG_RENDER_DEBOUNCE_MS: Dynamic;
  var HOT_DEBUG_LOG_DEBOUNCE_MS: Dynamic;
  var HOT_DEBUG_PANEL_SIZE: Dynamic;
  var HOT_DEBUG_MIN_PANEL_SIZE: Dynamic;
  var HOT_DEBUG_SHORTCUT: Dynamic;
  var createHotDebugTabId: Dynamic;
  var formatHotDebugTimestamp: Dynamic;
  var abbreviateHotDebugValue: Dynamic;
  function classifyHotEditMetric(editEvent?: Dynamic): Dynamic {
    if (editEvent.type === "applied")
      return editEvent.applied > 0 ? ["edit", "success"] : null;
    if (editEvent.type !== "restart") return null;
    let value: Dynamic = runtime.HOT_EDIT_RESTART_CATEGORIES[editEvent.reason];
    return value === null ? null : ["edit", "failure", value];
  }
  function isFilesDebugEnabled(
    getStorage: Dynamic = (): Dynamic => (globalThis as Dynamic).localStorage,
  ): Dynamic {
    try {
      return getStorage()?.getItem(FILES_DEBUG_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }
  function quantile(sortedValues?: Dynamic, ratio?: Dynamic): Dynamic {
    return sortedValues.length === 0
      ? NaN
      : sortedValues[
          Math.min(
            sortedValues.length - 1,
            Math.floor((sortedValues.length - 1) * ratio + 0.5),
          )
        ];
  }
  function classifyHotDebugEvent(event?: Dynamic): Dynamic {
    let type: Dynamic = event.type;
    if (
      type === "hot-restart" ||
      type === "save-conflict" ||
      type === "save-error" ||
      type === "publish-raw-error" ||
      type === "restart-asked"
    )
      return "error";
    if (type === "read") {
      let value: Dynamic = event.data?.status ?? 200;
      return value === 0 || value >= 400 ? "error" : "boot";
    }
    return type === "reconcile"
      ? event.data?.ok === false
        ? "error"
        : "hot"
      : type.startsWith("hot-") ||
          type === "apply" ||
          type === "visible" ||
          type === "board-remote" ||
          type === "reveal-held" ||
          type === "reconcile-choice"
        ? "hot"
        : type.startsWith("save-") || type === "notice"
          ? "save"
          : type.startsWith("boot") || type === "listing-retried"
            ? "boot"
            : type.startsWith("peer-") || type === "visibility"
              ? "room"
              : "other";
  }
  function createHotReloadDebugger(options?: Dynamic): Dynamic {
    let storagePrefix: Dynamic = "hotdbg/" + options.product + "/",
      storage: Dynamic = ((): Dynamic => {
        try {
          return typeof sessionStorage === "undefined" ? null : sessionStorage;
        } catch {
          return null;
        }
      })(),
      readStoredValue: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
      ): Dynamic => {
        try {
          let value60: Dynamic = storage?.getItem(storagePrefix + input);
          return value60 == null ? options2 : JSON.parse(value60);
        } catch {
          return options2;
        }
      },
      callback: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => {
        try {
          options2 === null
            ? storage?.removeItem(storagePrefix + input)
            : storage?.setItem(storagePrefix + input, JSON.stringify(options2));
        } catch {}
      },
      callback2: Dynamic = (): Dynamic =>
        typeof performance !== "undefined" ? performance.now() : Date.now(),
      value: Dynamic = options.hot ?? null,
      value2: Dynamic = readStoredValue("tab", "") || createHotDebugTabId();
    callback("tab", value2);
    let value3: Dynamic = options.bootStartedAt ?? callback2(),
      value4: Dynamic = readStoredValue("log", []),
      entries: Dynamic = new Map(),
      entries2: Dynamic = new Map(),
      items: Dynamic = [],
      entries3: Dynamic = new Map(),
      index: Dynamic = 0,
      flag: Dynamic = false,
      state: Dynamic = {},
      state2: Dynamic = {
        conflict: 0,
        rate: 0,
        other: 0,
      },
      value5: Dynamic,
      items2: Dynamic = [],
      value6: Dynamic = readStoredValue("crumb", null),
      value7: Dynamic = readStoredValue("seen", false),
      flag2: Dynamic = false,
      value8: Dynamic;
    try {
      value8 = value?.from;
      flag2 = value8 != null;
    } catch {}
    let value9: Dynamic = ((): Dynamic => {
        let value60: Dynamic = value8?.note;
        return typeof value60 == "string" ? value60 : undefined;
      })(),
      value10: Dynamic;
    value6?.phase === "hot-restart"
      ? (value10 = "hot restart: " + (value6.reason ?? "asked by this page"))
      : value6?.phase === "publishing"
        ? (value10 =
            "reloaded during a publish of " +
            (value6.paths ?? []).join(", ") +
            " (likely a conflict: the shell reboots the tab that lost)")
        : flag2
          ? (value10 =
              "hot restart by the shell" +
              (value9 !== undefined
                ? " (note: " + value9 + ")"
                : " (no reason recorded here: no accept handler was registered in time, or the kernel restarted on its own)"))
          : value7
            ? (value10 = "plain reload")
            : (value10 = "first load");
    let value11: Dynamic =
        value6?.phase === "hot-restart"
          ? "hot restart: " + (value6.reason ?? "?")
          : value6?.phase === "publishing"
            ? "during a publish"
            : flag2
              ? "hot restart by the shell"
              : value7
                ? "plain reload"
                : "first load",
      value12: Dynamic = readStoredValue("reasons", {});
    value12[value11] = (value12[value11] ?? 0) + 1;
    callback("reasons", value12);
    let value13: Dynamic = readStoredValue("reloads", []);
    value13.push({
      t: Date.now(),
      reason: value10,
    });
    value13.length > 60 && value13.splice(0, value13.length - 60);
    callback("reloads", value13);
    callback("crumb", null);
    callback("seen", true);
    let entries4: Dynamic = new Map();
    function value14(input?: Dynamic, options2?: Dynamic): Dynamic {
      entries4.has(input) ||
        entries4.set(input, {
          label: options2,
          on: readStoredValue("opt/" + input, true),
        });
      return (): Dynamic => entries4.get(input)?.on ?? true;
    }
    let value15: Dynamic,
      flag3: Dynamic = false,
      callback3: Dynamic = (): Dynamic => {
        !flag3 ||
          value15 !== undefined ||
          (value15 = setTimeout((): Dynamic => {
            value15 = undefined;
            flag3 &&
              callback("log", value4.slice(-HOT_DEBUG_RENDER_DEBOUNCE_MS));
          }, 250));
      };
    function value16(input?: Dynamic, options2?: Dynamic): Dynamic {
      value4.push({
        t: Date.now(),
        type: input,
        ...(options2 !== undefined
          ? {
              data: options2,
            }
          : {}),
      });
      value4.length > HOT_DEBUG_SAMPLE_PERIOD_MS &&
        value4.splice(0, value4.length - HOT_DEBUG_SAMPLE_PERIOD_MS);
      callback3();
      value42("events");
    }
    function value17(input?: Dynamic, options2?: Dynamic): Dynamic {
      if (!Number.isFinite(options2)) return;
      let value60: Dynamic = entries2.get(input) ?? [];
      value60.push(Math.round(options2));
      value60.length > 300 && value60.shift();
      entries2.set(input, value60);
      value42("timing");
    }
    let callback4: Dynamic = (): Dynamic =>
        typeof document !== "undefined" &&
        (document as Dynamic).visibilityState !== "visible",
      value18: Dynamic = callback4() ? Date.now() : undefined;
    typeof document !== "undefined" &&
      (document as Dynamic).addEventListener(
        "visibilitychange",
        (): Dynamic => {
          value18 = callback4() ? Date.now() : undefined;
          value16("visibility", {
            state: (document as Dynamic).visibilityState,
          });
        },
      );
    let value19: Dynamic = "hotdbg-" + options.product,
      value20: Dynamic = readStoredValue("pings", []),
      callback5: Dynamic = (): Dynamic => {
        value20 = value20
          .filter((input?: Dynamic): Dynamic => Date.now() - input.recvAt < 6e4)
          .slice(-40);
        callback("pings", value20);
      };
    function value21(input?: Dynamic): Dynamic {
      let value60: Dynamic = input?.data ?? input;
      if (
        value60 === null ||
        typeof value60 != "object" ||
        typeof value60.tab != "string" ||
        value60.tab === value2 ||
        typeof value60.n != "number" ||
        typeof value60.at != "number"
      )
        return;
      let state4: Dynamic = {
        tab: value60.tab,
        n: value60.n,
        phase: value60.phase === "saved" ? "saved" : "saving",
        ...(typeof value60.version == "string"
          ? {
              version: value60.version,
            }
          : {}),
        at: value60.at,
        recvAt: Date.now(),
        ...(Array.isArray(value60.paths)
          ? {
              paths: value60.paths,
            }
          : {}),
      };
      value20.push(state4);
      callback5();
      value17("room ping", Math.max(0, state4.recvAt - state4.at));
      value16("peer-" + state4.phase, {
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
      value41();
    }
    let value22: Dynamic = null,
      flag4: Dynamic = false;
    options.room !== false &&
      (0, runtime.cachedRoomCapability)().then(
        (input?: Dynamic): Dynamic => {
          value22 = input;
          entries.set("room", value22 === null ? "off" : "connected");
          value42("header");
          if (value22 === null) return;
          try {
            value22.on?.(value19, value21, (): Dynamic => {});
          } catch {}
          let entries6: Dynamic = new Map();
          try {
            value22.onPeers?.((input2?: Dynamic): Dynamic => {
              for (let value60 of input2.peers as Dynamic) {
                let value61: Dynamic = value60,
                  value62: Dynamic = value61?.presence?.hotdbg;
                if (
                  value61 === null ||
                  value61.sameTab === true ||
                  value62 === undefined ||
                  typeof value62.tab != "string" ||
                  typeof value62.n != "number"
                )
                  continue;
                let value63: Dynamic =
                  value62.tab + "/" + String(value62.phase);
                (entries6.get(value63) ?? -1) >= value62.n ||
                  (entries6.set(value63, value62.n),
                  value20.some(
                    (input3?: Dynamic): Dynamic =>
                      input3.tab === value62.tab &&
                      input3.n === value62.n &&
                      input3.phase ===
                        (value62.phase === "saved" ? "saved" : "saving"),
                  ) || value21(value62));
              }
            });
          } catch {}
        },
        (): Dynamic => {},
      );
    function value23(input?: Dynamic): Dynamic {
      let state4: Dynamic = {
          tab: value2,
          at: Date.now(),
          ...input,
        },
        value60: Dynamic = value22;
      if (value60 === null) return;
      let callback11: Dynamic = (): Dynamic => {
        flag4 = true;
        try {
          value60
            .presence?.({
              hotdbg: state4,
            })
            ?.catch?.((): Dynamic => {});
        } catch {}
      };
      if (flag4 || typeof value60.emit != "function") return callback11();
      try {
        value60.emit(value19, state4).catch(callback11);
      } catch {
        callback11();
      }
    }
    let value24: Dynamic = readStoredValue("saveN", 0),
      entries5: Dynamic = new Map(),
      callback6: Dynamic = (input?: Dynamic): Dynamic => {
        try {
          return JSON.parse(
            JSON.stringify(
              input,
              (input2?: Dynamic, items4?: Dynamic): Dynamic =>
                typeof items4 == "string" && items4.length > 300
                  ? items4.slice(0, 300) + "\u2026"
                  : items4,
            ),
          );
        } catch {
          return String(input);
        }
      };
    function value25(input?: Dynamic, options2?: Dynamic): Dynamic {
      value24 += 1;
      callback("saveN", value24);
      entries5.set(value24, {
        t: callback2(),
        paths: [...input],
        bytes: options2,
      });
      callback("crumb", {
        phase: "publishing",
        paths: flag3 ? [...input] : [],
        at: Date.now(),
      });
      value23({
        n: value24,
        phase: "saving",
        paths: [...input],
      });
      value16("save-flush", {
        n: value24,
        paths: input,
        bytes: options2,
      });
      value42("queue");
      return value24;
    }
    function value26(input?: Dynamic, options2?: Dynamic): Dynamic {
      let entry: Dynamic = entries5.get(input);
      entries5.delete(input);
      entries5.size === 0 && callback("crumb", null);
      let value60: Dynamic = entry !== undefined ? callback2() - entry.t : NaN;
      if (options2.ok) {
        value17("publish call", value60);
        value5 = {
          n: input,
          ms: Math.round(value60),
          ...(options2.version !== undefined
            ? {
                version: options2.version,
              }
            : {}),
          at: Date.now(),
        };
        if (options2.version !== undefined) {
          entries.set("on version", options2.version);
          for (let value61 of (entry?.paths ?? []) as Dynamic)
            entries3.set(value61, options2.version);
          value23({
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
        value16("save-ok", {
          n: input,
          ms: Math.round(value60),
          version: options2.version,
        });
      } else {
        options2.code === "conflict"
          ? (state2.conflict += 1)
          : options2.code === "rate_limited"
            ? (state2.rate += 1)
            : (state2.other += 1);
        items2.push({
          t: Date.now(),
          n: input,
          ...(options2.code !== undefined
            ? {
                code: options2.code,
              }
            : {}),
          ...(options2.raw !== undefined
            ? {
                raw: callback6(options2.raw),
              }
            : {}),
        });
        items2.length > 30 && items2.shift();
        value16(options2.code === "conflict" ? "save-conflict" : "save-error", {
          n: input,
          ms: Math.round(value60),
          code: options2.code,
          ...(options2.raw !== undefined
            ? {
                raw: callback6(options2.raw),
              }
            : {}),
        });
      }
      value42("queue");
      value42("header");
      value41();
    }
    function value27(input?: Dynamic, options2?: Dynamic): Dynamic {
      let value60: Dynamic = Date.now(),
        value61: Dynamic = value18 !== undefined,
        value62: Dynamic = value20.findIndex(
          (input2?: Dynamic): Dynamic =>
            input2.phase === "saved" && input2.version === input,
        ),
        value63: Dynamic =
          value62 >= 0
            ? value20[value62].recvAt
            : options2 === "restarted"
              ? value60
              : -1;
      if (value63 < 0) return;
      let value64: Dynamic = value20.filter(
        (input2?: Dynamic): Dynamic => input2.recvAt <= value63,
      );
      value20 = value20.filter(
        (input2?: Dynamic): Dynamic => input2.recvAt > value63,
      );
      callback5();
      let entries6: Dynamic = new Map();
      for (let value65 of value64 as Dynamic) {
        let value66: Dynamic = value65.tab + "#" + String(value65.n),
          value67: Dynamic = entries6.get(value66) ?? {};
        value67[value65.phase] = value65;
        entries6.set(value66, value67);
      }
      for (let value65 of entries6.values() as Dynamic) {
        let value66: Dynamic = value65.saving ?? value65.saved;
        if (value66 === undefined) continue;
        if (value61) {
          index += 1;
          continue;
        }
        let value67: Dynamic = value60 - value66.recvAt;
        value17(
          options2 === "adopted"
            ? "save \u2192 visible, adopted"
            : "save \u2192 visible, restarted",
          value67,
        );
        items.push({
          how: options2,
          ms: value67,
        });
        items.length > 60 && items.shift();
        value65.saved !== undefined &&
          value17("saved-ping \u2192 visible", value60 - value65.saved.recvAt);
      }
      value16("visible", {
        version: input,
        how: options2,
        saves: entries6.size,
        hidden: value61,
      });
      value41();
    }
    function value28(input?: Dynamic): Dynamic {
      input.type === "update" &&
        (entries.set(
          "hot shape",
          input.shape === "calls" ? "three calls" : "string verdicts",
        ),
        entries.set(
          "live seen",
          input.to +
            (input.toSeq !== undefined
              ? " \xB7 seq " + String(input.toSeq)
              : ""),
        ),
        input.decision === "adopt" &&
          (entries.set(
            "on version",
            input.to +
              (input.toSeq !== undefined
                ? " \xB7 seq " + String(input.toSeq)
                : ""),
          ),
          (flag = false)),
        input.decision === "restart" && (flag = true));
      input.type === "restart" && (flag = true);
      if (input.type === "applied") {
        flag = false;
        input.grantLagMs !== undefined &&
          value17("adopt \u2192 first 200 (grant lag)", input.grantLagMs);
        for (let value60 of (input.paths ?? []) as Dynamic)
          entries3.set(value60, input.to);
        value42("files");
      }
      value16("hot-" + input.type, input);
      value42("header");
      value41();
    }
    function value29(input?: Dynamic): Dynamic {
      callback("crumb", {
        phase: "hot-restart",
        reason: input,
        at: Date.now(),
      });
      value16("restart-asked", {
        reason: input,
      });
      flag3 && callback("log", value4.slice(-HOT_DEBUG_RENDER_DEBOUNCE_MS));
    }
    let items3: Dynamic = [];
    function value30(input?: Dynamic): Dynamic {
      let value60: Dynamic = Math.round(callback2() - value3);
      items3.push({
        name: input,
        ms: value60,
      });
      (input === "first artboard painted" || input === "first paint") &&
        value17("boot \u2192 first paint", value60);
      input === "all painted" && value17("boot \u2192 all painted", value60);
      value16("boot-phase", {
        name: input,
        ms: value60,
      });
      value42("timing");
    }
    function value31(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
      value60?: Dynamic,
    ): Dynamic {
      value16("read", {
        path: input,
        ms: Math.round(options2),
        status: context,
        ...(value60
          ? {
              fresh: true,
            }
          : {}),
      });
    }
    let value32: Dynamic = readStoredValue("ui", {}),
      state3: Dynamic = {
        open: value32.open === true,
        side: value32.side === "right" ? "right" : "bottom",
        size: {
          ...HOT_DEBUG_PANEL_SIZE,
          ...(value32.size ?? {}),
        },
        tab: value32.tab ?? "events",
        kinds: {
          hot: true,
          save: true,
          boot: true,
          room: true,
          error: true,
          other: true,
          ...(value32.kinds ?? {}),
        },
        text: typeof value32.text == "string" ? value32.text : "",
        paused: false,
      };
    value32.open === undefined &&
      readStoredValue("open", false) &&
      (state3.open = true);
    let callback7: Dynamic = (): Dynamic => callback("ui", state3);
    flag3 = state3.open;
    flag3 || callback("log", null);
    let value33: Dynamic = null,
      value34: Dynamic = null,
      value35: Dynamic = null,
      value36: Dynamic = null,
      value37: Dynamic = null,
      value38: Dynamic = null,
      value39: Dynamic = null,
      value40: Dynamic = null,
      values: Dynamic = new Set(),
      values2: Dynamic = new Set(),
      index2: Dynamic = 0,
      text: Dynamic = "ok";
    function value41(): Dynamic {
      let value60: Dynamic = Date.now(),
        value61: Dynamic =
          value20.some(
            (input?: Dynamic): Dynamic =>
              input.phase === "saved" && value60 - input.recvAt < 15e3,
          ) ||
          items2.some((input?: Dynamic): Dynamic => value60 - input.t < 1e4),
        value62: Dynamic = flag ? "bad" : value61 ? "behind" : "ok";
      value62 !== text &&
        ((text = value62),
        value36 && (value36.dataset.status = text),
        value42("header"));
    }
    function value42(input?: Dynamic): Dynamic {
      !state3.open ||
        value34 === null ||
        (values2.add(input),
        !(index2 !== 0 || typeof requestAnimationFrame != "function") &&
          (index2 = requestAnimationFrame((): Dynamic => {
            index2 = 0;
            value43();
          })));
    }
    function value43(): Dynamic {
      if (!state3.open || value37 === null) {
        values2.clear();
        return;
      }
      values2.has("header") && value47();
      let tab: Dynamic = state3.tab;
      tab === "events" && values2.has("events") && !state3.paused && value49();
      tab === "timing" && values2.has("timing") && value51();
      tab === "files" &&
        (values2.has("files") || values2.has("queue")) &&
        value51();
      tab === "queue" &&
        (values2.has("queue") || values2.has("events")) &&
        value51();
      values2.clear();
    }
    let callback8: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => {
        if (typeof document === "undefined") return;
        value40 === null &&
          ((value40 = (document as Dynamic).createElement("style")),
          value40.setAttribute("data-hot-debug-room", ""),
          (value40.textContent =
            ":root{--hotdbg-b:0px;--hotdbg-r:0px}html[data-hotdbg-open] .h-screen{height:calc(100vh - var(--hotdbg-b))!important}html[data-hotdbg-open] .h-dvh{height:calc(100dvh - var(--hotdbg-b))!important}html[data-hotdbg-open] .w-screen{width:calc(100vw - var(--hotdbg-r))!important}"),
          (document as Dynamic).head.appendChild(value40));
        let documentElement: Dynamic = (document as Dynamic).documentElement;
        input === null
          ? documentElement.removeAttribute("data-hotdbg-open")
          : documentElement.setAttribute("data-hotdbg-open", input);
        documentElement.style.setProperty(
          "--hotdbg-b",
          input === "bottom" ? String(options2) + "px" : "0px",
        );
        documentElement.style.setProperty(
          "--hotdbg-r",
          input === "right" ? String(options2) + "px" : "0px",
        );
        try {
          (window as Dynamic).dispatchEvent(new Event("resize"));
        } catch {}
      },
      value44: Dynamic = options.makeRoom ?? callback8,
      value45: Dynamic = `
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
      callback9: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let value60: Dynamic = (document as Dynamic).createElement(input);
        options2 !== undefined && (value60.className = options2);
        context !== undefined && (value60.textContent = context);
        return value60;
      },
      callback10: Dynamic = (): Dynamic => {
        let value60: Dynamic =
          (document as Dynamic).documentElement.getAttribute("data-theme") ??
          (document as Dynamic).documentElement.getAttribute("data-mode");
        if (value60 === "dark" || value60 === "light") return value60;
        try {
          return matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
        } catch {
          return "dark";
        }
      };
    function value46(input?: Dynamic): Dynamic {
      let value60: Dynamic = input.data ?? {},
        callback11: Dynamic = (input2?: Dynamic): Dynamic => {
          try {
            return JSON.stringify(input2);
          } catch {
            return String(input2);
          }
        };
      switch (input.type) {
        case "hot-update": {
          let changed: Dynamic = value60.changed,
            value61: Dynamic =
              changed === null
                ? "changed: null"
                : changed
                    .map(
                      (input2?: Dynamic): Dynamic =>
                        input2.path +
                        (input2.klass === "code" ? " [CODE]" : ""),
                    )
                    .join(", ");
          return {
            cls:
              value60.decision === "restart"
                ? "error"
                : value60.decision === "defer"
                  ? "warn"
                  : "",
            text: `${String(value60.decision).toUpperCase()} \xB7 ${abbreviateHotDebugValue(String(value60.from))} \u2192 ${abbreviateHotDebugValue(String(value60.to))}${value60.toSeq !== undefined ? " seq " + String(value60.toSeq) : ""} \xB7 required ${String(value60.required)} \xB7 ${value61} \xB7 ${String(value60.why ?? "")}${value60.early === true ? " (early handler)" : ""}`,
          };
        }
        case "hot-fetch":
          return {
            cls: value60.ok === true ? "" : "warn",
            text: `${String(value60.path)} \xB7 try ${String(value60.attempt)} \u2192 ${value60.ok === true ? "200" : String(value60.status ?? "failed")} at +${String(value60.msAfterAdopt)} ms after adopt`,
          };
        case "hot-pending":
          return {
            cls: "warn",
            text: `still refused ${String(value60.msAfterAdopt)} ms after adopt: old content stays, retrying slowly \xB7 ${callback11(value60.paths)}`,
          };
        case "hot-applied":
          return {
            cls: "",
            text: `${String(value60.applied)}/${String(value60.rows)} rows in ${String(value60.ms)} ms \xB7 grant lag ${String(value60.grantLagMs ?? "\u2014")} ms \xB7 retries ${String(value60.retries)} \xB7 ${callback11(value60.paths ?? [])}`,
          };
        case "hot-restart":
          return {
            cls: "error",
            text: `restart asked: ${String(value60.reason)}${value60.error !== undefined ? " \xB7 " + String(value60.error) : ""}`,
          };
        case "hot-deferred":
          return {
            cls: "warn",
            text: `deferred (${String(value60.reason)})`,
          };
        case "hot-reveal":
          return {
            cls: value60.timedOut === true ? "warn" : "",
            text: `restarted realm shown after holding the reveal ${String(value60.heldMs)} ms${value60.timedOut === true ? " (the hold ran out before the editor painted)" : ""}${value60.carried === true ? " \xB7 view carried" : ""}`,
          };
        case "reconcile": {
          let regions: Dynamic = value60.regions,
            guard: Dynamic = value60.guard,
            value61: Dynamic = value60.overlapList ?? [];
          return {
            cls:
              value60.ok === true
                ? Number(value60.overlaps) > 0
                  ? "warn"
                  : ""
                : "error",
            text: `${String(value60.file)} \xB7 ${String(value60.trigger)} \xB7 ${value60.ok === true ? "FOLDED" : "NOT merged: " + String(value60.why ?? "")}${regions !== undefined ? ` \xB7 template ${regions.template}, script ${regions.script}, outer ${regions.outer}` : ""} \xB7 ${String(value60.applied)} of mine re-applied \xB7 ${String(value60.overlaps)} overlaps${value61.length > 0 ? " (" + value61.map((input2?: Dynamic): Dynamic => `${input2.name}: mine ${String(input2.to)} over theirs ${String(input2.theirs)}`).join("; ") + ")" : ""}${guard !== undefined ? ` \xB7 same tree: theirs ${String(guard.baseTheirs)}, mine ${String(guard.baseMine)}` : ""} \xB7 ${String(value60.ms)} ms`,
          };
        }
        case "reconcile-choice":
          return {
            cls: "",
            text: `${String(value60.file)} \xB7 the person chose: ${String(value60.choice)}`,
          };
        case "board-remote":
          return {
            cls: "",
            text: `${String(value60.file)} \xB7 ${String(value60.how)}${value60.why !== undefined ? " \xB7 " + String(value60.why) : ""}${value60.ms !== undefined ? " \xB7 " + String(value60.ms) + " ms" : ""}`,
          };
        case "save-flush":
          return {
            cls: "",
            text: `#${String(value60.n)} ${callback11(value60.paths)} \xB7 ${String(value60.bytes)} B`,
          };
        case "save-ok":
          return {
            cls: "",
            text: `#${String(value60.n)} published in ${String(value60.ms)} ms \u2192 ${abbreviateHotDebugValue(String(value60.version))}`,
          };
        case "save-conflict":
        case "save-error":
          return {
            cls: "error",
            text: `#${String(value60.n)} ${String(value60.code)} after ${String(value60.ms)} ms \xB7 ${callback11(value60.raw ?? "")}`,
          };
        case "boot":
          return {
            cls: "",
            text: String(value60.reason),
          };
        case "boot-phase":
          return {
            cls: "",
            text: `${String(value60.name)} at +${String(value60.ms)} ms`,
          };
        case "read":
          return {
            cls:
              Number(value60.status) >= 400 || value60.status === 0
                ? "warn"
                : "",
            text: `${String(value60.path)} \xB7 ${String(value60.status)} in ${String(value60.ms)} ms${value60.fresh === true ? " (no-store)" : ""}`,
          };
        case "peer-saving":
        case "peer-saved":
          return {
            cls: "",
            text: `${String(value60.from)} #${String(value60.n)}${value60.version !== undefined ? " \u2192 " + abbreviateHotDebugValue(String(value60.version)) : ""} ${callback11(value60.paths ?? [])}`,
          };
        default:
          return {
            cls: "",
            text: callback11(value60),
          };
      }
    }
    function value47(): Dynamic {
      let value60: Dynamic = value37?.querySelector(".bar");
      if (!value60) return;
      value60.setAttribute("data-status", text);
      let callback11: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
      ): Dynamic => {
        let element: Dynamic = value60.querySelector(
          '[data-f="' + input + '"]',
        );
        element &&
          element.textContent !== options2 &&
          (element.textContent = options2);
      };
      callback11("tab", value2);
      callback11("ver", entries.get("on version") ?? "\u2014");
      callback11(
        "hot",
        value === null ? "absent" : (entries.get("hot shape") ?? "present"),
      );
      callback11(
        "status",
        text === "ok"
          ? "level with live"
          : text === "behind"
            ? "behind live"
            : "last update restarted",
      );
    }
    function value48(): Dynamic {
      let value60: Dynamic = state3.text.trim().toLowerCase(),
        items4: Dynamic = [];
      for (
        let value61: Dynamic = value4.length - 1;
        value61 >= 0 && items4.length < HOT_DEBUG_LOG_DEBOUNCE_MS;
        value61--
      ) {
        let value62: Dynamic = value4[value61];
        if (state3.kinds[classifyHotDebugEvent(value62)]) {
          if (value60 !== "") {
            let type: Dynamic = value62.type;
            try {
              type += " " + JSON.stringify(value62.data ?? "");
            } catch {}
            if (!type.toLowerCase().includes(value60)) continue;
          }
          items4.push(value62);
        }
      }
      return items4;
    }
    function value49(): Dynamic {
      if (value39 === null) return;
      let value60: Dynamic = value48(),
        value61: Dynamic = (document as Dynamic).createDocumentFragment();
      for (let value62 of value60 as Dynamic) {
        let value63: Dynamic = value46(value62),
          value64: Dynamic = classifyHotDebugEvent(value62),
          value65: Dynamic = callback9(
            "div",
            "row " + (value64 === "error" ? "error" : value63.cls),
          );
        value65.append(
          callback9("span", "t", formatHotDebugTimestamp(value62.t)),
          callback9("span", "ty", value62.type),
          callback9("span", "s", value63.text),
        );
        value65.title = "click for the raw event";
        value65.addEventListener("click", (): Dynamic => {
          values.has(value62) ? values.delete(value62) : values.add(value62);
          value49();
        });
        value61.append(value65);
        if (values.has(value62)) {
          let text2: Dynamic = "";
          try {
            text2 = JSON.stringify(value62.data ?? {}, null, 1);
          } catch {
            text2 = String(value62.data);
          }
          value61.append(callback9("div", "raw", text2));
        }
      }
      value60.length === 0 &&
        value61.append(
          callback9(
            "div",
            "pad mut",
            value4.length === 0
              ? "Nothing logged yet."
              : "No event matches the filters.",
          ),
        );
      value39.replaceChildren(value61);
    }
    function value50(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
    ): Dynamic {
      let value60: Dynamic = callback9("table", context);
      if (input.some((input2?: Dynamic): Dynamic => input2 !== "")) {
        let value61: Dynamic = callback9("tr");
        for (let value62 of input as Dynamic)
          value61.append(callback9("th", undefined, value62));
        value60.append(value61);
      }
      for (let value61 of options2 as Dynamic) {
        let value62: Dynamic = callback9("tr");
        for (let value63 of value61 as Dynamic)
          value62.append(callback9("td", undefined, String(value63)));
        value60.append(value62);
      }
      return value60;
    }
    function value51(): Dynamic {
      if (value38 === null) return;
      let value60: Dynamic = value38;
      value39 = null;
      value60.replaceChildren();
      if (state3.tab === "events") {
        let value62: Dynamic = callback9("div", "tools");
        for (let value65 of [
          "hot",
          "save",
          "boot",
          "room",
          "error",
          "other",
        ] as Dynamic) {
          let value66: Dynamic = callback9("button", "fchip", value65);
          value66.setAttribute("aria-pressed", String(state3.kinds[value65]));
          value66.addEventListener("click", (): Dynamic => {
            state3.kinds[value65] = !state3.kinds[value65];
            value66.setAttribute("aria-pressed", String(state3.kinds[value65]));
            callback7();
            value49();
          });
          value62.append(value66);
        }
        let value63: Dynamic = callback9("input");
        value63.type = "text";
        value63.placeholder = "filter (path, version, reason\u2026)";
        value63.value = state3.text;
        value63.addEventListener("input", (): Dynamic => {
          state3.text = value63.value;
          callback7();
          value49();
        });
        let value64: Dynamic = callback9(
          "button",
          "fchip",
          state3.paused ? "paused" : "live",
        );
        value64.setAttribute("aria-pressed", String(!state3.paused));
        value64.title = "pause the list (events keep being recorded)";
        value64.addEventListener("click", (): Dynamic => {
          state3.paused = !state3.paused;
          value64.textContent = state3.paused ? "paused" : "live";
          value64.setAttribute("aria-pressed", String(!state3.paused));
          state3.paused || value49();
        });
        value62.append(
          value63,
          value64,
          callback9(
            "span",
            "mut",
            `newest first \xB7 ${String(HOT_DEBUG_LOG_DEBOUNCE_MS)} drawn at most \xB7 ${String(HOT_DEBUG_SAMPLE_PERIOD_MS)} kept`,
          ),
        );
        value39 = callback9("div");
        value60.append(value62, value39);
        value49();
        return;
      }
      let value61: Dynamic = callback9("div", "pad");
      value60.append(value61);
      if (state3.tab === "timing") {
        value61.append(callback9("h4", undefined, "timing \xB7 ms"));
        let value62: Dynamic = [...entries2.entries()].map(
          ([input, input2]: Dynamic): Dynamic => {
            let value66: Dynamic = [...input2].sort(
              (input3?: Dynamic, options2?: Dynamic): Dynamic =>
                input3 - options2,
            );
            return [
              input,
              quantile(value66, 0.5),
              quantile(value66, 0.95),
              value66[value66.length - 1],
              value66.length,
            ];
          },
        );
        value61.append(
          value62.length > 0
            ? value50(["", "p50", "p95", "max", "n"], value62)
            : callback9(
                "div",
                "mut",
                "No samples yet. Save in another tab and watch this one.",
              ),
        );
        index > 0 &&
          value61.append(
            callback9(
              "div",
              "mut",
              `${String(index)} samples taken while this tab was hidden were left out.`,
            ),
          );
        value61.append(
          callback9(
            "h4",
            undefined,
            "save \u2192 visible, newest on the right \xB7 green adopted, red restarted",
          ),
        );
        let value63: Dynamic = callback9("div", "spark"),
          value64: Dynamic = Math.max(
            1,
            ...items.map((input?: Dynamic): Dynamic => input.ms),
          );
        for (let value66 of items as Dynamic) {
          let value67: Dynamic = callback9(
            "i",
            value66.how === "restarted" ? "r" : "",
          );
          value67.style.height =
            String(Math.max(2, Math.round((value66.ms / value64) * 40))) + "px";
          value67.title = value66.how + " \xB7 " + String(value66.ms) + " ms";
          value63.append(value67);
        }
        value61.append(
          items.length > 0 ? value63 : callback9("div", "mut", "\u2014"),
        );
        value61.append(
          callback9("h4", undefined, "boot, from the entry module"),
        );
        let value65: Dynamic = Math.max(
          1,
          ...items3.map((input?: Dynamic): Dynamic => input.ms),
        );
        for (let value66 of items3 as Dynamic) {
          let value67: Dynamic = callback9("div", "wf"),
            value68: Dynamic = callback9("div"),
            value69: Dynamic = callback9("div", "barx");
          value69.style.width =
            String(Math.max(1, Math.round((value66.ms / value65) * 100))) + "%";
          value68.append(value69);
          value67.append(
            callback9("span", undefined, value66.name),
            value68,
            callback9("span", "ms", "+" + String(value66.ms)),
          );
          value61.append(value67);
        }
        items3.length === 0 &&
          value61.append(callback9("div", "mut", "\u2014"));
        if (entries4.size > 0) {
          value61.append(callback9("h4", undefined, "options"));
          for (let [value66, value67] of entries4 as Dynamic) {
            let value68: Dynamic = callback9("label"),
              value69: Dynamic = callback9("input");
            value69.type = "checkbox";
            value69.checked = value67.on;
            value69.addEventListener("change", (): Dynamic => {
              value67.on = value69.checked;
              callback("opt/" + value66, value67.on);
              value16("option", {
                key: value66,
                on: value67.on,
              });
            });
            value68.append(
              value69,
              (document as Dynamic).createTextNode(" " + value67.label),
            );
            value61.append(value68);
          }
        }
        return;
      }
      if (state3.tab === "files") {
        let items4: Dynamic = [];
        try {
          items4 = state.files?.() ?? [];
        } catch {
          items4 = [];
        }
        value61.append(
          callback9(
            "h4",
            undefined,
            `files this tab knows \xB7 ${String(items4.length)}`,
          ),
        );
        if (items4.length === 0) {
          value61.append(
            callback9(
              "div",
              "mut",
              state.files === undefined
                ? "This editor did not provide its file list."
                : "No files.",
            ),
          );
          return;
        }
        let value62: Dynamic = callback9("table", "l"),
          value63: Dynamic = callback9("tr");
        for (let value64 of [
          "path",
          "state",
          "on screen",
          "live",
          "size",
          "last changed at",
        ] as Dynamic)
          value63.append(callback9("th", undefined, value64));
        value62.append(value63);
        for (let value64 of [...items4].sort(
          (input?: Dynamic, options2?: Dynamic): Dynamic =>
            input.path < options2.path ? -1 : 1,
        ) as Dynamic) {
          let value65: Dynamic = callback9("tr"),
            value66: Dynamic = callback9("td");
          for (let value67 of (value64.state ?? "")
            .split(" ")
            .filter(Boolean) as Dynamic)
            value66.append(
              callback9(
                "span",
                "st" +
                  (value67 === "conflicted"
                    ? " b"
                    : value67 === "behind" || value67 === "held"
                      ? " w"
                      : ""),
                value67,
              ),
            );
          value65.append(
            callback9("td", undefined, value64.path),
            value66,
            callback9("td", undefined, (value64.sha ?? "\u2014").slice(0, 10)),
            callback9(
              "td",
              undefined,
              value64.liveSha === undefined
                ? ""
                : (value64.liveSha ?? "removed").slice(0, 10),
            ),
            callback9(
              "td",
              undefined,
              value64.size !== undefined ? String(value64.size) : "",
            ),
            callback9(
              "td",
              undefined,
              abbreviateHotDebugValue(entries3.get(value64.path)),
            ),
          );
          value62.append(value65);
        }
        value61.append(value62);
        return;
      }
      if (state3.tab === "queue") {
        let value62: Dynamic;
        try {
          value62 = state.queue?.();
        } catch {
          value62 = undefined;
        }
        value61.append(callback9("h4", undefined, "now"));
        value61.append(
          value50(
            ["", ""],
            [
              [
                "dirty",
                value62 === undefined
                  ? "(not provided)"
                  : value62.dirty.length === 0
                    ? "none"
                    : value62.dirty.join(", "),
              ],
              [
                "in flight",
                entries5.size > 0
                  ? [...entries5.values()]
                      .map((input?: Dynamic): Dynamic => input.paths.join(", "))
                      .join(" | ")
                  : value62?.inFlight === true
                    ? "yes"
                    : "no",
              ],
              [
                "conflicted",
                value62?.conflicted !== undefined &&
                value62.conflicted.length > 0
                  ? value62.conflicted.join(", ")
                  : "none",
              ],
              [
                "last publish",
                value5 === undefined
                  ? "\u2014"
                  : `#${String(value5.n)} \xB7 ${String(value5.ms)} ms \u2192 ${abbreviateHotDebugValue(value5.version)} \xB7 ${formatHotDebugTimestamp(value5.at)}`,
              ],
              ["queue says", value62?.lastError ?? "ok"],
              ["publishes", String(value24)],
              [
                "errors",
                `409 conflict \xD7${String(state2.conflict)} \xB7 429 rate limit \xD7${String(state2.rate)} \xB7 other \xD7${String(state2.other)}`,
              ],
              [
                "catch-up waits",
                value62?.note ??
                  "this editor does not wait for a newer version before saving yet",
              ],
            ],
            "l",
          ),
        );
        value61.append(
          callback9("h4", undefined, "publish errors, newest first"),
        );
        items2.length === 0 && value61.append(callback9("div", "mut", "none"));
        for (let value63 of [...items2].reverse() as Dynamic) {
          let text2: Dynamic = "";
          try {
            text2 = JSON.stringify(value63.raw ?? {}, null, 1);
          } catch {
            text2 = String(value63.raw);
          }
          let value64: Dynamic = callback9("div", "raw", text2);
          value64.style.marginLeft = "0";
          value61.append(
            callback9(
              "div",
              "mut",
              `${formatHotDebugTimestamp(value63.t)} \xB7 #${String(value63.n)} \xB7 ${String(value63.code)}`,
            ),
            value64,
          );
        }
        return;
      }
      value61.append(
        callback9("h4", undefined, "this tab last loaded because"),
      );
      value61.append(callback9("div", undefined, value10));
      value61.append(callback9("h4", undefined, "counts by reason"));
      value61.append(
        value50(
          ["reason", "times"],
          Object.entries(value12)
            .sort(
              (input?: Dynamic, options2?: Dynamic): Dynamic =>
                options2[1] - input[1],
            )
            .map(([input, input2]: Dynamic): Dynamic => [input, input2]),
        ),
      );
      value61.append(callback9("h4", undefined, "history, newest first"));
      value61.append(
        value50(
          ["when", "reason"],
          [...value13]
            .reverse()
            .map(
              (input?: Dynamic): Dynamic => [
                formatHotDebugTimestamp(input.t),
                input.reason,
              ],
            ),
          "l",
        ),
      );
    }
    function value52(input?: Dynamic, options2?: Dynamic): Dynamic {
      let value60: Dynamic = Math.round(
        (input === "bottom"
          ? (window as Dynamic).innerHeight
          : (window as Dynamic).innerWidth) * 0.8,
      );
      return Math.max(
        HOT_DEBUG_MIN_PANEL_SIZE[input],
        Math.min(value60, Math.round(options2)),
      );
    }
    function value53(): Dynamic {
      if (value37 === null || value35 === null) return;
      value35.className = "t-" + callback10();
      value37.className = "panel " + state3.side;
      let value60: Dynamic = value52(state3.side, state3.size[state3.side]);
      state3.side === "bottom"
        ? ((value37.style.height = String(value60) + "px"),
          (value37.style.width = ""))
        : ((value37.style.width = String(value60) + "px"),
          (value37.style.height = ""));
      value44(state3.open ? state3.side : null, state3.open ? value60 : 0);
    }
    function value54(): Dynamic {
      value37
        ?.querySelectorAll(".tab")
        .forEach(
          (element?: Dynamic): Dynamic =>
            element.setAttribute(
              "aria-selected",
              String(element.getAttribute("data-tab") === state3.tab),
            ),
        );
    }
    function value55(input?: Dynamic): Dynamic {
      state3.open = input;
      flag3 = input;
      input ? callback3() : callback("log", null);
      callback7();
      value36 && (value36.dataset.open = input ? "1" : "0");
      value37 && (value37.style.display = input ? "flex" : "none");
      input ? (value53(), value47(), value54(), value51()) : value44(null, 0);
    }
    function value56(): Dynamic {
      if (value34 === null) return;
      value35 = callback9("div", "t-" + callback10());
      let value60: Dynamic = value35;
      value36 = callback9("div", "chip");
      value36.dataset.status = text;
      value36.dataset.open = "0";
      value36.title = "hot-reload debug panel (" + HOT_DEBUG_SHORTCUT + ")";
      value36.append(
        callback9("span", "dot"),
        callback9("span", undefined, "hot"),
        callback9("span", "mono", value2),
      );
      value36.addEventListener("click", (): Dynamic => value55(true));
      value37 = callback9("div", "panel " + state3.side);
      value37.style.display = "none";
      value37.tabIndex = -1;
      let value61: Dynamic = callback9("div", "grip");
      value61.title = "drag to resize \xB7 double-click to reset";
      value61.addEventListener("dblclick", (): Dynamic => {
        state3.size[state3.side] = HOT_DEBUG_PANEL_SIZE[state3.side];
        callback7();
        value53();
      });
      value61.addEventListener("pointerdown", (event?: Dynamic): Dynamic => {
        event.preventDefault();
        value61.classList.add("on");
        let value66: Dynamic = callback9("div", "shield");
        value66.style.cursor =
          state3.side === "bottom" ? "ns-resize" : "ew-resize";
        value60.append(value66);
        let callback13: Dynamic = (input?: Dynamic): Dynamic => {
            state3.size[state3.side] = value52(
              state3.side,
              state3.side === "bottom"
                ? (window as Dynamic).innerHeight - input.clientY
                : (window as Dynamic).innerWidth - input.clientX,
            );
            value53();
          },
          callback14: Dynamic = (): Dynamic => {
            value66.remove();
            value61.classList.remove("on");
            (window as Dynamic).removeEventListener(
              "pointermove",
              callback13,
              true,
            );
            (window as Dynamic).removeEventListener(
              "pointerup",
              callback14,
              true,
            );
            (window as Dynamic).removeEventListener(
              "pointercancel",
              callback14,
              true,
            );
            callback7();
          };
        (window as Dynamic).addEventListener("pointermove", callback13, true);
        (window as Dynamic).addEventListener("pointerup", callback14, true);
        (window as Dynamic).addEventListener("pointercancel", callback14, true);
      });
      let value62: Dynamic = callback9("div", "bar");
      value62.setAttribute("data-status", text);
      let callback11: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
      ): Dynamic => {
        value62.append(callback9("span", "k", input));
        let value66: Dynamic = callback9("span", "v");
        value66.setAttribute("data-f", options2);
        value62.append(value66);
      };
      value62.append(callback9("span", "dot"));
      let value63: Dynamic = callback9("span");
      value63.setAttribute("data-f", "status");
      value62.append(value63);
      callback11("tab", "tab");
      callback11("version", "ver");
      callback11("claude.hot", "hot");
      value62.append(callback9("span", "sp"));
      let callback12: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let value66: Dynamic = callback9("button", "ib", input);
        value66.title = options2;
        value66.addEventListener("click", context);
        value62.append(value66);
      };
      callback12(
        "dock \u21C4",
        "dock to the other side (bottom / right)",
        (): Dynamic => {
          state3.side = state3.side === "bottom" ? "right" : "bottom";
          callback7();
          value53();
        },
      );
      callback12("clear", "clear the log", (): Dynamic => {
        value4.length = 0;
        values.clear();
        callback("log", value4);
        value51();
      });
      callback12("copy log", "copy the whole log as JSON", (): Dynamic => {
        let value66: Dynamic = value57(),
          flag6: Dynamic = false;
        try {
          navigator.clipboard?.writeText(value66).then(
            (): Dynamic => {
              flag6 = true;
            },
            (): Dynamic => {},
          );
        } catch {}
        setTimeout((): Dynamic => {
          if (flag6 || value38 === null) return;
          value38.querySelector("textarea")?.remove();
          let value67: Dynamic = callback9("textarea");
          value67.readOnly = true;
          value67.value = value66;
          value38.prepend(value67);
        }, 200);
      });
      callback12(
        "\u2715",
        "close (Esc while the panel has focus, or " + HOT_DEBUG_SHORTCUT + ")",
        (): Dynamic => value55(false),
      );
      let value64: Dynamic = callback9("div", "tabs");
      for (let [value66, value67] of [
        ["events", "Events"],
        ["timing", "Timing"],
        ["files", "Files"],
        ["queue", "Save queue"],
        ["reloads", "Reloads"],
      ] as Dynamic) {
        let value68: Dynamic = callback9("button", "tab", value67);
        value68.setAttribute("data-tab", value66);
        value68.addEventListener("click", (): Dynamic => {
          state3.tab = value66;
          callback7();
          value54();
          value51();
        });
        value64.append(value68);
      }
      value38 = callback9("div", "body");
      value37.append(value61, value62, value64, value38);
      value37.addEventListener("keydown", (input?: Dynamic): Dynamic => {
        input.key === "Escape" && (input.stopPropagation(), value55(false));
      });
      value60.append(value36, value37);
      let value65: Dynamic = callback9("style");
      value65.textContent = value45;
      value34.replaceChildren(value65, value60);
      state3.open && value55(true);
      try {
        new MutationObserver((): Dynamic => {
          value35 && (value35.className = "t-" + callback10());
        }).observe((document as Dynamic).documentElement, {
          attributes: true,
          attributeFilter: ["data-theme", "data-mode"],
        });
      } catch {}
      let innerWidth: Dynamic = (window as Dynamic).innerWidth,
        innerHeight: Dynamic = (window as Dynamic).innerHeight;
      (window as Dynamic).addEventListener("resize", (): Dynamic => {
        !state3.open ||
          ((window as Dynamic).innerWidth === innerWidth &&
            (window as Dynamic).innerHeight === innerHeight) ||
          ((innerWidth = (window as Dynamic).innerWidth),
          (innerHeight = (window as Dynamic).innerHeight),
          value53());
      });
      setInterval(value41, 3e3);
    }
    function value57(): Dynamic {
      let state4: Dynamic = {};
      for (let [value62, value63] of entries2 as Dynamic) {
        let value64: Dynamic = [...value63].sort(
          (input?: Dynamic, options2?: Dynamic): Dynamic => input - options2,
        );
        state4[value62] = {
          p50: quantile(value64, 0.5),
          p95: quantile(value64, 0.95),
          max: value64[value64.length - 1],
          n: value64.length,
        };
      }
      let value60: Dynamic, value61: Dynamic;
      try {
        value60 = state.files?.();
      } catch {}
      try {
        value61 = state.queue?.();
      } catch {}
      return JSON.stringify(
        {
          tab: value2,
          reloadReason: value10,
          reasons: value12,
          reloads: value13,
          fields: Object.fromEntries(entries),
          stats: state4,
          excludedHidden: index,
          phases: items3,
          counters: state2,
          publishErrors: items2,
          series: items,
          files: value60,
          queue: value61,
          log: value4,
        },
        null,
        1,
      );
    }
    let flag5: Dynamic = false;
    function value58(): Dynamic {
      if (flag5 || typeof window === "undefined") return;
      flag5 = true;
      let callback11: Dynamic = (input?: Dynamic): Dynamic => {
        try {
          return value37 !== null && input.composedPath().includes(value37);
        } catch {
          return false;
        }
      };
      (window as Dynamic).addEventListener(
        "keydown",
        (event?: Dynamic): Dynamic => {
          if (
            event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            (event.key === "`" || event.code === "Backquote")
          ) {
            event.preventDefault();
            event.stopImmediatePropagation();
            value55(!state3.open);
            return;
          }
          callback11(event) &&
            (event.stopImmediatePropagation(),
            event.key === "Escape" && value55(false));
        },
        true,
      );
      for (let value60 of [
        "keyup",
        "keypress",
        "copy",
        "cut",
        "paste",
        "wheel",
        "contextmenu",
      ] as Dynamic)
        (window as Dynamic).addEventListener(
          value60,
          (input?: Dynamic): Dynamic => {
            callback11(input) && input.stopImmediatePropagation();
          },
          true,
        );
    }
    function value59(input?: Dynamic): Dynamic {
      if (
        input !== "files" ||
        typeof document === "undefined" ||
        value33 !== null
      )
        return;
      value58();
      let callback11: Dynamic = (): Dynamic => {
        value33 === null &&
          ((value33 = (document as Dynamic).createElement("div")),
          value33.setAttribute("data-hot-debug", ""),
          (value33.style.cssText =
            "position:fixed;left:0;top:0;width:0;height:0;z-index:2147483000;pointer-events:none"),
          (value34 = value33.attachShadow({
            mode: "open",
          })),
          (
            (document as Dynamic).body ?? (document as Dynamic).documentElement
          ).appendChild(value33),
          value56());
      };
      (document as Dynamic).body !== null
        ? callback11()
        : (document as Dynamic).addEventListener(
            "DOMContentLoaded",
            callback11,
            {
              once: true,
            },
          );
    }
    value16("boot", {
      reason: value10,
      viaHot: flag2,
      ...(value8 != null
        ? {
            hotFrom: value8,
          }
        : {}),
      ...(value6 !== null
        ? {
            crumb: value6,
          }
        : {}),
    });
    return {
      tab: value2,
      reloadReason: value10,
      field(input: Dynamic, options2: Dynamic): Dynamic {
        entries.set(input, options2);
        value42("header");
      },
      event: value16,
      hotEvent: value28,
      beforeRestart: value29,
      saveStart: value25,
      saveEnd: value26,
      phase: value30,
      read: value31,
      visible: value27,
      sample: value17,
      mount: value59,
      exportJson: value57,
      option: value14,
      provide(input: Dynamic): Dynamic {
        state = {
          ...state,
          ...input,
        };
        value42("files");
        value42("queue");
      },
    };
  }
  function createNoopHotDebugger(): Dynamic {
    let callback: Dynamic = (): Dynamic => {};
    return {
      tab: "",
      reloadReason: "",
      field: callback,
      event: callback,
      hotEvent: callback,
      beforeRestart: callback,
      saveStart: (): Dynamic => 0,
      saveEnd: callback,
      phase: callback,
      read: callback,
      visible: callback,
      sample: callback,
      mount: callback,
      exportJson: (): Dynamic => "{}",
      option: (): Dynamic => (): Dynamic => true,
      provide: callback,
    };
  }
  function createHotDebugger(options?: Dynamic): Dynamic {
    return isFilesDebugEnabled()
      ? createHotReloadDebugger(options)
      : createNoopHotDebugger();
  }
  bindRuntimeValue(
    runtime,
    "classifyHotEditMetric",
    () => classifyHotEditMetric,
  );
  bindRuntimeValue(
    runtime,
    "FILES_DEBUG_STORAGE_KEY",
    () => FILES_DEBUG_STORAGE_KEY,
    (value) => {
      FILES_DEBUG_STORAGE_KEY = value;
    },
  );
  bindRuntimeValue(runtime, "isFilesDebugEnabled", () => isFilesDebugEnabled);
  bindRuntimeValue(
    runtime,
    "HOT_DEBUG_SAMPLE_PERIOD_MS",
    () => HOT_DEBUG_SAMPLE_PERIOD_MS,
    (value) => {
      HOT_DEBUG_SAMPLE_PERIOD_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOT_DEBUG_RENDER_DEBOUNCE_MS",
    () => HOT_DEBUG_RENDER_DEBOUNCE_MS,
    (value) => {
      HOT_DEBUG_RENDER_DEBOUNCE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOT_DEBUG_LOG_DEBOUNCE_MS",
    () => HOT_DEBUG_LOG_DEBOUNCE_MS,
    (value) => {
      HOT_DEBUG_LOG_DEBOUNCE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOT_DEBUG_PANEL_SIZE",
    () => HOT_DEBUG_PANEL_SIZE,
    (value) => {
      HOT_DEBUG_PANEL_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOT_DEBUG_MIN_PANEL_SIZE",
    () => HOT_DEBUG_MIN_PANEL_SIZE,
    (value) => {
      HOT_DEBUG_MIN_PANEL_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOT_DEBUG_SHORTCUT",
    () => HOT_DEBUG_SHORTCUT,
    (value) => {
      HOT_DEBUG_SHORTCUT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createHotDebugTabId",
    () => createHotDebugTabId,
    (value) => {
      createHotDebugTabId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "formatHotDebugTimestamp",
    () => formatHotDebugTimestamp,
    (value) => {
      formatHotDebugTimestamp = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "abbreviateHotDebugValue",
    () => abbreviateHotDebugValue,
    (value) => {
      abbreviateHotDebugValue = value;
    },
  );
  bindRuntimeValue(runtime, "quantile", () => quantile);
  bindRuntimeValue(
    runtime,
    "classifyHotDebugEvent",
    () => classifyHotDebugEvent,
  );
  bindRuntimeValue(
    runtime,
    "createHotReloadDebugger",
    () => createHotReloadDebugger,
  );
  bindRuntimeValue(
    runtime,
    "createNoopHotDebugger",
    () => createNoopHotDebugger,
  );
  bindRuntimeValue(runtime, "createHotDebugger", () => createHotDebugger);
  return () => {
    FILES_DEBUG_STORAGE_KEY = "appifact-files-debug";
    HOT_DEBUG_SAMPLE_PERIOD_MS = 1500;
    HOT_DEBUG_RENDER_DEBOUNCE_MS = 150;
    HOT_DEBUG_LOG_DEBOUNCE_MS = 250;
    HOT_DEBUG_PANEL_SIZE = {
      bottom: 300,
      right: 440,
    };
    HOT_DEBUG_MIN_PANEL_SIZE = {
      bottom: 140,
      right: 300,
    };
    HOT_DEBUG_SHORTCUT = "Ctrl+`";
    createHotDebugTabId = (): Dynamic => Math.random().toString(36).slice(2, 6);
    formatHotDebugTimestamp = (input?: Dynamic): Dynamic =>
      new Date(input).toISOString().slice(11, 23);
    abbreviateHotDebugValue = (items?: Dynamic): Dynamic =>
      items == null || items === ""
        ? "\u2014"
        : items.length > 18
          ? items.slice(0, 10) + "\u2026" + items.slice(-4)
          : items;
  };
}
